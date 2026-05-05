"""Lightweight VADER-style lexicon sentiment scorer.

Avoids the NLTK download dance — we hand-roll a small lexicon tuned to support
language. Returns (label, score) where score is in [-1, 1] and label is one of
{Angry, Frustrated, Disappointed, Concerned, Worried, Neutral, Positive}.
"""
from __future__ import annotations

from .preprocess import tokenize

# Word → polarity weight (-1 very negative, +1 very positive)
LEXICON: dict[str, float] = {
    # strong negative
    "hate": -0.9, "terrible": -0.9, "awful": -0.9, "horrible": -0.9,
    "furious": -1.0, "outraged": -1.0, "disgusted": -0.9, "scammed": -1.0,
    "fraud": -1.0, "fraudulent": -1.0, "stolen": -0.9, "ripped": -0.9,
    "cheated": -0.9, "garbage": -0.9, "crap": -0.8, "useless": -0.8,
    "broken": -0.7, "shattered": -0.8, "damaged": -0.7, "smashed": -0.8,
    "cracked": -0.6, "defective": -0.7, "unusable": -0.8,
    # negative emotion
    "angry": -0.8, "mad": -0.7, "frustrated": -0.7, "annoyed": -0.6,
    "disappointed": -0.6, "upset": -0.6, "unhappy": -0.6,
    "concerned": -0.4, "worried": -0.5, "anxious": -0.5,
    "sad": -0.5, "bad": -0.5, "wrong": -0.5, "poor": -0.5,
    "missing": -0.5, "lost": -0.5, "late": -0.4, "delayed": -0.4,
    "stuck": -0.4, "expired": -0.3, "rejected": -0.4, "declined": -0.4,
    "duplicate": -0.4, "double": -0.3, "twice": -0.3, "suspicious": -0.5,
    "compromised": -0.7, "hacked": -0.8,
    # mild negative
    "issue": -0.2, "problem": -0.3, "trouble": -0.3, "complaint": -0.3,
    "doesn't": -0.2, "never": -0.3, "no": -0.1, "not": -0.1,
    # positive
    "love": 0.9, "great": 0.7, "amazing": 0.9, "awesome": 0.9,
    "fantastic": 0.9, "excellent": 0.9, "good": 0.5, "nice": 0.4,
    "happy": 0.6, "pleased": 0.5, "satisfied": 0.5, "thanks": 0.4,
    "thank": 0.4, "perfect": 0.8, "wonderful": 0.8,
}

# Phrases that flip / amplify nearby polarity (very small set)
INTENSIFIERS = {"very", "really", "extremely", "so", "absolutely", "totally"}
NEGATORS = {"not", "no", "never", "n't", "didn't", "doesn't", "wasn't", "won't"}


def score(text: str) -> tuple[str, float]:
    """Return (sentiment_label, signed_score in [-1, 1])."""
    tokens = tokenize(text)
    if not tokens:
        return "Neutral", 0.0

    total = 0.0
    n_polar = 0
    for i, tok in enumerate(tokens):
        w = LEXICON.get(tok)
        if w is None:
            continue
        # contextual modifiers in a 2-token window before this one
        window = tokens[max(0, i - 2):i]
        if any(t in NEGATORS for t in window):
            w = -w
        if any(t in INTENSIFIERS for t in window):
            w *= 1.4
        total += w
        n_polar += 1

    if n_polar == 0:
        return "Neutral", 0.0

    avg = total / max(n_polar, 1)
    # Squash to [-1, 1]
    avg = max(-1.0, min(1.0, avg))

    label = _label_for(avg, tokens)
    return label, round(avg, 3)


def _label_for(s: float, tokens: list[str]) -> str:
    if s >= 0.4:
        return "Positive"
    if s >= 0.05:
        return "Mildly positive"
    if s > -0.15:
        return "Neutral"
    # Pick a more specific negative label based on tokens present
    has_anger = any(t in tokens for t in ("angry", "mad", "furious", "outraged", "hate"))
    has_worry = any(t in tokens for t in ("worried", "anxious", "scared", "concerned",
                                            "suspicious", "compromised", "hacked", "phishing"))
    has_disappoint = any(t in tokens for t in ("disappointed", "let", "unhappy", "expected"))
    if s <= -0.6:
        return "Angry" if has_anger else "Frustrated"
    if has_worry:
        return "Worried"
    if has_disappoint:
        return "Disappointed"
    if s <= -0.3:
        return "Frustrated"
    return "Concerned"
