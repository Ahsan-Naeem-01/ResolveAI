import { useEffect, useMemo, useState } from "react";
import Icon from "./Icon.jsx";
import { api } from "../lib/api.js";

/* FAQCenter — public-facing help-center for customers.

   Design goals:
   - Quick search across question + answer text
   - Category filter chips (intents) so users can browse by topic
   - Accordion Q&A that expands smoothly
   - Empty state with a "Still need help? Submit a request" CTA
   - Local "was this helpful" feedback (persisted in localStorage so the
     thumb sticks across reloads — no backend round-trip needed for a tiny
     dataset)

   Props
   ─────
   onSubmitRequest(text?) — caller hook for the "Talk to a human" CTA, with
                            optional pre-filled message. Customer screen
                            uses this to switch tabs and seed the textarea.
*/

const CATEGORY_ICONS = {
  "Refund Request": "dollar",
  "Delivery Issue": "truck",
  "Payment Failure": "dollar",
  "Account / Security": "shield",
  "Promotion / Pricing": "tag",
  "Product Complaint": "box",
  Other: "chat",
};

const FEEDBACK_STORAGE_KEY = "resolveai.faq.feedback";

function loadFeedback() {
  try {
    return JSON.parse(localStorage.getItem(FEEDBACK_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveFeedback(map) {
  try {
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

export default function FAQCenter({ onSubmitRequest }) {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("All");
  const [openIds, setOpenIds] = useState(() => new Set());
  const [feedback, setFeedback] = useState(loadFeedback);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .faqs()
      .then((rows) => {
        if (!cancelled) setFaqs(rows || []);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const counts = new Map();
    for (const f of faqs) {
      counts.set(f.intent, (counts.get(f.intent) || 0) + 1);
    }
    return [["All", faqs.length], ...counts.entries()];
  }, [faqs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return faqs.filter((f) => {
      if (activeCat !== "All" && f.intent !== activeCat) return false;
      if (!q) return true;
      return (
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q) ||
        (f.intent || "").toLowerCase().includes(q)
      );
    });
  }, [faqs, search, activeCat]);

  // Group filtered results by category for the accordion sections.
  const grouped = useMemo(() => {
    const map = new Map();
    for (const f of filtered) {
      const key = f.intent || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(f);
    }
    return Array.from(map.entries());
  }, [filtered]);

  function toggleOpen(id) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setOpenIds(new Set(filtered.map((f) => f.id)));
  }

  function collapseAll() {
    setOpenIds(new Set());
  }

  function recordFeedback(id, vote) {
    setFeedback((prev) => {
      const next = { ...prev, [id]: prev[id] === vote ? null : vote };
      saveFeedback(next);
      return next;
    });
  }

  // Highlight matched text in question/answer
  function highlight(text) {
    const q = search.trim();
    if (!q) return text;
    try {
      const re = new RegExp(`(${escapeRegex(q)})`, "ig");
      const parts = text.split(re);
      return parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="faq-mark">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        )
      );
    } catch {
      return text;
    }
  }

  return (
    <div className="faq-center">
      <div className="faq-hero">
        <h1 className="portal-h1" style={{ marginBottom: 6 }}>
          Help center
        </h1>
        <p className="portal-sub" style={{ marginBottom: 14 }}>
          Browse answers to common questions. Can't find what you need?{" "}
          <button
            type="button"
            className="link"
            onClick={() => onSubmitRequest?.()}
          >
            Submit a request
          </button>
          .
        </p>
        <div className="faq-search">
          <Icon name="search" size={14} className="" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by keyword — refund, address, password…"
            aria-label="Search FAQs"
          />
          {search && (
            <button
              type="button"
              className="faq-search-clear"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="faq-toolbar">
        <div className="faq-cats">
          {categories.map(([cat, n]) => (
            <button
              key={cat}
              type="button"
              className={`faq-cat ${activeCat === cat ? "on" : ""}`}
              onClick={() => setActiveCat(cat)}
            >
              {cat !== "All" && (
                <Icon name={CATEGORY_ICONS[cat] || "chat"} size={12} className="" />
              )}
              <span>{cat}</span>
              <span className="faq-cat-count">{n}</span>
            </button>
          ))}
        </div>

        <div className="faq-toolbar-right">
          {filtered.length > 0 && (
            <>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={openIds.size === filtered.length ? collapseAll : expandAll}
              >
                <Icon
                  name={openIds.size === filtered.length ? "arrowUp" : "arrowDown"}
                  size={11}
                  className=""
                />
                {openIds.size === filtered.length ? "Collapse all" : "Expand all"}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading && <FAQSkeleton />}

      {!loading && filtered.length === 0 && (
        <div className="faq-empty">
          <div className="faq-empty-icon">
            <Icon name="search" size={20} className="" />
          </div>
          <div className="faq-empty-title">No matches found</div>
          <div className="faq-empty-sub">
            We couldn't find an FAQ matching{" "}
            <strong>"{search || activeCat}"</strong>. Try a different search or
            submit a request and an agent will get back to you.
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onSubmitRequest?.(search.trim() || undefined)}
          >
            <Icon name="sparkles" size={12} className="" />
            Submit a request
          </button>
        </div>
      )}

      {!loading && grouped.length > 0 && (
        <div className="faq-groups">
          {grouped.map(([category, items]) => (
            <section key={category} className="faq-group">
              <div className="faq-group-head">
                <Icon
                  name={CATEGORY_ICONS[category] || "chat"}
                  size={14}
                  className=""
                />
                <h2 className="faq-group-title">{category}</h2>
                <span className="faq-group-count">{items.length}</span>
              </div>
              <div className="faq-list">
                {items.map((f) => {
                  const isOpen = openIds.has(f.id);
                  const vote = feedback[f.id];
                  return (
                    <article
                      key={f.id}
                      className={`faq-item ${isOpen ? "open" : ""}`}
                    >
                      <button
                        type="button"
                        className="faq-q"
                        aria-expanded={isOpen}
                        onClick={() => toggleOpen(f.id)}
                      >
                        <span className="faq-q-text">
                          {highlight(f.question)}
                        </span>
                        <span className="faq-q-chevron" aria-hidden>
                          <Icon
                            name={isOpen ? "arrowUp" : "arrowDown"}
                            size={12}
                            className=""
                          />
                        </span>
                      </button>
                      {isOpen && (
                        <div className="faq-a">
                          <div className="faq-a-body">
                            {highlight(f.answer)}
                          </div>
                          <div className="faq-a-foot">
                            <span className="small muted">
                              Was this helpful?
                            </span>
                            <button
                              type="button"
                              className={`faq-vote ${vote === "up" ? "on" : ""}`}
                              onClick={() => recordFeedback(f.id, "up")}
                              aria-label="Yes, helpful"
                            >
                              <Icon name="thumbsUp" size={12} className="" />
                              Yes
                            </button>
                            <button
                              type="button"
                              className={`faq-vote ${vote === "down" ? "on" : ""}`}
                              onClick={() => recordFeedback(f.id, "down")}
                              aria-label="No, not helpful"
                            >
                              <Icon name="thumbsDown" size={12} className="" />
                              No
                            </button>
                            {vote === "down" && (
                              <button
                                type="button"
                                className="btn btn-sm btn-primary faq-still-need"
                                onClick={() =>
                                  onSubmitRequest?.(
                                    `I need more help with: ${f.question}`
                                  )
                                }
                              >
                                <Icon name="users" size={11} className="" />
                                Talk to a human
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="faq-cta">
          <div className="faq-cta-text">
            <div className="faq-cta-title">Still need help?</div>
            <div className="small muted">
              Our team typically responds within a few minutes.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onSubmitRequest?.()}
          >
            <Icon name="sparkles" size={12} className="" />
            Submit a request
          </button>
        </div>
      )}
    </div>
  );
}

function FAQSkeleton() {
  return (
    <div className="faq-groups">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="faq-group">
          <div className="faq-group-head">
            <div className="skel" style={{ width: 110, height: 14 }} />
          </div>
          <div className="faq-list">
            {Array.from({ length: 2 }).map((__, j) => (
              <div key={j} className="faq-item">
                <div style={{ padding: "14px 16px" }}>
                  <div
                    className="skel"
                    style={{ width: "70%", height: 13, marginBottom: 8 }}
                  />
                  <div className="skel" style={{ width: "40%", height: 11 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
