from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import schemas
from ..auth import get_current_user, require_customer, require_staff
from ..database import get_db
from ..email_utils import send_routing_email
from ..models import Ticket, Reply, User, Attachment, RoutingLog
from ..nlp import pipeline
from ..nlp import semantic_search
from ..nlp.routing import ROUTING

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


def _next_code(db: Session) -> str:
    last = db.query(Ticket).order_by(Ticket.id.desc()).first()
    base = 29481
    n = base + (last.id if last else 0) + 1
    return f"TKT-{n}"


def _refresh_index(db: Session) -> None:
    """Rebuild the semantic-search index from training examples + resolved tickets."""
    from ..models import TrainingExample
    docs = []
    for tr in db.query(TrainingExample).all():
        docs.append({"id": f"TR-{tr.id}", "text": tr.text, "intent": tr.intent,
                     "summary": tr.text[:120]})
    for tk in db.query(Ticket).filter(Ticket.status.in_(["auto-resolved", "resolved"])).all():
        docs.append({
            "id": tk.code,
            "text": f"{tk.subject}. {tk.body}",
            "intent": tk.intent,
            "summary": tk.summary or tk.subject,
        })
    semantic_search.get_index().build(docs)


@router.post("/process", response_model=schemas.TicketCreatedOut)
def process_query(
    payload: schemas.ProcessQueryIn,
    db: Session = Depends(get_db),
    customer: User = Depends(require_customer),
):
    """Run the NLP pipeline on a customer query and persist a new ticket.

    Only authenticated customers may submit tickets — staff accounts (agent /
    manager / admin) get a 403.
    """
    semantic_search.get_index()  # touch
    if semantic_search.get_index().vectorizer is None:
        _refresh_index(db)

    nlp = pipeline.process(payload.query, customer_name=customer.name)

    code = _next_code(db)
    subject = _derive_subject(payload.query, nlp["intent"])
    ticket = Ticket(
        code=code,
        subject=subject,
        body=payload.query.strip(),
        channel=payload.channel,
        customer_id=customer.id,
        intent=nlp["intent"],
        intent_confidence=nlp["intent_confidence"],
        sentiment=nlp["sentiment"],
        urgency=nlp["urgency"],
        keywords=nlp["keywords"],
        entities=nlp["entities"],
        summary=nlp["summary"],
        recommended_action=nlp["recommended_action"],
        auto_reply=nlp["auto_reply"],
        route=nlp["ticket_route"],
        status="ai-suggested",
        ai_assisted=True,
    )
    db.add(ticket)
    db.flush()

    # Save the AI-drafted reply
    db.add(Reply(
        ticket_id=ticket.id,
        body=nlp["auto_reply"],
        is_ai_draft=True,
        edited_by_agent=False,
        sent=False,
    ))

    # Persist any attachment metadata
    for att in payload.attachments or []:
        db.add(Attachment(
            ticket_id=ticket.id,
            filename=att.get("filename", "attachment"),
            size_bytes=int(att.get("size_bytes", 0)),
            content_type=att.get("content_type", "application/octet-stream"),
        ))

    db.commit()
    return {"ticket_id": code, "nlp": nlp}


def _derive_subject(text: str, intent: str) -> str:
    first = (text or "").strip().split(".", 1)[0]
    first = first.strip()
    if 8 <= len(first) <= 90:
        return first
    return f"{intent} — {first[:60]}"


@router.get("", response_model=list[schemas.TicketOut])
def list_tickets(
    status: Optional[str] = None,
    urgency: Optional[str] = None,
    intent: Optional[str] = None,
    q: Optional[str] = None,
    assignee: Optional[str] = Query(
        None,
        description=(
            "Filter by assignee. Pass 'me' for the current user, 'unassigned' "
            "for tickets with no assignee, or a numeric user id."
        ),
    ),
    has_draft: Optional[bool] = Query(
        None,
        description=(
            "If true, only return tickets that have an unsent reply edited by "
            "an agent (a draft in progress)."
        ),
    ),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    query = db.query(Ticket).order_by(Ticket.created_at.desc())
    if status and status != "All":
        query = query.filter(Ticket.status == status)
    if urgency and urgency != "All":
        query = query.filter(Ticket.urgency == urgency)
    if intent and intent != "All":
        query = query.filter(Ticket.intent == intent)
    if assignee:
        if assignee == "me":
            query = query.filter(Ticket.assignee_id == user.id)
        elif assignee == "unassigned":
            query = query.filter(Ticket.assignee_id.is_(None))
        else:
            try:
                query = query.filter(Ticket.assignee_id == int(assignee))
            except ValueError:
                raise HTTPException(400, "assignee must be 'me', 'unassigned', or a user id")
    if has_draft:
        draft_ticket_ids = (
            db.query(Reply.ticket_id)
            .filter(Reply.sent == False, Reply.edited_by_agent == True)  # noqa: E712
            .distinct()
        )
        query = query.filter(Ticket.id.in_(draft_ticket_ids))
    if q:
        like = f"%{q}%"
        query = query.filter((Ticket.subject.ilike(like)) | (Ticket.body.ilike(like)) | (Ticket.code.ilike(like)))
    rows = query.limit(limit).all()
    return [r.to_summary_dict() for r in rows]


@router.get("/{code}", response_model=schemas.TicketDetailOut)
def get_ticket(
    code: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Customers can only see their own tickets; staff see all.
    if user.role == "customer":
        owned = (
            db.query(Ticket)
            .filter(Ticket.code == code, Ticket.customer_id == user.id)
            .first()
        )
        if not owned:
            raise HTTPException(404, "Ticket not found")
    t = db.query(Ticket).filter(Ticket.code == code).first()
    if not t:
        raise HTTPException(404, "Ticket not found")

    summary = t.to_summary_dict()

    # Include similar tickets — recompute against the live index
    if semantic_search.get_index().vectorizer is None:
        _refresh_index(db)
    similar = semantic_search.get_index().search(f"{t.subject}. {t.body}", k=3)
    # Filter the current ticket out
    similar = [s for s in similar if s.get("id") != t.code]

    replies = [{
        "id": r.id, "body": r.body, "is_ai_draft": r.is_ai_draft,
        "edited_by_agent": r.edited_by_agent, "sent": r.sent,
        "created_at": r.created_at,
    } for r in t.replies]

    attachments = [{
        "id": a.id, "filename": a.filename, "size_bytes": a.size_bytes,
        "content_type": a.content_type,
    } for a in t.attachments]

    routing_rows = (
        db.query(RoutingLog)
        .filter(RoutingLog.ticket_id == t.id)
        .order_by(RoutingLog.created_at.desc())
        .all()
    )
    routing_history = [{
        "id": r.id,
        "department": r.department,
        "recipient_email": r.recipient_email,
        "subject": r.subject,
        "message": r.message,
        "delivery_status": r.delivery_status,
        "delivery_detail": r.delivery_detail or "",
        "routed_by": r.routed_by.name if r.routed_by else None,
        "created_at": r.created_at,
    } for r in routing_rows]

    return {
        **summary,
        "body": t.body,
        "entities": t.entities or {},
        "summary": t.summary,
        "recommended_action": t.recommended_action,
        "auto_reply": t.auto_reply,
        "similar_tickets": similar,
        "replies": replies,
        "attachments": attachments,
        "routing_history": routing_history,
    }


@router.patch("/{code}/reply")
def update_reply(
    code: str,
    payload: schemas.ReplyUpdateIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    t = db.query(Ticket).filter(Ticket.code == code).first()
    if not t:
        raise HTTPException(404, "Ticket not found")
    # Update or create the latest draft reply
    draft = (
        db.query(Reply)
        .filter(Reply.ticket_id == t.id, Reply.sent == False)  # noqa: E712
        .order_by(Reply.id.desc())
        .first()
    )
    if not draft:
        draft = Reply(ticket_id=t.id, body=payload.body, is_ai_draft=False)
        db.add(draft)
    else:
        draft.body = payload.body
        draft.edited_by_agent = payload.edited_by_agent
    t.auto_reply = payload.body
    db.commit()
    return {"ok": True}


@router.post("/{code}/regenerate")
def regenerate(
    code: str,
    payload: schemas.RegenerateReplyIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    t = db.query(Ticket).filter(Ticket.code == code).first()
    if not t:
        raise HTTPException(404, "Ticket not found")
    nlp = pipeline.process(t.body, customer_name=t.customer.name if t.customer else None,
                           tone=payload.tone)
    # Update fields that may have shifted
    t.auto_reply = nlp["auto_reply"]
    t.recommended_action = nlp["recommended_action"]
    # Persist as new draft
    db.add(Reply(ticket_id=t.id, body=nlp["auto_reply"], is_ai_draft=True))
    db.commit()
    return {
        "auto_reply": nlp["auto_reply"],
        "tone": payload.tone,
        "reply_source": nlp.get("reply_source", "template"),
    }


@router.post("/{code}/send")
def send_reply(
    code: str,
    payload: schemas.SendReplyIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    t = db.query(Ticket).filter(Ticket.code == code).first()
    if not t:
        raise HTTPException(404, "Ticket not found")
    body = payload.body or t.auto_reply
    if not body:
        raise HTTPException(400, "No reply body to send")
    reply = Reply(
        ticket_id=t.id,
        author_id=user.id,
        body=body,
        sent=True,
        edited_by_agent=bool(payload.body),
    )
    db.add(reply)
    # The agent's send marks the ticket resolved. If the customer replies
    # afterwards, the conversation reopens to "needs-review" so the queue
    # surfaces it.
    t.status = "resolved"
    t.resolved_at = datetime.now(timezone.utc)
    if t.created_at:
        # Compute resolution time
        created = t.created_at if t.created_at.tzinfo else t.created_at.replace(tzinfo=timezone.utc)
        t.resolution_seconds = int((t.resolved_at - created).total_seconds())
    db.commit()
    return {"ok": True, "status": t.status}


@router.post("/{code}/status")
def update_status(
    code: str,
    payload: schemas.TicketStatusUpdateIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    t = db.query(Ticket).filter(Ticket.code == code).first()
    if not t:
        raise HTTPException(404, "Ticket not found")
    t.status = payload.status
    if payload.csat is not None:
        t.csat = payload.csat
    if payload.status in ("resolved", "auto-resolved") and not t.resolved_at:
        t.resolved_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


# ── Department directory ──────────────────────────────────────────
# Default contact emails per department. Overridable via env vars
# (e.g. DEPT_EMAIL_FINANCE) so the demo works with real inboxes.
_DEPT_EMAIL_DEFAULTS = {
    "Finance Team":          "finance@resolveai.app",
    "Logistics Team":        "logistics@resolveai.app",
    "Support Team":          "support@resolveai.app",
    "Fraud / Security Team": "security@resolveai.app",
    "Engineering Team":      "engineering@resolveai.app",
    "Customer Success Team": "success@resolveai.app",
}


def _dept_email(name: str) -> str:
    import os
    # Build env-var key: "Finance Team" → DEPT_EMAIL_FINANCE
    short = name.split()[0].upper()
    return os.getenv(f"DEPT_EMAIL_{short}", "").strip() or _DEPT_EMAIL_DEFAULTS.get(name, "")


@router.get("/_meta/departments", response_model=list[schemas.DepartmentOut])
def list_departments(_: User = Depends(require_staff)):
    """All known routing destinations + their default contact email."""
    intent_map: dict[str, list[str]] = {}
    for intent, dept in ROUTING.items():
        intent_map.setdefault(dept, []).append(intent)
    out: list[dict] = []
    for name in _DEPT_EMAIL_DEFAULTS.keys():
        out.append({
            "name": name,
            "email": _dept_email(name),
            "intents": sorted(intent_map.get(name, [])),
        })
    return out


@router.post("/{code}/assign", response_model=schemas.TicketOut)
def assign_ticket(
    code: str,
    payload: schemas.AssignTicketIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    """Assign or unassign a ticket. `to_me=True` shortcut assigns to caller."""
    t = db.query(Ticket).filter(Ticket.code == code).first()
    if not t:
        raise HTTPException(404, "Ticket not found")

    if payload.to_me:
        t.assignee_id = user.id
    else:
        if payload.assignee_id is not None:
            target = db.query(User).filter(User.id == payload.assignee_id).first()
            if not target:
                raise HTTPException(404, "Assignee user not found")
            if target.role not in ("agent", "manager", "admin"):
                raise HTTPException(400, "Can only assign to staff users")
            t.assignee_id = target.id
        else:
            t.assignee_id = None  # unassign
    db.commit()
    db.refresh(t)
    return t.to_summary_dict()


@router.post("/{code}/route")
def route_ticket(
    code: str,
    payload: schemas.RouteTicketIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    """Forward a ticket to another department by email and log the event."""
    t = db.query(Ticket).filter(Ticket.code == code).first()
    if not t:
        raise HTTPException(404, "Ticket not found")

    subject = (payload.subject or
               f"[{t.code}] Routed to {payload.department} — {t.subject}")
    # Compose a richer body that includes the original ticket context so the
    # receiving team has everything they need without opening the app.
    customer_line = (
        f"Customer: {t.customer.name} <{t.customer.email}>"
        if t.customer else "Customer: —"
    )
    routed_by_line = f"Routed by: {user.name} <{user.email}>"
    full_body = (
        f"{payload.message.strip()}\n\n"
        f"────────────────────────────\n"
        f"Ticket: {t.code}\n"
        f"Subject: {t.subject}\n"
        f"Intent: {t.intent or '—'} · Urgency: {t.urgency or '—'}\n"
        f"{customer_line}\n"
        f"{routed_by_line}\n\n"
        f"Original message:\n{t.body}\n"
    )

    status_, detail = send_routing_email(
        to_email=payload.recipient_email,
        subject=subject,
        body=full_body,
        cc=payload.cc or None,
    )

    log = RoutingLog(
        ticket_id=t.id,
        routed_by_id=user.id,
        department=payload.department,
        recipient_email=payload.recipient_email,
        subject=subject,
        message=payload.message,
        delivery_status=status_,
        delivery_detail=detail,
    )
    db.add(log)

    # Reflect the routing on the ticket itself
    t.route = payload.department
    if payload.mark_escalated and t.status not in ("resolved", "auto-resolved"):
        t.status = "escalated"

    db.commit()
    db.refresh(log)
    return {
        "ok": True,
        "delivery_status": status_,
        "delivery_detail": detail,
        "ticket_status": t.status,
        "log_id": log.id,
    }


# ─────────────────────────────────────────────────────────────
# Chat / live-conversation endpoints
# ─────────────────────────────────────────────────────────────


def _initials(name: str) -> str:
    parts = [p for p in (name or "").split() if p]
    return ("".join(p[0] for p in parts[:2]) or "U").upper()


def _build_messages(t: Ticket, since_id: int = 0) -> list[dict]:
    """Build the customer-visible message thread for a ticket.

    Includes the ticket body as a synthetic message #0 (always from the
    customer) plus every Reply with `sent=True`, ordered by created_at.
    """
    messages: list[dict] = []

    # The original ticket body is message #0 — only include it on the
    # initial fetch (since_id == 0).
    if since_id <= 0 and t.customer:
        messages.append({
            "id": 0,
            "ticket_id": t.code,
            "sender_role": "customer",
            "sender_name": t.customer.name,
            "sender_initials": t.customer.initials or _initials(t.customer.name),
            "body": t.body,
            "is_ai": False,
            "is_system": False,
            "created_at": t.created_at,
        })

    for r in sorted(t.replies, key=lambda x: x.created_at or datetime.min):
        if not r.sent:
            continue
        if r.id <= since_id:
            continue
        author = r.author
        if author and author.id == t.customer_id:
            sender_role = "customer"
            sender_name = author.name
            sender_initials = author.initials or _initials(author.name)
            is_ai = False
        elif author:
            sender_role = author.role  # agent | manager | admin
            sender_name = author.name
            sender_initials = author.initials or _initials(author.name)
            is_ai = False
        else:
            # No author → AI assistant (template/LLM auto-reply)
            sender_role = "ai"
            sender_name = "ResolveAI Assistant"
            sender_initials = "AI"
            is_ai = True

        messages.append({
            "id": r.id,
            "ticket_id": t.code,
            "sender_role": sender_role,
            "sender_name": sender_name,
            "sender_initials": sender_initials,
            "body": r.body,
            "is_ai": is_ai,
            "is_system": False,
            "created_at": r.created_at,
        })

    return messages


def _ticket_status_snapshot(t: Ticket) -> dict:
    last_id = max(
        [r.id for r in t.replies if r.sent] or [0],
        default=0,
    )
    return {
        "id": t.code,
        "status": t.status,
        "assignee_name": t.assignee.name if t.assignee else None,
        "assignee_initials": (
            t.assignee.initials or _initials(t.assignee.name) if t.assignee else None
        ),
        "is_typing": False,
        "updated_at": t.updated_at,
        "last_message_id": last_id,
    }


def _ticket_for_user(db: Session, code: str, user: User) -> Ticket:
    """Resolve a ticket the user is permitted to see, or 404."""
    t = db.query(Ticket).filter(Ticket.code == code).first()
    if not t:
        raise HTTPException(404, "Ticket not found")
    if user.role == "customer" and t.customer_id != user.id:
        raise HTTPException(404, "Ticket not found")
    return t


@router.get("/{code}/messages", response_model=schemas.ChatPollOut)
def list_messages(
    code: str,
    since: int = Query(0, ge=0, description="Return messages with id > since"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List the chat thread for a ticket. Customers see only their own
    tickets; staff see any. Pass `since` (the highest id you already have)
    to fetch only new messages — the polling client uses this."""
    t = _ticket_for_user(db, code, user)
    return {
        "messages": _build_messages(t, since_id=since),
        "status": _ticket_status_snapshot(t),
    }


@router.post("/{code}/messages", response_model=schemas.ChatMessageOut)
def post_message(
    code: str,
    payload: schemas.CustomerReplyIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Post a new chat message — used by both customer (follow-up) and
    staff (agent reply via chat). For customers, this also reopens a
    resolved ticket."""
    t = _ticket_for_user(db, code, user)

    body = payload.body.strip()
    if not body:
        raise HTTPException(400, "Message body cannot be empty")

    reply = Reply(
        ticket_id=t.id,
        author_id=user.id,
        body=body,
        is_ai_draft=False,
        edited_by_agent=(user.role != "customer"),
        sent=True,
    )
    db.add(reply)

    # Customer replying after resolution → reopen for review
    if user.role == "customer" and t.status in ("resolved", "auto-resolved"):
        t.status = "needs-review"
        t.resolved_at = None

    # Update updated_at via SQLAlchemy onupdate
    db.commit()
    db.refresh(reply)

    role = "customer" if user.role == "customer" else user.role
    return {
        "id": reply.id,
        "ticket_id": t.code,
        "sender_role": role,
        "sender_name": user.name,
        "sender_initials": user.initials or _initials(user.name),
        "body": reply.body,
        "is_ai": False,
        "is_system": False,
        "created_at": reply.created_at,
    }


@router.get("/customer/me", response_model=list[schemas.CustomerTicketSummary])
def my_tickets(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """A customer's own tickets — used by the 'My tickets' panel on the
    help portal so they can resume conversations."""
    if user.role != "customer":
        # Staff don't have a 'my tickets as customer' list
        return []
    rows = (
        db.query(Ticket)
        .filter(Ticket.customer_id == user.id)
        .order_by(Ticket.updated_at.desc(), Ticket.created_at.desc())
        .limit(50)
        .all()
    )
    out = []
    for t in rows:
        # Last sent reply (any author) becomes the preview line
        sent_replies = sorted(
            [r for r in t.replies if r.sent],
            key=lambda r: r.created_at or datetime.min,
        )
        last = sent_replies[-1] if sent_replies else None
        last_msg_at = last.created_at if last else t.created_at
        last_preview = (last.body if last else t.body or "")[:140]

        # Count agent replies the customer hasn't "read" — simple heuristic:
        # any agent reply newer than the customer's most recent reply.
        last_customer_at = max(
            [r.created_at for r in t.replies if r.sent and r.author_id == user.id]
            + [t.created_at],
            default=t.created_at,
        )
        unread = sum(
            1 for r in sent_replies
            if r.author_id != user.id and (r.created_at or datetime.min) > last_customer_at
        )

        out.append({
            "id": t.code,
            "subject": t.subject,
            "status": t.status,
            "intent": t.intent,
            "urgency": t.urgency,
            "last_message_preview": last_preview,
            "last_message_at": last_msg_at,
            "unread_from_agent": unread,
            "created_at": t.created_at,
        })
    return out
