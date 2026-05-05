"""Knowledge-base API: CRUD, search, suggestions, and feedback for articles."""
from __future__ import annotations
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..models import KBArticle, Ticket
from ..nlp.semantic_search import SemanticIndex

router = APIRouter(prefix="/api/kb", tags=["knowledge-base"])


# ── Slug helpers ────────────────────────────────────────────────────

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slugify(s: str) -> str:
    s = (s or "").strip().lower()
    s = _SLUG_RE.sub("-", s).strip("-")
    return s[:80] or "article"


def _unique_slug(db: Session, base: str, *, exclude_id: int | None = None) -> str:
    """Append -2, -3, … if the slug already exists (excluding the given id)."""
    candidate = base
    suffix = 2
    while True:
        q = db.query(KBArticle).filter(KBArticle.slug == candidate)
        if exclude_id is not None:
            q = q.filter(KBArticle.id != exclude_id)
        if not q.first():
            return candidate
        candidate = f"{base}-{suffix}"
        suffix += 1


# ── Search index (built lazily on first use, refreshed on writes) ───
# Uses the same TF-IDF + cosine implementation as ticket semantic-search,
# but kept on its own instance so it doesn't pollute the ticket index.

_kb_index: SemanticIndex | None = None


def _doc_for(a: KBArticle) -> dict:
    tags = " ".join(a.tags or [])
    body = a.body or ""
    return {
        "id": a.slug,
        "text": f"{a.title}. {a.summary or ''} {body} {tags}",
        "intent": a.intent or "",
        "summary": a.summary or (a.title or ""),
    }


def _rebuild_index(db: Session) -> None:
    global _kb_index
    _kb_index = SemanticIndex()
    docs = [
        _doc_for(a)
        for a in db.query(KBArticle).filter(KBArticle.status == "published").all()
    ]
    if docs:
        _kb_index.build(docs)


def _ensure_index(db: Session) -> None:
    if _kb_index is None or _kb_index.vectorizer is None:
        _rebuild_index(db)


def invalidate_index() -> None:
    """Called after writes — forces a rebuild on the next read."""
    global _kb_index
    _kb_index = None


# ── Endpoints ───────────────────────────────────────────────────────


@router.get("", response_model=list[schemas.KBArticleSummary])
def list_articles(
    q: Optional[str] = Query(None, description="Free-text search across title/body/tags"),
    category: Optional[str] = None,
    status: Optional[str] = None,
    intent: Optional[str] = None,
    tag: Optional[str] = None,
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
):
    query = db.query(KBArticle)
    if status and status != "all":
        query = query.filter(KBArticle.status == status)
    if category and category != "All":
        query = query.filter(KBArticle.category == category)
    if intent and intent != "All":
        query = query.filter(KBArticle.intent == intent)

    if q:
        # If we have a published index, use it for relevance ranking.
        if status in (None, "published"):
            _ensure_index(db)
            if _kb_index and _kb_index.vectorizer is not None:
                hits = _kb_index.search(q, k=limit)
                slugs = [h["id"] for h in hits]
                if slugs:
                    rows = (
                        query.filter(KBArticle.slug.in_(slugs)).all()
                    )
                    by_slug = {r.slug: r for r in rows}
                    ordered = [by_slug[s] for s in slugs if s in by_slug]
                    if tag:
                        ordered = [a for a in ordered if tag in (a.tags or [])]
                    return [a.to_summary_dict() for a in ordered[:limit]]
        # Fallback: ILIKE across title/summary/body
        like = f"%{q}%"
        query = query.filter(
            or_(
                KBArticle.title.ilike(like),
                KBArticle.summary.ilike(like),
                KBArticle.body.ilike(like),
            )
        )

    rows = query.order_by(KBArticle.updated_at.desc()).limit(limit).all()
    if tag:
        rows = [r for r in rows if tag in (r.tags or [])]
    return [r.to_summary_dict() for r in rows]


@router.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    """Return categories with counts. Used by the sidebar in the KB UI."""
    rows = db.query(KBArticle).filter(KBArticle.status == "published").all()
    counts: dict[str, int] = {}
    tags: dict[str, int] = {}
    for r in rows:
        cat = r.category or "General"
        counts[cat] = counts.get(cat, 0) + 1
        for t in r.tags or []:
            tags[t] = tags.get(t, 0) + 1
    return {
        "total": len(rows),
        "categories": [
            {"name": k, "count": v}
            for k, v in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
        ],
        "tags": [
            {"name": k, "count": v}
            for k, v in sorted(tags.items(), key=lambda kv: (-kv[1], kv[0]))
        ],
    }


@router.get("/suggest", response_model=list[schemas.KBArticleSummary])
def suggest_for_ticket(
    ticket: str = Query(..., description="Ticket code, e.g. TKT-29485"),
    k: int = Query(3, le=10),
    db: Session = Depends(get_db),
):
    t = db.query(Ticket).filter(Ticket.code == ticket).first()
    if not t:
        raise HTTPException(404, "Ticket not found")

    _ensure_index(db)
    if not _kb_index or _kb_index.vectorizer is None:
        return []
    hits = _kb_index.search(f"{t.subject}. {t.body}", k=k)
    slugs = [h["id"] for h in hits]
    if not slugs:
        # Fallback to articles tagged with the same intent
        rows = (
            db.query(KBArticle)
            .filter(KBArticle.intent == t.intent, KBArticle.status == "published")
            .limit(k)
            .all()
        )
        return [r.to_summary_dict() for r in rows]
    rows = db.query(KBArticle).filter(KBArticle.slug.in_(slugs)).all()
    by_slug = {r.slug: r for r in rows}
    return [by_slug[s].to_summary_dict() for s in slugs if s in by_slug]


@router.get("/{slug}", response_model=schemas.KBArticleOut)
def get_article(slug: str, db: Session = Depends(get_db)):
    a = db.query(KBArticle).filter(KBArticle.slug == slug).first()
    if not a:
        raise HTTPException(404, "Article not found")
    a.views = (a.views or 0) + 1
    db.commit()
    return a.to_detail_dict()


@router.post("", response_model=schemas.KBArticleOut, status_code=201)
def create_article(payload: schemas.KBArticleCreateIn, db: Session = Depends(get_db)):
    if payload.status not in ("draft", "published", "archived"):
        raise HTTPException(400, "Invalid status")
    base_slug = _slugify(payload.slug or payload.title)
    slug = _unique_slug(db, base_slug)
    a = KBArticle(
        slug=slug,
        title=payload.title.strip(),
        summary=payload.summary.strip(),
        body=payload.body,
        category=payload.category or "General",
        intent=payload.intent,
        tags=payload.tags or [],
        status=payload.status,
    )
    db.add(a)
    db.commit()
    invalidate_index()
    return a.to_detail_dict()


@router.patch("/{slug}", response_model=schemas.KBArticleOut)
def update_article(
    slug: str, payload: schemas.KBArticleUpdateIn, db: Session = Depends(get_db)
):
    a = db.query(KBArticle).filter(KBArticle.slug == slug).first()
    if not a:
        raise HTTPException(404, "Article not found")
    data = payload.model_dump(exclude_unset=True)
    if "status" in data and data["status"] not in ("draft", "published", "archived"):
        raise HTTPException(400, "Invalid status")
    if "title" in data and data["title"]:
        a.title = data["title"].strip()
        # If slug looks auto-derived, refresh it for the new title.
        if a.slug == _slugify(a.slug) == _slugify(a.title):
            pass  # already aligned
    for key in ("summary", "body", "category", "intent", "tags", "status"):
        if key in data:
            setattr(a, key, data[key])
    db.commit()
    invalidate_index()
    return a.to_detail_dict()


@router.delete("/{slug}")
def delete_article(slug: str, db: Session = Depends(get_db)):
    """Soft-delete: mark archived. Use ?hard=true to fully remove."""
    a = db.query(KBArticle).filter(KBArticle.slug == slug).first()
    if not a:
        raise HTTPException(404, "Article not found")
    a.status = "archived"
    db.commit()
    invalidate_index()
    return {"ok": True, "status": a.status}


@router.post("/{slug}/feedback")
def submit_feedback(
    slug: str, payload: schemas.KBFeedbackIn, db: Session = Depends(get_db)
):
    a = db.query(KBArticle).filter(KBArticle.slug == slug).first()
    if not a:
        raise HTTPException(404, "Article not found")
    if payload.helpful:
        a.helpful = (a.helpful or 0) + 1
    else:
        a.not_helpful = (a.not_helpful or 0) + 1
    db.commit()
    return {"ok": True, "helpful": a.helpful, "not_helpful": a.not_helpful}


@router.post("/{slug}/insert")
def mark_inserted(slug: str, db: Session = Depends(get_db)):
    """Increment the 'inserted into reply' counter (called when an agent uses an article)."""
    a = db.query(KBArticle).filter(KBArticle.slug == slug).first()
    if not a:
        raise HTTPException(404, "Article not found")
    a.inserted_in_replies = (a.inserted_in_replies or 0) + 1
    db.commit()
    return {"ok": True, "inserted_in_replies": a.inserted_in_replies}
