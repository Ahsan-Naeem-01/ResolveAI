import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { useAuth } from "./lib/auth.jsx";
import { getRole } from "./lib/roles.js";

const CustomerScreen = lazy(() => import("./screens/CustomerScreen.jsx"));
const AgentScreen = lazy(() => import("./screens/AgentScreen.jsx"));
const ManagerScreen = lazy(() => import("./screens/ManagerScreen.jsx"));
const AdminScreen = lazy(() => import("./screens/AdminScreen.jsx"));
const AuthScreen = lazy(() => import("./screens/AuthScreen.jsx"));

const STORAGE_KEY = "resolveai.preferences";

export default function App() {
  const { user, loading, signOut } = useAuth();
  const [theme, setTheme] = useState("light");
  const [toastMsg, setToastMsg] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.theme === "light" || saved.theme === "dark") setTheme(saved.theme);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme }));
  }, [theme]);

  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2400);
  }, []);

  if (loading) return <BootSplash />;

  if (!user) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<BootSplash />}>
          <AuthScreen />
        </Suspense>
      </ErrorBoundary>
    );
  }

  // Build the per-role config and overlay the authenticated user identity.
  const roleConfig = getRole(user.role);
  const role =
    user.role === "customer"
      ? roleConfig
      : {
          ...roleConfig,
          user: {
            name: user.name,
            initials: user.initials,
            role: user.title || roleConfig.user?.role || roleConfig.label,
            email: user.email,
          },
        };

  const shellProps = {
    role,
    theme,
    onThemeChange: setTheme,
    onSignOut: signOut,
    currentUser: user,
  };

  return (
    <ErrorBoundary>
      <Suspense fallback={<BootSplash />}>
        {user.role === "customer" ? (
          <CustomerScreen {...shellProps} toast={toast} />
        ) : user.role === "agent" ? (
          <AgentScreen {...shellProps} toast={toast} />
        ) : user.role === "manager" ? (
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
