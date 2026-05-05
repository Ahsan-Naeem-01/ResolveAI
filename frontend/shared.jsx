/* Shared UI primitives + icons + mock data for ResolveAI */

const Icon = ({ name, size = 14, className = "nav-icon" }) => {
  const paths = {
    inbox: "M3 13l3-8h12l3 8M3 13v6a2 2 0 002 2h14a2 2 0 002-2v-6M3 13h5l1 2h6l1-2h5",
    chat: "M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.5 8.5 0 018 8v.5z",
    chart: "M3 3v18h18M7 14l4-4 4 4 5-5",
    sparkles: "M12 3l1.5 4L18 8.5l-4.5 1.5L12 14l-1.5-4L6 8.5 10.5 7 12 3zM19 14l.7 1.8L21.5 16.5l-1.8.7L19 19l-.7-1.8L16.5 16.5l1.8-.7L19 14z",
    users: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
    settings: "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51h0a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
    bell: "M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",
    search: "M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z",
    filter: "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
    flag: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22V15",
    tag: "M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01",
    box: "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12",
    dollar: "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
    clock: "M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2",
    truck: "M1 3h15v13H1zM16 8h4l3 3v5h-7M5.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM18.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    cpu: "M4 4h16v16H4zM9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3",
    plus: "M12 5v14M5 12h14",
    upload: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
    arrowRight: "M5 12h14M12 5l7 7-7 7",
    arrowDown: "M12 5v14M19 12l-7 7-7-7",
    arrowUp: "M12 19V5M5 12l7-7 7 7",
    check: "M20 6L9 17l-5-5",
    x: "M18 6L6 18M6 6l12 12",
    edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
    send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
    refresh: "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
    paperclip: "M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48",
    moreH: "M5 12h.01M12 12h.01M19 12h.01",
    trend: "M23 6l-9.5 9.5-5-5L1 18M17 6h6v6",
    lightning: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
    layers: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
    git: "M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9",
    compass: "M12 22a10 10 0 100-20 10 10 0 000 20zM16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z",
    book: "M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z",
  };
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={paths[name] || paths.box} />
    </svg>
  );
};

/* ── Browser chrome wrapper ──────────────────────────── */
const Chrome = ({ url, children }) => (
  <div className="surface">
    <div className="chrome">
      <div className="chrome-dots"><span /><span /><span /></div>
      <div className="chrome-url">{url}</div>
      <div style={{ width: 38 }} />
    </div>
    {children}
  </div>
);

/* ── Sidebar ─────────────────────────────────────────── */
const Sidebar = ({ role, items, activeId, onNav, user }) => (
  <aside className="sidebar">
    <div className="brand">
      <div className="brand-mark">R</div>
      <div>
        <div className="brand-name">ResolveAI</div>
        <div className="small muted" style={{ fontSize: 10.5, marginTop: -2 }}>{role}</div>
      </div>
    </div>
    {items.map((sect, i) => (
      <React.Fragment key={i}>
        {sect.label && <div className="nav-section">{sect.label}</div>}
        {sect.items.map(it => (
          <div
            key={it.id}
            className={`nav-item ${activeId === it.id ? "active" : ""}`}
            onClick={() => onNav && onNav(it.id)}
          >
            <Icon name={it.icon} />
            <span>{it.name}</span>
            {it.badge != null && <span className="nav-badge">{it.badge}</span>}
          </div>
        ))}
      </React.Fragment>
    ))}
    <div className="sidebar-footer">
      <div className="avatar">{user.initials}</div>
      <div style={{ minWidth: 0 }}>
        <div className="avatar-name">{user.name}</div>
        <div className="avatar-role">{user.role}</div>
      </div>
    </div>
  </aside>
);

/* ── Topbar ──────────────────────────────────────────── */
const Topbar = ({ crumb, title, actions, hasSearch = true }) => (
  <header className="topbar">
    <h1>
      {crumb && <span className="crumb">{crumb} / </span>}
      {title}
    </h1>
    <div className="topbar-actions">
      {hasSearch && (
        <div className="search">
          <Icon name="search" size={12} />
          <span>Search tickets, customers…</span>
          <kbd>⌘K</kbd>
        </div>
      )}
      <button className="btn btn-icon btn-ghost" title="Notifications" style={{ position: "relative" }}>
        <Icon name="bell" size={14} />
        <span className="bell-n">3</span>
      </button>
      {actions}
    </div>
  </header>
);

/* ── JSON syntax highlighting ─────────────────────── */
const Json = ({ data }) => {
  const lines = JSON.stringify(data, null, 2);
  // colorize keys / strings / numbers / booleans
  const html = lines
    .replace(/("[^"]+")(\s*:)/g, '<span class="k">$1</span>$2')
    .replace(/:\s*("[^"]*")/g, ': <span class="s">$1</span>')
    .replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="n">$1</span>')
    .replace(/:\s*(true|false|null)/g, ': <span class="b">$1</span>');
  return <pre className="json" dangerouslySetInnerHTML={{ __html: html }} />;
};

/* ── Sparkline ───────────────────────────────────────── */
const Spark = ({ data, w = 100, h = 28 }) => {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const area = `0,${h} ${pts.join(" ")} ${w},${h}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polygon className="spark-area" points={area} />
      <polyline className="spark-line" points={pts.join(" ")} />
    </svg>
  );
};

/* ── Mock data ───────────────────────────────────────── */
const TICKETS = [
  {
    id: "TKT-29481",
    customer: "Anika Rao",
    initials: "AR",
    subject: "Mug arrived shattered — need refund",
    snippet: "I ordered the ceramic mug set last week and one of them was broken on arrival.",
    intent: "Refund Request",
    urgency: "High",
    sentiment: "Frustrated",
    channel: "web",
    age: "4m",
    confidence: 0.94,
    route: "Finance",
    status: "ai-suggested",
    order: "ORD-12345",
    product: "Aurora Mug Set (4-pc)",
    keywords: ["damaged", "refund", "broken"],
  },
  {
    id: "TKT-29480",
    customer: "Marcus Lin",
    initials: "ML",
    subject: "Where is my package? FedEx 1Z…",
    snippet: "It's been 9 days and tracking hasn't updated since Monday.",
    intent: "Delivery Issue",
    urgency: "Medium",
    sentiment: "Concerned",
    channel: "email",
    age: "12m",
    confidence: 0.87,
    route: "Logistics",
    status: "ai-suggested",
    order: "ORD-12290",
    product: "Linen Throw Blanket",
    keywords: ["tracking", "delayed"],
  },
  {
    id: "TKT-29479",
    customer: "Priya Shah",
    initials: "PS",
    subject: "Charged twice for same order",
    snippet: "I see two charges on my card for the same order ID.",
    intent: "Payment Failure",
    urgency: "Critical",
    sentiment: "Angry",
    channel: "chat",
    age: "18m",
    confidence: 0.91,
    route: "Finance",
    status: "needs-review",
    order: "ORD-12275",
    product: "—",
    keywords: ["double charge", "billing"],
  },
  {
    id: "TKT-29478",
    customer: "Dilan Park",
    initials: "DP",
    subject: "Wrong size shipped",
    snippet: "Ordered medium, received XL.",
    intent: "Product Complaint",
    urgency: "Low",
    sentiment: "Neutral",
    channel: "web",
    age: "32m",
    confidence: 0.96,
    route: "Support",
    status: "auto-resolved",
    order: "ORD-12244",
    product: "Cloud Hoodie — M / Sand",
    keywords: ["wrong size", "exchange"],
  },
  {
    id: "TKT-29477",
    customer: "Elena Sokolov",
    initials: "ES",
    subject: "Suspicious login from new device",
    snippet: "Got an alert and didn't recognize the location.",
    intent: "Account / Security",
    urgency: "Critical",
    sentiment: "Worried",
    channel: "email",
    age: "41m",
    confidence: 0.82,
    route: "Fraud/Security",
    status: "ai-suggested",
    order: "—",
    product: "—",
    keywords: ["login", "suspicious"],
  },
  {
    id: "TKT-29476",
    customer: "Tomás Vega",
    initials: "TV",
    subject: "Coupon code rejected at checkout",
    snippet: "WELCOME10 says 'expired' but the email said it's good til tomorrow.",
    intent: "Promotion / Pricing",
    urgency: "Low",
    sentiment: "Mildly annoyed",
    channel: "chat",
    age: "55m",
    confidence: 0.93,
    route: "Support",
    status: "auto-resolved",
    order: "—",
    product: "—",
    keywords: ["coupon", "discount"],
  },
  {
    id: "TKT-29475",
    customer: "Hana Yoshida",
    initials: "HY",
    subject: "Battery doesn't last advertised time",
    snippet: "Headphones die in about 6 hours, listing says 18.",
    intent: "Product Complaint",
    urgency: "Medium",
    sentiment: "Disappointed",
    channel: "web",
    age: "1h",
    confidence: 0.88,
    route: "Support",
    status: "needs-review",
    order: "ORD-11992",
    product: "Halo ANC Headphones",
    keywords: ["battery", "warranty"],
  },
];

const URGENCY_CLASS = {
  Low: "pill",
  Medium: "pill pill-accent",
  High: "pill pill-warn",
  Critical: "pill pill-bad",
};

const STATUS_CLASS = {
  "ai-suggested": "pill pill-violet",
  "needs-review": "pill pill-warn",
  "auto-resolved": "pill pill-good",
};

const STATUS_LABEL = {
  "ai-suggested": "AI suggested",
  "needs-review": "Needs review",
  "auto-resolved": "Auto-resolved",
};

window.Icon = Icon;
window.Chrome = Chrome;
window.Sidebar = Sidebar;
window.Topbar = Topbar;
window.Json = Json;
window.Spark = Spark;
window.TICKETS = TICKETS;
window.URGENCY_CLASS = URGENCY_CLASS;
window.STATUS_CLASS = STATUS_CLASS;
window.STATUS_LABEL = STATUS_LABEL;
