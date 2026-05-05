"""Auto-reply, summary and recommended-action generation.

Template-driven so it works without an LLM. Substitutes entities and adapts tone
based on urgency/sentiment. For an LLM upgrade, swap `compose_reply()` to call
your provider with the same kwargs as context.
"""
from __future__ import annotations
from typing import Any


def _first_name(name: str | None) -> str:
    if not name:
        return "there"
    return name.split()[0]


def compose_summary(text: str, intent: str, entities: dict) -> str:
    fragments = []
    if entities.get("product"):
        fragments.append(f"about the {entities['product']}")
    if entities.get("order_id"):
        fragments.append(f"for order #{entities['order_id']}")
    suffix = (" " + " ".join(fragments)).rstrip() if fragments else ""

    base = {
        "Refund Request": f"Customer is requesting a refund{suffix}.",
        "Delivery Issue": f"Customer is asking about delayed/missing delivery{suffix}.",
        "Product Complaint": f"Customer is reporting a product issue{suffix}.",
        "Payment Failure": f"Customer is experiencing a billing/payment issue{suffix}.",
        "Account / Security": "Customer is reporting an account or security concern.",
        "Promotion / Pricing": "Customer has a question about pricing or a promotion code.",
        "Other": "Customer has submitted a general inquiry.",
    }
    return base.get(intent, base["Other"])


def recommend_action(intent: str, urgency: str, entities: dict) -> str:
    has_order = "order_id" in entities
    has_product = "product" in entities
    if intent == "Refund Request":
        a = "Verify order details, "
        a += "initiate a partial refund for the damaged unit" if has_product else "initiate a refund"
        a += "; offer a 15% goodwill credit"
        if "broken" in str(entities.get("keywords", "")):
            a += " and request a photo of the damage for QC."
        else:
            a += "."
        return a
    if intent == "Payment Failure":
        return ("Pull the transaction log, confirm whether the duplicate charge "
                "settled or is just a pending auth, and reverse if duplicated.")
    if intent == "Delivery Issue":
        if has_order:
            return ("Check carrier tracking for the order; if no movement in 48h, "
                    "open a courier trace and offer a replacement or refund.")
        return "Ask the customer for their order number, then open a courier trace."
    if intent == "Product Complaint":
        return ("Offer an exchange or partial refund based on the issue; "
                "tag the complaint for the quality-control review.")
    if intent == "Account / Security":
        return ("Force a password reset, terminate other active sessions, "
                "and escalate to the Fraud/Security team.")
    if intent == "Promotion / Pricing":
        return ("Verify the coupon's expiration window and either honor the "
                "discount or offer an equivalent code.")
    return "Triage and route to the appropriate team based on the customer's request."


_TONE_OPENERS = {
    None: "Hi {name},",
    "warm": "Hi {name} — thanks so much for reaching out,",
    "concise": "Hi {name},",
    "formal": "Dear {name},",
    "apologetic": "Hi {name} — I'm really sorry about this,",
}


def compose_reply(intent: str, urgency: str, sentiment: str, entities: dict,
                  customer_name: str | None = None, tone: str | None = None) -> str:
    name = _first_name(customer_name)
    opener = _TONE_OPENERS.get(tone, _TONE_OPENERS[None]).format(name=name)

    order_line = ""
    if entities.get("order_id"):
        order_line = f" for order #{entities['order_id']}"
    elif entities.get("product"):
        order_line = f" for your {entities['product']}"

    if sentiment in ("Angry", "Frustrated", "Disappointed"):
        empathy = " I'm really sorry for the trouble this has caused."
    elif sentiment in ("Worried", "Concerned"):
        empathy = " I understand how concerning this must be."
    else:
        empathy = ""

    body_by_intent = {
        "Refund Request": (
            f"I've started a refund{order_line} — you'll see it back on your original "
            "payment method within 3–5 business days. I've also added a 15% goodwill "
            "credit to your account for the inconvenience. Could you reply with a quick "
            "photo of the damage so we can flag it with our packaging team?"
        ),
        "Payment Failure": (
            f"I've pulled the transaction log{order_line}. If the second charge is a pending "
            "authorization, it'll drop off your statement in 3–5 business days; if it's settled, "
            "I'll reverse it now. I'll email you a confirmation either way."
        ),
        "Delivery Issue": (
            f"I've opened a courier trace{order_line}. Carriers usually update within 24–48 hours. "
            "If there's still no movement after that, I'll send a free replacement at no extra cost."
        ),
        "Product Complaint": (
            f"Thanks for letting us know{order_line}. I'd like to make this right — I can ship "
            "a replacement or process a refund, whichever you prefer. Could you let me know "
            "which works better for you?"
        ),
        "Account / Security": (
            "I've forced a password reset on your account and terminated any active sessions. "
            "Please reset your password using the email I just sent you, and reply if you spot "
            "anything else suspicious — our security team is on standby."
        ),
        "Promotion / Pricing": (
            "I checked the code on our end — looks like the expiration was earlier than the email "
            "suggested. I've issued you a fresh code (you'll get it in a follow-up email) good for "
            "the next 7 days."
        ),
        "Other": (
            "Thanks for reaching out — I've routed your message to the right team and someone "
            "will follow up within the next business day."
        ),
    }
    body = body_by_intent.get(intent, body_by_intent["Other"])
    closer = "\n\n— ResolveAI Support"
    return f"{opener}{empathy} {body}{closer}"
