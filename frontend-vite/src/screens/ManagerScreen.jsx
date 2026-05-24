import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppShell, { Header } from "../components/AppShell.jsx";
import Icon from "../components/Icon.jsx";
import Spark from "../components/Spark.jsx";
import { Skeleton, SkeletonKpiRow, SkeletonCard } from "../components/Skeleton.jsx";
import { api } from "../lib/api.js";
import { URGENCY_CLASS, STATUS_CLASS, STATUS_LABEL } from "../lib/format.js";

// Sidebar nav id → title bar label. Mirrors roles.js so each section reads
// "Team / <thing>" in the header.
const NAV_TITLES = {
  perf: { crumb: "Team", title: "Team performance" },
  queue: { crumb: "Team", title: "Live queue" },
  sla: { crumb: "Team", title: "SLA monitor" },
  agents: { crumb: "Team", title: "Agents" },
  shifts: { crumb: "Team", title: "Shifts & coverage" },
  training: { crumb: "Team", title: "Coaching" },
  trends: { crumb: "Insights", title: "Complaint trends" },
  macros: { crumb: "Insights", title: "Macro performance" },
};

export default function ManagerScreen(shellProps) {
  const [activeNavId, setActiveNavId] = useState(
    shellProps?.role?.activeNavId || "perf"
  );

  // Per-view content. The shell + header are constant; the body switches.
  let body;
  if (activeNavId === "queue") {
    body = <LiveQueueView />;
  } else if (activeNavId === "perf") {
    body = <TeamPerformanceView />;
  } else {
    const meta = NAV_TITLES[activeNavId] || NAV_TITLES.perf;
    body = <ComingSoonView title={meta.title} />;
  }

  return (
    <AppShell
      {...shellProps}
      activeNavId={activeNavId}
      onNavChange={setActiveNavId}
    >
      {body}
    </AppShell>
  );
}

/* ─────────────────────────────────────────────────────────────
   Team performance — the existing dashboard, unchanged behavior
   ───────────────────────────────────────────────────────────── */

function TeamPerformanceView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.managerDashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <Header
        crumb="Team"
        title="Team performance"
        actions={
          <>
            <button className="btn btn-sm">
              <Icon name="clock" size={12} className="" /> Today
            </button>
            <button className="btn btn-sm">
              <Icon name="upload" size={12} className="" /> Export
            </button>
          </>
        }
      />
      <div className="content">
        <div className="content-narrow">
          {error && <div className="error-banner">{error}</div>}
          {!data && !error && (
            <>
              <SkeletonKpiRow cols={4} />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.6fr 1fr",
                  gap: 14,
                  marginBottom: 18,
                }}
              >
                <SkeletonCard height={220} />
                <SkeletonCard height={220} />
              </div>
              <SkeletonCard height={240} />
            </>
          )}
          {data && <DashboardBody data={data} />}
        </div>
      </div>
    </>
  );
}

function DashboardBody({ data }) {
  const k = data.kpis;
  const v = data.volume_today;
  const maxV = Math.max(...v.values, 1);
  const sla = data.sla_7d;

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <Kpi
          label="Open tickets"
          value={k.open}
          deltaPct={k.open_delta_pct}
          spark={k.open_spark}
        />
        <Kpi
          label="Avg. resolution"
          value={k.avg_resolution_label}
          deltaPct={k.avg_resolution_delta_pct}
          spark={k.aht_spark}
          deltaInverse
        />
        <Kpi
          label="Auto-resolved by AI"
          value={`${k.auto_resolved_pct}%`}
          delta={`${k.auto_resolved_delta_pts > 0 ? "+" : ""}${
            k.auto_resolved_delta_pts
          } pts`}
          deltaUp={k.auto_resolved_delta_pts >= 0}
          spark={k.auto_spark}
        />
        <Kpi
          label="CSAT"
          value={k.csat}
          delta={(k.csat_delta > 0 ? "+" : "") + k.csat_delta.toFixed(2)}
          deltaUp={k.csat_delta >= 0}
          spark={k.csat_spark}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.6fr 1fr",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <div className="card">
          <div className="card-header">
            <div className="card-title">Ticket volume · today</div>
            <span className="pill pill-good" style={{ marginLeft: "auto" }}>
              <span className="pill-dot" /> Within capacity
            </span>
          </div>
          <div className="card-body">
            <div className="bars">
              {v.values.map((value, i) => (
                <div className="bar" key={i}>
                  <div className="bar-track">
                    <div
                      className={`bar-fill ${value === maxV ? "alt" : ""}`}
                      style={{ height: `${(value / maxV) * 100}%` }}
                      data-v={value}
                    />
                  </div>
                  <div className="bar-label">{v.labels[i]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">SLA compliance · 7d</div>
          </div>
          <div className="card-body">
            <SlaRow label="Critical < 15m" pct={sla.Critical} />
            <SlaRow label="High < 1h" pct={sla.High} />
            <SlaRow label="Medium < 4h" pct={sla.Medium} />
            <SlaRow label="Low < 24h" pct={sla.Low} />
            <div className="divider" />
            <div className="row small muted">
              <span>3 critical breaches need follow-up</span>
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginLeft: "auto" }}
              >
                Review →
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Agents</div>
          <span className="muted small" style={{ marginLeft: "auto" }}>
            {data.agents.filter((a) => a.status === "online").length} of{" "}
            {data.agents.length} online
          </span>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Agent</th>
              <th style={{ textAlign: "right" }}>Handled</th>
              <th style={{ textAlign: "right" }}>Avg handle</th>
              <th style={{ textAlign: "right" }}>CSAT</th>
              <th>AI assist rate</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.agents.map((a) => (
              <tr key={a.name}>
                <td>
                  <div className="row">
                    <div
                      className="avatar"
                      style={{ width: 26, height: 26, fontSize: 10 }}
                    >
                      {a.initials}
                    </div>
                    <span style={{ fontWeight: 500, color: "var(--ink)" }}>
                      {a.name}
                    </span>
                  </div>
                </td>
                <td className="mono" style={{ textAlign: "right" }}>
                  {a.handled}
                </td>
                <td className="mono" style={{ textAlign: "right" }}>
                  {a.ahtMin}m
                </td>
                <td className="mono" style={{ textAlign: "right" }}>
                  {a.csat ? a.csat.toFixed(1) : "—"}
                </td>
                <td>
                  <div className="row" style={{ gap: 8 }}>
                    <div className="cat-track" style={{ flex: 1 }}>
                      <div
                        className="cat-fill"
                        style={{ width: `${(a.ai || 0) * 100}%` }}
                      />
                    </div>
                    <span
                      className="mono small"
                      style={{ width: 32, textAlign: "right" }}
                    >
                      {Math.round((a.ai || 0) * 100)}%
                    </span>
                  </div>
                </td>
                <td>
                  <span
                    className={`pill ${
                      a.status === "online"
                        ? "pill-good"
                        : a.status === "break"
                        ? "pill-warn"
                        : ""
                    }`}
                  >
                    <span className="pill-dot" /> {a.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Kpi({ label, value, delta, deltaPct, deltaUp, deltaInverse, spark }) {
  let deltaText = delta;
  let isUp;
  if (deltaPct != null) {
    deltaText = `${Math.abs(deltaPct).toFixed(1)}%`;
    isUp = deltaInverse ? deltaPct < 0 : deltaPct > 0;
  } else if (deltaUp != null) {
    isUp = deltaUp;
  }
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="row">
        <div className="kpi-value">{value}</div>
        {deltaText && (
          <span
            className={`kpi-delta ${isUp ? "up" : "down"}`}
            style={{ marginLeft: "auto" }}
          >
            <Icon name={isUp ? "arrowUp" : "arrowDown"} size={10} className="" />{" "}
            {deltaText}
          </span>
        )}
      </div>
      {spark && <Spark data={spark} w={140} h={28} />}
    </div>
  );
}

function SlaRow({ label, pct }) {
  const color =
    pct >= 90 ? "var(--good)" : pct >= 80 ? "var(--warn)" : "var(--bad)";
  return (
    <div className="cat-row">
      <span>{label}</span>
      <div className="cat-track">
        <div
          className="cat-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="cat-val">{pct}%</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Live queue — every open ticket across the team, in one table.
   Polls every 15s. Lets a manager spot SLA risk and reassign.
   ───────────────────────────────────────────────────────────── */

// SLA windows in seconds, mirrored from backend analytics.py.
const SLA_SECONDS = {
  Critical: 15 * 60,
  High: 60 * 60,
  Medium: 4 * 3600,
  Low: 24 * 3600,
};

// Statuses we consider "open" — anything still on someone's plate.
const OPEN_STATUSES = ["ai-suggested", "needs-review", "escalated"];

const QUEUE_FILTERS = [
  { id: "all", label: "All open" },
  { id: "unassigned", label: "Unassigned" },
  { id: "breach", label: "Breaching SLA" },
  { id: "critical", label: "Critical" },
  { id: "escalated", label: "Escalated" },
];

const REFRESH_MS = 15_000;

function LiveQueueView() {
  const [tickets, setTickets] = useState([]);
  const [agents, setAgents] = useState([]);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [busyCode, setBusyCode] = useState(null);
  // Re-render once per second so SLA countdowns tick smoothly.
  const [, setTick] = useState(0);

  const refresh = useCallback(async () => {
    try {
      // Pull every open status in parallel — /api/tickets only takes one
      // status at a time, so we fan out and merge.
      const lists = await Promise.all(
        OPEN_STATUSES.map((s) => api.listTickets({ status: s, limit: 200 }))
      );
      const merged = lists.flat();
      // Dedup just in case (shouldn't happen since statuses are disjoint).
      const seen = new Set();
      const unique = [];
      for (const t of merged) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        unique.push(t);
      }
      setTickets(unique);
      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    api
      .listAgents()
      .then(setAgents)
      .catch(() => {});
  }, [refresh]);

  // Poll every 15s. Pause when the tab is hidden so we don't hammer the
  // backend while the manager is in another window.
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) refresh();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Tick the clock so SLA countdowns update without a network round-trip.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Annotate each ticket with SLA seconds remaining (negative = breached).
  const now = Date.now();
  const annotated = useMemo(() => {
    return tickets.map((t) => {
      const window = SLA_SECONDS[t.urgency] ?? SLA_SECONDS.Medium;
      const createdMs = t.created_at ? Date.parse(t.created_at) : now;
      const elapsedSec = (now - createdMs) / 1000;
      const remainingSec = window - elapsedSec;
      return { ...t, sla_remaining_sec: remainingSec };
    });
  }, [tickets, now]);

  const filtered = useMemo(() => {
    let rows = annotated;
    if (filter === "unassigned") rows = rows.filter((t) => !t.assignee_id);
    else if (filter === "breach")
      rows = rows.filter((t) => t.sla_remaining_sec <= 0);
    else if (filter === "critical")
      rows = rows.filter((t) => t.urgency === "Critical");
    else if (filter === "escalated")
      rows = rows.filter((t) => t.status === "escalated");
    // Default sort: most at-risk first (smallest remaining, breaches at top).
    return [...rows].sort((a, b) => a.sla_remaining_sec - b.sla_remaining_sec);
  }, [annotated, filter]);

  const counts = useMemo(
    () => ({
      all: annotated.length,
      unassigned: annotated.filter((t) => !t.assignee_id).length,
      breach: annotated.filter((t) => t.sla_remaining_sec <= 0).length,
      critical: annotated.filter((t) => t.urgency === "Critical").length,
      escalated: annotated.filter((t) => t.status === "escalated").length,
    }),
    [annotated]
  );

  async function reassign(code, assigneeId) {
    setBusyCode(code);
    try {
      await api.assignTicket(code, { assigneeId });
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyCode(null);
    }
  }

  return (
    <>
      <Header
        crumb="Team"
        title="Live queue"
        actions={
          <>
            <span className="muted small" style={{ marginRight: 4 }}>
              {lastRefresh
                ? `Updated ${formatClock(lastRefresh)}`
                : "Loading…"}
            </span>
            <button
              className="btn btn-sm"
              onClick={refresh}
              disabled={loading}
              title="Refresh now"
            >
              <Icon name="refresh" size={12} className="" /> Refresh
            </button>
          </>
        }
      />
      <div className="content">
        <div className="content-narrow">
          {error && <div className="error-banner">{error}</div>}

          <div
            className="row"
            style={{ gap: 6, marginBottom: 12, flexWrap: "wrap" }}
          >
            {QUEUE_FILTERS.map((f) => (
              <button
                key={f.id}
                className={`btn btn-sm ${
                  filter === f.id ? "btn-primary" : "btn-ghost"
                }`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
                <span
                  className="mono"
                  style={{
                    marginLeft: 6,
                    opacity: 0.75,
                    fontSize: 11,
                  }}
                >
                  {counts[f.id] ?? 0}
                </span>
              </button>
            ))}
          </div>

          <div className="card">
            <div className="card-header">
              <Icon name="inbox" size={13} className="" />
              <div className="card-title">
                {filtered.length} ticket{filtered.length === 1 ? "" : "s"}
              </div>
              <span
                className="pill"
                style={{ marginLeft: "auto" }}
                title="Auto-refreshes every 15 seconds"
              >
                <span className="pill-dot" /> Live
              </span>
            </div>
            {loading && tickets.length === 0 ? (
              <div style={{ padding: 14 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "10px 0",
                      borderBottom: "1px solid var(--line)",
                    }}
                  >
                    <Skeleton width="90%" height={13} style={{ marginBottom: 6 }} />
                    <Skeleton width="60%" height={11} />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="empty-state" style={{ height: 180 }}>
                Nothing matches this filter. Nice.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Ticket</th>
                      <th>Urgency</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Age</th>
                      <th>SLA</th>
                      <th>Assignee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => (
                      <QueueRow
                        key={t.id}
                        ticket={t}
                        agents={agents}
                        busy={busyCode === t.id}
                        onReassign={(aid) => reassign(t.id, aid)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function QueueRow({ ticket, agents, busy, onReassign }) {
  const remaining = ticket.sla_remaining_sec;
  const breached = remaining <= 0;
  const atRisk = !breached && remaining < 5 * 60;

  return (
    <tr>
      <td>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div className="row" style={{ gap: 6 }}>
            <span className="mono small muted">{ticket.id}</span>
            <span style={{ fontWeight: 500, color: "var(--ink)" }}>
              {ticket.customer}
            </span>
          </div>
          <div
            className="small"
            style={{
              color: "var(--ink-2)",
              maxWidth: 380,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {ticket.subject}
          </div>
        </div>
      </td>
      <td>
        <span className={URGENCY_CLASS[ticket.urgency] || "pill"}>
          <span className="pill-dot" /> {ticket.urgency || "—"}
        </span>
      </td>
      <td>
        <span className={STATUS_CLASS[ticket.status] || "pill"}>
          {STATUS_LABEL[ticket.status] || ticket.status}
        </span>
      </td>
      <td className="mono" style={{ textAlign: "right" }}>
        {ticket.age}
      </td>
      <td>
        <span
          className={`pill ${
            breached ? "pill-bad" : atRisk ? "pill-warn" : "pill-good"
          }`}
          title={`SLA window for ${ticket.urgency}: ${formatWindow(
            SLA_SECONDS[ticket.urgency] || 0
          )}`}
        >
          <span className="pill-dot" />
          {breached
            ? `Breached ${formatDuration(-remaining)} ago`
            : `${formatDuration(remaining)} left`}
        </span>
      </td>
      <td>
        <div className="row" style={{ gap: 6 }}>
          {ticket.assignee_id ? (
            <span
              className="pill"
              title={`Assigned to ${ticket.assignee_name}`}
            >
              @{ticket.assignee_initials}
            </span>
          ) : (
            <span className="pill pill-warn">Unassigned</span>
          )}
          <select
            className="text-input"
            style={{ padding: "4px 6px", fontSize: 12, maxWidth: 160 }}
            value={ticket.assignee_id ?? ""}
            disabled={busy || agents.length === 0}
            onChange={(e) => {
              const v = e.target.value;
              onReassign(v === "" ? null : Number(v));
            }}
          >
            <option value="">— Unassigned —</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </td>
    </tr>
  );
}

function formatDuration(sec) {
  const s = Math.max(0, Math.floor(sec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h < 24) return rem ? `${h}h ${rem}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function formatWindow(sec) {
  if (sec >= 3600) return `${sec / 3600}h`;
  return `${sec / 60}m`;
}

function formatClock(d) {
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  const s = d.getSeconds().toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/* ─────────────────────────────────────────────────────────────
   Placeholder for nav items not yet implemented.
   ───────────────────────────────────────────────────────────── */

function ComingSoonView({ title }) {
  return (
    <>
      <Header crumb="Team" title={title} hasSearch={false} />
      <div className="content">
        <div className="content-narrow">
          <div
            className="card"
            style={{ padding: 32, textAlign: "center", color: "var(--ink-3)" }}
          >
            <div style={{ fontSize: 14, color: "var(--ink-2)", marginBottom: 4 }}>
              {title}
            </div>
            <div className="small">Coming soon.</div>
          </div>
        </div>
      </div>
    </>
  );
}
