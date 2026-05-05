/* Thin fetch wrapper — Vite dev server proxies /api → http://localhost:8000 */

const BASE = "";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = j.detail || JSON.stringify(j);
    } catch {}
    throw new Error(`${res.status} — ${detail}`);
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

  managerDashboard: () => request("/api/analytics/manager"),
  adminDashboard: () => request("/api/analytics/admin"),
  listAgents: () => request("/api/agents"),
  faqs: (intent) =>
    request(`/api/faq${intent ? `?intent=${encodeURIComponent(intent)}` : ""}`),
};
