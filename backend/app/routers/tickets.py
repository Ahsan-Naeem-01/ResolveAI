from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..models import Ticket, Reply, User, Attachment
from ..nlp import pipeline
from ..nlp import semantic_search

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


def _next_code(db: Session) -> str:
    last = db.query(Ticket).order_by(Ticket.id.desc()).first()
    base = 29481
    n = base + (last.id if last else 0) + 1
    return f"TKT-{n}"


def _ensure_customer(db: Session, *, name: Optional[str], email: Optional[str]) -> User:
    """Find-or-create the customer user from a (name, email) pair."""
    if email:
        user = db.query(User).filter(User.email == email).first()
        if user:
            return user
    if not name:
        name = "Anonymous Customer"
    if not email:
        email = f"guest+{int(datetime.now().timestamp())}@example.com"
    initials = "".join(part[0] for part in name.split()[:2]).upper() or "AC"
    user = User(email=email, name=name, role="customer", initials=initials, title="")
    db.add(user)
    db.flush()
    return user


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
def process_query(payload: schemas.ProcessQueryIn, db: Session = Depends(get_db)):
    """Run the NLP pipeline on a customer query and persist a new ticket."""
    semantic_search.get_index()  # touch
    if semantic_search.get_index().vectorizer is None:
        _refresh_index(db)

    customer = _ensure_customer(db, name=payload.customer_name, email=payload.customer_email)
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
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(Ticket).order_by(Ticket.created_at.desc())
    if status and status != "All":
        query = query.filter(Ticket.status == status)
    if urgency and urgency != "All":
        query = query.filter(Ticket.urgency == urgency)
    if intent and intent != "All":
        query = query.filter(Ticket.intent == intent)
    if q:
        like = f"%{q}%"
        query = query.filter((Ticket.subject.ilike(like)) | (Ticket.body.ilike(like)) | (Ticket.code.ilike(like)))
    rows = query.limit(limit).all()
    return [r.to_summary_dict() for r in rows]


@router.get("/{code}", response_model=schemas.TicketDetailOut)
def get_ticket(code: str, db: Session = Depends(get_db)):
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
    }


@router.patch("/{code}/reply")
def update_reply(code: str, payload: schemas.ReplyUpdateIn, db: Session = Depends(get_db)):
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
def regenerate(code: str, payload: schemas.RegenerateReplyIn, db: Session = Depends(get_db)):
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
    return {"auto_reply": nlp["auto_reply"], "tone": payload.tone}


@router.post("/{code}/send")
def send_reply(code: str, payload: schemas.SendReplyIn, db: Session = Depends(get_db)):
    t = db.query(Ticket).filter(Ticket.code == code).first()
    if not t:
        raise HTTPException(404, "Ticket not found")
    body = payload.body or t.auto_reply
    if not body:
        raise HTTPException(400, "No reply body to send")
    reply = Reply(ticket_id=t.id, body=body, sent=True, edited_by_agent=bool(payload.body))
    db.add(reply)
    t.status = "resolved"
    t.resolved_at = datetime.now(timezone.utc)
    if t.created_at:
        # Compute resolution time
        created = t.created_at if t.created_at.tzinfo else t.created_at.replace(tzinfo=timezone.utc)
        t.resolution_seconds = int((t.resolved_at - created).total_seconds())
    db.commit()
    return {"ok": True, "status": t.status}


@router.post("/{code}/status")
def update_status(code: str, payload: schemas.TicketStatusUpdateIn, db: Session = Depends(get_db)):
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
