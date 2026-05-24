"""Labeled examples for the intent classifier — loaded from training_data.csv.

CSV format: header row `text,intent` followed by one example per row. Edit
training_data.csv (e.g. in Excel) to add or remove examples; delete the cached
_intent_model.joblib afterwards so the classifier retrains on next prediction.
"""
from __future__ import annotations

import csv
from pathlib import Path

CSV_PATH = Path(__file__).resolve().parent / "training_data.csv"

INTENTS = [
    "Refund Request",
    "Delivery Issue",
    "Product Complaint",
    "Payment Failure",
    "Account / Security",
    "Promotion / Pricing",
    "Other",
]


def _load_examples() -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    with CSV_PATH.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            text = (row.get("text") or "").strip()
            intent = (row.get("intent") or "").strip()
            if text and intent:
                rows.append((text, intent))
    return rows


EXAMPLES: list[tuple[str, str]] = _load_examples()
