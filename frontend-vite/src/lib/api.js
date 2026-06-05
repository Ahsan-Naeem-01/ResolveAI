/* Thin fetch wrapper — Vite dev server proxies /api → http://localhost:8000.
   Attaches the Supabase bearer token to every request.

   In production (Vercel) the frontend is served from a different origin than
   the backend, so we point at the deployed Render URL via VITE_API_BASE_URL.
   Leave it blank locally — the Vite dev proxy handles routing to :8000. */

import { getAccessToken } from "./auth.jsx";

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL || "").trim();
// Strip any trailing slash so we don't end up with `https://api.example.com//api/health`.
const BASE = RAW_BASE.endsWith("/") ? RAW_BASE.slice(0, -1) : RAW_BASE;

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = await getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = j.detail || JSON.stringify(j);
    } catch {}
    const err = new Error(`${res.status} — ${detail}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  health: () => request("/api/health"),

  llmStatus: () => request("/api/llm/status"),

  processQuery: (payload) =>
    request("/api/tickets/process", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listTickets: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== "")
    ).toString();
    return request(`/api/tickets${qs ? `?${qs}` : ""}`);
  },

  getTicket: (code) => request(`/api/tickets/${code}`),

  updateReply: (code, body, edited = true) =>
    request(`/api/tickets/${code}/reply`, {
      method: "PATCH",
      body: JSON.stringify({ body, edited_by_agent: edited }),
    }),

  regenerate: (code, tone = null) =>
    request(`/api/tickets/${code}/regenerate`, {
      method: "POST",
      body: JSON.stringify({ tone }),
    }),

  sendReply: (code, body = null) =>
    request(`/api/tickets/${code}/send`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),

  assignTicket: (code, { assigneeId = null, toMe = false } = {}) =>
    request(`/api/tickets/${code}/assign`, {
      method: "POST",
      body: JSON.stringify({ assignee_id: assigneeId, to_me: toMe }),
    }),

  routeTicket: (code, payload) =>
    request(`/api/tickets/${code}/route`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listDepartments: () => request("/api/tickets/_meta/departments"),

  // ── Chat / live messages ─────────────────────────────────────
  getMessages: (code, since = 0) =>
    request(`/api/tickets/${code}/messages?since=${since}`),

  postMessage: (code, body) =>
    request(`/api/tickets/${code}/messages`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),

  myTickets: () => request("/api/tickets/customer/me"),

  managerDashboard: () => request("/api/analytics/manager"),
  shiftsCoverage: () => request("/api/analytics/shifts"),
  adminDashboard: () => request("/api/analytics/admin"),
  listAgents: () => request("/api/agents"),
  me: () => request("/api/agents/me"),
  faqs: (intent) =>
    request(`/api/faq${intent ? `?intent=${encodeURIComponent(intent)}` : ""}`),

  // ── Knowledge base ──────────────────────────────────────────
  kbList: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== "")
    ).toString();
    return request(`/api/kb${qs ? `?${qs}` : ""}`);
  },
  kbCategories: () => request("/api/kb/categories"),
  kbGet: (slug) => request(`/api/kb/${encodeURIComponent(slug)}`),
  kbCreate: (payload) =>
    request("/api/kb", { method: "POST", body: JSON.stringify(payload) }),
  kbUpdate: (slug, payload) =>
    request(`/api/kb/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  kbDelete: (slug) =>
    request(`/api/kb/${encodeURIComponent(slug)}`, { method: "DELETE" }),
  kbFeedback: (slug, helpful) =>
    request(`/api/kb/${encodeURIComponent(slug)}/feedback`, {
      method: "POST",
      body: JSON.stringify({ helpful }),
    }),
  kbMarkInserted: (slug) =>
    request(`/api/kb/${encodeURIComponent(slug)}/insert`, { method: "POST" }),
  kbSuggestForTicket: (ticketCode, k = 3) =>
    request(`/api/kb/suggest?ticket=${encodeURIComponent(ticketCode)}&k=${k}`),
};
