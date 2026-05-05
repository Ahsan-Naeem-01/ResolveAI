"""Seed the database with users, training examples, FAQs, and demo tickets."""
from __future__ import annotations
from datetime import datetime, timedelta, timezone

from .database import Base, engine, SessionLocal
from .models import User, Ticket, Reply, FAQ, TrainingExample, ModelMetric, Attachment
from .nlp.training_data import EXAMPLES
from .nlp import classifier, pipeline, semantic_search


DEMO_USERS = [
    # role, name, email, initials, title
    ("customer", "Anika Rao",       "anika.rao@example.com",       "AR", "Customer"),
    ("customer", "Marcus Lin",      "marcus.lin@example.com",      "ML", "Customer"),
    ("customer", "Priya Shah",      "priya.shah@example.com",      "PS", "Customer"),
    ("customer", "Dilan Park",      "dilan.park@example.com",      "DP", "Customer"),
    ("customer", "Elena Sokolov",   "elena.sokolov@example.com",   "ES", "Customer"),
    ("customer", "Tomás Vega",      "tomas.vega@example.com",      "TV", "Customer"),
    ("customer", "Hana Yoshida",    "hana.yoshida@example.com",    "HY", "Customer"),

    ("agent",   "Jordan Maeda",     "jordan@resolveai.app",   "JM", "Tier 2 Agent"),
    ("agent",   "Lina Okafor",      "lina@resolveai.app",     "LO", "Tier 2 Agent"),
    ("agent",   "Rafael Mendes",    "rafael@resolveai.app",   "RM", "Tier 1 Agent"),
    ("agent",   "Ash Patel",        "ash@resolveai.app",      "AP", "Tier 2 Agent"),
    ("agent",   "Yuki Tanaka",      "yuki@resolveai.app",     "YT", "Tier 1 Agent"),
    ("agent",   "Sam Reyes",        "sam@resolveai.app",      "SR", "Tier 1 Agent"),

    ("manager", "Maya Khan",        "maya@resolveai.app",     "MK", "Support Lead"),
    ("admin",   "Robin Beck",       "robin@resolveai.app",    "RB", "Owner"),
]

DEMO_TICKETS = [
    # body, customer_email, channel, age_minutes, force_intent
    ("Hi, I ordered the Aurora ceramic mug set (order #12345) and one of them arrived shattered. "
     "The packaging was crushed. I'd like a refund please — really disappointed because it was a gift.",
     "anika.rao@example.com", "web", 4, None),
    ("Where is my package? FedEx tracking shows nothing since Monday and it's been 9 days for order 12290 "
     "(Linen Throw Blanket).",
     "marcus.lin@example.com", "email", 12, None),
    ("I was charged twice for the same order (12275) — I see two pending charges on my card and only "
     "one confirmation email. Please refund one immediately.",
     "priya.shah@example.com", "chat", 18, None),
    ("Ordered medium hoodie, received XL. Cloud Hoodie Sand color. Need to exchange.",
     "dilan.park@example.com", "web", 32, None),
    ("Got an alert about a suspicious login from a device I don't recognize. I think my account "
     "might be compromised — please help.",
     "elena.sokolov@example.com", "email", 41, None),
    ("My coupon code WELCOME10 says expired but the email I received yesterday said it's good til "
     "tomorrow. Can you fix this?",
     "tomas.vega@example.com", "chat", 55, None),
    ("Battery on my Halo ANC Headphones dies in about 6 hours. The product page says 18 hours. "
     "I think I got a defective unit — what are my options?",
     "hana.yoshida@example.com", "web", 60, None),
]

FAQS = [
    ("Refund Request", "How long do refunds take?",
     "Refunds typically post back to your original payment method within 3–5 business days "
     "after we initiate them."),
    ("Refund Request", "Do I need to ship the damaged item back?",
     "For damaged items under $50 we usually waive the return — just send a photo of the damage."),
    ("Delivery Issue", "When does my package count as lost?",
     "If tracking hasn't updated for 7+ days, we open a courier trace and offer a replacement or refund."),
    ("Delivery Issue", "Can I change my shipping address after ordering?",
     "If the order hasn't shipped yet, yes — reach out and we'll update it. Otherwise the carrier "
     "may be able to redirect mid-shipment."),
    ("Payment Failure", "Why was I charged twice?",
     "Most duplicate charges are pending authorizations that drop off in 3–5 business days. "
     "If both settle, contact us and we'll reverse the duplicate."),
    ("Account / Security", "I can't log in.",
     "Use the password reset flow on the login page. If the reset email doesn't arrive within "
     "10 minutes, contact support — we can issue a manual reset."),
    ("Promotion / Pricing", "My coupon isn't working.",
     "Coupons are case-sensitive and tied to the email address that received them. If it's still "
     "showing expired before the date in the email, send us the code and we'll honor it."),
    ("Product Complaint", "How do I exchange a product?",
     "Contact us with your order number and the issue — we'll send you a prepaid return label "
     "and ship the replacement."),
]


def _now():
    return datetime.now(timezone.utc)


def seed(force: bool = False) -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if force:
            db.query(Reply).delete()
            db.query(Attachment).delete()
            db.query(Ticket).delete()
            db.query(FAQ).delete()
            db.query(TrainingExample).delete()
            db.query(ModelMetric).delete()
            db.query(User).delete()
            db.commit()

        # Users
        if db.query(User).count() == 0:
            for role, name, email, initials, title in DEMO_USERS:
                db.add(User(role=role, name=name, email=email, initials=initials, title=title))
            db.commit()

        # FAQs
        if db.query(FAQ).count() == 0:
            for intent, q, a in FAQS:
                db.add(FAQ(intent=intent, question=q, answer=a))
            db.commit()

        # Training examples
        if db.query(TrainingExample).count() == 0:
            for text, intent in EXAMPLES:
                db.add(TrainingExample(text=text, intent=intent))
            db.commit()

        # Train classifier (always — it's quick and ensures the model file exists)
        metrics = classifier.train()
        classifier.reload()
        db.add(ModelMetric(
            name="intent_classifier",
            accuracy=metrics["accuracy"],
            f1_macro=metrics["accuracy"],  # using accuracy as proxy on small dataset
            n_samples=metrics["n_samples"],
        ))
        db.commit()

        # Build the semantic-search index from training data
        _rebuild_search_index(db)

        # Demo tickets
        if db.query(Ticket).count() == 0:
            for body, email, channel, age_min, _force in DEMO_TICKETS:
                customer = db.query(User).filter(User.email == email).first()
                nlp = pipeline.process(body, customer_name=customer.name if customer else None)
                code = _next_ticket_code(db)
                t = Ticket(
                    code=code,
                    subject=_subject_for(body, nlp["intent"]),
                    body=body,
                    channel=channel,
                    customer_id=customer.id if customer else None,
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
                    created_at=_now() - timedelta(minutes=age_min),
                )
                db.add(t)
                db.flush()
                db.add(Reply(ticket_id=t.id, body=nlp["auto_reply"], is_ai_draft=True))
            db.commit()
            _rebuild_search_index(db)
    finally:
        db.close()


def _next_ticket_code(db) -> str:
    last = db.query(Ticket).order_by(Ticket.id.desc()).first()
    base = 29481
    n = base + (last.id if last else 0) + 1
    return f"TKT-{n}"


def _subject_for(body: str, intent: str) -> str:
    first = body.strip().split(".", 1)[0].strip()
    if 8 <= len(first) <= 90:
        return first
    return f"{intent} — {first[:60]}"


def _rebuild_search_index(db) -> None:
    docs = []
    for tr in db.query(TrainingExample).all():
        docs.append({"id": f"TR-{tr.id}", "text": tr.text, "intent": tr.intent,
                     "summary": tr.text[:120]})
    for tk in db.query(Ticket).filter(Ticket.status.in_(("auto-resolved", "resolved"))).all():
        docs.append({
            "id": tk.code,
            "text": f"{tk.subject}. {tk.body}",
            "intent": tk.intent,
            "summary": tk.summary or tk.subject,
        })
    semantic_search.get_index().build(docs)


if __name__ == "__main__":
    seed()
    print("Seed complete.")
