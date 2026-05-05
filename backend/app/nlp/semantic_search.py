"""Semantic search over historical resolved tickets using TF-IDF + cosine similarity.

The index rebuilds on demand from the database. For larger deployments swap
this for sentence-transformers + FAISS.
"""
from __future__ import annotations

from typing import Iterable
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from .preprocess import clean_for_classifier


class SemanticIndex:
    def __init__(self):
        self.vectorizer: TfidfVectorizer | None = None
        self.matrix = None
        self.docs: list[dict] = []  # each: {id, text, summary, intent}

    def build(self, docs: Iterable[dict]) -> None:
        self.docs = list(docs)
        if not self.docs:
            self.vectorizer, self.matrix = None, None
            return
        corpus = [d["text"] for d in self.docs]
        self.vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            min_df=1,
            sublinear_tf=True,
            preprocessor=clean_for_classifier,
        )
        self.matrix = self.vectorizer.fit_transform(corpus)

    def search(self, query: str, k: int = 3) -> list[dict]:
        if not self.vectorizer or self.matrix is None or not self.docs:
            return []
        qv = self.vectorizer.transform([query])
        sims = cosine_similarity(qv, self.matrix)[0]
        top_idx = np.argsort(-sims)[:k]
        out = []
        for i in top_idx:
            sim = float(sims[i])
            if sim < 0.05:
                continue
            d = self.docs[int(i)]
            out.append({
                "id": d.get("id"),
                "summary": d.get("summary") or d.get("text", "")[:120],
                "intent": d.get("intent"),
                "similarity": round(sim, 3),
            })
        return out


_INDEX = SemanticIndex()


def get_index() -> SemanticIndex:
    return _INDEX
