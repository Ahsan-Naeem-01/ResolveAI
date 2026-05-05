"""Live LLM-backed reply generation via Groq's free API.

Uses Groq's OpenAI-compatible chat completions endpoint to draft customer
support replies in real time. Falls back to template-based replies (returns
None) if `GROQ_API_KEY` is unset, the request fails, or the response is empty,
so the application continues to work offline / without an API key.

Environment variables:
    GROQ_API_KEY   Required to enable live LLM replies. Get one for free at
                   https://console.groq.com — no credit card required.
    GROQ_MODEL     Model id (default: "llama-3.3-70b-versatile").
    GROQ_TIMEOUT   HTTP timeout in seconds (default: 15).
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "llama-3.3-70b-versatile"


def is_enabled() -> bool:
    """True when an API key is configured."""
    return bool(os.getenv("GROQ_API_KEY"))


def _model() -> str:
    return os.getenv("GROQ_MODEL", DEFAULT_MODEL)


def _timeout() -> float:
    try:
        return float(os.getenv("GROQ_TIMEOUT", "15"))
    except ValueError:
        return 15.0


_TONE_DIRECTIVES = {
    "warm": "Use a warm, empathetic, conversational tone.",
    "concise": "Be brief and to the point — three sentences maximum.",
    "formal": "Use formal, professional language.",
    "apologetic": "Be sincerely apologetic and reassuring.",
}


def _build_system_prompt(tone: Optional[str]) -> str:
    tone_directive = _TONE_DIRECTIVES.get(
        tone or "", "Use a helpful, professional, and empathetic tone."
    )
    return (
        "You are a senior customer support specialist for ResolveAI, an "
        "e-commerce company. Draft a personalized reply to the customer based "
        "on the structured ticket context the user provides.\n\n"
        f"{tone_directive}\n\n"
        "Rules:\n"
        "- Acknowledge the customer's specific issue and reference any concrete "
        "details given (order id, product, dates) when relevant.\n"
        "- Propose a concrete next step the support team will take.\n"
        "- Do not invent details that aren't in the context.\n"
        "- Keep the reply under 140 words.\n"
        "- Sign off with `— ResolveAI Support` on its own line.\n"
        "- Output the reply only — no preamble, no markdown headings, no quoting."
    )


def _build_user_prompt(
    *,
    intent: str,
    urgency: str,
    sentiment: str,
    entities: dict,
    customer_name: Optional[str],
    original_message: Optional[str],
) -> str:
    lines = [
        f"Customer name: {customer_name or 'Unknown'}",
        f"Detected intent: {intent}",
        f"Detected sentiment: {sentiment}",
        f"Urgency: {urgency}",
    ]
    for key, label in (
        ("order_id", "Order ID"),
        ("product", "Product"),
        ("date", "Relevant date"),
        ("tracking_number", "Tracking number"),
    ):
        if entities.get(key):
            lines.append(f"{label}: {entities[key]}")
    if original_message:
        lines.append("")
        lines.append("Original customer message:")
        lines.append(original_message.strip())
    lines.append("")
    lines.append("Write the support reply now.")
    return "\n".join(lines)


def generate_reply(
    *,
    intent: str,
    urgency: str,
    sentiment: str,
    entities: dict,
    customer_name: Optional[str] = None,
    original_message: Optional[str] = None,
    tone: Optional[str] = None,
) -> Optional[str]:
    """Call Groq to draft a reply.

    Returns the reply string on success, or None if the LLM is disabled
    (no API key) or the call failed for any reason. Callers should fall back
    to the template-based reply on None.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None

    payload = {
        "model": _model(),
        "messages": [
            {"role": "system", "content": _build_system_prompt(tone)},
            {
                "role": "user",
                "content": _build_user_prompt(
                    intent=intent,
                    urgency=urgency,
                    sentiment=sentiment,
                    entities=entities,
                    customer_name=customer_name,
                    original_message=original_message,
                ),
            },
        ],
        "temperature": 0.6,
        "max_tokens": 350,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=_timeout()) as client:
            r = client.post(GROQ_API_URL, json=payload, headers=headers)
            r.raise_for_status()
            data = r.json()
            content = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
            return content or None
    except httpx.HTTPStatusError as e:
        logger.warning(
            "Groq returned %s: %s", e.response.status_code, e.response.text[:200]
        )
        return None
    except Exception as e:
        logger.warning("Groq request failed: %s", e)
        return None
