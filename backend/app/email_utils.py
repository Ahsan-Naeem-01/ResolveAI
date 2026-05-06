"""Lightweight SMTP helper for outbound routing emails.

If `SMTP_HOST` is set, we attempt a real SMTP send via stdlib `smtplib`.
Otherwise we record a "simulated" send so the UI flow still works in dev.

Env vars (all optional — set in backend/.env):
    SMTP_HOST       e.g. smtp.gmail.com
    SMTP_PORT       e.g. 587 (default 587)
    SMTP_USER       login user
    SMTP_PASSWORD   login password / app password
    SMTP_FROM       From: address (default: SMTP_USER or noreply@resolveai.app)
    SMTP_USE_TLS    "1" or "0" (default 1)
"""
from __future__ import annotations
import os
import smtplib
import ssl
from email.message import EmailMessage
from typing import Tuple


def _bool(v: str | None, default: bool = True) -> bool:
    if v is None or v == "":
        return default
    return v.strip() in ("1", "true", "yes", "on")


def is_configured() -> bool:
    return bool(os.getenv("SMTP_HOST", "").strip())


def send_routing_email(
    to_email: str,
    subject: str,
    body: str,
    cc: list[str] | None = None,
) -> Tuple[str, str]:
    """Send an email or simulate one.

    Returns (status, detail) where status ∈ {"sent","simulated","failed"}.
    """
    if not is_configured():
        return ("simulated", "SMTP not configured — message recorded but not sent.")

    host = os.getenv("SMTP_HOST", "").strip()
    port = int(os.getenv("SMTP_PORT", "587").strip() or "587")
    user = os.getenv("SMTP_USER", "").strip()
    pwd = os.getenv("SMTP_PASSWORD", "").strip()
    from_addr = (
        os.getenv("SMTP_FROM", "").strip() or user or "noreply@resolveai.app"
    )
    use_tls = _bool(os.getenv("SMTP_USE_TLS"), True)

    msg = EmailMessage()
    msg["From"] = from_addr
    msg["To"] = to_email
    if cc:
        msg["Cc"] = ", ".join(cc)
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        if use_tls:
            ctx = ssl.create_default_context()
            with smtplib.SMTP(host, port, timeout=15) as server:
                server.ehlo()
                server.starttls(context=ctx)
                server.ehlo()
                if user and pwd:
                    server.login(user, pwd)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=15) as server:
                if user and pwd:
                    server.login(user, pwd)
                server.send_message(msg)
        return ("sent", f"Delivered to {to_email} via {host}:{port}")
    except Exception as exc:  # noqa: BLE001 — we want any failure surfaced
        return ("failed", f"{type(exc).__name__}: {exc}")
