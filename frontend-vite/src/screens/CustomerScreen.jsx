import { useEffect, useState } from "react";
import PortalLayout from "../components/PortalLayout.jsx";
import Icon from "../components/Icon.jsx";
import ChatPanel from "../components/ChatPanel.jsx";
import { api } from "../lib/api.js";
import { URGENCY_CLASS, STATUS_CLASS, STATUS_LABEL } from "../lib/format.js";

const DEFAULT_QUERY =
  "Hi, I ordered the Aurora ceramic mug set (order #12345) and one of them arrived shattered. The packaging was crushed. I'd like a refund please — really disappointed because it was a gift.";

const STEP_TEMPLATE = [
  { name: "Reading your message", desc: "Understanding the details" },
  { name: "Identifying the issue", desc: "Figuring out how we can help" },
  { name: "Finding your order", desc: "Looking up order, product, dates" },
  { name: "Checking priority", desc: "Detecting urgency" },
  { name: "Choosing the right team", desc: "Routing your case" },
  { name: "Confirming next steps", desc: "Preparing your update" },
];

const SUGGESTIONS = [
  { icon: "truck", label: "Track my order", text: "Where is my package? Tracking hasn't updated in 9 days." },
  { icon: "dollar", label: "Request refund", text: "I'd like a refund for order 12345 — the item arrived damaged." },
  { icon: "box", label: "Damaged item", text: "My Aurora Mug Set (4-pc) arrived with one piece shattered. Need help." },
  { icon: "shield", label: "Account access", text: "I got an alert about a suspicious login from a device I don't recognize." },
];

export default function CustomerScreen(shellProps) {
  // Tab state lets the customer switch between submitting a new request
  // and viewing the chat threads of their existing tickets.
  const [tab, setTab] = useState("new"); // "new" | "tickets"
  const [activeTicket, setActiveTicket] = useState(null);
  const [myTickets, setMyTickets] = useState([]);
  const [myUserId, setMyUserId] = useState(null);

  useEffect(() => {
    api.me().then((u) => setMyUserId(u?.id ?? null)).catch(() => {});
  }, []);

  const refreshMyTickets = async () => {
    try {
      const list = await api.myTickets();
      setMyTickets(list || []);
    } catch {
      // ignore — endpoint will return [] for non-customer roles
    }
  };

  // Refresh the list when the customer opens the My-tickets tab.
  useEffect(() => {
    if (tab === "tickets") refreshMyTickets();
  }, [tab]);

  // After a successful submission, route the customer straight to the chat
  // for that ticket so they can converse with the agent.
  const handleTicketCreated = async (code) => {
    setActiveTicket(code);
    setTab("tickets");
    await refreshMyTickets();
  };

  return (
    <PortalLayout {...shellProps}>
      <div className="portal-tabs">
        <button
          type="button"
          className={`portal-tab ${tab === "new" ? "on" : ""}`}
          onClick={() => {
            setTab("new");
            setActiveTicket(null);
          }}
        >
          <Icon name="sparkles" size={13} className="" />
          New request
        </button>
        <button
          type="button"
          className={`portal-tab ${tab === "tickets" ? "on" : ""}`}
          onClick={() => setTab("tickets")}
        >
          <Icon name="chat" size={13} className="" />
          My tickets
          {myTickets.length > 0 && (
            <span className="portal-tab-badge">{myTickets.length}</span>
          )}
        </button>
      </div>

      {tab === "new" && <NewRequest onCreated={handleTicketCreated} />}

      {tab === "tickets" && (
        <MyTickets
          tickets={myTickets}
          activeTicket={activeTicket}
          onSelect={setActiveTicket}
          onRefresh={refreshMyTickets}
          myUserId={myUserId}
          onStartNew={() => {
            setTab("new");
            setActiveTicket(null);
          }}
        />
      )}
    </PortalLayout>
  );
}

/* ─────────────────────────────────────────────────────────────
   "New request" — the original landing flow
   ───────────────────────────────────────────────────────────── */

function NewRequest({ onCreated }) {
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
    <>
      <h1 className="portal-h1">How can we help?</h1>
      <p className="portal-sub">
        Describe your issue in plain English. Our system will find your order,
        identify what went wrong, and either resolve it instantly or route you
        to the right team.
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
            flexWrap: "wrap",
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
        <DoneView
          result={result}
          ticketCode={ticketCode}
          onOpenChat={() => onCreated?.(ticketCode)}
        />
      )}
    </>
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

function DoneView({ result, ticketCode, onOpenChat }) {
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
          flexWrap: "wrap",
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
        <div style={{ flex: 1, minWidth: 200 }}>
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
          <Icon name="layers" size={14} className="" />
          <div className="card-title">Your request summary</div>
        </div>
        <div className="card-body">
          <div className="meta-list">
            <span className="meta-key">Issue type</span>
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
            <span className="meta-key">Handled by</span>
            <span className="meta-val">{result.ticket_route}</span>
          </div>
          <div className="divider" />
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={onOpenChat}
            >
              <Icon name="chat" size={12} className="" /> Open conversation
            </button>
            <button className="btn btn-sm">
              <Icon name="users" size={12} className="" /> Talk to a human
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   "My tickets" — list + active chat
   ───────────────────────────────────────────────────────────── */

function MyTickets({ tickets, activeTicket, onSelect, onRefresh, myUserId, onStartNew }) {
  // If no ticket is selected, default to the first.
  useEffect(() => {
    if (!activeTicket && tickets.length > 0) onSelect(tickets[0].id);
  }, [activeTicket, tickets, onSelect]);

  return (
    <div className="customer-tickets-grid">
      <div className="customer-tickets-list">
        <div className="customer-tickets-head">
          <h2 className="customer-tickets-title">Your conversations</h2>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={onStartNew}
          >
            <Icon name="plus" size={12} className="" />
            New
          </button>
        </div>

        <div className="customer-tickets-rows">
          {tickets.length === 0 && (
            <div className="empty-state" style={{ height: 160 }}>
              You don't have any tickets yet.
            </div>
          )}
          {tickets.map((t) => {
            const active = t.id === activeTicket;
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => onSelect(t.id)}
                className={`customer-ticket-row ${active ? "on" : ""}`}
              >
                <div className="customer-ticket-row-head">
                  <span className="mono small muted">{t.id}</span>
                  <span
                    className={STATUS_CLASS[t.status] || "pill"}
                    style={{ marginLeft: "auto", fontSize: 9.5, padding: "1px 6px" }}
                  >
                    {STATUS_LABEL[t.status] || t.status}
                  </span>
                  {t.unread_from_agent > 0 && (
                    <span
                      className="pill pill-accent"
                      style={{ fontSize: 9.5, padding: "1px 6px" }}
                      title={`${t.unread_from_agent} new message(s)`}
                    >
                      {t.unread_from_agent}
                    </span>
                  )}
                </div>
                <div className="customer-ticket-row-subject">{t.subject}</div>
                <div className="customer-ticket-row-preview">
                  {t.last_message_preview}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="customer-tickets-chat">
        {activeTicket ? (
          <ChatPanel
            code={activeTicket}
            currentUserId={myUserId}
            currentUserRole="customer"
            onNewMessages={() => onRefresh?.()}
            onStatusChange={() => {}}
          />
        ) : (
          <div className="empty-state" style={{ height: "100%" }}>
            Select a conversation to view it.
          </div>
        )}
      </div>
    </div>
  );
}
