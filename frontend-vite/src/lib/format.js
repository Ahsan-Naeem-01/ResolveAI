export const URGENCY_CLASS = {
  Low: "pill",
  Medium: "pill pill-accent",
  High: "pill pill-warn",
  Critical: "pill pill-bad",
};

export const STATUS_CLASS = {
  "ai-suggested": "pill pill-violet",
  "needs-review": "pill pill-warn",
  "auto-resolved": "pill pill-good",
  resolved: "pill pill-good",
  escalated: "pill pill-bad",
};

export const STATUS_LABEL = {
  "ai-suggested": "AI suggested",
  "needs-review": "Needs review",
  "auto-resolved": "Auto-resolved",
  resolved: "Resolved",
  escalated: "Escalated",
};

export function pct(n, decimals = 0) {
  if (n == null || isNaN(n)) return "—";
  return `${(n * 100).toFixed(decimals)}%`;
}

export function highlightJSON(data) {
  const lines = JSON.stringify(data, null, 2);
  return lines
    .replace(/("[^"]+")(\s*:)/g, '<span class="k">$1</span>$2')
    .replace(/:\s*("[^"]*")/g, ': <span class="s">$1</span>')
    .replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="n">$1</span>')
    .replace(/:\s*(true|false|null)/g, ': <span class="b">$1</span>');
}
