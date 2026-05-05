/* Business Admin screen — analytics dashboard */

const AdminScreen = () => {
  const navItems = [
    { label: "Insights", items: [
      { id: "ov", icon: "chart", name: "Overview" },
      { id: "compl", icon: "trend", name: "Complaint trends" },
      { id: "prod", icon: "box", name: "Product issues" },
      { id: "rev", icon: "dollar", name: "Revenue impact" },
    ]},
    { label: "Operations", items: [
      { id: "team", icon: "users", name: "Team" },
      { id: "int", icon: "git", name: "Integrations" },
      { id: "set", icon: "settings", name: "Settings" },
    ]},
  ];

  // intent share data
  const intents = [
    { name: "Delivery Issue",  v: 31, color: "var(--accent)" },
    { name: "Refund Request",  v: 24, color: "var(--violet)" },
    { name: "Product Complaint", v: 18, color: "var(--good)" },
    { name: "Payment Failure", v: 12, color: "var(--warn)" },
    { name: "Account / Security", v: 8, color: "var(--bad)" },
    { name: "Other", v: 7, color: "var(--ink-3)" },
  ];

  // Build donut
  const total = intents.reduce((s, i) => s + i.v, 0);
  let acc = 0;
  const radius = 56, c = 2 * Math.PI * radius;
  const arcs = intents.map(i => {
    const len = (i.v / total) * c;
    const dasharray = `${len} ${c - len}`;
    const dashoffset = c - acc;
    acc += len;
    return { ...i, dasharray, dashoffset };
  });

  // 7 days x 24 hours heatmap
  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const heat = days.map((d, di) => Array.from({ length: 24 }, (_, hi) => {
    const peak = hi >= 9 && hi <= 19 ? 1 : 0.3;
    const weekend = di >= 5 ? 0.6 : 1;
    const noise = 0.5 + Math.sin(di * 7 + hi) * 0.4 + Math.cos(hi * 1.3) * 0.2;
    return Math.max(0, Math.min(1, peak * weekend * noise));
  }));

  const issues = [
    { product: "Aurora Mug Set (4-pc)",  count: 47, change: 23, sev: "high",   tag: "packaging" },
    { product: "Halo ANC Headphones",    count: 38, change: 14, sev: "med",    tag: "battery life" },
    { product: "Cloud Hoodie",           count: 26, change: -8, sev: "low",    tag: "sizing" },
    { product: "Linen Throw Blanket",    count: 21, change:  4, sev: "med",    tag: "shipping delays" },
    { product: "Glass Carafe",           count: 17, change: 41, sev: "high",   tag: "packaging" },
  ];

  return (
    <Chrome url="resolveai.app/admin/insights">
      <div className="shell">
        <Sidebar
          role="Business admin"
          items={navItems}
          activeId="ov"
          user={{ initials: "RB", name: "Robin Beck", role: "Owner" }}
        />
        <div className="main">
          <Topbar
            crumb="Insights"
            title="Business overview"
            actions={
              <>
                <button className="btn"><Icon name="clock" size={12} /> Last 30 days</button>
                <button className="btn btn-primary"><Icon name="upload" size={12} /> Share report</button>
              </>
            }
          />
          <div className="content">
            {/* Top metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 18 }}>
              <div className="kpi">
                <div className="kpi-label">Total tickets</div>
                <div className="kpi-value">12,484</div>
                <span className="kpi-delta up"><Icon name="arrowUp" size={10} className="" /> 9.4% vs prev</span>
              </div>
              <div className="kpi">
                <div className="kpi-label">Cost per ticket</div>
                <div className="kpi-value">$1.42</div>
                <span className="kpi-delta up"><Icon name="arrowDown" size={10} className="" /> 38% YoY</span>
              </div>
              <div className="kpi">
                <div className="kpi-label">Refund $ flagged</div>
                <div className="kpi-value">$28,910</div>
                <span className="kpi-delta down"><Icon name="arrowUp" size={10} className="" /> 6.1%</span>
              </div>
              <div className="kpi">
                <div className="kpi-label">CSAT</div>
                <div className="kpi-value">4.71<span className="muted" style={{ fontSize: 14, fontWeight: 400 }}> /5</span></div>
                <span className="kpi-delta up"><Icon name="arrowUp" size={10} className="" /> 0.08</span>
              </div>
            </div>

            {/* Donut + product issues */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 14, marginBottom: 18 }}>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Ticket categories</div>
                  <span className="muted small" style={{ marginLeft: "auto" }}>last 30d</span>
                </div>
                <div className="card-body" style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 18, alignItems: "center" }}>
                  <svg width="140" height="140" viewBox="0 0 140 140">
                    <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--bg-sunk)" strokeWidth="14" />
                    {arcs.map((a, i) => (
                      <circle
                        key={i}
                        cx="70" cy="70" r={radius}
                        fill="none"
                        stroke={a.color}
                        strokeWidth="14"
                        strokeDasharray={a.dasharray}
                        strokeDashoffset={a.dashoffset}
                        transform="rotate(-90 70 70)"
                      />
                    ))}
                    <text x="70" y="68" textAnchor="middle"
                      style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 22, fill: "var(--ink)" }}>
                      12,484
                    </text>
                    <text x="70" y="84" textAnchor="middle"
                      style={{ fontSize: 10, fill: "var(--ink-3)" }}>
                      tickets
                    </text>
                  </svg>
                  <div>
                    {intents.map(i => (
                      <div key={i.name} className="row" style={{ padding: "4px 0", fontSize: 12 }}>
                        <span className="pill-dot" style={{ background: i.color, width: 8, height: 8 }} />
                        <span style={{ marginLeft: 8 }}>{i.name}</span>
                        <span className="mono small muted" style={{ marginLeft: "auto" }}>{i.v}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title">Top product issues</div>
                  <span className="muted small" style={{ marginLeft: "auto" }}>highest complaint volume</span>
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
                    {issues.map(p => (
                      <tr key={p.product}>
                        <td>
                          <div className="row">
                            <div className="ph" style={{ width: 28, height: 28, fontSize: 0 }} />
                            <span style={{ fontWeight: 500 }}>{p.product}</span>
                          </div>
                        </td>
                        <td><span className="pill">{p.tag}</span></td>
                        <td className="mono" style={{ textAlign: "right" }}>{p.count}</td>
                        <td style={{ textAlign: "right" }}>
                          <span className={`kpi-delta ${p.change > 0 ? "down" : "up"}`}>
                            <Icon name={p.change > 0 ? "arrowUp" : "arrowDown"} size={10} className="" />
                            {Math.abs(p.change)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Heatmap */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">When tickets arrive</div>
                <span className="muted small" style={{ marginLeft: "auto" }}>hour of day · last 4 weeks</span>
              </div>
              <div className="card-body">
                <div className="heat">
                  <div></div>
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} style={{ textAlign: "center" }}>
                      {h % 3 === 0 ? (h === 0 ? "12a" : h === 12 ? "12p" : h > 12 ? `${h-12}p` : `${h}a`) : ""}
                    </div>
                  ))}
                  {days.map((d, di) => (
                    <React.Fragment key={d}>
                      <div className="heat-day">{d}</div>
                      {heat[di].map((v, hi) => (
                        <div
                          key={hi}
                          className="heat-cell"
                          style={{
                            background: v < 0.1
                              ? "var(--bg-sunk)"
                              : `color-mix(in oklab, var(--accent) ${Math.round(v * 90)}%, var(--bg-sunk))`
                          }}
                          title={`${d} ${hi}:00 — ${Math.round(v * 100)}%`}
                        />
                      ))}
                    </React.Fragment>
                  ))}
                </div>
                <div className="row small muted" style={{ marginTop: 12, gap: 6 }}>
                  <span>Less</span>
                  {[0.1, 0.3, 0.5, 0.7, 0.9].map(v => (
                    <div key={v} style={{
                      width: 14, height: 14, borderRadius: 3,
                      background: `color-mix(in oklab, var(--accent) ${v * 90}%, var(--bg-sunk))`
                    }} />
                  ))}
                  <span>More</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Chrome>
  );
};

window.AdminScreen = AdminScreen;
