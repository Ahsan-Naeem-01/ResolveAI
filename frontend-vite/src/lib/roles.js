/* Role configuration: identity + sidebar navigation per role.
   Centralized so screens just render the body — shell handles nav. */

export const ROLES = [
  {
    id: "agent",
    label: "Agent",
    user: { name: "Jordan Maeda", initials: "JM", role: "Tier 2 Agent" },
    title: "Inbox",
    crumb: "Tickets",
    nav: [
      {
        label: "Queue",
        items: [
          { id: "inbox", icon: "inbox", name: "All tickets" },
          { id: "drafts", icon: "edit", name: "Drafts" },
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
    ],
    activeNavId: "inbox",
  },
  {
    id: "manager",
    label: "Manager",
    user: { name: "Maya Khan", initials: "MK", role: "Support Lead" },
    title: "Team performance",
    crumb: "Team",
    nav: [
      {
        label: "Overview",
        items: [
          { id: "perf", icon: "chart", name: "Team performance" },
          { id: "queue", icon: "inbox", name: "Live queue" },
          { id: "sla", icon: "clock", name: "SLA monitor" },
        ],
      },
      {
        label: "Team",
        items: [
          { id: "agents", icon: "users", name: "Agents" },
          { id: "shifts", icon: "clock", name: "Shifts & coverage" },
          { id: "training", icon: "book", name: "Coaching" },
        ],
      },
      {
        label: "Insights",
        items: [
          { id: "trends", icon: "trend", name: "Complaint trends" },
          { id: "macros", icon: "lightning", name: "Macro performance" },
        ],
      },
    ],
    activeNavId: "perf",
  },
  {
    id: "admin",
    label: "Admin",
    user: { name: "Robin Beck", initials: "RB", role: "Owner" },
    title: "Business overview",
    crumb: "Insights",
    nav: [
      {
        label: "Insights",
        items: [
          { id: "ov", icon: "chart", name: "Overview" },
          { id: "compl", icon: "trend", name: "Complaint trends" },
          { id: "prod", icon: "box", name: "Product issues" },
          { id: "rev", icon: "dollar", name: "Revenue impact" },
        ],
      },
      {
        label: "Operations",
        items: [
          { id: "team", icon: "users", name: "Team" },
          { id: "int", icon: "git", name: "Integrations" },
          { id: "set", icon: "settings", name: "Settings" },
        ],
      },
    ],
    activeNavId: "ov",
  },
];

export const CUSTOMER_ROLE = {
  id: "customer",
  label: "Customer",
};

export function getRole(id) {
  if (id === "customer") return CUSTOMER_ROLE;
  return ROLES.find((r) => r.id === id) || ROLES[0];
}
