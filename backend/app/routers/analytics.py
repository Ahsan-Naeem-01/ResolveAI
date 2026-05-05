from __future__ import annotations
from datetime import datetime, timedelta, timezone
from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import require_admin, require_manager
from ..database import get_db
from ..models import Ticket, User, Reply

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _aware(dt):
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


@router.get("/manager", dependencies=[Depends(require_manager)])
def manager_dashboard(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    open_statuses = ("ai-suggested", "needs-review", "escalated")

    open_count = db.query(func.count(Ticket.id)).filter(Ticket.status.in_(open_statuses)).scalar() or 0
    resolved = db.query(Ticket).filter(Ticket.status.in_(("auto-resolved", "resolved"))).all()

    # Average handle time (seconds → mm:ss)
    times = [t.resolution_seconds for t in resolved if t.resolution_seconds]
    avg_secs = (sum(times) / len(times)) if times else 318.0
    avg_label = _format_mm_ss(avg_secs)

    # AI auto-resolved share
    auto_n = sum(1 for t in resolved if t.status == "auto-resolved")
    pct_auto = round(100 * auto_n / max(len(resolved), 1)) if resolved else 68

    # CSAT
    csat_vals = [t.csat for t in resolved if t.csat is not None]
    csat = round(sum(csat_vals) / len(csat_vals), 2) if csat_vals else 4.71

    # Hourly volume — today (8a..7p)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    todays = db.query(Ticket).filter(Ticket.created_at >= today_start).all()
    bucket_labels = ["8a","9a","10a","11a","12p","1p","2p","3p","4p","5p","6p","7p"]
    bucket_hours = list(range(8, 20))
    counts = [0] * len(bucket_hours)
    for t in todays:
        c = _aware(t.created_at)
        if c is None: continue
        h = c.astimezone(timezone.utc).hour
        if h in bucket_hours:
            counts[bucket_hours.index(h)] += 1
    if not any(counts):
        # demo fallback so the chart isn't empty on a fresh DB
        counts = [38, 42, 51, 47, 62, 71, 68, 74, 89, 82, 76, 65]

    # SLA breach rates by urgency over last 7d
    week_ago = now - timedelta(days=7)
    sla_window = {"Critical": 15*60, "High": 60*60, "Medium": 4*3600, "Low": 24*3600}
    sla = {}
    for level, secs in sla_window.items():
        recent = db.query(Ticket).filter(
            Ticket.urgency == level,
            Ticket.created_at >= week_ago,
            Ticket.status.in_(("auto-resolved", "resolved")),
        ).all()
        if not recent:
            # baseline placeholder so the dashboard reads sensibly on empty data
            sla[level] = {"Critical": 92, "High": 87, "Medium": 78, "Low": 96}[level]
            continue
        on_time = sum(1 for t in recent if (t.resolution_seconds or 0) <= secs)
        sla[level] = round(100 * on_time / len(recent))

    # Per-agent table — based on tickets they were assigned and whose status is resolved
    agents_q = db.query(User).filter(User.role == "agent").all()
    agents_payload = []
    for ag in agents_q:
        tk = [t for t in ag.assigned_tickets if t.status in ("auto-resolved", "resolved")]
        handled = len(tk)
        avg_aht = (sum((t.resolution_seconds or 0) for t in tk) / handled / 60) if handled else 0
        avg_csat = (sum((t.csat or 0) for t in tk if t.csat is not None) / max(1, sum(1 for t in tk if t.csat is not None))) if tk else 0
        ai_assist = (sum(1 for t in tk if t.ai_assisted) / handled) if handled else 0
        # Fall back to demo numbers if the agent has no data yet
        if handled == 0:
            preset = {
                "Jordan Maeda":  {"handled": 142, "ahtMin": 4.2, "csat": 4.8, "ai": 0.78, "status": "online"},
                "Lina Okafor":   {"handled": 128, "ahtMin": 5.1, "csat": 4.7, "ai": 0.71, "status": "online"},
                "Rafael Mendes": {"handled": 119, "ahtMin": 6.3, "csat": 4.5, "ai": 0.65, "status": "break"},
                "Ash Patel":     {"handled": 97,  "ahtMin": 3.8, "csat": 4.9, "ai": 0.84, "status": "online"},
                "Yuki Tanaka":   {"handled": 88,  "ahtMin": 7.1, "csat": 4.3, "ai": 0.58, "status": "offline"},
                "Sam Reyes":     {"handled": 76,  "ahtMin": 5.5, "csat": 4.6, "ai": 0.69, "status": "online"},
            }.get(ag.name, {"handled": 0, "ahtMin": 0, "csat": 0, "ai": 0, "status": "offline"})
            agents_payload.append({"name": ag.name, "initials": ag.initials, **preset})
        else:
            agents_payload.append({
                "name": ag.name, "initials": ag.initials,
                "handled": handled,
                "ahtMin": round(avg_aht, 1),
                "csat": round(avg_csat, 2) if avg_csat else 0,
                "ai": round(ai_assist, 2),
                "status": "online",
            })

    return {
        "kpis": {
            "open": open_count or 412,
            "open_delta_pct": -8.2,
            "open_spark": [420,431,418,402,398,415, open_count or 412],
            "avg_resolution_label": avg_label,
            "avg_resolution_delta_pct": -12,
            "aht_spark": [6.2, 6.0, 5.9, 5.8, 5.6, 5.4, round(avg_secs/60, 1)],
            "auto_resolved_pct": pct_auto,
            "auto_resolved_delta_pts": 4,
            "auto_spark": [58, 60, 62, 63, 65, 66, pct_auto],
            "csat": csat,
            "csat_delta": 0.08,
            "csat_spark": [4.5, 4.55, 4.6, 4.62, 4.65, 4.68, csat],
        },
        "volume_today": {
            "labels": bucket_labels,
            "values": counts,
        },
        "sla_7d": sla,
        "agents": agents_payload,
    }


@router.get("/admin", dependencies=[Depends(require_admin)])
def admin_dashboard(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    month_ago = now - timedelta(days=30)

    all_tickets = db.query(Ticket).filter(Ticket.created_at >= month_ago).all()
    total = len(all_tickets) or 12484

    # Cost-per-ticket — assume $4.20 per human-handled, $0.30 per auto-resolved
    auto_cnt = sum(1 for t in all_tickets if t.status == "auto-resolved")
    human_cnt = max(total - auto_cnt, 0)
    cost_total = auto_cnt * 0.30 + human_cnt * 4.20
    cost_per = round(cost_total / max(total, 1), 2) if all_tickets else 1.42

    # Refund $ flagged
    refund_dollars = 28910
    if all_tickets:
        # crude: $42 average refund on Refund Request tickets
        rr = [t for t in all_tickets if t.intent == "Refund Request"]
        refund_dollars = round(len(rr) * 42)

    # Intent distribution
    counter = Counter(t.intent or "Other" for t in all_tickets)
    if not counter:
        counter = Counter({
            "Delivery Issue": 31, "Refund Request": 24, "Product Complaint": 18,
            "Payment Failure": 12, "Account / Security": 8, "Other": 7,
        })
    grand = sum(counter.values()) or 1
    palette = {
        "Delivery Issue": "var(--accent)",
        "Refund Request": "var(--violet)",
        "Product Complaint": "var(--good)",
        "Payment Failure": "var(--warn)",
        "Account / Security": "var(--bad)",
        "Promotion / Pricing": "var(--accent-ink)",
        "Other": "var(--ink-3)",
    }
    intents = [
        {"name": name, "v": round(100 * c / grand), "color": palette.get(name, "var(--ink-3)")}
        for name, c in counter.most_common()
    ]

    # Top product issues
    product_counter = Counter()
    issue_tag_by_product: dict[str, str] = {}
    for t in all_tickets:
        p = (t.entities or {}).get("product")
        if not p: continue
        product_counter[p] += 1
        tag = (t.keywords or [None])[0]
        if tag and p not in issue_tag_by_product:
            issue_tag_by_product[p] = tag
    issues = []
    for product, count in product_counter.most_common(5):
        issues.append({
            "product": product, "count": count,
            "change": 0,
            "tag": issue_tag_by_product.get(product, "general"),
            "sev": "med",
        })
    if not issues:
        issues = [
            {"product": "Aurora Mug Set (4-pc)", "count": 47, "change": 23, "sev": "high", "tag": "packaging"},
            {"product": "Halo ANC Headphones",   "count": 38, "change": 14, "sev": "med",  "tag": "battery life"},
            {"product": "Cloud Hoodie",          "count": 26, "change": -8, "sev": "low",  "tag": "sizing"},
            {"product": "Linen Throw Blanket",   "count": 21, "change":  4, "sev": "med",  "tag": "shipping delays"},
            {"product": "Glass Carafe",          "count": 17, "change": 41, "sev": "high", "tag": "packaging"},
        ]

    # 7×24 ticket-arrival heatmap (last 4 weeks). Falls back to a synthetic shape on empty data.
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    grid = [[0] * 24 for _ in range(7)]
    four_weeks = now - timedelta(days=28)
    recent = db.query(Ticket).filter(Ticket.created_at >= four_weeks).all()
    for t in recent:
        c = _aware(t.created_at)
        if not c: continue
        c_local = c.astimezone(timezone.utc)
        grid[c_local.weekday()][c_local.hour] += 1

    max_v = max((max(row) for row in grid), default=0)
    if max_v == 0:
        # Synthetic plausible pattern
        import math
        for di in range(7):
            for hi in range(24):
                peak = 1.0 if 9 <= hi <= 19 else 0.3
                weekend = 0.6 if di >= 5 else 1.0
                noise = 0.5 + math.sin(di * 7 + hi) * 0.4 + math.cos(hi * 1.3) * 0.2
                grid[di][hi] = round(max(0.0, min(1.0, peak * weekend * noise)), 3)
    else:
        grid = [[round(v / max_v, 3) for v in row] for row in grid]

    # CSAT
    csat_vals = [t.csat for t in all_tickets if t.csat is not None]
    csat = round(sum(csat_vals) / len(csat_vals), 2) if csat_vals else 4.71

    return {
        "kpis": {
            "total": total,
            "total_delta_pct": 9.4,
            "cost_per": cost_per,
            "cost_delta_pct": -38,
            "refund_dollars": refund_dollars,
            "refund_delta_pct": 6.1,
            "csat": csat,
            "csat_delta": 0.08,
        },
        "intents": intents,
        "top_issues": issues,
        "heatmap": {"days": days, "grid": grid},
    }


def _format_mm_ss(secs: float) -> str:
    secs = int(secs)
    return f"{secs // 60}m {secs % 60:02d}s"
