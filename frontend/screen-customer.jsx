/* Customer-facing screen: query submission + AI response */

const CustomerScreen = ({ compact = false }) => {
  const [stage, setStage] = React.useState("idle"); // idle | processing | done
  const [step, setStep] = React.useState(-1);
  const [query, setQuery] = React.useState(
    "Hi, I ordered the Aurora ceramic mug set (order #12345) and one of them arrived shattered. The packaging was crushed. I'd like a refund please — really disappointed because it was a gift."
  );

  const steps = [
    { name: "Preprocessing", desc: "Tokenizing & normalizing", time: "12 ms" },
    { name: "Intent classification", desc: "Refund Request · 94%", time: "84 ms" },
    { name: "Entity extraction", desc: "order_id · product · date", time: "37 ms" },
    { name: "Sentiment & urgency", desc: "Frustrated · High", time: "29 ms" },
    { name: "Semantic search", desc: "12 similar resolved tickets", time: "112 ms" },
    { name: "Response generation", desc: "Composing reply", time: "240 ms" },
  ];

  const startProcessing = () => {
    if (!query.trim()) return;
    setStage("processing");
    setStep(0);
    let i = 0;
    const tick = () => {
      i++;
      if (i < steps.length) {
        setStep(i);
        setTimeout(tick, 380);
      } else {
        setTimeout(() => { setStage("done"); setStep(steps.length); }, 380);
      }
    };
    setTimeout(tick, 380);
  };

  const reset = () => { setStage("idle"); setStep(-1); };

  const aiOutput = {
    intent: "Refund Request",
    urgency: "High",
    entities: { order_id: "12345", product: "Aurora Mug Set (4-pc)", date: "2026-04-29" },
    keywords: ["damaged", "refund", "shattered", "gift"],
    summary: "Customer requesting refund for one shattered mug from a 4-piece set ordered as a gift.",
    recommended_action: "Initiate partial refund for damaged unit; offer 15% goodwill credit; request photo for QC.",
    auto_reply:
      "Hi Anika — so sorry about the shattered mug, especially as a gift. I've started a refund for the damaged piece (you'll see it in 3–5 business days) and added a 15% credit to your account. Could you reply with a quick photo of the damage so we can flag it with packaging? — Resolve",
    ticket_route: "Finance Team",
  };

  return (
    <Chrome url="resolveai.app/help">
      <div className={`cust-hero ${compact ? "compact" : ""}`}>
        <div className="cust-eyebrow">Resolve · Help center</div>
        <div className="cust-h1">How can we help with your order?</div>
        <div className="cust-sub">
          Tell us what's going on in your own words. Our AI assistant reads it instantly,
          finds your order, and either resolves it or routes you to the right team.
        </div>

        <div className="cust-card">
          <div className="cust-card-inner">
            <textarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Describe your issue…"
              disabled={stage !== "idle"}
            />
          </div>
          <div className="cust-card-tools">
            <button className="tool-chip"><Icon name="paperclip" size={11} /> Attach photo</button>
            <button className="tool-chip"><Icon name="box" size={11} /> Link order</button>
            <span style={{ marginLeft: "auto" }} className="muted small tabular">
              {query.length} chars
            </span>
            {stage === "idle" ? (
              <button className="btn btn-accent" onClick={startProcessing}>
                <Icon name="sparkles" size={12} /> Get help
              </button>
            ) : (
              <button className="btn btn-ghost" onClick={reset}>
                <Icon name="refresh" size={12} /> Ask again
              </button>
            )}
          </div>
        </div>

        {stage === "idle" && (
          <div className="sug-grid">
            <span className="muted small" style={{ alignSelf: "center", marginRight: 4 }}>Try:</span>
            <button className="sug-chip"><Icon name="truck" size={11} /> Track my order</button>
            <button className="sug-chip"><Icon name="dollar" size={11} /> Request refund</button>
            <button className="sug-chip"><Icon name="box" size={11} /> Damaged item</button>
            <button className="sug-chip"><Icon name="shield" size={11} /> Account access</button>
          </div>
        )}

        {stage === "processing" && (
          <div className="ai-result">
            <div className="card">
              <div className="card-header">
                <Icon name="sparkles" size={14} className="" />
                <div className="card-title">Resolve is reading your message</div>
                <span className="muted small typing" style={{ marginLeft: "auto" }}>
                  <span /><span /><span />
                </span>
              </div>
              <div className="card-body">
                <div className="steps">
                  {steps.map((s, i) => (
                    <div
                      key={i}
                      className={`step ${i < step ? "done" : i === step ? "active" : ""}`}
                    >
                      <div className="step-dot">
                        {i < step ? <Icon name="check" size={10} className="" /> : i + 1}
                      </div>
                      <div>
                        <div className="step-name">{s.name}</div>
                        <div className="step-desc">{s.desc}</div>
                      </div>
                      <div className="step-time">{i <= step ? s.time : "—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {stage === "done" && (
          <div className="ai-result">
            <div className="ai-banner">
              <div className="ai-banner-mark">R</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  Got it — we've got this handled.
                </div>
                <div className="small muted">
                  We've identified your order, started a refund, and routed your case to our Finance team.
                  Reference <span className="mono" style={{ color: "var(--ink-2)" }}>TKT-29481</span>.
                </div>
              </div>
              <span className={URGENCY_CLASS["High"]}>
                <span className="pill-dot" /> High urgency
              </span>
            </div>

            <div className="card">
              <div className="card-header">
                <Icon name="chat" size={14} />
                <div className="card-title">Suggested reply</div>
                <button className="btn btn-ghost small" style={{ marginLeft: "auto" }}>
                  <Icon name="edit" size={11} /> Edit
                </button>
              </div>
              <div className="card-body" style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-2)" }}>
                {aiOutput.auto_reply}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <Icon name="layers" size={14} />
                <div className="card-title">What we understood</div>
              </div>
              <div className="card-body">
                <div className="meta-list">
                  <span className="meta-key">Intent</span>
                  <span className="meta-val">{aiOutput.intent}</span>
                  <span className="meta-key">Order</span>
                  <span className="meta-val mono">{aiOutput.entities.order_id}</span>
                  <span className="meta-key">Product</span>
                  <span className="meta-val">{aiOutput.entities.product}</span>
                  <span className="meta-key">Keywords</span>
                  <span className="meta-val">
                    {aiOutput.keywords.map(k => (
                      <span key={k} className="pill" style={{ marginRight: 4 }}>{k}</span>
                    ))}
                  </span>
                  <span className="meta-key">Routed to</span>
                  <span className="meta-val">{aiOutput.ticket_route}</span>
                </div>
                <div className="divider" />
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn-primary"><Icon name="check" size={12} /> Looks right</button>
                  <button className="btn"><Icon name="users" size={12} /> Talk to a human</button>
                  <button className="btn btn-ghost" style={{ marginLeft: "auto" }}>
                    <Icon name="git" size={12} /> View JSON
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Chrome>
  );
};

window.CustomerScreen = CustomerScreen;
