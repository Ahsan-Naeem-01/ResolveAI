"""Intent classifier — TF-IDF + Logistic Regression over labeled examples."""
from __future__ import annotations

from pathlib import Path
import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.model_selection import cross_val_score, StratifiedKFold

from .preprocess import clean_for_classifier
from .training_data import EXAMPLES, INTENTS

MODEL_PATH = Path(__file__).resolve().parent / "_intent_model.joblib"


def _build_pipeline() -> Pipeline:
    return Pipeline([
        ("tfidf", TfidfVectorizer(
            ngram_range=(1, 2),
            min_df=1,
            sublinear_tf=True,
            preprocessor=clean_for_classifier,
        )),
        ("clf", LogisticRegression(max_iter=1000, C=4.0, class_weight="balanced")),
    ])


def train() -> dict:
    """Train and persist the intent classifier. Returns evaluation metrics."""
    texts = [t for t, _ in EXAMPLES]
    labels = [lbl for _, lbl in EXAMPLES]
    pipe = _build_pipeline()

    # cross-val accuracy for honest reporting (3-fold given small dataset)
    n_per_class = min({labels.count(c) for c in set(labels)})
    n_folds = max(2, min(5, n_per_class))
    skf = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=42)
    cv = cross_val_score(pipe, texts, labels, cv=skf, scoring="accuracy")
    accuracy = float(np.mean(cv))

    pipe.fit(texts, labels)
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, MODEL_PATH)
    return {"accuracy": accuracy, "n_samples": len(texts), "folds": n_folds}


_pipeline_cache: Pipeline | None = None


def _get_pipeline() -> Pipeline:
    global _pipeline_cache
    if _pipeline_cache is None:
        if not MODEL_PATH.exists():
            train()
        _pipeline_cache = joblib.load(MODEL_PATH)
    return _pipeline_cache


def reload() -> None:
    global _pipeline_cache
    _pipeline_cache = None


def predict(text: str) -> tuple[str, float]:
    """Return (intent_label, confidence) for the given text."""
    pipe = _get_pipeline()
    proba = pipe.predict_proba([text])[0]
    classes = pipe.classes_
    idx = int(np.argmax(proba))
    return str(classes[idx]), float(proba[idx])


def predict_topk(text: str, k: int = 3) -> list[tuple[str, float]]:
    pipe = _get_pipeline()
    proba = pipe.predict_proba([text])[0]
    classes = pipe.classes_
    pairs = sorted(zip(classes, proba), key=lambda x: -x[1])[:k]
    return [(str(c), float(p)) for c, p in pairs]
