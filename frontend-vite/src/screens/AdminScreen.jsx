import { Fragment, useEffect, useState } from "react";
import Chrome from "../components/Chrome.jsx";
import Sidebar from "../components/Sidebar.jsx";
import Topbar from "../components/Topbar.jsx";
import Icon from "../components/Icon.jsx";
import { api } from "../lib/api.js";

const NAV = [
  {
    label: "Insights",
    items: [
      { id: "ov", icon: "chart", name: "Overview" },
      { id: "compl", icon: "trend", name: "Complaint trends" },
      { id: "prod", icon: "box", name: "Product issues" },
      { id: "rev", icon: "dollar", name: "Revenue impact" },
    ],
  },
  {
    label: "Operations",
    items: [
      { id: "team", icon: "users", name: "Team" },
      { id: "int", icon: "git", name: "Integrations" },
      { id: "set", icon: "settings", name: "Settings" },
    ],
  },
];

export default function AdminScreen() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.adminDashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  return (
    <Chrome url="resolveai.app/admin/insights">
      <div className="shell">
        <Sidebar
          role="Business admin"
          items={NAV}
          activeId="ov"
          user={{ initials: "RB", name: "Robin Beck", role: "Owner" }}
        />
        <div className="main">
          <Topbar
            crumb="Insights"
            title="Business overview"
            actions={
              <>
                <button className="btn">
                  <Icon name="clock" size={12} /> Last 30 days
                </button>
                <button className="btn btn-primary">
                  <Icon name="upload" size={12} /> Share report
                </button>
              </>
            }
          />
          <div className="content">
            {error && <div className="error-banner">{error}</div>}
            {!data && !error && (
              <div className="empty-state">
                <div className="spinner" />
              </div>
            )}
            {data && <Body data={data} />}
          </div>
        </div>
      </div>
    </Chrome>
  );
}

function Body({ data }) {
  const k = data.kpis;
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
        <div className="kpi">
          <div className="kpi-label">Total tickets</div>
          <div className="kpi-value">{k.total.toLocaleString()}</div>
          <span className={`kpi-delta ${k.total_delta_pct >= 0 ? "up" : "down"}`}>
            <Icon name={k.total_delta_pct >= 0 ? "arrowUp" : "arrowDown"} size={10} className="" />{" "}
            {Math.abs(k.total_delta_pct)}% vs prev
          </span>
        </div>
        <div className="kpi">
          <div className="kpi-label">Cost per ticket</div>
          <div className="kpi-value">${k.cost_per.toFixed(2)}</div>
          <span className={`kpi-delta ${k.cost_delta_pct < 0 ? "up" : "down"}`}>
            <Icon name={k.cost_delta_pct < 0 ? "arrowDown" : "arrowUp"} size={10} className="" />{" "}
            {Math.abs(k.cost_delta_pct)}% YoY
          </span>
        </div>
        <div className="kpi">
          <div className="kpi-label">Refund $ flagged</div>
          <div className="kpi-value">${k.refund_dollars.toLocaleString()}</div>
          <span className="kpi-delta down">
            <Icon name="arrowUp" size={10} className="" /> {Math.abs(k.refund_delta_pct)}%
          </span>
        </div>
        <div className="kpi">
          <div className="kpi-label">CSAT</div>
          <div className="kpi-value">
            {k.csat}
            <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}> /5</span>
          </div>
          <span className="kpi-delta up">
            <Icon name="arrowUp" size={10} className="" /> {k.csat_delta.toFixed(2)}
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.3fr",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <Donut intents={data.intents} total={k.total} />
        <ProductIssues issues={data.top_issues} />
      </div>

      <Heatmap heatmap={data.heatmap} />
    </>
  );
}

function Donut({ intents, total }) {
  const radius = 56;
  const c = 2 * Math.PI * radius;
  const sum = intents.reduce((s, i) => s + i.v, 0) || 1;
  let acc = 0;
  const arcs = intents.map((i) => {
    const len = (i.v / sum) * c;
    const dasharray = `${len} ${c - len}`;
    const dashoffset = c - acc;
    acc += len;
    return { ...i, dasharray, dashoffset };
  });

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Ticket categories</div>
        <span className="muted small" style={{ marginLeft: "auto" }}>
          last 30d
        </span>
      </div>
      <div
        className="card-body"
        style={{
          display: "grid",
          gridTemplateColumns: "140px 1fr",
          gap: 18,
          alignItems: "center",
        }}
      >
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--bg-sunk)" strokeWidth="14" />
          {arcs.map((a, i) => (
            <circle
              key={i}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={a.color}
              strokeWidth="14"
              strokeDasharray={a.dasharray}
              strokeDashoffset={a.dashoffset}
              transform="rotate(-90 70 70)"
            />
          ))}
          <text
            x="70"
            y="68"
            textAnchor="middle"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: 22,
              fill: "var(--ink)",
            }}
          >
            {total.toLocaleString()}
          </text>
          <text x="70" y="84" textAnchor="middle" style={{ fontSize: 10, fill: "var(--ink-3)" }}>
            tickets
          </text>
        </svg>
        <div>
          {intents.map((i) => (
            <div key={i.name} className="row" style={{ padding: "4px 0", fontSize: 12 }}>
              <span
                className="pill-dot"
                style={{ background: i.color, width: 8, height: 8 }}
              />
              <span style={{ marginLeft: 8 }}>{i.name}</span>
              <span className="mono small muted" style={{ marginLeft: "auto" }}>
                {i.v}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProductIssues({ issues }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Top product issues</div>
        <span className="muted small" style={{ marginLeft: "auto" }}>
          highest complaint volume
        </span>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>Product</th>
            <th>Common issue</th>
            <th style={{ textAlign: "right" }}>Tickets</th>
            <th style={{ textAlign: "right" }}>vs prev</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((p) => (
            <tr key={p.product}>
              <td>
                <div className="row">
                  <div className="ph" style={{ width: 28, height: 28, fontSize: 0 }} />
                  <span style={{ fontWeight: 500 }}>{p.product}</span>
                </div>
              </td>
              <td>
                <span className="pill">{p.tag}</span>
              </td>
              <td className="mono" style={{ textAlign: "right" }}>
                {p.count}
              </td>
              <td style={{ textAlign: "right" }}>
                <span className={`kpi-delta ${p.change > 0 ? "down" : "up"}`}>
                  <Icon
                    name={p.change > 0 ? "arrowUp" : "arrowDown"}
                    size={10}
                    className=""
                  />
                  {Math.abs(p.change)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Heatmap({ heatmap }) {
  const { days, grid } = heatmap;
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">When tickets arrive</div>
        <span className="muted small" style={{ marginLeft: "auto" }}>
          hour of day · last 4 weeks
        </span>
      </div>
      <div className="card-body">
        <div className="heat">
          <div></div>
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} style={{ textAlign: "center" }}>
              {h % 3 === 0 ? (h === 0 ? "12a" : h === 12 ? "12p" : h > 12 ? `${h - 12}p` : `${h}a`) : ""}
            </div>
          ))}
          {days.map((d, di) => (
            <Fragment key={d}>
              <div className="heat-day">{d}</div>
              {grid[di].map((v, hi) => (
                <div
                  key={hi}
                  className="heat-cell"
                  style={{
                    background:
                      v < 0.1
                        ? "var(--bg-sunk)"
                        : `color-mix(in oklab, var(--accent) ${Math.round(v * 90)}%, var(--bg-sunk))`,
                  }}
                  title={`${d} ${hi}:00 — ${Math.round(v * 100)}%`}
                />
              ))}
            </Fragment>
          ))}
        </div>
        <div className="row small muted" style={{ marginTop: 12, gap: 6 }}>
          <span>Less</span>
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
            <div
              key={v}
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: `color-mix(in oklab, var(--accent) ${v * 90}%, var(--bg-sunk))`,
              }}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
