import { Fragment, useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { ROLES, CUSTOMER_ROLE } from "../lib/roles.js";

/* AppShell — persistent staff layout (sidebar + header).
   Used by Agent / Manager / Admin screens. The Customer surface uses a
   different (public help-portal) layout; see PortalLayout. */

export default function AppShell({
  role,
  onRoleChange,
  theme,
  onThemeChange,
  activeNavId,
  onNavChange,
  children,
}) {
  // The active nav id can be controlled by the screen (preferred) or fall back
  // to the role's default. This keeps existing screens (Manager / Admin) that
  // don't yet route between sub-views working as before.
  const currentNav = activeNavId ?? role.activeNavId;

  return (
    <div className="app">
      <aside className="side">
        <div className="side-brand">
          <div className="side-brand-mark">R</div>
          <div>
            <div className="side-brand-name">ResolveAI</div>
            <div className="side-brand-tag">{role.user.role}</div>
          </div>
        </div>

        <nav className="side-nav">
          {role.nav.map((sect, i) => (
            <Fragment key={i}>
              {sect.label && <div className="side-section">{sect.label}</div>}
              {sect.items.map((it) => {
                const isActive = currentNav === it.id;
                const handleClick = () => {
                  if (onNavChange) onNavChange(it.id);
                };
                return (
                  <button
                    type="button"
                    key={it.id}
                    onClick={handleClick}
                    className={`side-item ${isActive ? "active" : ""}`}
                  >
                    <Icon name={it.icon} size={16} className="side-icon" />
                    <span>{it.name}</span>
                    {it.badge != null && (
                      <span className="side-badge">{it.badge}</span>
                    )}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </nav>

        <UserMenu
          role={role}
          theme={theme}
          onThemeChange={onThemeChange}
          onRoleChange={onRoleChange}
        />
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}

export function Header({ crumb, title, actions, hasSearch = true }) {
  return (
    <header className="header">
      <h1 className="header-title">
        {crumb && <span className="header-crumb">{crumb} /</span>} {title}
      </h1>
      <div className="header-actions">
        {hasSearch && (
          <div className="header-search">
            <Icon name="search" size={13} className="" />
            <span>Search tickets, customers…</span>
            <kbd>⌘K</kbd>
          </div>
        )}
        {actions}
      </div>
    </header>
  );
}

function UserMenu({ role, theme, onThemeChange, onRoleChange }) {
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
    <div className="side-user" ref={ref}>
      <div className="side-user-card" onClick={() => setOpen((v) => !v)}>
        <div className="avatar">{role.user.initials}</div>
        <div className="side-user-info">
          <div className="side-user-name">{role.user.name}</div>
          <div className="side-user-role">{role.user.role}</div>
        </div>
        <Icon name="moreH" size={14} className="side-user-caret" />
      </div>

      {open && (
        <div className="user-menu" role="menu">
          <div className="user-menu-header">
            <div style={{ fontSize: 13, fontWeight: 500 }}>{role.user.name}</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
              {role.user.role}
            </div>
          </div>

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
