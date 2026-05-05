"""Regex- and lexicon-based entity extraction.

Extracts: order_id, date, product, tracking_number, money_amount, email.
"""
from __future__ import annotations
import re
from datetime import datetime

# Catalog of products we know about — used for fuzzy product matching.
PRODUCT_CATALOG = [
    "Aurora Mug Set",
    "Aurora Mug Set (4-pc)",
    "Halo ANC Headphones",
    "Cloud Hoodie",
    "Linen Throw Blanket",
    "Glass Carafe",
    "Cedar Cutting Board",
    "Brass Desk Lamp",
    "Atlas Backpack",
    "Stoneware Plate Set",
]

_ORDER_RE = re.compile(r"\b(?:order|ord|#)\s*[:#]?\s*(\d{4,9})\b", re.I)
_TRACKING_RE = re.compile(r"\b(1Z[0-9A-Z]{16}|\d{10,22})\b")
_MONEY_RE = re.compile(r"\$\s?\d+(?:\.\d{1,2})?")
_EMAIL_RE = re.compile(r"[\w.\-+]+@[\w.\-]+\.\w+")
_DATE_RE = re.compile(
    r"\b("
    r"\d{4}-\d{2}-\d{2}"  # 2026-04-29
    r"|\d{1,2}/\d{1,2}/\d{2,4}"
    r"|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}(?:,? \d{4})?"
    r")\b",
    re.I,
)


def extract(text: str) -> dict:
    """Return a dict of extracted entities. Missing keys mean nothing was found."""
    text = text or ""
    out: dict[str, str | list[str]] = {}

    m = _ORDER_RE.search(text)
    if m:
        out["order_id"] = m.group(1)

    m = _TRACKING_RE.search(text)
    if m and m.group(0) != out.get("order_id"):
        out["tracking_number"] = m.group(1)

    money = _MONEY_RE.findall(text)
    if money:
        out["money_amounts"] = money

    emails = _EMAIL_RE.findall(text)
    if emails:
        out["email"] = emails[0]

    m = _DATE_RE.search(text)
    if m:
        out["date"] = _normalize_date(m.group(1))

    prod = _match_product(text)
    if prod:
        out["product"] = prod

    return out


def _normalize_date(raw: str) -> str:
    """Best-effort ISO normalization. Falls back to the raw string."""
    fmts = ["%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%b %d %Y", "%b %d, %Y", "%B %d %Y", "%B %d, %Y"]
    for fmt in fmts:
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return raw


def _match_product(text: str) -> str | None:
    """Substring + token overlap match against the catalog."""
    lower = text.lower()
    best = None
    best_score = 0
    for product in PRODUCT_CATALOG:
        plower = product.lower()
        if plower in lower:
            return product  # exact substring wins immediately
        ptokens = {t for t in re.findall(r"[a-z]+", plower) if len(t) > 2}
        ttokens = set(re.findall(r"[a-z]+", lower))
        score = len(ptokens & ttokens)
        # require at least 2 distinctive tokens to count
        if score >= 2 and score > best_score:
            best, best_score = product, score
    return best
