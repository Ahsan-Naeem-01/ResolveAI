import { useEffect, useState } from "react";
import Chrome from "../components/Chrome.jsx";
import Sidebar from "../components/Sidebar.jsx";
import Topbar from "../components/Topbar.jsx";
import Icon from "../components/Icon.jsx";
import Spark from "../components/Spark.jsx";
import { api } from "../lib/api.js";

const NAV = [
  {
    label: "Overview",
    items: [
      { id: "perf", icon: "chart", name: "Team performance" },
      { id: "queue", icon: "inbox", name: "Live queue" },
      { id: "sla", icon: "clock", name: "SLA monitor" },
    ],
  },
  {
    label: "Team",
    items: [
      { id: "agents", icon: "users", name: "Agents" },
      { id: "shifts", icon: "clock", name: "Shifts & coverage" },
      { id: "training", icon: "book", name: "Coaching" },
    ],
  },
  {
    label: "Insights",
    items: [
      { id: "trends", icon: "trend", name: "Complaint trends" },
      { id: "macros", icon: "lightning", name: "Macro performance" },
    ],
  },
];

export default function ManagerScreen() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.managerDashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  return (
    <Chrome url="resolveai.app/manager">
      <div className="shell">
        <Sidebar
          role="Manager"
          items={NAV}
          activeId="perf"
          user={{ initials: "MK", name: "Maya Khan", role: "Support Lead" }}
        />
        <div className="main">
          <Topbar
            crumb="Team"
            title="Team performance"
            actions={
              <>
                <button className="btn"><Icon name="clock" size={12} /> Today</button>
                <button className="btn"><Icon name="upload" size={12} /> Export</button>
              </>
            }
          />
          <div className="content">
            {error && <div className="error-banner">{error}</div>}
            {!data && !error && <div className="empty-state"><div className="spinner" /></div>}
            {data && <DashboardBody data={data} />}
          </div>
        </div>
      </div>
    </Chrome>
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
          delta={`${k.auto_resolved_delta_pts > 0 ? "+" : ""}${k.auto_resolved_delta_pts} pts`}
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
            <div className="card-title">SLA breaches · 7d</div>
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
                className="btn btn-ghost"
                style={{ marginLeft: "auto", fontSize: 11, padding: "3px 8px" }}
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
                    <span style={{ fontWeight: 500 }}>{a.name}</span>
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
  const color = pct >= 90 ? "var(--good)" : pct >= 80 ? "var(--warn)" : "var(--bad)";
  return (
    <div className="cat-row">
      <span>{label}</span>
      <div className="cat-track">
        <div className="cat-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="cat-val">{pct}%</span>
    </div>
  );
}
