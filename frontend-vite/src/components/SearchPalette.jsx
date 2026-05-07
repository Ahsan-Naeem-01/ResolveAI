import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { api } from "../lib/api.js";

/* Global ⌘K palette — searches tickets, customers, KB articles, and agents.
   Results dispatch a `resolveai:navigate` CustomEvent on window so any screen
   can opt-in to handle selection. */

const DEBOUNCE_MS = 180;

export default function SearchPalette({ open, onClose }) {
  const [q, setQ] = useState("");
  const [tickets, setTickets] = useState([]);
  const [articles, setArticles] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const allAgentsRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setActive(0);
    setTickets([]);
    setArticles([]);
    setAgents([]);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Fetch (debounced)
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (!term) {
      setTickets([]);
      setArticles([]);
      setAgents([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        if (!allAgentsRef.current) {
          allAgentsRef.current = await api.listAgents().catch(() => []);
        }
        const [tk, kb] = await Promise.all([
          api.listTickets({ q: term, limit: 6 }).catch(() => []),
          api.kbList({ q: term, limit: 6, status: "published" }).catch(() => []),
        ]);
        if (cancelled) return;
        setTickets(tk || []);
        setArticles(kb || []);
        const lower = term.toLowerCase();
        setAgents(
          (allAgentsRef.current || [])
            .filter(
              (a) =>
                a.name?.toLowerCase().includes(lower) ||
                a.email?.toLowerCase().includes(lower)
            )
            .slice(0, 5)
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open]);

  // Derive a unique customer list from ticket hits.
  const customers = useMemo(() => {
    const seen = new Map();
    for (const t of tickets) {
      if (!t.customer || t.customer === "—") continue;
      if (!seen.has(t.customer))
        seen.set(t.customer, { name: t.customer, initials: t.initials, ticket: t.id });
    }
    return Array.from(seen.values()).slice(0, 4);
  }, [tickets]);

  // Flatten results so arrow-keys can move across groups.
  const flat = useMemo(() => {
    const list = [];
    tickets.forEach((t) => list.push({ kind: "ticket", item: t }));
    customers.forEach((c) => list.push({ kind: "customer", item: c }));
    articles.forEach((a) => list.push({ kind: "kb", item: a }));
    agents.forEach((a) => list.push({ kind: "agent", item: a }));
    return list;
  }, [tickets, customers, articles, agents]);

  useEffect(() => {
    setActive(0);
  }, [flat.length]);

  const select = (entry) => {
    if (!entry) return;
    window.dispatchEvent(
      new CustomEvent("resolveai:navigate", { detail: entry })
    );
    onClose();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(flat[active]);
    }
  };

  if (!open) return null;

  let cursor = 0;
  const renderRow = (entry, label) => {
    const idx = cursor++;
    const isActive = idx === active;
    return (
      <button
        key={`${entry.kind}-${idx}`}
        type="button"
        className={`sp-row ${isActive ? "sp-row-active" : ""}`}
        onMouseEnter={() => setActive(idx)}
        onClick={() => select(entry)}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="sp-backdrop" onMouseDown={onClose}>
      <div
        className="sp-panel"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Global search"
      >
        <div className="sp-input-row">
          <Icon name="search" size={14} className="" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search tickets, customers, KB articles, agents…"
            className="sp-input"
            aria-label="Search"
          />
          <kbd className="sp-kbd">Esc</kbd>
        </div>

        <div className="sp-results">
          {!q.trim() && (
            <div className="sp-empty">
              Type to search across tickets, customers, KB, and agents.
            </div>
          )}
          {q.trim() && !loading && flat.length === 0 && (
            <div className="sp-empty">No results for “{q}”.</div>
          )}

          {tickets.length > 0 && (
            <div className="sp-group">
              <div className="sp-group-label">Tickets</div>
              {tickets.map((t) =>
                renderRow(
                  { kind: "ticket", item: t },
                  <>
                    <span className="sp-mono">{t.id}</span>
                    <span className="sp-title">{t.subject}</span>
                    <span className="sp-meta">
                      {t.customer} · {t.status}
                    </span>
                  </>
                )
              )}
            </div>
          )}

          {customers.length > 0 && (
            <div className="sp-group">
              <div className="sp-group-label">Customers</div>
              {customers.map((c) =>
                renderRow(
                  { kind: "customer", item: c },
                  <>
                    <span className="sp-avatar">{c.initials || "?"}</span>
                    <span className="sp-title">{c.name}</span>
                    <span className="sp-meta">via {c.ticket}</span>
                  </>
                )
              )}
            </div>
          )}

          {articles.length > 0 && (
            <div className="sp-group">
              <div className="sp-group-label">Knowledge base</div>
              {articles.map((a) =>
                renderRow(
                  { kind: "kb", item: a },
                  <>
                    <Icon name="book" size={13} className="" />
                    <span className="sp-title">{a.title}</span>
                    <span className="sp-meta">{a.category}</span>
                  </>
                )
              )}
            </div>
          )}

          {agents.length > 0 && (
            <div className="sp-group">
              <div className="sp-group-label">Agents</div>
              {agents.map((a) =>
                renderRow(
                  { kind: "agent", item: a },
                  <>
                    <span className="sp-avatar">{a.initials || "?"}</span>
                    <span className="sp-title">{a.name}</span>
                    <span className="sp-meta">{a.email}</span>
                  </>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
