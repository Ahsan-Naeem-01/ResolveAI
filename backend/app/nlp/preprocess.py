"""Lightweight text preprocessing — tokenize, lowercase, strip stopwords."""
import re

STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from",
    "has", "have", "i", "i've", "i'd", "i'm", "if", "in", "is", "it", "its",
    "of", "on", "or", "that", "the", "this", "to", "was", "were", "will",
    "with", "would", "you", "your", "you're", "yours", "we", "our", "us",
    "they", "them", "their", "he", "she", "his", "her", "do", "does", "did",
    "so", "just", "really", "very", "had", "been", "am", "me", "my",
    "there", "here", "out", "up", "down", "over", "under", "again", "than",
    "then", "now", "no", "not", "only", "also", "still", "even", "ever",
    "all", "any", "some", "few", "more", "most", "other", "such", "own",
    "can", "could", "should", "may", "might", "must", "shall", "ought",
    "about", "into", "through", "during", "before", "after", "between",
    "because", "while", "where", "when", "who", "which", "whom", "whose",
    "how", "why", "what", "doing", "having", "being",
}

_TOKEN_RE = re.compile(r"[A-Za-z0-9]+(?:'[A-Za-z]+)?")


def tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall((text or "").lower())


def remove_stopwords(tokens: list[str]) -> list[str]:
    return [t for t in tokens if t not in STOPWORDS and len(t) > 1]


def normalize(text: str) -> str:
    """Collapse whitespace, strip control chars, keep punctuation for sentiment."""
    text = re.sub(r"\s+", " ", text or "")
    return text.strip()


def clean_for_classifier(text: str) -> str:
    """Lowercase + token rejoin, light cleanup. Stopwords kept — TF-IDF handles weighting."""
    return " ".join(tokenize(text))
