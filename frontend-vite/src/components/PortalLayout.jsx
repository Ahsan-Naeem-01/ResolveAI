import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { ROLES, CUSTOMER_ROLE } from "../lib/roles.js";

/* Public-facing customer help-portal layout.
   Distinct from the staff AppShell — this is what an end-customer would see. */

export default function PortalLayout({
  role,
  onRoleChange,
  theme,
  onThemeChange,
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
          <button className="btn btn-ghost btn-sm">Track an order</button>
          <button className="btn btn-ghost btn-sm">FAQs</button>
          <PortalUserMenu
            role={role}
            theme={theme}
            onRoleChange={onRoleChange}
            onThemeChange={onThemeChange}
          />
        </div>
      </header>

      <div className="portal-content">
        <div className="portal-inner">{children}</div>
      </div>
    </div>
  );
}

function PortalUserMenu({ role, theme, onThemeChange, onRoleChange }) {
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
        className="btn btn-ghost btn-sm"
        onClick={() => setOpen((v) => !v)}
      >
        Sign in
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
          <div className="user-menu-section-label">View as</div>
          <button
            className={`user-menu-item ${role.id === "customer" ? "on" : ""}`}
            onClick={() => {
              onRoleChange(CUSTOMER_ROLE.id);
              setOpen(false);
            }}
          >
            <Icon name="users" size={14} className="" />
            Customer (help portal)
          </button>
          {ROLES.map((r) => (
            <button
              key={r.id}
              className={`user-menu-item ${role.id === r.id ? "on" : ""}`}
              onClick={() => {
                onRoleChange(r.id);
                setOpen(false);
              }}
            >
              <Icon
                name={
                  r.id === "agent"
                    ? "inbox"
                    : r.id === "manager"
                    ? "chart"
                    : "settings"
                }
                size={14}
                className=""
              />
              {r.label}
            </button>
          ))}

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
        </div>
      )}
    </div>
  );
}
