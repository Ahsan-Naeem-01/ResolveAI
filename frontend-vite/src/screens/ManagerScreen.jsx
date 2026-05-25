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
  } else if (activeNavId === "agents") {
    body = <AgentsView />;
  } else if (activeNavId === "shifts") {
    body = <ShiftsCoverageView />;
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
   Agents — team roster with workload, performance, drill-down.
   Combines /analytics/manager (per-agent KPIs) with /agents (IDs)
   and live open tickets (current workload + assignment list).
   ───────────────────────────────────────────────────────────── */

const AGENT_STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "online", label: "Online" },
  { id: "break", label: "On break" },
  { id: "offline", label: "Offline" },
];

const STATUS_PILL = {
  online: "pill pill-good",
  break: "pill pill-warn",
  offline: "pill",
};

function AgentsView() {
  const [dashboard, setDashboard] = useState(null);
  const [agents, setAgents] = useState([]);
  const [openTickets, setOpenTickets] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [busyCode, setBusyCode] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [dash, ags, ...lists] = await Promise.all([
        api.managerDashboard(),
        api.listAgents(),
        ...OPEN_STATUSES.map((s) => api.listTickets({ status: s, limit: 200 })),
      ]);
      setDashboard(dash);
      setAgents(ags);
      const merged = lists.flat();
      const seen = new Set();
      const unique = [];
      for (const t of merged) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        unique.push(t);
      }
      setOpenTickets(unique);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Stitch dashboard KPIs (keyed by name) onto the real agent records
  // and attach the agent's currently-open tickets.
  const enriched = useMemo(() => {
    const statsByName = new Map(
      (dashboard?.agents || []).map((a) => [a.name, a])
    );
    const ticketsByAgent = new Map();
    for (const t of openTickets) {
      if (t.assignee_id == null) continue;
      if (!ticketsByAgent.has(t.assignee_id)) ticketsByAgent.set(t.assignee_id, []);
      ticketsByAgent.get(t.assignee_id).push(t);
    }
    return agents.map((a) => {
      const s = statsByName.get(a.name) || {};
      const open = ticketsByAgent.get(a.id) || [];
      return {
        ...a,
        handled: s.handled ?? 0,
        ahtMin: s.ahtMin ?? 0,
        csat: s.csat ?? 0,
        ai: s.ai ?? 0,
        status: s.status || "offline",
        open,
        openCount: open.length,
        breachCount: open.filter((t) => {
          const window = SLA_SECONDS[t.urgency] ?? SLA_SECONDS.Medium;
          const createdMs = t.created_at ? Date.parse(t.created_at) : Date.now();
          return (Date.now() - createdMs) / 1000 > window;
        }).length,
      };
    });
  }, [agents, dashboard, openTickets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.title || "").toLowerCase().includes(q)
      );
    });
  }, [enriched, statusFilter, search]);

  const unassignedCount = useMemo(
    () => openTickets.filter((t) => !t.assignee_id).length,
    [openTickets]
  );
  const totalAssigned = useMemo(
    () => openTickets.filter((t) => t.assignee_id != null).length,
    [openTickets]
  );
  const onlineCount = enriched.filter((a) => a.status === "online").length;
  const avgLoad = enriched.length
    ? (totalAssigned / enriched.length).toFixed(1)
    : "0.0";
  const maxLoad = Math.max(1, ...enriched.map((a) => a.openCount));

  const selected = enriched.find((a) => a.id === selectedId) || null;

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
        title="Agents"
        actions={
          <button
            className="btn btn-sm"
            onClick={refresh}
            disabled={loading}
            title="Refresh"
          >
            <Icon name="refresh" size={12} className="" /> Refresh
          </button>
        }
      />
      <div className="content">
        <div className="content-narrow">
          {error && <div className="error-banner">{error}</div>}

          {/* KPI strip */}
          {loading && !dashboard ? (
            <SkeletonKpiRow cols={4} />
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 14,
                marginBottom: 18,
              }}
            >
              <SimpleKpi label="Team size" value={enriched.length} />
              <SimpleKpi
                label="Online now"
                value={`${onlineCount} / ${enriched.length}`}
              />
              <SimpleKpi label="Open assignments" value={totalAssigned} />
              <SimpleKpi
                label="Unassigned"
                value={unassignedCount}
                tone={unassignedCount > 0 ? "warn" : "good"}
              />
            </div>
          )}

          {/* Filter + search row */}
          <div
            className="row"
            style={{
              gap: 8,
              marginBottom: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {AGENT_STATUS_FILTERS.map((f) => {
              const count =
                f.id === "all"
                  ? enriched.length
                  : enriched.filter((a) => a.status === f.id).length;
              return (
                <button
                  key={f.id}
                  className={`btn btn-sm ${
                    statusFilter === f.id ? "btn-primary" : "btn-ghost"
                  }`}
                  onClick={() => setStatusFilter(f.id)}
                >
                  {f.label}
                  <span
                    className="mono"
                    style={{ marginLeft: 6, opacity: 0.75, fontSize: 11 }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
            <div style={{ flex: 1 }} />
            <input
              className="text-input"
              placeholder="Search by name, email, or title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: 260, padding: "6px 10px", fontSize: 12 }}
            />
          </div>

          {/* Agent grid */}
          {loading && enriched.length === 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 14,
              }}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} height={170} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card">
              <div className="empty-state" style={{ height: 200 }}>
                No agents match this filter.
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 14,
                marginBottom: 18,
              }}
            >
              {filtered.map((a) => (
                <AgentCard
                  key={a.id}
                  agent={a}
                  maxLoad={maxLoad}
                  selected={a.id === selectedId}
                  onSelect={() =>
                    setSelectedId((cur) => (cur === a.id ? null : a.id))
                  }
                />
              ))}
            </div>
          )}

          {/* Detail panel — selected agent's open assignments */}
          {selected && (
            <AgentDetail
              agent={selected}
              agents={agents}
              busyCode={busyCode}
              onReassign={reassign}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      </div>
    </>
  );
}

function SimpleKpi({ label, value, tone }) {
  const toneClass =
    tone === "warn"
      ? "kpi-delta down"
      : tone === "good"
      ? "kpi-delta up"
      : null;
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {toneClass && (
        <span className={toneClass} style={{ marginTop: 4 }}>
          {tone === "warn" ? "Needs routing" : "All claimed"}
        </span>
      )}
    </div>
  );
}

function AgentCard({ agent, maxLoad, selected, onSelect }) {
  const loadPct = Math.min(100, (agent.openCount / maxLoad) * 100);
  const loadColor =
    agent.openCount === 0
      ? "var(--ink-3)"
      : agent.breachCount > 0
      ? "var(--bad)"
      : agent.openCount >= maxLoad * 0.75
      ? "var(--warn)"
      : "var(--good)";

  return (
    <div
      className="card"
      onClick={onSelect}
      style={{
        padding: 14,
        cursor: "pointer",
        outline: selected ? "2px solid var(--accent)" : "none",
        outlineOffset: -1,
      }}
    >
      <div className="row" style={{ gap: 10, marginBottom: 10 }}>
        <div className="avatar" style={{ width: 36, height: 36, fontSize: 12 }}>
          {agent.initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, color: "var(--ink)" }}>
            {agent.name}
          </div>
          <div
            className="small muted"
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {agent.title || agent.email}
          </div>
        </div>
        <span className={STATUS_PILL[agent.status] || "pill"}>
          <span className="pill-dot" /> {agent.status}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 6,
          marginBottom: 10,
        }}
      >
        <MiniStat label="Handled" value={agent.handled} />
        <MiniStat label="AHT" value={`${agent.ahtMin || 0}m`} />
        <MiniStat
          label="CSAT"
          value={agent.csat ? Number(agent.csat).toFixed(1) : "—"}
        />
      </div>

      <div style={{ marginBottom: 8 }}>
        <div
          className="row small muted"
          style={{ justifyContent: "space-between", marginBottom: 4 }}
        >
          <span>AI assist</span>
          <span className="mono">{Math.round((agent.ai || 0) * 100)}%</span>
        </div>
        <div className="cat-track">
          <div
            className="cat-fill"
            style={{ width: `${(agent.ai || 0) * 100}%` }}
          />
        </div>
      </div>

      <div>
        <div
          className="row small muted"
          style={{ justifyContent: "space-between", marginBottom: 4 }}
        >
          <span>Open workload</span>
          <span className="mono" style={{ color: "var(--ink)" }}>
            {agent.openCount}
            {agent.breachCount > 0 && (
              <span className="pill pill-bad" style={{ marginLeft: 6 }}>
                {agent.breachCount} breach
              </span>
            )}
          </span>
        </div>
        <div className="cat-track">
          <div
            className="cat-fill"
            style={{ width: `${loadPct}%`, background: loadColor }}
          />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div>
      <div
        className="small muted"
        style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.3 }}
      >
        {label}
      </div>
      <div
        className="mono"
        style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}
      >
        {value}
      </div>
    </div>
  );
}

function AgentDetail({ agent, agents, busyCode, onReassign, onClose }) {
  const sorted = [...agent.open].sort((a, b) => {
    const wa = SLA_SECONDS[a.urgency] ?? SLA_SECONDS.Medium;
    const wb = SLA_SECONDS[b.urgency] ?? SLA_SECONDS.Medium;
    const ra =
      wa - (Date.now() - Date.parse(a.created_at || Date.now())) / 1000;
    const rb =
      wb - (Date.now() - Date.parse(b.created_at || Date.now())) / 1000;
    return ra - rb;
  });

  return (
    <div className="card">
      <div className="card-header">
        <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
          {agent.initials}
        </div>
        <div className="card-title">{agent.name}'s open tickets</div>
        <span className="muted small" style={{ marginLeft: 8 }}>
          {agent.openCount} open · {agent.breachCount} breaching
        </span>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: "auto" }}
          onClick={onClose}
        >
          <Icon name="x" size={12} className="" /> Close
        </button>
      </div>
      {sorted.length === 0 ? (
        <div className="empty-state" style={{ height: 140 }}>
          {agent.name} has no open tickets right now.
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
                <th>Reassign to</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <span className="mono small muted">{t.id}</span>
                      <span style={{ fontWeight: 500, color: "var(--ink)" }}>
                        {t.customer}
                      </span>
                    </div>
                    <div
                      className="small"
                      style={{
                        color: "var(--ink-2)",
                        maxWidth: 360,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.subject}
                    </div>
                  </td>
                  <td>
                    <span className={URGENCY_CLASS[t.urgency] || "pill"}>
                      <span className="pill-dot" /> {t.urgency || "—"}
                    </span>
                  </td>
                  <td>
                    <span className={STATUS_CLASS[t.status] || "pill"}>
                      {STATUS_LABEL[t.status] || t.status}
                    </span>
                  </td>
                  <td className="mono" style={{ textAlign: "right" }}>
                    {t.age}
                  </td>
                  <td>
                    <select
                      className="text-input"
                      style={{
                        padding: "4px 6px",
                        fontSize: 12,
                        maxWidth: 180,
                      }}
                      value={t.assignee_id ?? ""}
                      disabled={busyCode === t.id}
                      onChange={(e) => {
                        const v = e.target.value;
                        onReassign(t.id, v === "" ? null : Number(v));
                      }}
                    >
                      <option value="">— Unassigned —</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Shifts & coverage — synthesized weekly schedule + an hourly
   demand-vs-capacity view. Backed by /api/analytics/shifts which
   derives shifts deterministically from the agent list and
   estimates demand from real ticket history.
   ───────────────────────────────────────────────────────────── */

// Maps backend "tone" → existing pill class. Keeps the shift legend and
// schedule cells visually consistent with the rest of the app.
const SHIFT_PILL_CLASS = {
  good: "pill pill-good",
  accent: "pill pill-accent",
  violet: "pill pill-violet",
  warn: "pill pill-warn",
  muted: "pill",
};

function ShiftsCoverageView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    api.shiftsCoverage().then(setData).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <>
      <Header
        crumb="Team"
        title="Shifts & coverage"
        actions={
          <>
            <button className="btn btn-sm">
              <Icon name="clock" size={12} className="" /> This week
            </button>
            <button
              className="btn btn-sm"
              onClick={refresh}
              title="Refresh"
            >
              <Icon name="refresh" size={12} className="" /> Refresh
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
              <SkeletonCard height={220} />
              <div style={{ height: 14 }} />
              <SkeletonCard height={260} />
            </>
          )}
          {data && <ShiftsBody data={data} />}
        </div>
      </div>
    </>
  );
}

function ShiftsBody({ data }) {
  const s = data.summary;
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
          label="On shift now"
          value={`${s.on_now} / ${s.total_agents}`}
          delta={`${s.scheduled_today} scheduled`}
          deltaUp
        />
        <Kpi
          label="Forecasted coverage"
          value={`${s.coverage_pct}%`}
          delta={s.coverage_pct >= 95 ? "Healthy" : "Watch"}
          deltaUp={s.coverage_pct >= 95}
        />
        <Kpi
          label="Coverage gap hours"
          value={s.gap_hours}
          delta={s.gap_hours === 0 ? "All clear" : "Action"}
          deltaUp={s.gap_hours === 0}
        />
        <Kpi
          label="Throughput / agent"
          value={`${s.tickets_per_agent_hour}/hr`}
          delta="assumed"
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
        <CoverageChartCard data={data} />
        <CoverageGapsCard gaps={data.gaps} />
      </div>

      <ScheduleGridCard data={data} />
    </>
  );
}

function CoverageChartCard({ data }) {
  // Overlay capacity bars (soft) with a demand line so the manager can spot
  // where the forecast pokes above what the team can absorb.
  const maxVal = Math.max(
    ...data.demand,
    ...data.capacity_tickets,
    1
  );
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Today · demand vs capacity</div>
        <span className="muted small" style={{ marginLeft: "auto" }}>
          tickets / hour
        </span>
      </div>
      <div className="card-body">
        <div className="bars" style={{ height: 180 }}>
          {data.hour_labels.map((label, i) => {
            const demand = data.demand[i];
            const cap = data.capacity_tickets[i];
            const isGap = demand > cap;
            return (
              <div className="bar" key={i} title={`${label} · demand ${demand}, capacity ${cap}`}>
                <div
                  className="bar-track"
                  style={{ position: "relative" }}
                >
                  {/* Capacity track: full-height ghost showing what the team
                      can absorb, painted bottom-up. */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: `${(cap / maxVal) * 100}%`,
                      background: "var(--bg-sunk)",
                      border: "1px dashed var(--line)",
                      borderRadius: "4px 4px 0 0",
                    }}
                  />
                  {/* Demand bar on top — red when it exceeds capacity. */}
                  <div
                    className={`bar-fill ${isGap ? "" : "alt"}`}
                    style={{
                      height: `${(demand / maxVal) * 100}%`,
                      position: "relative",
                      background: isGap
                        ? "color-mix(in oklab, var(--bad) 70%, transparent)"
                        : undefined,
                      borderColor: isGap ? "var(--bad)" : undefined,
                    }}
                    data-v={demand}
                  />
                </div>
                <div className="bar-label">{label}</div>
              </div>
            );
          })}
        </div>
        <div
          className="row small muted"
          style={{ gap: 14, marginTop: 10, flexWrap: "wrap" }}
        >
          <LegendSwatch color="var(--accent)" label="Forecast demand" />
          <LegendSwatch
            color="color-mix(in oklab, var(--bad) 70%, transparent)"
            label="Over capacity"
          />
          <LegendSwatch
            color="var(--bg-sunk)"
            label="Capacity (agents on shift)"
            outline
          />
        </div>
      </div>
    </div>
  );
}

function LegendSwatch({ color, label, outline }) {
  return (
    <span className="row" style={{ gap: 6 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 2,
          background: color,
          border: outline ? "1px dashed var(--line)" : "none",
          display: "inline-block",
        }}
      />
      {label}
    </span>
  );
}

function CoverageGapsCard({ gaps }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Coverage gaps · today</div>
        <span
          className={`pill ${gaps.length === 0 ? "pill-good" : "pill-warn"}`}
          style={{ marginLeft: "auto" }}
        >
          <span className="pill-dot" />
          {gaps.length === 0 ? "All clear" : `${gaps.length} hour${gaps.length === 1 ? "" : "s"}`}
        </span>
      </div>
      <div className="card-body">
        {gaps.length === 0 ? (
          <div
            className="empty-state"
            style={{ height: 140, padding: 0, textAlign: "center" }}
          >
            No projected shortfalls. Schedule looks balanced.
          </div>
        ) : (
          <>
            {gaps.map((g) => (
              <div
                key={g.hour}
                className="cat-row"
                style={{ gridTemplateColumns: "60px 1fr auto" }}
              >
                <span className="mono">{g.label}</span>
                <div className="cat-track">
                  <div
                    className="cat-fill"
                    style={{
                      width: `${Math.min(
                        100,
                        (g.demand / Math.max(g.capacity, 1)) * 100 - 100
                      )}%`,
                      background: "var(--bad)",
                    }}
                    title={`Need ${g.demand}/hr, have ${g.capacity}/hr`}
                  />
                </div>
                <span className="small muted">
                  +{g.agents_needed} agent{g.agents_needed === 1 ? "" : "s"}
                </span>
              </div>
            ))}
            <div className="divider" />
            <div className="row small muted">
              <span>Demand is forecast from 4-week ticket history.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ScheduleGridCard({ data }) {
  const shiftEntries = Object.entries(data.shifts).filter(([id]) => id !== "off");
  return (
    <div className="card">
      <div className="card-header">
        <Icon name="users" size={13} className="" />
        <div className="card-title">Weekly schedule</div>
        <div
          className="row"
          style={{ gap: 10, marginLeft: "auto", flexWrap: "wrap" }}
        >
          {shiftEntries.map(([id, tpl]) => (
            <span
              key={id}
              className={SHIFT_PILL_CLASS[tpl.tone] || "pill"}
              title={`${tpl.label} · ${formatHour(tpl.start)}–${formatHour(tpl.end)}`}
            >
              <span className="pill-dot" /> {tpl.label}
            </span>
          ))}
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="tbl shift-grid">
          <thead>
            <tr>
              <th>Agent</th>
              {data.days.map((d, i) => (
                <th
                  key={d}
                  style={{
                    textAlign: "center",
                    color:
                      i === data.today_idx ? "var(--accent-ink)" : undefined,
                  }}
                >
                  {d}
                  {i === data.today_idx && (
                    <span className="muted small"> · today</span>
                  )}
                </th>
              ))}
              <th style={{ textAlign: "right" }}>Today</th>
            </tr>
          </thead>
          <tbody>
            {data.agents.map((a) => (
              <tr key={a.id}>
                <td>
                  <div className="row">
                    <div
                      className="avatar"
                      style={{ width: 26, height: 26, fontSize: 10 }}
                    >
                      {a.initials}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontWeight: 500, color: "var(--ink)" }}>
                        {a.name}
                      </span>
                      <span className="small muted">{a.title}</span>
                    </div>
                  </div>
                </td>
                {a.week.map((shiftId, di) => {
                  const tpl = data.shifts[shiftId];
                  const isToday = di === data.today_idx;
                  if (shiftId === "off") {
                    return (
                      <td
                        key={di}
                        className="shift-cell shift-cell-off"
                        style={isToday ? { background: "var(--bg-sunk)" } : undefined}
                      >
                        <span className="muted small">—</span>
                      </td>
                    );
                  }
                  return (
                    <td
                      key={di}
                      className="shift-cell"
                      style={isToday ? { background: "var(--bg-sunk)" } : undefined}
                    >
                      <span
                        className={SHIFT_PILL_CLASS[tpl.tone] || "pill"}
                        title={`${tpl.label} · ${formatHour(tpl.start)}–${formatHour(tpl.end)}`}
                      >
                        {formatHour(tpl.start)}–{formatHour(tpl.end)}
                      </span>
                    </td>
                  );
                })}
                <td style={{ textAlign: "right" }}>
                  {a.status === "on-shift" ? (
                    <span className="pill pill-good">
                      <span className="pill-dot" /> On shift
                    </span>
                  ) : a.status === "scheduled" ? (
                    <span className="pill">
                      <span className="pill-dot" /> Scheduled
                    </span>
                  ) : (
                    <span className="pill pill-warn">
                      <span className="pill-dot" /> Off
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatHour(h) {
  if (h == null) return "—";
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  if (h === 24) return "12a";
  return h > 12 ? `${h - 12}p` : `${h}a`;
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
