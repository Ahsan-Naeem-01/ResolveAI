"""End-to-end NLP pipeline. Used by /process-query and ticket regeneration."""
from __future__ import annotations
import time
from typing import Any

from . import classifier, entities as entities_mod, keywords as keywords_mod
from . import sentiment as sentiment_mod, urgency as urgency_mod
from . import response as response_mod, routing
from . import semantic_search
from . import llm


def process(query: str, *, customer_name: str | None = None,
            tone: str | None = None) -> dict[str, Any]:
    """Run the full pipeline. Returns the structured result + per-step timings."""
    steps: list[dict[str, Any]] = []

    # 1. Preprocessing (placeholder timing — happens implicitly elsewhere)
    t0 = time.perf_counter()
    text = (query or "").strip()
    steps.append(_step("Preprocessing", "Tokenized & normalized", t0))

    # 2. Intent classification
    t0 = time.perf_counter()
    intent, conf = classifier.predict(text)
    steps.append(_step("Intent classification",
                       f"{intent} · {conf*100:.0f}%", t0))

    # 3. Entity extraction
    t0 = time.perf_counter()
    ents = entities_mod.extract(text)
    detail = ", ".join(k for k in ("order_id", "product", "date", "tracking_number") if k in ents) or "none found"
    steps.append(_step("Entity extraction", detail, t0))

    # 4. Keyword extraction
    t0 = time.perf_counter()
    kws = keywords_mod.extract(text, k=6)
    steps.append(_step("Keyword extraction", f"{len(kws)} terms", t0))

    # 5. Sentiment & urgency
    t0 = time.perf_counter()
    sentiment_label, sentiment_value = sentiment_mod.score(text)
    urgency = urgency_mod.score(text, intent, sentiment_value)
    steps.append(_step("Sentiment & urgency",
                       f"{sentiment_label} · {urgency}", t0))

    # 6. Semantic search
    t0 = time.perf_counter()
    similar = semantic_search.get_index().search(text, k=3)
    steps.append(_step("Semantic search", f"{len(similar)} similar resolved tickets", t0))

    # 7. Solution recommendation
    t0 = time.perf_counter()
    recommended = response_mod.recommend_action(intent, urgency, ents)
    steps.append(_step("Recommendation", "Action selected", t0))

    # 8. Auto reply — try live LLM first, fall back to template if unavailable
    t0 = time.perf_counter()
    llm_reply = llm.generate_reply(
        intent=intent,
        urgency=urgency,
        sentiment=sentiment_label,
        entities=ents,
        customer_name=customer_name,
        original_message=text,
        tone=tone,
    )
    if llm_reply:
        auto_reply = llm_reply
        reply_source = "llm"
        reply_desc = "Reply composed (live LLM)"
    else:
        auto_reply = response_mod.compose_reply(
            intent, urgency, sentiment_label, ents,
            customer_name=customer_name, tone=tone,
        )
        reply_source = "template"
        reply_desc = "Reply composed (template fallback)"
    steps.append(_step("Response generation", reply_desc, t0))

    # 9. Routing
    t0 = time.perf_counter()
    route = routing.route_for(intent)
    steps.append(_step("Ticket routing", route, t0))

    summary = response_mod.compose_summary(text, intent, {**ents, "keywords": kws})

    return {
        "intent": intent,
        "intent_confidence": conf,
        "urgency": urgency,
        "sentiment": sentiment_label,
        "sentiment_score": sentiment_value,
        "entities": ents,
        "keywords": kws,
        "summary": summary,
        "recommended_action": recommended,
        "auto_reply": auto_reply,
        "reply_source": reply_source,
        "ticket_route": route,
        "similar_tickets": similar,
        "steps": steps,
    }


def _step(name: str, desc: str, started_at: float) -> dict[str, Any]:
    elapsed_ms = (time.perf_counter() - started_at) * 1000.0
    return {"name": name, "desc": desc, "ms": round(elapsed_ms, 1)}
