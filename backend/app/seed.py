"""Seed the database with users, training examples, FAQs, and demo tickets."""
from __future__ import annotations
from datetime import datetime, timedelta, timezone

from .database import Base, engine, SessionLocal
from .models import User, Ticket, Reply, FAQ, TrainingExample, ModelMetric, Attachment, KBArticle
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


# Knowledge-base seed articles. Each entry is:
#   (slug, title, category, intent, tags, summary, body)
KB_ARTICLES = [
    (
        "refund-timing-and-policy",
        "Refund timing and policy",
        "Refunds", "Refund Request",
        ["refund", "policy", "billing"],
        "How long refunds take to land back on the customer's card and what we promise.",
        "## Standard refund timing\n\n"
        "Once we initiate a refund, the funds return to the customer's **original payment method** within "
        "**3–5 business days**. Bank-card processing (Visa/Mastercard) usually clears in 3 days; some "
        "international cards take up to 10.\n\n"
        "## What to tell the customer\n\n"
        "- Set expectation: 3–5 business days.\n"
        "- If they're past day 5: ask for the last four digits of the card and the issuing bank, then "
        "  open a billing trace.\n\n"
        "## Edge cases\n\n"
        "- **Original card cancelled** → refund still posts to the closed account; the bank forwards it.\n"
        "- **Gift purchase** → refund goes to the buyer, not the recipient. Confirm before refunding.\n"
        "- **Partial refund** → split-refund works on Stripe but takes one extra business day.",
    ),
    (
        "damaged-item-refund-flow",
        "Handling damaged-item refunds",
        "Refunds", "Refund Request",
        ["damaged", "refund", "qc", "photo"],
        "End-to-end workflow when a customer reports a broken or damaged item on arrival.",
        "## Step-by-step\n\n"
        "1. Confirm the **order number** and the specific item.\n"
        "2. Ask the customer for a **photo of the damage** and the packaging — this feeds our QC team.\n"
        "3. For items under **$50**, waive the physical return and issue an immediate refund.\n"
        "4. For higher-value items, generate a prepaid return label.\n"
        "5. Add a **15% goodwill credit** if the item was a gift or this is a repeat issue.\n\n"
        "## Escalation\n\n"
        "If the same SKU has had 3+ damage reports this week, flag the SKU in `#qc-flags` and notify the "
        "packaging lead. Pause new shipments of that SKU pending review.",
    ),
    (
        "duplicate-charge-investigation",
        "Investigating duplicate charges",
        "Payments", "Payment Failure",
        ["billing", "duplicate", "stripe"],
        "How to triage a customer reporting they were charged twice.",
        "## Quick triage\n\n"
        "1. Pull the customer's transaction log (Admin → Billing → search by email).\n"
        "2. Check whether one charge is a **pending authorization** (status `auth`) vs **settled** (status `captured`).\n"
        "3. **Auth + captured** is normal — the auth drops off in 3–5 business days.\n"
        "4. **Two captured charges** is a true duplicate — reverse one immediately via the Stripe dashboard.\n\n"
        "## Reply template\n\n"
        "> Looks like one of these is a pending authorization that hasn't settled yet — it'll fall off your "
        "> statement within 3–5 business days. If it doesn't, write back and we'll reverse it manually.\n\n"
        "## Always do\n\n"
        "Confirm the resolution by email and attach the transaction IDs.",
    ),
    (
        "missing-package-trace",
        "Opening a courier trace for missing packages",
        "Delivery", "Delivery Issue",
        ["shipping", "carrier", "trace"],
        "When tracking has stalled — when to open a trace and what to do while we wait.",
        "## Threshold\n\n"
        "Open a courier trace when **tracking hasn't updated for 48+ hours** beyond the expected delivery "
        "window, OR when it's been **7+ days** with no scan at all.\n\n"
        "## How to open a trace\n\n"
        "- **FedEx**: Carrier portal → Traces → New (case ID format `FX-`).\n"
        "- **UPS**: 1-800-PICK-UPS or claims portal.\n"
        "- **USPS**: Open at usps.com/help/missing-mail.htm.\n\n"
        "## Customer communication\n\n"
        "Set the expectation that traces take 24–48 hours. Offer a **free replacement** or **full refund** "
        "right away if the customer has a hard deadline (event, gift, etc.) — don't make them wait.",
    ),
    (
        "address-change-after-ordering",
        "Changing a shipping address after order placement",
        "Delivery", "Delivery Issue",
        ["shipping", "address", "edit"],
        "What's possible — and what's not — after the customer places an order.",
        "## Before the order ships\n\n"
        "Edit the address directly on the order. Confirm the new address with the customer in writing.\n\n"
        "## After the order ships\n\n"
        "We can request a **carrier redirect** for FedEx/UPS (~$5 fee, usually waived). USPS doesn't "
        "support reliable mid-route redirects.\n\n"
        "## When redirect fails\n\n"
        "1. Wait for the package to be marked undeliverable / returned to sender.\n"
        "2. Reship to the correct address at no charge.\n"
        "3. Apologize for the delay and offer a 10% next-order credit.",
    ),
    (
        "wrong-item-or-size-received",
        "Wrong item or wrong size received",
        "Product", "Product Complaint",
        ["exchange", "size", "fulfillment"],
        "Customer got something they didn't order. How to make it right fast.",
        "## Default flow: free exchange\n\n"
        "1. Apologize and confirm the SKU/size the customer originally ordered.\n"
        "2. Generate a **prepaid return label** for the wrong item.\n"
        "3. Ship the correct item the same day — don't wait for the return to arrive.\n"
        "4. Add a note in the order so warehouse can investigate the mis-pick.\n\n"
        "## If the correct size is out of stock\n\n"
        "Offer: (a) full refund, (b) wait + 15% credit, or (c) closest available size with free shipping.\n\n"
        "## Tracking warehouse mis-picks\n\n"
        "Tag the ticket with `#mispick` so the manager dashboard can spot fulfillment trends.",
    ),
    (
        "defective-product-troubleshoot-and-replace",
        "Defective product — troubleshoot then replace",
        "Product", "Product Complaint",
        ["defective", "warranty", "replace"],
        "Quick diagnostic flow before issuing a replacement on electronics or accessories.",
        "## Step 1: Quick diagnostic\n\n"
        "Ask 2–3 specific questions before assuming defect:\n\n"
        "- **Headphones / battery products**: Is it dying noticeably faster than spec, or just shorter "
        "  than expected? (Battery life drops ~5–8 hours in cold weather.)\n"
        "- **Bluetooth devices**: Have they tried unpairing and re-pairing? Different device?\n"
        "- **Mechanical**: Any visible damage to the housing or cable?\n\n"
        "## Step 2: Replace if confirmed\n\n"
        "If the customer's experience is meaningfully outside spec, ship a replacement under the "
        "**1-year warranty** at no charge. Don't require the original back unless the unit is over $200.\n\n"
        "## Step 3: Log the defect\n\n"
        "Add `#qc-defect` and the symptom to the ticket — it feeds the weekly QC report.",
    ),
    (
        "suspicious-login-account-lockdown",
        "Account compromise — lockdown procedure",
        "Account / Security", "Account / Security",
        ["security", "fraud", "urgent"],
        "Fast lockdown sequence when a customer reports a suspicious login or possible account takeover.",
        "## Treat as time-sensitive — act immediately\n\n"
        "1. **Force a password reset** on the account.\n"
        "2. **Terminate all active sessions** (Admin → Users → Sessions → Revoke all).\n"
        "3. **Disable saved payment methods** until the customer confirms they're back in.\n"
        "4. **Flag the account** in the fraud queue with `#suspicious-login`.\n\n"
        "## Don't ask for password\n\n"
        "We never ask the customer for their password. If they offered it, instruct them to reset it "
        "immediately and never share it again.\n\n"
        "## Escalation\n\n"
        "If the customer reports unauthorized purchases, escalate to the **Fraud / Security team** with "
        "tag `#fraud` — they have the chargeback authority.",
    ),
    (
        "password-reset-troubleshooting",
        "Password reset emails not arriving",
        "Account / Security", "Account / Security",
        ["password", "email", "deliverability"],
        "When the customer says the reset email didn't show up.",
        "## Check before manual reset\n\n"
        "- Confirm the email on file matches what they're entering (typos: gmail vs gmial).\n"
        "- Ask them to check **spam / promotions** folders.\n"
        "- Wait 10 minutes — provider greylisting can delay first-time delivery.\n\n"
        "## If still nothing\n\n"
        "Issue a **manual reset link** from the admin panel and send it via the channel the customer is "
        "already using (chat or reply-to-email). Manual links expire in 30 minutes.\n\n"
        "## Gmail / Outlook specifically\n\n"
        "Both occasionally bucket our transactional mail. Recommend the customer mark our address as "
        "'Not spam' once they receive it.",
    ),
    (
        "expired-coupon-honor-policy",
        "Expired coupons — when to honor",
        "Promotions", "Promotion / Pricing",
        ["coupon", "discount", "policy"],
        "Our policy on honoring discount codes that have technically expired.",
        "## We honor when\n\n"
        "- The customer received the code from us in an email **within the last 30 days**.\n"
        "- The expiration date in the email is **later than today**, but the code was disabled in our system "
        "  (a marketing mistake).\n"
        "- The customer is a long-tenured account (12+ months) and the discount is under 25%.\n\n"
        "## We don't honor when\n\n"
        "- The code is from a third-party deal site we don't run.\n"
        "- It's tied to a flash promotion that already expired publicly.\n\n"
        "## How to issue\n\n"
        "Generate a fresh, single-use code in the promotions panel and email it directly to the customer. "
        "Don't extend the original code — it pollutes our analytics.",
    ),
    (
        "writing-empathetic-replies",
        "Writing empathetic replies",
        "General", None,
        ["tone", "soft-skills", "writing"],
        "Tone guidance for customer-facing writing — what to do, what to avoid.",
        "## Open with acknowledgement\n\n"
        "Lead with the customer's feelings, not the policy.\n\n"
        "- ❌ \"Per our refund policy, refunds take 3–5 business days.\"\n"
        "- ✅ \"That's frustrating — totally hear you. I've started the refund and you'll see it back within "
        "  3–5 business days.\"\n\n"
        "## Avoid\n\n"
        "- **\"Unfortunately\"** — usually softened with a concrete next step instead.\n"
        "- **Passive voice** (\"your order has been delayed\") — say *who* did *what*.\n"
        "- **Robot-speak** (\"please be advised\", \"as per our policy\").\n\n"
        "## End with a clear next step\n\n"
        "Every reply should give the customer something to do next, or tell them they don't need to do "
        "anything until we follow up.",
    ),
    (
        "escalation-thresholds-and-routing",
        "When to escalate (and to whom)",
        "General", None,
        ["escalation", "routing", "policy"],
        "Quick reference for when a ticket needs to leave the Tier 1 queue.",
        "## Escalate to Tier 2 when\n\n"
        "- The case requires a refund > $200.\n"
        "- The customer has contacted us about the same issue 2+ times.\n"
        "- There's a signed SLA / business contract on the account.\n\n"
        "## Escalate to Fraud / Security when\n\n"
        "- Unauthorized purchases reported.\n"
        "- Account takeover suspected.\n"
        "- Chargeback initiated by the customer's bank.\n\n"
        "## Escalate to Engineering when\n\n"
        "- The customer hits a reproducible bug in the product (not a one-off glitch).\n"
        "- Payments are silently failing for a specific card type or region.\n\n"
        "## Don't escalate when\n\n"
        "The case is clearly within Tier 1 authority (standard refund, address change, password reset). "
        "Resolve it; escalation creates queue drag.",
    ),
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

        # Knowledge-base articles (with realistic seeded usage stats)
        if db.query(KBArticle).count() == 0:
            import random
            rng = random.Random(7)
            for slug, title, category, intent, tags, summary, body in KB_ARTICLES:
                db.add(KBArticle(
                    slug=slug,
                    title=title,
                    summary=summary,
                    body=body,
                    category=category,
                    intent=intent,
                    tags=list(tags),
                    status="published",
                    views=rng.randint(40, 350),
                    helpful=rng.randint(8, 45),
                    not_helpful=rng.randint(0, 6),
                    inserted_in_replies=rng.randint(2, 28),
                ))
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
