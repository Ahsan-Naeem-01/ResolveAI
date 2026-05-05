import { useEffect, useState, useCallback } from "react";
import CustomerScreen from "./screens/CustomerScreen.jsx";
import AgentScreen from "./screens/AgentScreen.jsx";
import ManagerScreen from "./screens/ManagerScreen.jsx";
import AdminScreen from "./screens/AdminScreen.jsx";

const ROLES = [
  { id: "customer", label: "Customer" },
  { id: "agent", label: "Agent" },
  { id: "manager", label: "Manager" },
  { id: "admin", label: "Admin" },
];

const STORAGE_KEY = "resolveai.preferences";

export default function App() {
  const [role, setRole] = useState("customer");
  const [theme, setTheme] = useState("light");
  const [toastMsg, setToastMsg] = useState(null);

  // Restore persisted preferences
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.role && ROLES.some((r) => r.id === saved.role)) setRole(saved.role);
        if (saved.theme === "light" || saved.theme === "dark") setTheme(saved.theme);
      }
    } catch {}
  }, []);

  // Persist preferences
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ role, theme }));
  }, [role, theme]);

  // Apply theme to body
  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2400);
  }, []);

  return (
    <div className="app">
      <div className="topstrip">
        <div style={{ minWidth: 200, display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: "-0.01em",
            }}
          >
            ResolveAI
          </span>
          <span className="muted small">Smart Customer Support Intelligence</span>
        </div>
        <div className="role-tabs-static">
          {ROLES.map((r) => (
            <button
              key={r.id}
              className={role === r.id ? "on" : ""}
              onClick={() => setRole(r.id)}
            >
              <span className="dot" /> {r.label}
            </button>
          ))}
        </div>
        <div
          style={{
            minWidth: 200,
            display: "flex",
            justifyContent: "flex-end",
            gap: 6,
          }}
        >
          <div className="modeswitch-static">
            <button
              className={theme === "light" ? "on" : ""}
              onClick={() => setTheme("light")}
            >
              Light
            </button>
            <button
              className={theme === "dark" ? "on" : ""}
              onClick={() => setTheme("dark")}
            >
              Dark
            </button>
          </div>
        </div>
      </div>

      <div className="pageframe">
        {role === "customer" && <CustomerScreen />}
        {role === "agent" && <AgentScreen toast={toast} />}
        {role === "manager" && <ManagerScreen />}
        {role === "admin" && <AdminScreen />}
      </div>

      {toastMsg && <div className="toast">{toastMsg}</div>}
    </div>
  );
}
