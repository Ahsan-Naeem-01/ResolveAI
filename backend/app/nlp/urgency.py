"""Urgency detection — combines intent priors, sentiment, and keyword cues.

Levels: Low | Medium | High | Critical
"""
from __future__ import annotations
import re

INTENT_BASELINE = {
    "Refund Request": 1,        # base Medium
    "Delivery Issue": 1,
    "Product Complaint": 0,     # base Low
    "Payment Failure": 2,       # base High
    "Account / Security": 2,
    "Promotion / Pricing": 0,
    "Other": 0,
}

CRITICAL_CUES = re.compile(
    r"\b(asap|emergency|urgent|right now|immediately|stolen|hacked|fraud|"
    r"unauthorized|critical|broken in transit|compromised|phishing|"
    r"chargeback|lawsuit|legal|fired|reported|cancel(?:l)?(?:ed|ing)? subscription)\b",
    re.I,
)
HIGH_CUES = re.compile(
    r"\b(broken|shattered|damaged|defective|missing|lost|late|never arrived|"
    r"already \d+ days|days ago|double charged|charged twice|duplicate charge|"
    r"wrong address|locked out)\b",
    re.I,
)


def score(text: str, intent: str, sentiment_score: float) -> str:
    base = INTENT_BASELINE.get(intent, 0)
    bonus = 0
    if CRITICAL_CUES.search(text or ""):
        bonus += 2
    if HIGH_CUES.search(text or ""):
        bonus += 1
    if sentiment_score is not None:
        if sentiment_score <= -0.6:
            bonus += 1
        elif sentiment_score >= 0.3:
            bonus -= 1  # happy customer = lower urgency

    total = base + bonus
    if total >= 4:
        return "Critical"
    if total >= 2:
        return "High"
    if total >= 1:
        return "Medium"
    return "Low"
