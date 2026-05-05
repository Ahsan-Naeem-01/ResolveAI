import { useState } from "react";
import { useAuth } from "../lib/auth.jsx";
import Icon from "../components/Icon.jsx";

const ROLE_OPTIONS = [
  {
    id: "customer",
    label: "Customer",
    desc: "Submit and track support requests",
    icon: "users",
  },
  {
    id: "agent",
    label: "Agent",
    desc: "Resolve customer tickets",
    icon: "inbox",
  },
  {
    id: "manager",
    label: "Manager",
    desc: "Oversee team performance",
    icon: "chart",
  },
  {
    id: "admin",
    label: "Admin",
    desc: "Business-wide analytics",
    icon: "settings",
  },
];

export default function AuthScreen() {
  const { signIn, signUp, configured } = useAuth();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("customer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("Please enter your name.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
      } else {
        const res = await signUp(email, password, { name: name.trim(), role });
        if (!res.session) {
          setInfo(
            "Account created. Check your email to confirm, then sign in."
          );
          setMode("signin");
          setPassword("");
        }
      }
    } catch (err) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--bg-soft)",
        padding: 24,
      }}
    >
      <div
        className="card"
        style={{ width: "min(440px, 100%)", padding: 28, boxShadow: "var(--shadow-md)" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div className="side-brand-mark">R</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: "var(--ink)" }}>
            ResolveAI
          </div>
        </div>
        <h1 style={{ fontSize: 20, margin: "10px 0 4px", color: "var(--ink)" }}>
          {mode === "signin" ? "Sign in to your account" : "Create your account"}
        </h1>
        <p className="muted small" style={{ marginBottom: 18 }}>
          {mode === "signin"
            ? "Enter your credentials to continue."
            : "Tell us a bit about you — your role determines which workspace you see."}
        </p>

        {!configured && (
          <div className="error-banner" style={{ marginBottom: 14 }}>
            Supabase is not configured. Set <code>VITE_SUPABASE_URL</code> and
            <code> VITE_SUPABASE_ANON_KEY</code> in <code>frontend-vite/.env</code>.
          </div>
        )}

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "signup" && (
            <Field
              label="Full name"
              value={name}
              onChange={setName}
              placeholder="Jane Doe"
              autoComplete="name"
            />
          )}

          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoComplete="email"
          />

          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={6}
          />

          {mode === "signup" && (
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--ink-2)",
                  marginBottom: 6,
                }}
              >
                I am a…
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {ROLE_OPTIONS.map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => setRole(r.id)}
                    className="role-pick"
                    data-active={role === r.id ? "true" : "false"}
                  >
                    <Icon name={r.icon} size={16} className="" />
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{r.label}</div>
                      <div className="muted small">{r.desc}</div>
                    </div>
                    {role === r.id && <Icon name="check" size={14} className="" />}
                  </button>
                ))}
              </div>
              <p className="muted small" style={{ marginTop: 8 }}>
                Staff roles (Agent / Manager / Admin) typically need approval —
                an existing admin can promote you in Supabase.
              </p>
            </div>
          )}

          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
          {info && (
            <div
              className="card"
              style={{
                padding: "10px 12px",
                background: "var(--good-soft)",
                borderColor: "color-mix(in oklab, var(--good) 30%, transparent)",
                color: "var(--good)",
                fontSize: 13,
              }}
            >
              {info}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || !configured}
          >
            {busy
              ? mode === "signin"
                ? "Signing in…"
                : "Creating account…"
              : mode === "signin"
              ? "Sign in"
              : "Create account"}
          </button>
        </form>

        <div
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: "1px solid var(--line)",
            textAlign: "center",
            fontSize: 13,
            color: "var(--ink-3)",
          }}
        >
          {mode === "signin" ? (
            <>
              New here?{" "}
              <button
                type="button"
                className="link"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setInfo(null);
                }}
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                className="link"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setInfo(null);
                }}
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", ...props }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-2)" }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-input"
        {...props}
      />
    </label>
  );
}
