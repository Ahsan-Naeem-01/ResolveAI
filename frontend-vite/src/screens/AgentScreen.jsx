import { useEffect, useState, useCallback } from "react";
import Chrome from "../components/Chrome.jsx";
import Sidebar from "../components/Sidebar.jsx";
import Topbar from "../components/Topbar.jsx";
import Icon from "../components/Icon.jsx";
import { api } from "../lib/api.js";
import { URGENCY_CLASS, STATUS_CLASS, STATUS_LABEL } from "../lib/format.js";

const NAV = [
  {
    label: "Queue",
    items: [
      { id: "inbox", icon: "inbox", name: "All tickets" },
      { id: "mine", icon: "users", name: "Assigned to me" },
      { id: "watch", icon: "flag", name: "Watching" },
    ],
  },
  {
    label: "Status",
    items: [
      { id: "review", icon: "sparkles", name: "Needs review" },
      { id: "resolved", icon: "check", name: "Auto-resolved" },
      { id: "escalated", icon: "shield", name: "Escalated" },
    ],
  },
  {
    label: "Library",
    items: [
      { id: "kb", icon: "book", name: "Knowledge base" },
      { id: "macros", icon: "lightning", name: "Macros" },
    ],
  },
];

export default function AgentScreen({ toast }) {
  const [tickets, setTickets] = useState([]);
  const [activeCode, setActiveCode] = useState(null);
  const [filter, setFilter] = useState("All");
  const [detail, setDetail] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyEdited, setReplyEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // 'regen' | 'send' | null

  const refreshList = useCallback(async () => {
    try {
      const params = {};
      if (filter === "Critical" || filter === "High") params.urgency = filter;
      else if (filter === "needs-review") params.status = "needs-review";
      const list = await api.listTickets(params);
      setTickets(list);
      if (list.length && !list.find((t) => t.id === activeCode)) {
        setActiveCode(list[0].id);
      }
    } catch (e) {
      setError(e.message);
    }
  }, [filter, activeCode]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (!activeCode) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getTicket(activeCode)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setReplyText(d.auto_reply || "");
        setReplyEdited(false);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activeCode]);

  async function regenerate(tone = null) {
    if (!detail) return;
    setBusy("regen");
    try {
      const r = await api.regenerate(detail.id, tone);
      setReplyText(r.auto_reply);
      setReplyEdited(false);
      toast?.(`Reply regenerated${tone ? ` (${tone})` : ""}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (!detail) return;
    setBusy("send");
    try {
      await api.sendReply(detail.id, replyEdited ? replyText : null);
      toast?.("Reply sent — ticket resolved");
      await refreshList();
      const updated = await api.getTicket(detail.id);
      setDetail(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function saveDraft() {
    if (!detail || !replyEdited) return;
    try {
      await api.updateReply(detail.id, replyText, true);
      toast?.("Draft saved");
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Chrome url="resolveai.app/agent/queue">
      <div className="shell">
        <Sidebar
          role="Agent workspace"
          items={NAV}
          activeId="inbox"
          user={{ initials: "JM", name: "Jordan Maeda", role: "Tier 2 Agent" }}
        />
        <div className="main">
          <Topbar
            crumb="Tickets"
            title={`Inbox · ${tickets.length} open`}
            actions={
              <>
                <button className="btn">
                  <Icon name="filter" size={12} /> Filter
                </button>
                <button className="btn btn-primary">
                  <Icon name="plus" size={12} /> New ticket
                </button>
              </>
            }
          />
          <div
            className="content"
            style={{
              display: "grid",
              gridTemplateColumns: "380px 1fr",
              gap: 16,
              height: "100%",
            }}
          >
            <TicketList
              tickets={tickets}
              activeCode={activeCode}
              onSelect={setActiveCode}
              filter={filter}
              setFilter={setFilter}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                minHeight: 0,
                overflow: "auto",
              }}
            >
              {error && <div className="error-banner">{error}</div>}
              {loading && !detail && (
                <div className="empty-state">
                  <div className="spinner" />
                </div>
              )}
              {detail && (
                <TicketDetail
                  ticket={detail}
                  replyText={replyText}
                  onReplyChange={(v) => {
                    setReplyText(v);
                    setReplyEdited(true);
                  }}
                  replyEdited={replyEdited}
                  onRegenerate={regenerate}
                  onSend={send}
                  onSaveDraft={saveDraft}
                  busy={busy}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Chrome>
  );
}

function TicketList({ tickets, activeCode, onSelect, filter, setFilter }) {
  return (
    <div
      className="card"
      style={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minHeight: 0,
      }}
    >
      <div className="card-header" style={{ gap: 6, padding: "10px 12px" }}>
        {["All", "Critical", "High", "needs-review"].map((f) => (
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
        {tickets.length === 0 && (
          <div className="empty-state" style={{ height: 200 }}>
            No tickets matching this filter.
          </div>
        )}
        {tickets.map((t) => (
          <div
            key={t.id}
            onClick={() => onSelect(t.id)}
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid var(--line)",
              cursor: "pointer",
              background: t.id === activeCode ? "var(--accent-soft)" : "transparent",
              borderLeft:
                t.id === activeCode ? "3px solid var(--accent)" : "3px solid transparent",
            }}
          >
            <div className="row" style={{ marginBottom: 4 }}>
              <div
                className="avatar"
                style={{ width: 24, height: 24, fontSize: 10 }}
              >
                {t.initials}
              </div>
              <span style={{ fontWeight: 500, fontSize: 12.5 }}>{t.customer}</span>
              <span className="mono small muted" style={{ marginLeft: "auto" }}>
                {t.age}
              </span>
            </div>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 500,
                marginBottom: 4,
                color: "var(--ink)",
              }}
            >
              {t.subject}
            </div>
            <div
              className="small muted"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 1,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                marginBottom: 6,
              }}
            >
              {t.snippet}
            </div>
            <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
              <span className={URGENCY_CLASS[t.urgency] || "pill"}>
                <span className="pill-dot" /> {t.urgency}
              </span>
              <span className="pill">{t.intent}</span>
              <span
                className={STATUS_CLASS[t.status] || "pill"}
                style={{ marginLeft: "auto" }}
              >
                {STATUS_LABEL[t.status] || t.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TicketDetail({
  ticket,
  replyText,
  onReplyChange,
  replyEdited,
  onRegenerate,
  onSend,
  onSaveDraft,
  busy,
}) {
  return (
    <>
      <div className="card">
        <div className="card-header">
          <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
            {ticket.initials}
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{ticket.customer}</div>
            <div className="small muted">
              <span className="mono">{ticket.id}</span> · opened {ticket.age} ago · via{" "}
              {ticket.channel}
            </div>
          </div>
          <div className="row" style={{ marginLeft: "auto", gap: 6 }}>
            <span className={URGENCY_CLASS[ticket.urgency] || "pill"}>
              <span className="pill-dot" /> {ticket.urgency}
            </span>
            <button className="btn btn-icon btn-ghost">
              <Icon name="moreH" size={14} />
            </button>
          </div>
        </div>
        <div className="card-body">
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              marginBottom: 8,
            }}
          >
            {ticket.subject}
          </div>
          <div style={{ color: "var(--ink-2)", lineHeight: 1.6, fontSize: 13.5, whiteSpace: "pre-wrap" }}>
            {ticket.body}
          </div>
          {ticket.attachments && ticket.attachments.length > 0 && (
            <div className="row" style={{ marginTop: 14, gap: 10 }}>
              <div className="upload-thumb" />
              <div>
                <div className="small" style={{ fontWeight: 500 }}>
                  {ticket.attachments[0].filename}
                </div>
                <div className="small muted">
                  attached by customer · {(ticket.attachments[0].size_bytes / 1024 / 1024).toFixed(1)} MB
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="split">
        <div className="card">
          <div className="card-header">
            <Icon name="sparkles" size={14} />
            <div className="card-title">AI suggested reply</div>
            {ticket.confidence != null && (
              <span className="pill pill-violet" style={{ marginLeft: "auto" }}>
                <span className="pill-dot" /> {Math.round(ticket.confidence * 100)}% confidence
              </span>
            )}
          </div>
          <div className="card-body">
            <textarea
              className="field"
              style={{ minHeight: 140 }}
              value={replyText}
              onChange={(e) => onReplyChange(e.target.value)}
              disabled={ticket.status === "resolved"}
            />
            <div className="row" style={{ marginTop: 12, flexWrap: "wrap", gap: 6 }}>
              <button
                className="btn btn-ghost"
                onClick={() => onRegenerate(null)}
                disabled={busy === "regen"}
              >
                <Icon name="refresh" size={12} />{" "}
                {busy === "regen" ? "Regenerating…" : "Regenerate"}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => onRegenerate("warm")}
                disabled={busy === "regen"}
              >
                <Icon name="lightning" size={12} /> Warm tone
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => onRegenerate("concise")}
                disabled={busy === "regen"}
              >
                Concise
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => onRegenerate("formal")}
                disabled={busy === "regen"}
              >
                Formal
              </button>
              <span className="muted small" style={{ marginLeft: "auto" }}>
                {replyEdited ? "Edited by agent" : "AI-drafted, untouched"}
              </span>
              <button
                className="btn"
                onClick={onSaveDraft}
                disabled={!replyEdited || busy != null}
              >
                <Icon name="check" size={12} /> Save draft
              </button>
              <button
                className="btn btn-accent"
                onClick={onSend}
                disabled={busy != null || ticket.status === "resolved"}
              >
                <Icon name="send" size={12} />{" "}
                {busy === "send" ? "Sending…" : "Send reply"}
              </button>
            </div>
          </div>
        </div>

        <div className="col" style={{ gap: 14 }}>
          <div className="card">
            <div className="card-header" style={{ padding: "12px 14px" }}>
              <Icon name="layers" size={13} />
              <div className="card-title" style={{ fontSize: 13 }}>
                Extracted
              </div>
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

          {ticket.similar_tickets && ticket.similar_tickets.length > 0 && (
            <div className="card">
              <div className="card-header" style={{ padding: "12px 14px" }}>
                <Icon name="compass" size={13} />
                <div className="card-title" style={{ fontSize: 13 }}>
                  Similar resolved
                </div>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                {ticket.similar_tickets.map((s) => (
                  <div
                    key={s.id}
                    style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}
                  >
                    <div className="row">
                      <span className="mono small muted">{s.id}</span>
                      <span
                        className="pill pill-accent"
                        style={{ marginLeft: "auto", fontSize: 10 }}
                      >
                        {Math.round((s.similarity || 0) * 100)}%
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
      </div>
    </>
  );
}
