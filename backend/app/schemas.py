from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    name: str
    role: str
    initials: str
    title: str = ""


class ProcessQueryIn(BaseModel):
    query: str = Field(..., min_length=1)
    customer_email: Optional[str] = None
    customer_name: Optional[str] = None
    channel: str = "web"
    attachments: Optional[list[dict[str, Any]]] = None


class NLPResult(BaseModel):
    intent: str
    intent_confidence: float
    urgency: str
    sentiment: str
    entities: dict[str, Any]
    keywords: list[str]
    summary: str
    recommended_action: str
    auto_reply: str
    ticket_route: str
    similar_tickets: list[dict[str, Any]] = []
    steps: list[dict[str, Any]] = []


class TicketCreatedOut(BaseModel):
    ticket_id: str
    nlp: NLPResult


class ReplyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    body: str
    is_ai_draft: bool
    edited_by_agent: bool
    sent: bool
    created_at: datetime


class TicketOut(BaseModel):
    id: str
    customer: str
    initials: str
    subject: str
    snippet: str
    intent: Optional[str]
    urgency: Optional[str]
    sentiment: Optional[str]
    channel: str
    age: str
    confidence: Optional[float]
    route: Optional[str]
    status: str
    order: str
    product: str
    keywords: list[str] = []


class TicketDetailOut(TicketOut):
    body: str
    entities: dict[str, Any] = {}
    summary: Optional[str] = None
    recommended_action: Optional[str] = None
    auto_reply: Optional[str] = None
    similar_tickets: list[dict[str, Any]] = []
    replies: list[ReplyOut] = []
    attachments: list[dict[str, Any]] = []


class ReplyUpdateIn(BaseModel):
    body: str
    edited_by_agent: bool = True


class RegenerateReplyIn(BaseModel):
    tone: Optional[str] = None  # warm | concise | formal


class SendReplyIn(BaseModel):
    body: Optional[str] = None  # if None, send the latest draft


class TicketStatusUpdateIn(BaseModel):
    status: str
    csat: Optional[float] = None


class FAQOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    intent: str
    question: str
    answer: str
