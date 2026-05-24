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
    created_at: Optional[datetime] = None
    confidence: Optional[float]
    route: Optional[str]
    status: str
    order: str
    product: str
    keywords: list[str] = []
    assignee_id: Optional[int] = None
    assignee_name: Optional[str] = None
    assignee_initials: Optional[str] = None
    has_draft: bool = False


class TicketDetailOut(TicketOut):
    body: str
    entities: dict[str, Any] = {}
    summary: Optional[str] = None
    recommended_action: Optional[str] = None
    auto_reply: Optional[str] = None
    similar_tickets: list[dict[str, Any]] = []
    replies: list[ReplyOut] = []
    attachments: list[dict[str, Any]] = []
    routing_history: list[dict[str, Any]] = []


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


class AssignTicketIn(BaseModel):
    """Assign a ticket to a user. Pass `null` for `assignee_id` to unassign,
    or omit and pass `to_me=True` to assign to the current user."""
    assignee_id: Optional[int] = None
    to_me: bool = False


class RouteTicketIn(BaseModel):
    """Forward / route a ticket to a department by sending an email."""
    department: str = Field(..., min_length=1, max_length=80)
    recipient_email: str = Field(..., min_length=3, max_length=200)
    subject: Optional[str] = None
    message: str = Field(..., min_length=1)
    cc: list[str] = []
    mark_escalated: bool = True


class RoutingLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    department: str
    recipient_email: str
    subject: str
    message: str
    delivery_status: str
    delivery_detail: str = ""
    routed_by: Optional[str] = None
    created_at: datetime


class DepartmentOut(BaseModel):
    """A routing destination — name + a default contact address."""
    name: str
    email: str
    intents: list[str] = []


# ── Chat / messages ─────────────────────────────────────────────


class ChatMessageOut(BaseModel):
    """A single message in the customer↔agent thread."""
    id: int  # 0 for the synthetic "ticket body" first message
    ticket_id: str
    sender_role: str  # customer | agent | manager | admin | ai
    sender_name: str
    sender_initials: str
    body: str
    is_ai: bool = False
    is_system: bool = False
    created_at: datetime


class CustomerReplyIn(BaseModel):
    body: str = Field(..., min_length=1, max_length=8000)


class TicketStatusOut(BaseModel):
    """Lightweight status snapshot — used by the chat polling endpoint so
    the client can show 'agent is working' / 'resolved' without a full
    ticket re-fetch."""
    id: str
    status: str
    assignee_name: Optional[str] = None
    assignee_initials: Optional[str] = None
    is_typing: bool = False  # reserved — placeholder for future typing indicator
    updated_at: Optional[datetime] = None
    last_message_id: int = 0


class ChatPollOut(BaseModel):
    """Combined response — new messages + ticket status snapshot."""
    messages: list[ChatMessageOut]
    status: TicketStatusOut


class CustomerTicketSummary(BaseModel):
    """A compact ticket summary for the customer's 'My tickets' list."""
    id: str
    subject: str
    status: str
    intent: Optional[str] = None
    urgency: Optional[str] = None
    last_message_preview: str = ""
    last_message_at: Optional[datetime] = None
    unread_from_agent: int = 0
    created_at: datetime


class FAQOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    intent: str
    question: str
    answer: str


# ── Knowledge base ────────────────────────────────────────────────


class KBArticleSummary(BaseModel):
    id: int
    slug: str
    title: str
    summary: str = ""
    category: str = "General"
    intent: Optional[str] = None
    tags: list[str] = []
    status: str = "published"
    views: int = 0
    helpful: int = 0
    not_helpful: int = 0
    inserted_in_replies: int = 0
    updated_at: Optional[datetime] = None


class KBArticleOut(KBArticleSummary):
    body: str = ""
    author: Optional[str] = None
    created_at: Optional[datetime] = None


class KBArticleCreateIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    body: str = ""
    summary: str = ""
    category: str = "General"
    intent: Optional[str] = None
    tags: list[str] = []
    status: str = "draft"  # draft | published | archived
    slug: Optional[str] = None  # auto-derived from title if omitted


class KBArticleUpdateIn(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    body: Optional[str] = None
    summary: Optional[str] = None
    category: Optional[str] = None
    intent: Optional[str] = None
    tags: Optional[list[str]] = None
    status: Optional[str] = None


class KBFeedbackIn(BaseModel):
    helpful: bool
