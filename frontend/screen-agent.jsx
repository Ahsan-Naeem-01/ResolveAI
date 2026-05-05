/* Support Agent screen — ticket queue + ticket detail with AI panel */

const AgentScreen = () => {
  const [activeId, setActiveId] = React.useState("TKT-29481");
  const [filter, setFilter] = React.useState("All");
  const [replyEdited, setReplyEdited] = React.useState(false);
  const [replyText, setReplyText] = React.useState(
    "Hi Anika — so sorry about the shattered mug, especially as a gift. I've started a refund for the damaged piece (you'll see it in 3–5 business days) and added a 15% credit to your account. Could you reply with a quick photo of the damage so we can flag it with packaging? — Resolve"
  );

  const ticket = TICKETS.find(t => t.id === activeId) || TICKETS[0];
  const filtered = filter === "All"
    ? TICKETS
    : TICKETS.filter(t => t.urgency === filter || t.status === filter);

  const navItems = [
    { label: "Queue", items: [
      { id: "inbox", icon: "inbox", name: "All tickets", badge: 47 },
      { id: "mine", icon: "users", name: "Assigned to me", badge: 8 },
      { id: "watch", icon: "flag", name: "Watching", badge: 3 },
    ]},
    { label: "Status", items: [
      { id: "review", icon: "sparkles", name: "Needs review", badge: 12 },
      { id: "resolved", icon: "check", name: "Auto-resolved", badge: 134 },
      { id: "escalated", icon: "shield", name: "Escalated", badge: 2 },
    ]},
    { label: "Library", items: [
      { id: "kb", icon: "book", name: "Knowledge base" },
      { id: "macros", icon: "lightning", name: "Macros" },
    ]},
  ];

  return (
    <Chrome url="resolveai.app/agent/queue">
      <div className="shell">
        <Sidebar
          role="Agent workspace"
          items={navItems}
          activeId="inbox"
          user={{ initials: "JM", name: "Jordan Maeda", role: "Tier 2 Agent" }}
        />
        <div className="main">
          <Topbar
            crumb="Tickets"
            title={`Inbox · ${filtered.length} open`}
            actions={
              <>
                <button className="btn"><Icon name="filter" size={12} /> Filter</button>
                <button className="btn btn-primary"><Icon name="plus" size={12} /> New ticket</button>
              </>
            }
          />
          <div className="content" style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 16, height: "100%" }}>
            {/* Ticket list */}
            <div className="card" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
              <div className="card-header" style={{ gap: 6, padding: "10px 12px" }}>
                {["All", "Critical", "High", "needs-review"].map(f => (
                  <button
                    key={f}
                    className={`btn ${filter === f ? "btn-primary" : "btn-ghost"}`}
                    style={{ fontSize: 11, padding: "4px 10px" }}
                    onClick={() => setFilter(f)}
                  >
                    {f === "needs-review" ? "Needs review" : f}
                  </button>
                ))}
              </div>
              <div style={{ overflow: "auto", flex: 1 }}>
                {filtered.map(t => (
                  <div
                    key={t.id}
                    onClick={() => setActiveId(t.id)}
                    style={{
                      padding: "12px 14px",
                      borderBottom: "1px solid var(--line)",
                      cursor: "pointer",
                      background: t.id === activeId ? "var(--accent-soft)" : "transparent",
                      borderLeft: t.id === activeId ? "3px solid var(--accent)" : "3px solid transparent",
                    }}
                  >
                    <div className="row" style={{ marginBottom: 4 }}>
                      <div className="avatar" style={{ width: 24, height: 24, fontSize: 10 }}>{t.initials}</div>
                      <span style={{ fontWeight: 500, fontSize: 12.5 }}>{t.customer}</span>
                      <span className="mono small muted" style={{ marginLeft: "auto" }}>{t.age}</span>
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 4, color: "var(--ink)" }}>
                      {t.subject}
                    </div>
                    <div className="small muted" style={{
                      display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical",
                      overflow: "hidden", marginBottom: 6
                    }}>
                      {t.snippet}
                    </div>
                    <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                      <span className={URGENCY_CLASS[t.urgency]}>
                        <span className="pill-dot" /> {t.urgency}
                      </span>
                      <span className="pill">{t.intent}</span>
                      <span className={STATUS_CLASS[t.status]} style={{ marginLeft: "auto" }}>
                        {STATUS_LABEL[t.status]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ticket detail */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 0, overflow: "auto" }}>
              <div className="card">
                <div className="card-header">
                  <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{ticket.initials}</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{ticket.customer}</div>
                    <div className="small muted">
                      <span className="mono">{ticket.id}</span> · opened {ticket.age} ago · via {ticket.channel}
                    </div>
                  </div>
                  <div className="row" style={{ marginLeft: "auto", gap: 6 }}>
                    <span className={URGENCY_CLASS[ticket.urgency]}>
                      <span className="pill-dot" /> {ticket.urgency}
                    </span>
                    <button className="btn btn-icon btn-ghost"><Icon name="moreH" size={14} /></button>
                  </div>
                </div>
                <div className="card-body">
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 8 }}>
                    {ticket.subject}
                  </div>
                  <div style={{ color: "var(--ink-2)", lineHeight: 1.6, fontSize: 13.5 }}>
                    {ticket.snippet} The packaging was crushed on one corner — looks like rough handling in transit.
                    I'd really like a refund for the damaged piece. This was a housewarming gift so it was extra disappointing.
                  </div>
                  <div className="row" style={{ marginTop: 14, gap: 10 }}>
                    <div className="upload-thumb" />
                    <div>
                      <div className="small" style={{ fontWeight: 500 }}>damage_photo.jpg</div>
                      <div className="small muted">attached by customer · 2.4 MB</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="split">
                <div className="card">
                  <div className="card-header">
                    <Icon name="sparkles" size={14} />
                    <div className="card-title">AI suggested reply</div>
                    <span className="pill pill-violet" style={{ marginLeft: "auto" }}>
                      <span className="pill-dot" /> {Math.round(ticket.confidence * 100)}% confidence
                    </span>
                  </div>
                  <div className="card-body">
                    <textarea
                      className="field"
                      style={{ minHeight: 140 }}
                      value={replyText}
                      onChange={e => { setReplyText(e.target.value); setReplyEdited(true); }}
                    />
                    <div className="row" style={{ marginTop: 12 }}>
                      <button className="btn btn-ghost"><Icon name="refresh" size={12} /> Regenerate</button>
                      <button className="btn btn-ghost"><Icon name="lightning" size={12} /> Tone…</button>
                      <span className="muted small" style={{ marginLeft: "auto" }}>
                        {replyEdited ? "Edited by agent" : "AI-drafted, untouched"}
                      </span>
                      <button className="btn"><Icon name="check" size={12} /> Approve</button>
                      <button className="btn btn-accent"><Icon name="send" size={12} /> Send reply</button>
                    </div>
                  </div>
                </div>

                <div className="col" style={{ gap: 14 }}>
                  <div className="card">
                    <div className="card-header" style={{ padding: "12px 14px" }}>
                      <Icon name="layers" size={13} />
                      <div className="card-title" style={{ fontSize: 13 }}>Extracted</div>
                    </div>
                    <div className="card-body" style={{ padding: 14 }}>
                      <div className="meta-list" style={{ fontSize: 12 }}>
                        <span className="meta-key">Intent</span>
                        <span className="meta-val">{ticket.intent}</span>
                        <span className="meta-key">Sentiment</span>
                        <span className="meta-val">{ticket.sentiment}</span>
                        <span className="meta-key">Order</span>
                        <span className="meta-val mono">{ticket.order}</span>
                        <span className="meta-key">Product</span>
                        <span className="meta-val">{ticket.product}</span>
                        <span className="meta-key">Route</span>
                        <span className="meta-val">{ticket.route}</span>
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header" style={{ padding: "12px 14px" }}>
                      <Icon name="compass" size={13} />
                      <div className="card-title" style={{ fontSize: 13 }}>Similar resolved</div>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                      {[
                        { id: "TKT-28104", t: "Cracked plate from set, full refund + reship", sim: 0.94 },
                        { id: "TKT-27011", t: "Damaged glassware, partial refund", sim: 0.89 },
                        { id: "TKT-26877", t: "Box crushed in transit — replacement", sim: 0.81 },
                      ].map(s => (
                        <div key={s.id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
                          <div className="row">
                            <span className="mono small muted">{s.id}</span>
                            <span className="pill pill-accent" style={{ marginLeft: "auto", fontSize: 10 }}>
                              {Math.round(s.sim * 100)}%
                            </span>
                          </div>
                          <div className="small" style={{ marginTop: 2 }}>{s.t}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Chrome>
  );
};

window.AgentScreen = AgentScreen;
