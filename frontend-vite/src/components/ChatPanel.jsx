import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { api } from "../lib/api.js";
import { STATUS_CLASS, STATUS_LABEL } from "../lib/format.js";

/* ChatPanel — a live, polling-based conversation thread.

   Used by both the customer help-portal and the agent screen. Behavior:

   - On mount, fetches the full thread via api.getMessages(code, since=0)
   - Then every `pollMs` (default 4000ms) fetches incremental updates
   - Pauses polling when the document is hidden (Page Visibility API)
   - Auto-scrolls to the bottom on new messages

   Props
   ─────
   code            ticket code (TKT-XXXXX)
   currentUserId   the local-DB integer id of the viewer (so we render
                   their bubbles on the right)
   currentUserRole "customer" | "agent" | "manager" | "admin"
   onStatusChange  optional callback(status) — fires on every poll so the
                   parent can re-render (e.g. show "resolved" badge)
   onNewMessages   optional callback(newMessages, allMessages)
   readOnly        if true, hides the composer
   pollMs          override poll interval (default 4000)
   className       extra class on the wrapper
*/

const DEFAULT_POLL_MS = 4000;

export default function ChatPanel({
  code,
  currentUserId,
  currentUserRole = "customer",
  onStatusChange,
  onNewMessages,
  readOnly = false,
  pollMs = DEFAULT_POLL_MS,
  className = "",
}) {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const sinceRef = useRef(0);
  const scrollerRef = useRef(null);
  const isAtBottomRef = useRef(true);

  // Track whether the user is at the bottom of the thread before each render,
  // so we don't auto-scroll if they're scrolled up reading older messages.
  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distanceFromBottom < 80;
  };

  const fetchMessages = useCallback(async () => {
    if (!code) return;
    try {
      const r = await api.getMessages(code, sinceRef.current);
      setStatus(r.status);
      onStatusChange?.(r.status);
      if (r.messages?.length) {
        setMessages((prev) => {
          // Dedupe by id (the synthetic id 0 == ticket body, only present on
          // the first fetch so we don't need extra guards).
          const seen = new Set(prev.map((m) => m.id));
          const additions = r.messages.filter((m) => !seen.has(m.id));
          if (additions.length === 0) return prev;
          const next = [...prev, ...additions].sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at)
          );
          onNewMessages?.(additions, next);
          return next;
        });
        sinceRef.current = Math.max(
          sinceRef.current,
          ...r.messages.map((m) => m.id)
        );
      }
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setInitialLoaded(true);
    }
  }, [code, onStatusChange, onNewMessages]);

  // Reset state when the active ticket code changes
  useEffect(() => {
    sinceRef.current = 0;
    setMessages([]);
    setStatus(null);
    setInitialLoaded(false);
    setError(null);
  }, [code]);

  // Initial fetch + polling loop
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    let timer = null;

    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState === "hidden") {
        timer = setTimeout(tick, pollMs);
        return;
      }
      await fetchMessages();
      if (!cancelled) timer = setTimeout(tick, pollMs);
    };

    tick();

    const onVisibility = () => {
      // When the tab becomes visible again, immediately refresh.
      if (document.visibilityState === "visible") {
        if (timer) clearTimeout(timer);
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [code, fetchMessages, pollMs]);

  // Auto-scroll on new messages — only if the user was already near the bottom
  useEffect(() => {
    if (!isAtBottomRef.current) return;
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const m = await api.postMessage(code, text);
      // Optimistically prepend; the next poll will reconcile
      setMessages((prev) => {
        if (prev.find((x) => x.id === m.id)) return prev;
        return [...prev, m];
      });
      sinceRef.current = Math.max(sinceRef.current, m.id);
      setDraft("");
      isAtBottomRef.current = true;
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  function onComposerKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const grouped = useMemo(() => groupMessages(messages), [messages]);
  const isResolved =
    status?.status === "resolved" || status?.status === "auto-resolved";

  return (
    <div className={`chat-panel ${className}`}>
      <div
        className="chat-thread"
        ref={scrollerRef}
        onScroll={handleScroll}
      >
        {!initialLoaded && (
          <div className="chat-empty">
            <span className="spinner" />
            <span style={{ marginLeft: 8 }}>Loading conversation…</span>
          </div>
        )}
        {initialLoaded && messages.length === 0 && (
          <div className="chat-empty">No messages yet.</div>
        )}
        {grouped.map((group, gi) => (
          <div key={gi} className="chat-day">
            {group.label && (
              <div className="chat-day-label">{group.label}</div>
            )}
            {group.items.map((m) => {
              const mine = currentUserId && m.author_id_match === currentUserId;
              const isOwn = mine || isOwnByRole(m, currentUserRole);
              const sideClass = isOwn ? "right" : "left";
              return (
                <div
                  key={`${m.id}-${m.created_at}`}
                  className={`chat-msg chat-msg-${sideClass} ${
                    m.is_ai ? "chat-msg-ai" : ""
                  }`}
                >
                  {!isOwn && (
                    <div
                      className={`avatar ${m.is_ai ? "ai" : ""}`}
                      style={{ width: 28, height: 28, fontSize: 10 }}
                      title={m.sender_name}
                    >
                      {m.sender_initials}
                    </div>
                  )}
                  <div className="chat-msg-bubble-wrap">
                    {!isOwn && (
                      <div className="chat-msg-meta">
                        <span className="chat-msg-name">{m.sender_name}</span>
                        {m.is_ai && (
                          <span
                            className="pill pill-accent"
                            style={{ fontSize: 9.5, padding: "1px 6px" }}
                          >
                            AI
                          </span>
                        )}
                        <span className="chat-msg-time">
                          {formatTime(m.created_at)}
                        </span>
                      </div>
                    )}
                    <div className="chat-msg-bubble">
                      {m.body}
                    </div>
                    {isOwn && (
                      <div className="chat-msg-meta chat-msg-meta-own">
                        <span className="chat-msg-time">
                          {formatTime(m.created_at)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="chat-status-bar">
        <div className="chat-status-bar-inner">
          {status && (
            <>
              <span
                className={STATUS_CLASS[status.status] || "pill"}
                style={{ fontSize: 10.5 }}
              >
                {STATUS_LABEL[status.status] || status.status}
              </span>
              {status.assignee_name && (
                <span className="small muted">
                  Handled by <strong>{status.assignee_name}</strong>
                </span>
              )}
              {!status.assignee_name && currentUserRole === "customer" && (
                <span className="small muted">Waiting for an agent…</span>
              )}
            </>
          )}
          {error && (
            <span className="small" style={{ color: "var(--bad)" }}>
              {error}
            </span>
          )}
        </div>
      </div>

      {!readOnly && (
        <div className="chat-composer">
          <textarea
            className="chat-composer-input"
            placeholder={
              isResolved && currentUserRole === "customer"
                ? "This conversation is closed — sending will reopen it."
                : currentUserRole === "customer"
                ? "Type a message…   (Enter to send · Shift+Enter for newline)"
                : "Type your reply…   (Enter to send · Shift+Enter for newline)"
            }
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onComposerKeyDown}
            disabled={sending}
            rows={2}
          />
          <button
            type="button"
            className="btn btn-primary chat-composer-send"
            onClick={send}
            disabled={!draft.trim() || sending}
          >
            <Icon name="send" size={13} className="" />
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── helpers ────────────────────────────────────────────── */

function isOwnByRole(message, viewerRole) {
  // Fallback: match by role family. Used when we don't have a direct id match.
  if (viewerRole === "customer") return message.sender_role === "customer";
  if (
    viewerRole === "agent" ||
    viewerRole === "manager" ||
    viewerRole === "admin"
  ) {
    return ["agent", "manager", "admin"].includes(message.sender_role);
  }
  return false;
}

function groupMessages(messages) {
  // Group by day for a Day label (Today / Yesterday / Mon, Jan 5).
  const groups = [];
  let lastLabel = null;
  for (const m of messages) {
    const d = new Date(m.created_at);
    const label = friendlyDay(d);
    if (label !== lastLabel) {
      groups.push({ label, items: [] });
      lastLabel = label;
    }
    groups[groups.length - 1].items.push(m);
  }
  return groups;
}

function friendlyDay(date) {
  if (isNaN(date.getTime())) return null;
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
