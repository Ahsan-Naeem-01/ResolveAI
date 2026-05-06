import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";

/* Public-facing customer help-portal layout.
   Distinct from the staff AppShell — this is what an end-customer would see. */

export default function PortalLayout({
  theme,
  onThemeChange,
  onSignOut,
  currentUser,
  onOpenFAQ,
  onOpenTickets,
  children,
}) {
  return (
    <div className="portal">
      <header className="portal-nav">
        <div className="portal-nav-brand">
          <div className="side-brand-mark">R</div>
          <div>ResolveAI</div>
          <span
            style={{
              fontWeight: 400,
              color: "var(--ink-3)",
              fontSize: 13,
              marginLeft: 4,
            }}
          >
            · Help center
          </span>
        </div>
        <div className="portal-nav-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onOpenTickets?.()}
          >
            <Icon name="chat" size={12} className="" />
            My tickets
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onOpenFAQ?.()}
          >
            <Icon name="book" size={12} className="" />
            FAQs
          </button>
          <PortalUserMenu
            currentUser={currentUser}
            theme={theme}
            onThemeChange={onThemeChange}
            onSignOut={onSignOut}
          />
        </div>
      </header>

      <div className="portal-content">
        <div className="portal-inner">{children}</div>
      </div>
    </div>
  );
}

function PortalUserMenu({ currentUser, theme, onThemeChange, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className="btn btn-sm"
        onClick={() => setOpen((v) => !v)}
        style={{ display: "flex", alignItems: "center", gap: 8 }}
      >
        <span className="avatar" style={{ width: 22, height: 22, fontSize: 11 }}>
          {currentUser?.initials || "U"}
        </span>
        <span>{currentUser?.name || "Account"}</span>
        <Icon name="arrowDown" size={12} className="" />
      </button>
      {open && (
        <div
          className="user-menu"
          role="menu"
          style={{
            bottom: "auto",
            top: "calc(100% + 8px)",
            right: 0,
            left: "auto",
            width: 240,
          }}
        >
          <div className="user-menu-header">
            <div style={{ fontSize: 13, fontWeight: 500 }}>
              {currentUser?.name}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
              {currentUser?.email}
            </div>
          </div>

          <div className="user-menu-section-label">Theme</div>
          <div style={{ padding: "0 6px 6px" }}>
            <div className="theme-toggle" style={{ width: "100%" }}>
              <button
                className={theme === "light" ? "on" : ""}
                style={{ flex: 1 }}
                onClick={() => onThemeChange("light")}
              >
                Light
              </button>
              <button
                className={theme === "dark" ? "on" : ""}
                style={{ flex: 1 }}
                onClick={() => onThemeChange("dark")}
              >
                Dark
              </button>
            </div>
          </div>

          <div style={{ padding: 6 }}>
            <button
              className="btn btn-sm"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => {
                setOpen(false);
                onSignOut?.();
              }}
            >
              <Icon name="shield" size={12} className="" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
