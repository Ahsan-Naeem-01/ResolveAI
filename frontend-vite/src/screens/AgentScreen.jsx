import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppShell, { Header } from "../components/AppShell.jsx";
import Icon from "../components/Icon.jsx";
import { Skeleton, SkeletonCard } from "../components/Skeleton.jsx";
import ChatPanel from "../components/ChatPanel.jsx";
import { api } from "../lib/api.js";
import { URGENCY_CLASS, STATUS_CLASS, STATUS_LABEL } from "../lib/format.js";
import KnowledgeBase from "./KnowledgeBase.jsx";

const FILTERS = [
  { id: "All", label: "All" },
  { id: "Critical", label: "Critical" },
  { id: "High", label: "High" },
  { id: "needs-review", label: "Needs review" },
];

// Each side-nav id → server-side filter applied to GET /api/tickets.
// Filters are merged with the chip-bar filter (urgency/needs-review).
const NAV_FILTERS = {
  inbox: {},
  drafts: { has_draft: true },
  watch: { assignee: "unassigned" },
  review: { status: "needs-review" },
  resolved: { status: "resolved" },
  escalated: { status: "escalated" },
};

const NAV_TITLES = {
  inbox: { crumb: "Tickets", title: "Inbox" },
  drafts: { crumb: "Tickets", title: "Drafts" },
  watch: { crumb: "Tickets", title: "Unassigned (watching)" },
  review: { crumb: "Tickets", title: "Needs review" },
  resolved: { crumb: "Tickets", title: "Auto-resolved" },
  escalated: { crumb: "Tickets", title: "Escalated" },
};

export default function AgentScreen({ toast, currentUser, ...shellProps }) {
  const [tickets, setTickets] = useState([]);
  const [activeCode, setActiveCode] = useState(null);
  const [filter, setFilter] = useState("All");
  const [detail, setDetail] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyEdited, setReplyEdited] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [llmInfo, setLlmInfo] = useState({ enabled: false, model: null });
  const [replySource, setReplySource] = useState(null); // "llm" | "template" | null
  const [activeNavId, setActiveNavId] = useState("inbox");
  const [routeOpen, setRouteOpen] = useState(false);
  const [departments, setDepartments] = useState([]);
  // The backend's integer user id (distinct from the Supabase UUID we get
  // in `currentUser`). We use this to compare against ticket.assignee_id.
  const [backendUserId, setBackendUserId] = useState(null);
  // Mobile detail-pane toggle: on small screens we show either the list OR
  // the detail, not both. Selecting a ticket flips this flag.
  const [showDetailMobile, setShowDetailMobile] = useState(false);

  useEffect(() => {
    api
      .llmStatus()
      .then((s) => setLlmInfo(s))
      .catch(() => {});
    api
      .listDepartments()
      .then((d) => setDepartments(d || []))
      .catch(() => {});
    api
      .me()
      .then((u) => setBackendUserId(u?.id ?? null))
      .catch(() => {});
  }, []);

  // Hook into the global ⌘K palette: when a ticket / KB article is selected,
  // surface it in the right pane instead of just emitting an event into the void.
  useEffect(() => {
    const handler = (e) => {
      const entry = e.detail;
      if (!entry) return;
      if (entry.kind === "ticket") {
        setActiveNavId("inbox");
        setFilter("All");
        setActiveCode(entry.item.id);
        setShowDetailMobile(true);
      } else if (entry.kind === "kb") {
        setActiveNavId("kb");
      }
    };
    window.addEventListener("resolveai:navigate", handler);
    return () => window.removeEventListener("resolveai:navigate", handler);
  }, []);

  function insertIntoReply(text) {
    const sep = replyText && !replyText.endsWith("\n") ? "\n\n" : "";
    setReplyText((prev) => `${prev}${sep}${text}`);
    setReplyEdited(true);
    toast?.("Inserted into reply");
  }

  const refreshList = useCallback(async () => {
    try {
      setLoadingList(true);
      const params = { ...(NAV_FILTERS[activeNavId] || {}) };
      if (filter === "Critical" || filter === "High") params.urgency = filter;
      else if (filter === "needs-review") params.status = "needs-review";
      const list = await api.listTickets(params);
      setTickets(list);
      if (list.length) {
        if (!list.find((t) => t.id === activeCode)) {
          setActiveCode(list[0].id);
        }
      } else {
        setActiveCode(null);
        setDetail(null);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingList(false);
    }
  }, [filter, activeCode, activeNavId]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (!activeCode) return;
    let cancelled = false;
    setLoadingDetail(true);
    setError(null);
    api
      .getTicket(activeCode)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setReplyText(d.auto_reply || "");
        setReplyEdited(false);
        setReplySource(null);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoadingDetail(false));
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
      setReplySource(r.reply_source || null);
      const sourceLabel =
        r.reply_source === "llm" ? " · live LLM" : r.reply_source === "template" ? " · template" : "";
      toast?.(`Reply regenerated${tone ? ` (${tone})` : ""}${sourceLabel}`);
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
      await refreshList();
    } catch (e) {
      setError(e.message);
    }
  }

  async function assignToMe() {
    if (!detail) return;
    setBusy("assign");
    try {
      await api.assignTicket(detail.id, { toMe: true });
      toast?.("Ticket assigned to you");
      const updated = await api.getTicket(detail.id);
      setDetail(updated);
      await refreshList();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function unassign() {
    if (!detail) return;
    setBusy("assign");
    try {
      await api.assignTicket(detail.id, { assigneeId: null });
      toast?.("Ticket unassigned");
      const updated = await api.getTicket(detail.id);
      setDetail(updated);
      await refreshList();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function submitRoute(form) {
    if (!detail) return;
    setBusy("route");
    try {
      const r = await api.routeTicket(detail.id, form);
      const sentNote =
        r.delivery_status === "sent"
          ? "email sent"
          : r.delivery_status === "simulated"
          ? "logged (SMTP not configured)"
          : "delivery failed";
      toast?.(`Routed to ${form.department} — ${sentNote}`);
      setRouteOpen(false);
      const updated = await api.getTicket(detail.id);
      setDetail(updated);
      await refreshList();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  // Map sidebar nav id → which view to render.
  const isKBView = activeNavId === "kb";
  const isMacrosView = activeNavId === "macros";
  const navMeta = NAV_TITLES[activeNavId] || NAV_TITLES.inbox;

  // Whenever the user switches a nav category, return to the list-view on mobile.
  useEffect(() => {
    setShowDetailMobile(false);
  }, [activeNavId]);

  const handleSelectTicket = (id) => {
    setActiveCode(id);
    setShowDetailMobile(true);
  };

  const myUserId = backendUserId;

  return (
    <AppShell
      {...shellProps}
      activeNavId={activeNavId}
      onNavChange={setActiveNavId}
    >
      {isKBView ? (
        <KnowledgeBase
          toast={toast}
          onInsertIntoReply={(text) => {
            insertIntoReply(text);
            setActiveNavId("inbox");
          }}
          ticketOpen={!!detail}
        />
      ) : isMacrosView ? (
        <ComingSoon
          title="Macros"
          subtitle="Reusable reply templates and one-click responses. Coming soon."
        />
      ) : (
        <>
          <Header
            crumb={navMeta.crumb}
            title={`${navMeta.title} · ${tickets.length}`}
            actions={
              <div className="agent-header-actions">
                {showDetailMobile && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm agent-back-btn"
                    onClick={() => setShowDetailMobile(false)}
                    aria-label="Back to ticket list"
                  >
                    <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>
                      ←
                    </span>
                    Back
                  </button>
                )}
                <button className="btn btn-primary btn-sm">
                  <Icon name="plus" size={12} className="" /> New ticket
                </button>
              </div>
            }
          />
          <div
            className={`content agent-grid ${showDetailMobile ? "show-detail" : "show-list"}`}
          >
            <div className="agent-list-pane">
              <TicketList
                tickets={tickets}
                activeCode={activeCode}
                onSelect={handleSelectTicket}
                filter={filter}
                setFilter={setFilter}
                loading={loadingList}
                myUserId={myUserId}
              />
            </div>
            <div className="agent-detail-pane">
              {error && <div className="error-banner">{error}</div>}
              {loadingDetail && !detail && <SkeletonCard height={420} />}
              {!detail && !loadingDetail && (
                <div className="empty-state" style={{ height: 240 }}>
                  Select a ticket to view its details.
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
                  llmInfo={llmInfo}
                  replySource={replySource}
                  onInsertKB={insertIntoReply}
                  onAssignMe={assignToMe}
                  onUnassign={unassign}
                  onOpenRoute={() => setRouteOpen(true)}
                  onConversationUpdate={refreshList}
                  myUserId={myUserId}
                />
              )}
            </div>
          </div>

          {routeOpen && detail && (
            <RouteModal
              ticket={detail}
              departments={departments}
              busy={busy === "route"}
              onClose={() => setRouteOpen(false)}
              onSubmit={submitRoute}
              currentUser={currentUser}
            />
          )}
        </>
      )}
    </AppShell>
  );
}

function ComingSoon({ title, subtitle }) {
  return (
    <>
      <Header crumb="Tickets" title={title} hasSearch={false} />
      <div className="content">
        <div
          className="card"
          style={{
            padding: 32,
            textAlign: "center",
            color: "var(--ink-3)",
          }}
        >
          <div style={{ fontSize: 14, color: "var(--ink-2)", marginBottom: 4 }}>
            {title}
          </div>
          <div className="small">{subtitle}</div>
        </div>
      </div>
    </>
  );
}

function TicketList({
  tickets,
  activeCode,
  onSelect,
  filter,
  setFilter,
  loading,
  myUserId,
}) {
  return (
    <div
      className="card agent-ticket-list"
      style={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minHeight: 0,
        height: "100%",
      }}
    >
      <div
        className="card-header agent-filter-bar"
        style={{ gap: 6, padding: "10px 14px", flexShrink: 0, flexWrap: "wrap" }}
      >
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`btn btn-sm ${filter === f.id ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div style={{ overflow: "auto", flex: 1 }}>
        {loading && tickets.length === 0 && (
          <div style={{ padding: 14 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 0",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <Skeleton width="60%" height={11} style={{ marginBottom: 6 }} />
                <Skeleton width="90%" height={13} style={{ marginBottom: 6 }} />
                <Skeleton width="80%" height={10} />
              </div>
            ))}
          </div>
        )}
        {!loading && tickets.length === 0 && (
          <div className="empty-state" style={{ height: 200 }}>
            No tickets matching this filter.
          </div>
        )}
        {tickets.map((t) => {
          const mine = myUserId && t.assignee_id === myUserId;
          return (
            <div
              key={t.id}
              onClick={() => onSelect(t.id)}
              className="ticket-row"
              style={{
                padding: "12px 14px",
                borderBottom: "1px solid var(--line)",
                cursor: "pointer",
                background:
                  t.id === activeCode ? "var(--accent-soft)" : "transparent",
                borderLeft:
                  t.id === activeCode
                    ? "3px solid var(--accent)"
                    : "3px solid transparent",
              }}
            >
              <div className="row" style={{ marginBottom: 4 }}>
                <div
                  className="avatar"
                  style={{ width: 24, height: 24, fontSize: 10 }}
                >
                  {t.initials}
                </div>
                <span style={{ fontWeight: 500, fontSize: 12.5, color: "var(--ink)" }}>
                  {t.customer}
                </span>
                <span
                  className="mono small muted"
                  style={{ marginLeft: "auto" }}
                >
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
                {t.has_draft && (
                  <span
                    className="pill pill-warn"
                    title="You have an unsent draft on this ticket"
                  >
                    <Icon name="edit" size={9} className="" /> Draft
                  </span>
                )}
                {mine && (
                  <span
                    className="pill pill-accent"
                    title="Assigned to you"
                  >
                    Mine
                  </span>
                )}
                {!mine && t.assignee_initials && (
                  <span className="pill" title={`Assigned to ${t.assignee_name}`}>
                    @{t.assignee_initials}
                  </span>
                )}
                <span
                  className={STATUS_CLASS[t.status] || "pill"}
                  style={{ marginLeft: "auto" }}
                >
                  {STATUS_LABEL[t.status] || t.status}
                </span>
              </div>
            </div>
          );
        })}
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
  llmInfo,
  replySource,
  onInsertKB,
  onAssignMe,
  onUnassign,
  onOpenRoute,
  onConversationUpdate,
  myUserId,
}) {
  const [kbSuggestions, setKbSuggestions] = useState([]);
  const [kbLoading, setKbLoading] = useState(false);

  useEffect(() => {
    if (!ticket?.id) return;
    let cancelled = false;
    setKbLoading(true);
    api
      .kbSuggestForTicket(ticket.id, 3)
      .then((rows) => {
        if (!cancelled) setKbSuggestions(rows || []);
      })
      .catch(() => !cancelled && setKbSuggestions([]))
      .finally(() => !cancelled && setKbLoading(false));
    return () => {
      cancelled = true;
    };
  }, [ticket?.id]);

  async function insertKB(slug) {
    try {
      const article = await api.kbGet(slug);
      await api.kbMarkInserted(slug);
      onInsertKB?.(article.body || "");
    } catch (e) {
      console.error(e);
    }
  }

  const showLiveBadge = replySource === "llm" || (llmInfo?.enabled && replySource == null);
  const showTemplateBadge = replySource === "template" || (!llmInfo?.enabled && replySource == null);

  const isMine = myUserId && ticket.assignee_id === myUserId;
  const hasAssignee = !!ticket.assignee_id;
  const routingHistory = ticket.routing_history || [];

  return (
    <>
      <div className="card agent-ticket-summary">
        <div className="card-header agent-detail-head">
          <div
            className="avatar lg"
            style={{ width: 32, height: 32, fontSize: 12 }}
          >
            {ticket.initials}
          </div>
          <div className="agent-detail-customer">
            <div style={{ fontWeight: 600, color: "var(--ink)" }}>
              {ticket.customer}
            </div>
            <div className="small muted">
              <span className="mono">{ticket.id}</span> · opened{" "}
              {ticket.age} ago · via {ticket.channel}
            </div>
          </div>
          <div className="row agent-detail-actions" style={{ marginLeft: "auto", gap: 6, flexWrap: "wrap" }}>
            {hasAssignee && (
              <span
                className={`pill ${isMine ? "pill-accent" : ""}`}
                title={
                  isMine
                    ? "Assigned to you"
                    : `Assigned to ${ticket.assignee_name}`
                }
              >
                <span className="pill-dot" />
                {isMine ? "Assigned to me" : ticket.assignee_name}
              </span>
            )}
            <span className={URGENCY_CLASS[ticket.urgency] || "pill"}>
              <span className="pill-dot" /> {ticket.urgency}
            </span>
            {!isMine && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={onAssignMe}
                disabled={busy === "assign"}
                title="Take ownership of this ticket"
              >
                <Icon name="users" size={12} className="" />
                {busy === "assign" ? "Saving…" : "Assign to me"}
              </button>
            )}
            {isMine && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={onUnassign}
                disabled={busy === "assign"}
              >
                <Icon name="x" size={12} className="" />
                Unassign
              </button>
            )}
          </div>
        </div>
        <div className="card-body agent-ticket-summary-body">
          <div className="agent-subject">{ticket.subject}</div>
          {ticket.attachments && ticket.attachments.length > 0 && (
            <div className="row" style={{ marginTop: 10, gap: 10 }}>
              <div className="upload-thumb" style={{ width: 36, height: 36 }}>
                <Icon name="paperclip" size={14} className="" />
              </div>
              <div>
                <div className="small" style={{ fontWeight: 500 }}>
                  {ticket.attachments[0].filename}
                </div>
                <div className="small muted">
                  attached by customer ·{" "}
                  {(ticket.attachments[0].size_bytes / 1024 / 1024).toFixed(1)} MB
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="agent-work-main">
        <div className="card agent-chat-card">
          <div className="card-header agent-chat-head">
            <Icon name="chat" size={13} className="" />
            <div className="card-title" style={{ fontSize: 13 }}>
              Conversation
            </div>
          </div>
          <ChatPanel
            code={ticket.id}
            currentUserId={myUserId}
            currentUserRole="agent"
            onNewMessages={onConversationUpdate}
            className="chat-panel-embedded"
          />
        </div>

        <div className="card agent-reply-card">
          <div className="card-header agent-reply-head">
            <Icon name="sparkles" size={14} className="" />
            <div className="card-title">AI suggested reply</div>
            <div
              className="row"
              style={{ marginLeft: "auto", gap: 6, flexWrap: "wrap" }}
            >
              {showLiveBadge && (
                <span
                  className="pill pill-accent"
                  title={
                    llmInfo?.model
                      ? `Live LLM via Groq (${llmInfo.model})`
                      : "Live LLM"
                  }
                >
                  <span className="pill-dot" /> Live LLM
                </span>
              )}
              {showTemplateBadge && (
                <span
                  className="pill"
                  title="Set GROQ_API_KEY in backend/.env to enable live LLM replies"
                >
                  Template
                </span>
              )}
              {ticket.confidence != null && (
                <span className="pill pill-accent">
                  <span className="pill-dot" />{" "}
                  {Math.round(ticket.confidence * 100)}% confidence
                </span>
              )}
            </div>
          </div>
          <div className="card-body">
            <textarea
              className="field"
              style={{ minHeight: 140 }}
              value={replyText}
              onChange={(e) => onReplyChange(e.target.value)}
              disabled={ticket.status === "resolved"}
            />
            <div
              className="row agent-reply-actions"
              style={{ marginTop: 12, flexWrap: "wrap", gap: 6 }}
            >
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => onRegenerate(null)}
                disabled={busy === "regen"}
              >
                <Icon name="refresh" size={12} className="" />
                {busy === "regen" ? "Regenerating…" : "Regenerate"}
              </button>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => onRegenerate("warm")}
                disabled={busy === "regen"}
              >
                Warm
              </button>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => onRegenerate("concise")}
                disabled={busy === "regen"}
              >
                Concise
              </button>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => onRegenerate("formal")}
                disabled={busy === "regen"}
              >
                Formal
              </button>
              <span
                className="muted small agent-reply-status"
                style={{ marginLeft: "auto" }}
              >
                {replyEdited ? "Edited by agent" : "AI-drafted, untouched"}
              </span>
              <button
                className="btn btn-sm"
                onClick={onSaveDraft}
                disabled={!replyEdited || busy != null}
              >
                <Icon name="check" size={12} className="" /> Save draft
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={onSend}
                disabled={busy != null || ticket.status === "resolved"}
              >
                <Icon name="send" size={12} className="" />
                {busy === "send" ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="agent-side-rail">
        <div className="card">
          <div className="card-header" style={{ padding: "12px 14px" }}>
            <Icon name="layers" size={13} className="" />
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
              <div
                className="row"
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: "1px solid var(--line)",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={onOpenRoute}
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  <Icon name="send" size={12} className="" />
                  Route to department
                </button>
              </div>
              {routingHistory.length > 0 && (
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: "1px solid var(--line)",
                  }}
                >
                  <div
                    className="small muted"
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      marginBottom: 6,
                    }}
                  >
                    Routing history
                  </div>
                  {routingHistory.slice(0, 3).map((h) => (
                    <div
                      key={h.id}
                      style={{
                        fontSize: 11.5,
                        color: "var(--ink-2)",
                        marginBottom: 6,
                      }}
                    >
                      <div style={{ fontWeight: 500, color: "var(--ink)" }}>
                        {h.department}
                      </div>
                      <div className="small muted" style={{ fontSize: 10.5 }}>
                        → {h.recipient_email} ·{" "}
                        <span
                          className={`pill ${
                            h.delivery_status === "sent"
                              ? "pill-good"
                              : h.delivery_status === "failed"
                              ? "pill-bad"
                              : ""
                          }`}
                          style={{ fontSize: 9.5, padding: "1px 6px" }}
                        >
                          {h.delivery_status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {(kbLoading || kbSuggestions.length > 0) && (
            <div className="card">
              <div className="card-header" style={{ padding: "12px 14px" }}>
                <Icon name="book" size={13} className="" />
                <div className="card-title" style={{ fontSize: 13 }}>
                  Suggested articles
                </div>
                {kbLoading && (
                  <span
                    className="muted small"
                    style={{ marginLeft: "auto" }}
                  >
                    …
                  </span>
                )}
              </div>
              <div style={{ padding: 0 }}>
                {kbSuggestions.map((a) => (
                  <div
                    key={a.slug}
                    style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid var(--line)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: "var(--ink)",
                        marginBottom: 2,
                      }}
                    >
                      {a.title}
                    </div>
                    {a.summary && (
                      <div
                        className="small"
                        style={{
                          color: "var(--ink-2)",
                          marginBottom: 6,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {a.summary}
                      </div>
                    )}
                    <div className="row" style={{ gap: 6 }}>
                      <span className="pill" style={{ fontSize: 10 }}>
                        {a.category}
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        style={{ marginLeft: "auto", fontSize: 11 }}
                        onClick={() => insertKB(a.slug)}
                      >
                        <Icon name="lightning" size={11} className="" /> Insert
                      </button>
                    </div>
                  </div>
                ))}
                {!kbLoading && kbSuggestions.length === 0 && (
                  <div
                    className="small muted"
                    style={{ padding: "12px 14px" }}
                  >
                    No matching articles yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {ticket.similar_tickets && ticket.similar_tickets.length > 0 && (
            <div className="card">
              <div className="card-header" style={{ padding: "12px 14px" }}>
                <Icon name="compass" size={13} className="" />
                <div className="card-title" style={{ fontSize: 13 }}>
                  Similar resolved
                </div>
              </div>
              <div style={{ padding: 0 }}>
                {ticket.similar_tickets.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid var(--line)",
                    }}
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
                    <div
                      className="small"
                      style={{ marginTop: 2, color: "var(--ink-2)" }}
                    >
                      {s.summary}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   RouteModal — forward the ticket to a department by email
   ───────────────────────────────────────────────────────────── */

function RouteModal({ ticket, departments, busy, onClose, onSubmit, currentUser }) {
  // Default to the AI-suggested route if it matches a known department.
  const initialDept = useMemo(() => {
    if (!departments?.length) return null;
    const match = departments.find(
      (d) => d.name.toLowerCase() === (ticket.route || "").toLowerCase()
    );
    return match || departments[0];
  }, [ticket.route, departments]);

  const [deptName, setDeptName] = useState(initialDept?.name || "");
  const [recipient, setRecipient] = useState(initialDept?.email || "");
  const [subject, setSubject] = useState(
    `[${ticket.id}] ${ticket.subject || "Routed ticket"}`
  );
  const [message, setMessage] = useState(
    [
      `Hi ${deptName || "team"},`,
      "",
      `Forwarding ticket ${ticket.id} for your review and ownership.`,
      "",
      `Recommended action: ${ticket.recommended_action || "—"}`,
      "",
      `Thanks,`,
      currentUser?.name || "ResolveAI",
    ].join("\n")
  );
  const [cc, setCc] = useState("");
  const [touchedSubject, setTouchedSubject] = useState(false);
  const messageRef = useRef(null);

  // When department changes, update the recipient default + greeting.
  useEffect(() => {
    const d = departments.find((x) => x.name === deptName);
    if (d?.email) setRecipient(d.email);
  }, [deptName, departments]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!deptName || !recipient || !message.trim()) return;
    const payload = {
      department: deptName,
      recipient_email: recipient.trim(),
      subject: subject.trim() || undefined,
      message: message.trim(),
      cc: cc
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      mark_escalated: true,
    };
    onSubmit(payload);
  }

  return (
    <div
      className="route-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Route ticket to a department"
      onClick={(e) => {
        if (e.target.classList.contains("route-modal-overlay")) onClose();
      }}
    >
      <form className="route-modal" onSubmit={handleSubmit}>
        <div className="route-modal-head">
          <div>
            <div className="route-modal-title">Route to a department</div>
            <div className="small muted">
              Forward <span className="mono">{ticket.id}</span> via email — the
              full ticket context is included automatically.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="x" size={14} className="" />
          </button>
        </div>

        <div className="route-modal-body">
          <div className="route-field">
            <label className="route-label">Department</label>
            <div className="route-dept-grid">
              {departments.map((d) => {
                const on = d.name === deptName;
                return (
                  <button
                    key={d.name}
                    type="button"
                    className={`route-dept ${on ? "on" : ""}`}
                    onClick={() => setDeptName(d.name)}
                  >
                    <div className="route-dept-name">{d.name}</div>
                    <div className="route-dept-email">{d.email}</div>
                    {d.intents?.length > 0 && (
                      <div className="route-dept-intents">
                        {d.intents.slice(0, 2).join(" · ")}
                        {d.intents.length > 2 ? ` +${d.intents.length - 2}` : ""}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="route-field">
            <label className="route-label" htmlFor="route-recipient">
              Recipient
            </label>
            <input
              id="route-recipient"
              className="text-input"
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="team@yourcompany.com"
              required
            />
          </div>

          <div className="route-field">
            <label className="route-label" htmlFor="route-cc">
              Cc <span className="muted small">(optional, comma-separated)</span>
            </label>
            <input
              id="route-cc"
              className="text-input"
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="manager@example.com, lead@example.com"
            />
          </div>

          <div className="route-field">
            <label className="route-label" htmlFor="route-subject">
              Subject
            </label>
            <input
              id="route-subject"
              className="text-input"
              type="text"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setTouchedSubject(true);
              }}
            />
          </div>

          <div className="route-field">
            <label className="route-label" htmlFor="route-message">
              Message
            </label>
            <textarea
              id="route-message"
              ref={messageRef}
              className="field"
              style={{ minHeight: 160, fontFamily: "inherit" }}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
            <div className="small muted" style={{ marginTop: 6 }}>
              The original message, ticket metadata, and your signature are
              appended automatically.
            </div>
          </div>
        </div>

        <div className="route-modal-foot">
          <span className="small muted">
            The ticket will be marked <strong>Escalated</strong> after sending.
          </span>
          <div className="row" style={{ gap: 8, marginLeft: "auto" }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-sm btn-primary"
              disabled={busy || !deptName || !recipient || !message.trim()}
            >
              <Icon name="send" size={12} className="" />
              {busy ? "Sending…" : "Send & route"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
