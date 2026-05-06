from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Text, DateTime, ForeignKey, Boolean, JSON
)
from sqlalchemy.orm import relationship
from .database import Base


def _now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)  # customer | agent | manager | admin
    initials = Column(String, nullable=False, default="")
    title = Column(String, default="")
    created_at = Column(DateTime, default=_now)

    tickets = relationship("Ticket", back_populates="customer", foreign_keys="Ticket.customer_id")
    assigned_tickets = relationship("Ticket", back_populates="assignee", foreign_keys="Ticket.assignee_id")


class Ticket(Base):
    __tablename__ = "tickets"
    id = Column(Integer, primary_key=True)
    code = Column(String, unique=True, nullable=False, index=True)  # e.g. TKT-29481
    subject = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    channel = Column(String, default="web")  # web | email | chat

    customer_id = Column(Integer, ForeignKey("users.id"))
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    intent = Column(String)
    intent_confidence = Column(Float)
    sentiment = Column(String)
    urgency = Column(String)
    keywords = Column(JSON, default=list)
    entities = Column(JSON, default=dict)
    summary = Column(Text)
    recommended_action = Column(Text)
    auto_reply = Column(Text)
    route = Column(String)
    status = Column(String, default="ai-suggested")  # ai-suggested | needs-review | auto-resolved | resolved | escalated
    resolution_seconds = Column(Integer, nullable=True)
    csat = Column(Float, nullable=True)  # 1.0 - 5.0
    ai_assisted = Column(Boolean, default=True)

    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)
    resolved_at = Column(DateTime, nullable=True)

    customer = relationship("User", back_populates="tickets", foreign_keys=[customer_id])
    assignee = relationship("User", back_populates="assigned_tickets", foreign_keys=[assignee_id])
    replies = relationship("Reply", back_populates="ticket", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="ticket", cascade="all, delete-orphan")

    def to_summary_dict(self):
        return {
            "id": self.code,
            "customer": self.customer.name if self.customer else "—",
            "initials": self.customer.initials if self.customer else "",
            "subject": self.subject,
            "snippet": (self.body or "")[:140],
            "intent": self.intent,
            "urgency": self.urgency,
            "sentiment": self.sentiment,
            "channel": self.channel,
            "age": _humanize_age(self.created_at),
            "confidence": self.intent_confidence,
            "route": self.route,
            "status": self.status,
            "order": (self.entities or {}).get("order_id", "—") or "—",
            "product": (self.entities or {}).get("product", "—") or "—",
            "keywords": self.keywords or [],
            "assignee_id": self.assignee_id,
            "assignee_name": self.assignee.name if self.assignee else None,
            "assignee_initials": self.assignee.initials if self.assignee else None,
        }


class Reply(Base):
    __tablename__ = "replies"
    id = Column(Integer, primary_key=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    body = Column(Text, nullable=False)
    is_ai_draft = Column(Boolean, default=False)
    edited_by_agent = Column(Boolean, default=False)
    sent = Column(Boolean, default=False)
    created_at = Column(DateTime, default=_now)

    ticket = relationship("Ticket", back_populates="replies")
    author = relationship("User")


class Attachment(Base):
    __tablename__ = "attachments"
    id = Column(Integer, primary_key=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    filename = Column(String, nullable=False)
    size_bytes = Column(Integer, default=0)
    content_type = Column(String, default="application/octet-stream")
    created_at = Column(DateTime, default=_now)

    ticket = relationship("Ticket", back_populates="attachments")


class FAQ(Base):
    __tablename__ = "faqs"
    id = Column(Integer, primary_key=True)
    intent = Column(String, index=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)


class KBArticle(Base):
    """A knowledge-base article. Markdown body, lifecycle status, and usage metrics."""
    __tablename__ = "kb_articles"
    id = Column(Integer, primary_key=True)
    slug = Column(String, unique=True, nullable=False, index=True)
    title = Column(String, nullable=False)
    summary = Column(Text, default="")
    body = Column(Text, nullable=False, default="")  # markdown
    category = Column(String, index=True, default="General")
    intent = Column(String, index=True, nullable=True)  # maps to NLP intent
    tags = Column(JSON, default=list)
    status = Column(String, default="published", index=True)  # draft | published | archived

    views = Column(Integer, default=0)
    helpful = Column(Integer, default=0)
    not_helpful = Column(Integer, default=0)
    inserted_in_replies = Column(Integer, default=0)

    author_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    author = relationship("User")

    def to_summary_dict(self):
        return {
            "id": self.id,
            "slug": self.slug,
            "title": self.title,
            "summary": self.summary or "",
            "category": self.category or "General",
            "intent": self.intent,
            "tags": self.tags or [],
            "status": self.status,
            "views": int(self.views or 0),
            "helpful": int(self.helpful or 0),
            "not_helpful": int(self.not_helpful or 0),
            "inserted_in_replies": int(self.inserted_in_replies or 0),
            "updated_at": self.updated_at,
        }

    def to_detail_dict(self):
        d = self.to_summary_dict()
        d.update({
            "body": self.body or "",
            "author": self.author.name if self.author else None,
            "created_at": self.created_at,
        })
        return d


class TrainingExample(Base):
    """Labeled examples used to train the intent classifier and seed semantic search."""
    __tablename__ = "training_examples"
    id = Column(Integer, primary_key=True)
    text = Column(Text, nullable=False)
    intent = Column(String, nullable=False, index=True)


class ModelMetric(Base):
    """Snapshot of model evaluation metrics from the last training run."""
    __tablename__ = "model_metrics"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)  # e.g. intent_classifier
    accuracy = Column(Float)
    f1_macro = Column(Float)
    n_samples = Column(Integer)
    trained_at = Column(DateTime, default=_now)


class RoutingLog(Base):
    """Records when a ticket is routed (forwarded) to another department."""
    __tablename__ = "routing_logs"
    id = Column(Integer, primary_key=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    routed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    department = Column(String, nullable=False)
    recipient_email = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    delivery_status = Column(String, default="simulated")  # sent | simulated | failed
    delivery_detail = Column(Text, default="")
    created_at = Column(DateTime, default=_now)

    ticket = relationship("Ticket")
    routed_by = relationship("User")


def _humanize_age(dt):
    if dt is None:
        return "—"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    delta = _now() - dt
    secs = int(delta.total_seconds())
    if secs < 60:
        return f"{secs}s"
    mins = secs // 60
    if mins < 60:
        return f"{mins}m"
    hours = mins // 60
    if hours < 24:
        return f"{hours}h"
    days = hours // 24
    return f"{days}d"
