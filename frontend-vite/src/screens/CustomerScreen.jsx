import { useState } from "react";
import PortalLayout from "../components/PortalLayout.jsx";
import Icon from "../components/Icon.jsx";
import { api } from "../lib/api.js";
import { URGENCY_CLASS } from "../lib/format.js";

const DEFAULT_QUERY =
  "Hi, I ordered the Aurora ceramic mug set (order #12345) and one of them arrived shattered. The packaging was crushed. I'd like a refund please — really disappointed because it was a gift.";

const STEP_TEMPLATE = [
  { name: "Preprocessing", desc: "Tokenizing & normalizing" },
  { name: "Intent classification", desc: "Routing your message" },
  { name: "Entity extraction", desc: "Order, product, dates" },
  { name: "Sentiment & urgency", desc: "Detecting tone" },
  { name: "Semantic search", desc: "Finding similar resolved cases" },
  { name: "Response generation", desc: "Composing reply" },
];

const SUGGESTIONS = [
  { icon: "truck", label: "Track my order", text: "Where is my package? Tracking hasn't updated in 9 days." },
  { icon: "dollar", label: "Request refund", text: "I'd like a refund for order 12345 — the item arrived damaged." },
  { icon: "box", label: "Damaged item", text: "My Aurora Mug Set (4-pc) arrived with one piece shattered. Need help." },
  { icon: "shield", label: "Account access", text: "I got an alert about a suspicious login from a device I don't recognize." },
];

export default function CustomerScreen(shellProps) {
  const [stage, setStage] = useState("idle"); // idle | processing | done | error
  const [step, setStep] = useState(-1);
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [ticketCode, setTicketCode] = useState(null);

  async function start() {
    if (!query.trim()) return;
    setError(null);
    setStage("processing");
    setStep(0);

    const ticker = setInterval(() => {
      setStep((s) => Math.min(s + 1, STEP_TEMPLATE.length - 1));
    }, 320);

    try {
      const data = await api.processQuery({ query: query.trim() });
      clearInterval(ticker);
      setStep(STEP_TEMPLATE.length);
      setResult(data.nlp);
      setTicketCode(data.ticket_id);
      setStage("done");
    } catch (e) {
      clearInterval(ticker);
      setError(e.message || "Something went wrong");
      setStage("error");
      setStep(-1);
    }
  }

  function reset() {
    setStage("idle");
    setStep(-1);
    setResult(null);
    setError(null);
    setTicketCode(null);
  }

  return (
    <PortalLayout {...shellProps}>
      <h1 className="portal-h1">How can we help?</h1>
      <p className="portal-sub">
        Describe your issue in plain English. Our system will find your order,
        identify what went wrong, and either resolve it instantly or route you to
        the right team.
      </p>

      <div
        className="card"
        style={{
          padding: 0,
          boxShadow: "var(--shadow-md)",
        }}
      >
        <div style={{ padding: "16px 18px 4px" }}>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe your issue…"
            disabled={stage !== "idle" && stage !== "error"}
            style={{
              border: 0,
              outline: 0,
              padding: 0,
              width: "100%",
              minHeight: 84,
              resize: "vertical",
              fontFamily: "inherit",
              fontSize: 15,
              color: "var(--ink)",
              background: "transparent",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 14px",
            borderTop: "1px solid var(--line)",
          }}
        >
          <button className="btn btn-sm btn-ghost">
            <Icon name="paperclip" size={12} className="" /> Attach
          </button>
          <button className="btn btn-sm btn-ghost">
            <Icon name="box" size={12} className="" /> Link order
          </button>
          <span className="muted small tabular" style={{ marginLeft: "auto" }}>
            {query.length} chars
          </span>
          {stage === "idle" || stage === "error" ? (
            <button className="btn btn-primary btn-sm" onClick={start}>
              <Icon name="sparkles" size={12} className="" />
              Get help
            </button>
          ) : (
            <button className="btn btn-sm btn-ghost" onClick={reset}>
              <Icon name="refresh" size={12} className="" /> Start over
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-banner" style={{ marginTop: 14 }}>
          {error}
        </div>
      )}

      {stage === "idle" && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 16,
            alignItems: "center",
          }}
        >
          <span className="muted small">Common issues:</span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              className="btn btn-sm"
              onClick={() => setQuery(s.text)}
            >
              <Icon name={s.icon} size={12} className="" /> {s.label}
            </button>
          ))}
        </div>
      )}

      {stage === "processing" && (
        <ProcessingPanel step={step} liveSteps={result?.steps} />
      )}

      {stage === "done" && result && (
        <DoneView result={result} ticketCode={ticketCode} />
      )}
    </PortalLayout>
  );
}

function ProcessingPanel({ step, liveSteps }) {
  const items =
    liveSteps && liveSteps.length === STEP_TEMPLATE.length
      ? liveSteps
      : STEP_TEMPLATE.map((s) => ({ ...s, ms: null }));
  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div className="card-header">
        <Icon name="sparkles" size={14} className="" />
        <div className="card-title">Reading your message</div>
        <span className="muted small typing" style={{ marginLeft: "auto" }}>
          <span /><span /><span />
        </span>
      </div>
      <div className="card-body">
        <div className="steps">
          {items.map((s, i) => (
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
              <div className="step-time">
                {i <= step && s.ms != null
                  ? `${s.ms.toFixed(0)} ms`
                  : i <= step
                  ? "…"
                  : "—"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DoneView({ result, ticketCode }) {
  const urgencyClass = URGENCY_CLASS[result.urgency] || "pill";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
      <div
        className="card"
        style={{
          padding: 18,
          background: "var(--accent-soft)",
          borderColor: "color-mix(in oklab, var(--accent) 25%, transparent)",
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            background: "var(--accent)",
            color: "white",
            borderRadius: "var(--rad-md)",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            fontSize: 13,
            flexShrink: 0,
          }}
        >
          R
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: "var(--ink)" }}>
            Got it — we've taken care of this.
          </div>
          <div className="small muted">
            We've identified your order, started a {result.intent.toLowerCase()},
            and routed your case to <strong>{result.ticket_route}</strong>.
            Reference{" "}
            <span className="mono" style={{ color: "var(--ink-2)" }}>
              {ticketCode}
            </span>
            .
          </div>
        </div>
        <span className={urgencyClass}>
          <span className="pill-dot" /> {result.urgency} urgency
        </span>
      </div>

      <div className="card">
        <div className="card-header">
          <Icon name="chat" size={14} className="" />
          <div className="card-title">Suggested reply</div>
          <span className="muted small" style={{ marginLeft: "auto" }}>
            {(result.intent_confidence * 100).toFixed(0)}% confidence
          </span>
        </div>
        <div
          className="card-body"
          style={{
            fontSize: 13.5,
            lineHeight: 1.6,
            color: "var(--ink-2)",
            whiteSpace: "pre-wrap",
          }}
        >
          {result.auto_reply}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <Icon name="layers" size={14} className="" />
          <div className="card-title">What we understood</div>
        </div>
        <div className="card-body">
          <div className="meta-list">
            <span className="meta-key">Intent</span>
            <span className="meta-val">{result.intent}</span>
            {result.entities.order_id && (
              <>
                <span className="meta-key">Order</span>
                <span className="meta-val mono">{result.entities.order_id}</span>
              </>
            )}
            {result.entities.product && (
              <>
                <span className="meta-key">Product</span>
                <span className="meta-val">{result.entities.product}</span>
              </>
            )}
            {result.entities.date && (
              <>
                <span className="meta-key">Date</span>
                <span className="meta-val mono">{result.entities.date}</span>
              </>
            )}
            <span className="meta-key">Sentiment</span>
            <span className="meta-val">{result.sentiment}</span>
            <span className="meta-key">Keywords</span>
            <span className="meta-val">
              {result.keywords.map((k) => (
                <span key={k} className="pill" style={{ marginRight: 4 }}>
                  {k}
                </span>
              ))}
            </span>
            <span className="meta-key">Routed to</span>
            <span className="meta-val">{result.ticket_route}</span>
          </div>
          <div className="divider" />
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-primary btn-sm">
              <Icon name="check" size={12} className="" /> Looks right
            </button>
            <button className="btn btn-sm">
              <Icon name="users" size={12} className="" /> Talk to a human
            </button>
          </div>
        </div>
      </div>

      {result.similar_tickets && result.similar_tickets.length > 0 && (
        <div className="card">
          <div className="card-header">
            <Icon name="compass" size={14} className="" />
            <div className="card-title">Similar resolved cases</div>
          </div>
          <div style={{ padding: 0 }}>
            {result.similar_tickets.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: "12px 18px",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div className="row">
                  <span className="mono small muted">{s.id}</span>
                  <span
                    className="pill pill-accent"
                    style={{ marginLeft: "auto", fontSize: 10 }}
                  >
                    {Math.round((s.similarity || 0) * 100)}% match
                  </span>
                </div>
                <div className="small" style={{ marginTop: 4, color: "var(--ink-2)" }}>
                  {s.summary}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
