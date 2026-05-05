"""Keyword extraction — TF-IDF unigrams/bigrams against a small in-domain corpus.

We avoid heavy deps (rake-nltk) by using sklearn's TfidfVectorizer fit lazily on
the union of training examples + any tickets we've seen so far. The top-k tokens
of the input by IDF-weighted frequency are returned.
"""
from __future__ import annotations
from sklearn.feature_extraction.text import TfidfVectorizer

from .preprocess import tokenize, remove_stopwords
from .training_data import EXAMPLES

_BASE_CORPUS = [t for t, _ in EXAMPLES]
_vectorizer: TfidfVectorizer | None = None


def _fit_vectorizer() -> TfidfVectorizer:
    v = TfidfVectorizer(
        ngram_range=(1, 2),
        min_df=1,
        sublinear_tf=True,
        token_pattern=r"[A-Za-z][A-Za-z'-]{1,}",
    )
    v.fit(_BASE_CORPUS)
    return v


def _get_vectorizer() -> TfidfVectorizer:
    global _vectorizer
    if _vectorizer is None:
        _vectorizer = _fit_vectorizer()
    return _vectorizer


# Domain-specific high-signal keyword lexicon — boosts terms even if rare in corpus.
_DOMAIN_BOOST = {
    "refund", "broken", "damaged", "shattered", "cracked", "delayed",
    "late", "missing", "tracking", "wrong", "size", "battery", "charge",
    "double", "refund", "return", "defective", "exchange", "expired",
    "discount", "coupon", "duplicate", "lost", "delivered", "stolen",
    "warranty", "replacement", "shipping", "package", "phishing", "hacked",
    "compromised", "locked", "login", "fraud", "suspicious",
}


def extract(text: str, k: int = 6) -> list[str]:
    """Return up to k keywords/keyphrases ordered by score."""
    if not text or not text.strip():
        return []

    v = _get_vectorizer()
    try:
        X = v.transform([text])
    except Exception:
        return []

    feature_names = v.get_feature_names_out()
    scores = X.toarray()[0]

    # Boost domain-relevant tokens
    domain_bonus = 0.5
    boosted = []
    for i, score in enumerate(scores):
        if score == 0:
            continue
        feat = feature_names[i]
        s = float(score)
        if any(d in feat.split() for d in _DOMAIN_BOOST):
            s += domain_bonus
        boosted.append((feat, s))

    # Fallback to raw token frequency if vectorizer found nothing (very short input)
    if not boosted:
        tokens = remove_stopwords(tokenize(text))
        return list(dict.fromkeys(tokens))[:k]

    boosted.sort(key=lambda x: -x[1])
    seen, out = set(), []
    for feat, _ in boosted:
        # de-duplicate keyphrases that fully cover already-seen tokens
        toks = feat.split()
        norm = " ".join(sorted(toks))
        if norm in seen:
            continue
        seen.add(norm)
        out.append(feat)
        if len(out) >= k:
            break
    return out
