import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { getRole } from "./lib/roles.js";

const CustomerScreen = lazy(() => import("./screens/CustomerScreen.jsx"));
const AgentScreen = lazy(() => import("./screens/AgentScreen.jsx"));
const ManagerScreen = lazy(() => import("./screens/ManagerScreen.jsx"));
const AdminScreen = lazy(() => import("./screens/AdminScreen.jsx"));

const STORAGE_KEY = "resolveai.preferences";

export default function App() {
  const [roleId, setRoleId] = useState("agent");
  const [theme, setTheme] = useState("light");
  const [toastMsg, setToastMsg] = useState(null);

  // Restore persisted preferences once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.roleId) setRoleId(saved.roleId);
      if (saved.theme === "light" || saved.theme === "dark") setTheme(saved.theme);
    } catch {}
  }, []);

  // Persist + apply theme
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ roleId, theme }));
  }, [roleId, theme]);

  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2400);
  }, []);

  const role = getRole(roleId);
  const shellProps = {
    role,
    onRoleChange: setRoleId,
    theme,
    onThemeChange: setTheme,
  };

  return (
    <ErrorBoundary>
      <Suspense fallback={<BootSplash />}>
        {roleId === "customer" ? (
          <CustomerScreen {...shellProps} toast={toast} />
        ) : roleId === "agent" ? (
          <AgentScreen {...shellProps} toast={toast} />
        ) : roleId === "manager" ? (
          <ManagerScreen {...shellProps} />
        ) : (
          <AdminScreen {...shellProps} />
        )}
      </Suspense>
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </ErrorBoundary>
  );
}

function BootSplash() {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        height: "100vh",
        background: "var(--bg)",
      }}
    >
      <div className="spinner" />
    </div>
  );
}
