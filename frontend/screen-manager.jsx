/* Support Manager screen — team performance dashboard */

const ManagerScreen = () => {
  const navItems = [
    { label: "Overview", items: [
      { id: "perf", icon: "chart", name: "Team performance" },
      { id: "queue", icon: "inbox", name: "Live queue", badge: 47 },
      { id: "sla", icon: "clock", name: "SLA monitor", badge: 3 },
    ]},
    { label: "Team", items: [
      { id: "agents", icon: "users", name: "Agents" },
      { id: "shifts", icon: "clock", name: "Shifts & coverage" },
      { id: "training", icon: "book", name: "Coaching" },
    ]},
    { label: "Insights", items: [
      { id: "trends", icon: "trend", name: "Complaint trends" },
      { id: "macros", icon: "lightning", name: "Macro performance" },
    ]},
  ];

  const agents = [
    { name: "Jordan Maeda",  initials: "JM", handled: 142, ahtMin: 4.2, csat: 4.8, ai: 0.78, status: "online" },
    { name: "Lina Okafor",   initials: "LO", handled: 128, ahtMin: 5.1, csat: 4.7, ai: 0.71, status: "online" },
    { name: "Rafael Mendes", initials: "RM", handled: 119, ahtMin: 6.3, csat: 4.5, ai: 0.65, status: "break" },
    { name: "Ash Patel",     initials: "AP", handled: 97,  ahtMin: 3.8, csat: 4.9, ai: 0.84, status: "online" },
    { name: "Yuki Tanaka",   initials: "YT", handled: 88,  ahtMin: 7.1, csat: 4.3, ai: 0.58, status: "offline" },
    { name: "Sam Reyes",     initials: "SR", handled: 76,  ahtMin: 5.5, csat: 4.6, ai: 0.69, status: "online" },
  ];

  const volume = [38, 42, 51, 47, 62, 71, 68, 74, 89, 82, 76, 65];
  const labels = ["8a","9a","10a","11a","12p","1p","2p","3p","4p","5p","6p","7p"];
  const maxV = Math.max(...volume);

  return (
    <Chrome url="resolveai.app/manager">
      <div className="shell">
        <Sidebar
          role="Manager"
          items={navItems}
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
            {/* KPI row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 18 }}>
              <div className="kpi">
                <div className="kpi-label">Open tickets</div>
                <div className="row"><div className="kpi-value">412</div>
                  <span className="kpi-delta down" style={{ marginLeft: "auto" }}>
                    <Icon name="arrowDown" size={10} className="" /> 8.2%
                  </span></div>
                <Spark data={[420,431,418,402,398,415,412]} w={140} h={28} />
              </div>
              <div className="kpi">
                <div className="kpi-label">Avg. resolution</div>
                <div className="row"><div className="kpi-value">5m 18s</div>
                  <span className="kpi-delta up" style={{ marginLeft: "auto" }}>
                    <Icon name="arrowDown" size={10} className="" /> 12%
                  </span></div>
                <Spark data={[6.2,6.0,5.9,5.8,5.6,5.4,5.3]} w={140} h={28} />
              </div>
              <div className="kpi">
                <div className="kpi-label">Auto-resolved by AI</div>
                <div className="row"><div className="kpi-value">68%</div>
                  <span className="kpi-delta up" style={{ marginLeft: "auto" }}>
                    <Icon name="arrowUp" size={10} className="" /> 4 pts
                  </span></div>
                <Spark data={[58,60,62,63,65,66,68]} w={140} h={28} />
              </div>
              <div className="kpi">
                <div className="kpi-label">CSAT</div>
                <div className="row"><div className="kpi-value">4.71</div>
                  <span className="kpi-delta up" style={{ marginLeft: "auto" }}>
                    <Icon name="arrowUp" size={10} className="" /> 0.08
                  </span></div>
                <Spark data={[4.5,4.55,4.6,4.62,4.65,4.68,4.71]} w={140} h={28} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14, marginBottom: 18 }}>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Ticket volume · today</div>
                  <span className="pill pill-good" style={{ marginLeft: "auto" }}><span className="pill-dot" /> Within capacity</span>
                </div>
                <div className="card-body">
                  <div className="bars">
                    {volume.map((v, i) => (
                      <div className="bar" key={i}>
                        <div className="bar-track">
                          <div
                            className={`bar-fill ${i === volume.indexOf(maxV) ? "alt" : ""}`}
                            style={{ height: `${(v / maxV) * 100}%` }}
                            data-v={v}
                          />
                        </div>
                        <div className="bar-label">{labels[i]}</div>
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
                  <div className="cat-row">
                    <span>Critical &lt; 15m</span>
                    <div className="cat-track"><div className="cat-fill" style={{ width: "92%", background: "var(--good)" }} /></div>
                    <span className="cat-val">92%</span>
                  </div>
                  <div className="cat-row">
                    <span>High &lt; 1h</span>
                    <div className="cat-track"><div className="cat-fill" style={{ width: "87%", background: "var(--good)" }} /></div>
                    <span className="cat-val">87%</span>
                  </div>
                  <div className="cat-row">
                    <span>Medium &lt; 4h</span>
                    <div className="cat-track"><div className="cat-fill" style={{ width: "78%", background: "var(--warn)" }} /></div>
                    <span className="cat-val">78%</span>
                  </div>
                  <div className="cat-row">
                    <span>Low &lt; 24h</span>
                    <div className="cat-track"><div className="cat-fill" style={{ width: "96%", background: "var(--good)" }} /></div>
                    <span className="cat-val">96%</span>
                  </div>
                  <div className="divider" />
                  <div className="row small muted">
                    <span>3 critical breaches need follow-up</span>
                    <button className="btn btn-ghost" style={{ marginLeft: "auto", fontSize: 11, padding: "3px 8px" }}>
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
                  6 of 9 online
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
                  {agents.map(a => (
                    <tr key={a.name}>
                      <td>
                        <div className="row">
                          <div className="avatar" style={{ width: 26, height: 26, fontSize: 10 }}>{a.initials}</div>
                          <span style={{ fontWeight: 500 }}>{a.name}</span>
                        </div>
                      </td>
                      <td className="mono" style={{ textAlign: "right" }}>{a.handled}</td>
                      <td className="mono" style={{ textAlign: "right" }}>{a.ahtMin}m</td>
                      <td className="mono" style={{ textAlign: "right" }}>{a.csat.toFixed(1)}</td>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <div className="cat-track" style={{ flex: 1 }}>
                            <div className="cat-fill" style={{ width: `${a.ai * 100}%` }} />
                          </div>
                          <span className="mono small" style={{ width: 32, textAlign: "right" }}>
                            {Math.round(a.ai * 100)}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`pill ${a.status === "online" ? "pill-good" : a.status === "break" ? "pill-warn" : ""}`}>
                          <span className="pill-dot" /> {a.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Chrome>
  );
};

window.ManagerScreen = ManagerScreen;
