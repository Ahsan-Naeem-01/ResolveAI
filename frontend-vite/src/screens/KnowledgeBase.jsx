import { useEffect, useMemo, useRef, useState } from "react";
import { Header } from "../components/AppShell.jsx";
import Icon from "../components/Icon.jsx";
import Markdown from "../components/Markdown.jsx";
import { Skeleton } from "../components/Skeleton.jsx";
import { api } from "../lib/api.js";

const STATUSES = [
  { id: "published", label: "Published" },
  { id: "draft", label: "Drafts" },
  { id: "archived", label: "Archived" },
];

const CATEGORIES = [
  "Refunds",
  "Delivery",
  "Payments",
  "Account / Security",
  "Promotions",
  "Product",
  "General",
];

export default function KnowledgeBase({ toast, onInsertIntoReply, ticketOpen }) {
  const [statusFilter, setStatusFilter] = useState("published");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [tagFilter, setTagFilter] = useState(null);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, 250);

  const [articles, setArticles] = useState(null); // null = loading
  const [meta, setMeta] = useState(null);

  const [activeSlug, setActiveSlug] = useState(null);
  const [activeArticle, setActiveArticle] = useState(null);
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [error, setError] = useState(null);

  const [editing, setEditing] = useState(false); // editor mode
  const [creating, setCreating] = useState(false); // new article mode
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const searchRef = useRef(null);

  // Categories sidebar — refresh whenever the catalog changes
  const [catRefreshKey, setCatRefreshKey] = useState(0);
  useEffect(() => {
    api.kbCategories().then(setMeta).catch(() => {});
  }, [catRefreshKey]);

  // List
  useEffect(() => {
    let cancelled = false;
    setArticles(null);
    const params = {
      status: statusFilter,
      category: categoryFilter === "All" ? null : categoryFilter,
      q: debouncedQuery || null,
      tag: tagFilter || null,
    };
    api
      .kbList(params)
      .then((rows) => {
        if (cancelled) return;
        setArticles(rows);
        // If the current active slug is no longer in the list, pick the first.
        if (rows.length === 0) {
          setActiveSlug(null);
        } else if (!rows.some((r) => r.slug === activeSlug)) {
          setActiveSlug(rows[0].slug);
        }
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, categoryFilter, debouncedQuery, tagFilter, catRefreshKey]);

  // Detail
  useEffect(() => {
    if (!activeSlug) {
      setActiveArticle(null);
      return;
    }
    let cancelled = false;
    setLoadingArticle(true);
    setEditing(false);
    setCreating(false);
    api
      .kbGet(activeSlug)
      .then((d) => {
        if (cancelled) return;
        setActiveArticle(d);
        setLoadingArticle(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message);
        setLoadingArticle(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSlug]);

  // Keyboard shortcuts: '/' focuses search, 'n' new article
  useEffect(() => {
    const handler = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      const isFormElement = ["input", "textarea", "select"].includes(tag);
      if (isFormElement) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        startCreate();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startCreate() {
    setCreating(true);
    setEditing(true);
    setActiveSlug(null);
    setActiveArticle(null);
    setDraft({
      title: "",
      summary: "",
      body: "",
      category: "General",
      intent: null,
      tags: [],
      status: "draft",
    });
  }

  function startEdit() {
    if (!activeArticle) return;
    setEditing(true);
    setCreating(false);
    setDraft({
      title: activeArticle.title,
      summary: activeArticle.summary || "",
      body: activeArticle.body || "",
      category: activeArticle.category || "General",
      intent: activeArticle.intent || null,
      tags: activeArticle.tags || [],
      status: activeArticle.status || "published",
    });
  }

  function cancelEdit() {
    setEditing(false);
    setCreating(false);
    setDraft(null);
    if (creating && articles && articles.length > 0 && !activeSlug) {
      setActiveSlug(articles[0].slug);
    }
  }

  async function saveDraft(nextStatus = null) {
    if (!draft) return;
    if (!draft.title.trim()) {
      toast?.("Title is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: draft.title.trim(),
        summary: (draft.summary || "").trim(),
        body: draft.body || "",
        category: draft.category || "General",
        intent: draft.intent || null,
        tags: draft.tags || [],
        status: nextStatus || draft.status || "draft",
      };
      let saved;
      if (creating) {
        saved = await api.kbCreate(payload);
      } else {
        saved = await api.kbUpdate(activeSlug, payload);
      }
      setActiveSlug(saved.slug);
      setActiveArticle(saved);
      setEditing(false);
      setCreating(false);
      setDraft(null);
      setCatRefreshKey((k) => k + 1);
      toast?.(creating ? "Article created" : "Article saved");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!activeArticle) return;
    if (!confirm(`Archive "${activeArticle.title}"? It won't appear in search until republished.`))
      return;
    try {
      await api.kbDelete(activeArticle.slug);
      setCatRefreshKey((k) => k + 1);
      toast?.("Article archived");
    } catch (e) {
      setError(e.message);
    }
  }

  async function feedback(helpful) {
    if (!activeArticle) return;
    try {
      const r = await api.kbFeedback(activeArticle.slug, helpful);
      setActiveArticle({
        ...activeArticle,
        helpful: r.helpful,
        not_helpful: r.not_helpful,
      });
      toast?.("Thanks for the feedback");
    } catch (e) {
      setError(e.message);
    }
  }

  async function insertIntoReply() {
    if (!activeArticle) return;
    if (!onInsertIntoReply) {
      toast?.("Open a ticket first to insert into a reply");
      return;
    }
    try {
      await api.kbMarkInserted(activeArticle.slug);
      onInsertIntoReply(activeArticle.body || "");
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      <Header
        crumb="Library"
        title={`Knowledge base${meta ? ` · ${meta.total} published` : ""}`}
        hasSearch={false}
        actions={
          <button className="btn btn-primary btn-sm" onClick={startCreate}>
            <Icon name="plus" size={12} className="" /> New article
          </button>
        }
      />
      <div
        className="content kb-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "200px 360px 1fr",
          gap: 16,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <CategoryRail
          meta={meta}
          status={statusFilter}
          onStatus={setStatusFilter}
          category={categoryFilter}
          onCategory={setCategoryFilter}
          tag={tagFilter}
          onTag={setTagFilter}
        />

        <ArticleListPane
          articles={articles}
          activeSlug={activeSlug}
          onSelect={(slug) => {
            setActiveSlug(slug);
            setEditing(false);
            setCreating(false);
          }}
          query={query}
          setQuery={setQuery}
          searchRef={searchRef}
          status={statusFilter}
        />

        <div
          style={{
            minHeight: 0,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {error && <div className="error-banner">{error}</div>}

          {editing && draft ? (
            <ArticleEditor
              draft={draft}
              setDraft={setDraft}
              creating={creating}
              saving={saving}
              onCancel={cancelEdit}
              onSaveDraft={() => saveDraft("draft")}
              onPublish={() => saveDraft("published")}
            />
          ) : loadingArticle ? (
            <div className="card" style={{ padding: 24 }}>
              <Skeleton width={220} height={20} style={{ marginBottom: 12 }} />
              <Skeleton width="80%" height={12} style={{ marginBottom: 8 }} />
              <Skeleton width="92%" height={12} style={{ marginBottom: 8 }} />
              <Skeleton width="70%" height={12} />
            </div>
          ) : activeArticle ? (
            <ArticleViewer
              article={activeArticle}
              ticketOpen={ticketOpen}
              onEdit={startEdit}
              onArchive={archive}
              onFeedback={feedback}
              onInsertIntoReply={insertIntoReply}
            />
          ) : (
            <EmptyState onCreate={startCreate} />
          )}
        </div>
      </div>
    </>
  );
}

/* ── Left rail: status + categories + tags ───────────────────── */

function CategoryRail({
  meta,
  status,
  onStatus,
  category,
  onCategory,
  tag,
  onTag,
}) {
  return (
    <aside className="kb-rail">
      <div className="kb-rail-section">
        <div className="kb-rail-label">Status</div>
        {STATUSES.map((s) => (
          <button
            key={s.id}
            className={`kb-rail-item ${status === s.id ? "on" : ""}`}
            onClick={() => onStatus(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="kb-rail-section">
        <div className="kb-rail-label">Categories</div>
        <button
          className={`kb-rail-item ${category === "All" ? "on" : ""}`}
          onClick={() => onCategory("All")}
        >
          <span>All</span>
          {meta && <span className="kb-rail-count">{meta.total}</span>}
        </button>
        {(meta?.categories || CATEGORIES.map((c) => ({ name: c, count: 0 }))).map(
          (c) => (
            <button
              key={c.name}
              className={`kb-rail-item ${category === c.name ? "on" : ""}`}
              onClick={() => onCategory(c.name)}
            >
              <span>{c.name}</span>
              <span className="kb-rail-count">{c.count}</span>
            </button>
          )
        )}
      </div>

      {meta?.tags && meta.tags.length > 0 && (
        <div className="kb-rail-section">
          <div className="kb-rail-label">Tags</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button
              className={`kb-tag ${!tag ? "on" : ""}`}
              onClick={() => onTag(null)}
            >
              all
            </button>
            {meta.tags.slice(0, 12).map((t) => (
              <button
                key={t.name}
                className={`kb-tag ${tag === t.name ? "on" : ""}`}
                onClick={() => onTag(tag === t.name ? null : t.name)}
                title={`${t.count} article(s)`}
              >
                #{t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        className="kb-rail-section small muted"
        style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}
      >
        <div style={{ marginBottom: 4 }}>
          Tip: <kbd className="kb-kbd">/</kbd> to search,{" "}
          <kbd className="kb-kbd">n</kbd> for new
        </div>
      </div>
    </aside>
  );
}

/* ── Middle: search + article list ──────────────────────────── */

function ArticleListPane({
  articles,
  activeSlug,
  onSelect,
  query,
  setQuery,
  searchRef,
  status,
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
        border: "1px solid var(--line)",
        borderRadius: "var(--rad-lg)",
        background: "var(--bg-raised)",
      }}
    >
      <div style={{ padding: 12, borderBottom: "1px solid var(--line)" }}>
        <div className="kb-search">
          <Icon name="search" size={13} className="" />
          <input
            ref={searchRef}
            placeholder="Search articles…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="kb-search-clear"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>
      <div style={{ overflow: "auto", flex: 1 }}>
        {articles === null ? (
          <div style={{ padding: 16 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ padding: "10px 0" }}>
                <Skeleton width="70%" height={12} style={{ marginBottom: 6 }} />
                <Skeleton width="90%" height={10} />
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              color: "var(--ink-3)",
              fontSize: 13,
            }}
          >
            No {status} articles{query ? ` matching "${query}"` : ""}.
          </div>
        ) : (
          articles.map((a) => (
            <button
              key={a.slug}
              type="button"
              onClick={() => onSelect(a.slug)}
              className={`kb-list-item ${activeSlug === a.slug ? "active" : ""}`}
            >
              <div className="kb-list-title">{a.title}</div>
              {a.summary && (
                <div className="kb-list-summary">{a.summary}</div>
              )}
              <div className="kb-list-meta">
                <span className="pill" style={{ fontSize: 10 }}>
                  {a.category}
                </span>
                <span className="muted small">· {a.views} views</span>
                {a.status === "draft" && (
                  <span
                    className="pill"
                    style={{
                      fontSize: 10,
                      marginLeft: "auto",
                      background: "var(--warn-soft, var(--bg-sunk))",
                      color: "var(--warn-ink, var(--ink-2))",
                    }}
                  >
                    Draft
                  </span>
                )}
                {a.status === "archived" && (
                  <span
                    className="pill"
                    style={{
                      fontSize: 10,
                      marginLeft: "auto",
                      background: "var(--bg-sunk)",
                      color: "var(--ink-3)",
                    }}
                  >
                    Archived
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Right: viewer ─────────────────────────────────────────── */

function ArticleViewer({
  article,
  ticketOpen,
  onEdit,
  onArchive,
  onFeedback,
  onInsertIntoReply,
}) {
  const totalFeedback = (article.helpful || 0) + (article.not_helpful || 0);
  const helpfulPct =
    totalFeedback > 0
      ? Math.round((article.helpful / totalFeedback) * 100)
      : null;

  return (
    <div className="card kb-viewer">
      <div className="kb-viewer-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="kb-viewer-title">{article.title}</div>
          <div className="kb-viewer-meta">
            <span className="pill">{article.category}</span>
            {article.intent && (
              <span className="pill pill-accent">Intent: {article.intent}</span>
            )}
            <span className="muted small">·</span>
            <span className="muted small">
              Updated {formatDate(article.updated_at)}
            </span>
            {article.author && (
              <span className="muted small">· by {article.author}</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={onInsertIntoReply}
            disabled={!ticketOpen}
            title={
              ticketOpen
                ? "Insert this article into the open ticket reply"
                : "Open a ticket first"
            }
          >
            <Icon name="lightning" size={12} className="" /> Insert into reply
          </button>
          <button className="btn btn-sm" onClick={onEdit}>
            <Icon name="edit" size={12} className="" /> Edit
          </button>
        </div>
      </div>

      <div className="kb-viewer-body">
        <Markdown source={article.body} />
      </div>

      {article.tags && article.tags.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            padding: "0 22px 16px",
          }}
        >
          {article.tags.map((t) => (
            <span key={t} className="kb-tag" style={{ pointerEvents: "none" }}>
              #{t}
            </span>
          ))}
        </div>
      )}

      <div className="kb-viewer-foot">
        <div className="kb-stats">
          <Stat label="Views" value={article.views} />
          <Stat label="Inserted" value={article.inserted_in_replies} />
          <Stat
            label="Helpful"
            value={
              helpfulPct == null
                ? "—"
                : `${helpfulPct}% (${article.helpful + article.not_helpful})`
            }
          />
        </div>

        <div className="kb-feedback">
          <span className="muted small">Was this helpful?</span>
          <button className="btn btn-sm" onClick={() => onFeedback(true)}>
            <Icon name="check" size={12} className="" /> Yes
          </button>
          <button className="btn btn-sm" onClick={() => onFeedback(false)}>
            No
          </button>
          <button
            className="btn btn-sm"
            style={{ marginLeft: 8 }}
            onClick={onArchive}
          >
            Archive
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="kb-stat">
      <div className="kb-stat-label">{label}</div>
      <div className="kb-stat-value">{value}</div>
    </div>
  );
}

/* ── Editor ────────────────────────────────────────────────── */

const INTENTS = [
  null,
  "Refund Request",
  "Delivery Issue",
  "Payment Failure",
  "Account / Security",
  "Promotion / Pricing",
  "Product Complaint",
];

function ArticleEditor({
  draft,
  setDraft,
  creating,
  saving,
  onCancel,
  onSaveDraft,
  onPublish,
}) {
  const [tagInput, setTagInput] = useState("");
  const [previewing, setPreviewing] = useState(false);

  function update(patch) {
    setDraft({ ...draft, ...patch });
  }

  function addTag() {
    const t = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (!t) return;
    if (draft.tags.includes(t)) {
      setTagInput("");
      return;
    }
    update({ tags: [...draft.tags, t] });
    setTagInput("");
  }

  function removeTag(t) {
    update({ tags: draft.tags.filter((x) => x !== t) });
  }

  return (
    <div className="card kb-editor">
      <div className="kb-viewer-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            className="kb-editor-title"
            placeholder="Article title…"
            value={draft.title}
            onChange={(e) => update({ title: e.target.value })}
          />
          <div className="kb-viewer-meta" style={{ marginTop: 6 }}>
            <select
              className="kb-select"
              value={draft.category}
              onChange={(e) => update({ category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className="kb-select"
              value={draft.intent || ""}
              onChange={(e) =>
                update({ intent: e.target.value === "" ? null : e.target.value })
              }
            >
              <option value="">No intent</option>
              {INTENTS.filter(Boolean).map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
            <span className="pill" style={{ fontSize: 10 }}>
              {creating ? "New" : "Editing"} ·{" "}
              {draft.status === "published" ? "Published" : draft.status === "archived" ? "Archived" : "Draft"}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            className="btn btn-sm"
            onClick={() => setPreviewing((p) => !p)}
          >
            <Icon name={previewing ? "edit" : "eye"} size={12} className="" />
            {previewing ? "Edit" : "Preview"}
          </button>
          <button className="btn btn-sm" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            className="btn btn-sm"
            onClick={onSaveDraft}
            disabled={saving}
          >
            Save draft
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={onPublish}
            disabled={saving}
          >
            <Icon name="check" size={12} className="" />
            {saving ? "Saving…" : "Publish"}
          </button>
        </div>
      </div>

      <div className="kb-editor-body">
        <label className="kb-editor-label">Summary (one-line preview)</label>
        <input
          className="kb-editor-input"
          placeholder="A short description shown in the article list…"
          value={draft.summary}
          onChange={(e) => update({ summary: e.target.value })}
        />

        <label className="kb-editor-label" style={{ marginTop: 14 }}>
          Body — markdown supported (## heading, **bold**, lists, &gt; quote, `code`)
        </label>

        {previewing ? (
          <div
            className="kb-editor-preview"
            style={{ padding: 16, minHeight: 320 }}
          >
            <Markdown source={draft.body} />
          </div>
        ) : (
          <textarea
            className="kb-editor-textarea"
            placeholder={"## Step 1\nDescribe the first step…\n\n- Bullet point\n- Another\n"}
            value={draft.body}
            onChange={(e) => update({ body: e.target.value })}
          />
        )}

        <label className="kb-editor-label" style={{ marginTop: 14 }}>
          Tags
        </label>
        <div className="kb-tag-input">
          {draft.tags.map((t) => (
            <span key={t} className="kb-tag on">
              #{t}
              <button
                onClick={() => removeTag(t)}
                aria-label={`Remove ${t}`}
                className="kb-tag-x"
              >
                ×
              </button>
            </span>
          ))}
          <input
            placeholder="Type and press Enter…"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag();
              } else if (e.key === "Backspace" && !tagInput && draft.tags.length) {
                removeTag(draft.tags[draft.tags.length - 1]);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Empty state ──────────────────────────────────────────── */

function EmptyState({ onCreate }) {
  return (
    <div
      className="card"
      style={{
        padding: 40,
        textAlign: "center",
        color: "var(--ink-3)",
      }}
    >
      <div style={{ fontSize: 14, color: "var(--ink-2)", marginBottom: 6 }}>
        No article selected
      </div>
      <div className="small" style={{ marginBottom: 14 }}>
        Pick an article from the list, or create a new one.
      </div>
      <button className="btn btn-primary btn-sm" onClick={onCreate}>
        <Icon name="plus" size={12} className="" /> New article
      </button>
    </div>
  );
}

/* ── helpers ──────────────────────────────────────────────── */

function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function formatDate(d) {
  if (!d) return "—";
  try {
    const dt = typeof d === "string" ? new Date(d) : d;
    const now = new Date();
    const diff = (now - dt) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
    return dt.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}
