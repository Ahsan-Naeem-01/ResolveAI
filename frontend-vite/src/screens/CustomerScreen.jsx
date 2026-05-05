import { useState } from "react";
import Chrome from "../components/Chrome.jsx";
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

export default function CustomerScreen({ compact = false }) {
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

    // Tick visual progress while the request is in flight
    const ticker = setInterval(() => {
      setStep((s) => Math.min(s + 1, STEP_TEMPLATE.length - 1));
    }, 320);

    try {
      const data = await api.processQuery({ query: query.trim() });
      clearInterval(ticker);
      setStep(STEP_TEMPLATE.length); // mark all done
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
    <Chrome url="resolveai.app/help">
      <div className={`cust-hero ${compact ? "compact" : ""}`}>
        <div className="cust-eyebrow">Resolve · Help center</div>
        <div className="cust-h1">How can we help with your order?</div>
        <div className="cust-sub">
          Tell us what's going on in your own words. Our AI assistant reads it
          instantly, finds your order, and either resolves it or routes you to the
          right team.
        </div>

        <div className="cust-card">
          <div className="cust-card-inner">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Describe your issue…"
              disabled={stage !== "idle" && stage !== "error"}
            />
          </div>
          <div className="cust-card-tools">
            <button className="tool-chip">
              <Icon name="paperclip" size={11} /> Attach photo
            </button>
            <button className="tool-chip">
              <Icon name="box" size={11} /> Link order
            </button>
            <span style={{ marginLeft: "auto" }} className="muted small tabular">
              {query.length} chars
            </span>
            {stage === "idle" || stage === "error" ? (
              <button className="btn btn-accent" onClick={start}>
                <Icon name="sparkles" size={12} /> Get help
              </button>
            ) : (
              <button className="btn btn-ghost" onClick={reset}>
                <Icon name="refresh" size={12} /> Ask again
              </button>
            )}
          </div>
        </div>

        {error && <div className="error-banner" style={{ maxWidth: 720, marginTop: 14 }}>{error}</div>}

        {stage === "idle" && (
          <div className="sug-grid">
            <span className="muted small" style={{ alignSelf: "center", marginRight: 4 }}>
              Try:
            </span>
            <button
              className="sug-chip"
              onClick={() => setQuery("Where is my package? Tracking hasn't updated in 9 days.")}
            >
              <Icon name="truck" size={11} /> Track my order
            </button>
            <button
              className="sug-chip"
              onClick={() => setQuery("I'd like a refund for order 12345 — the item arrived damaged.")}
            >
              <Icon name="dollar" size={11} /> Request refund
            </button>
            <button
              className="sug-chip"
              onClick={() =>
                setQuery("My Aurora Mug Set (4-pc) arrived with one piece shattered. Need help.")
              }
            >
              <Icon name="box" size={11} /> Damaged item
            </button>
            <button
              className="sug-chip"
              onClick={() =>
                setQuery("I got an alert about a suspicious login from a device I don't recognize.")
              }
            >
              <Icon name="shield" size={11} /> Account access
            </button>
          </div>
        )}

        {stage === "processing" && (
          <ProcessingPanel step={step} liveSteps={result?.steps} />
        )}

        {stage === "done" && result && (
          <DoneView result={result} ticketCode={ticketCode} />
        )}
      </div>
    </Chrome>
  );
}

function ProcessingPanel({ step, liveSteps }) {
  const items = liveSteps && liveSteps.length === STEP_TEMPLATE.length
    ? liveSteps
    : STEP_TEMPLATE.map((s, i) => ({ ...s, ms: null }));
  return (
    <div className="ai-result">
      <div className="card">
        <div className="card-header">
          <Icon name="sparkles" size={14} />
          <div className="card-title">Resolve is reading your message</div>
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
                  {i <= step && s.ms != null ? `${s.ms.toFixed(0)} ms` : i <= step ? "…" : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DoneView({ result, ticketCode }) {
  const urgencyClass = URGENCY_CLASS[result.urgency] || "pill";
  return (
    <div className="ai-result">
      <div className="ai-banner">
        <div className="ai-banner-mark">R</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Got it — we've got this handled.
          </div>
          <div className="small muted">
            We've identified your order, started a {result.intent.toLowerCase()}, and routed your case to{" "}
            <strong>{result.ticket_route}</strong>. Reference{" "}
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
          <Icon name="chat" size={14} />
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
          <Icon name="layers" size={14} />
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
            <button className="btn btn-primary">
              <Icon name="check" size={12} /> Looks right
            </button>
            <button className="btn">
              <Icon name="users" size={12} /> Talk to a human
            </button>
          </div>
        </div>
      </div>

      {result.similar_tickets && result.similar_tickets.length > 0 && (
        <div className="card">
          <div className="card-header">
            <Icon name="compass" size={14} />
            <div className="card-title">Similar resolved cases</div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {result.similar_tickets.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div className="row">
                  <span className="mono small muted">{s.id}</span>
                  <span className="pill pill-accent" style={{ marginLeft: "auto", fontSize: 10 }}>
                    {Math.round((s.similarity || 0) * 100)}% match
                  </span>
                </div>
                <div className="small" style={{ marginTop: 2 }}>
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
