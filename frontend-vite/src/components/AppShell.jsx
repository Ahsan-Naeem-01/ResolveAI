import { Fragment, useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";

/* AppShell — persistent staff layout (sidebar + header).
   Used by Agent / Manager / Admin screens. The Customer surface uses a
   different (public help-portal) layout; see PortalLayout. */

export default function AppShell({
  role,
  theme,
  onThemeChange,
  onSignOut,
  activeNavId,
  onNavChange,
  children,
}) {
  const currentNav = activeNavId ?? role.activeNavId;
  // Mobile sidebar drawer — collapsed by default, opens via the menu button.
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auto-close the drawer when the user picks an item or resizes back to
  // desktop (≥900px) so the state doesn't get "stuck open".
  useEffect(() => {
    const handler = () => {
      if (window.innerWidth >= 900) setMobileOpen(false);
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return (
    <div className={`app ${mobileOpen ? "mobile-nav-open" : ""}`}>
      {mobileOpen && (
        <div
          className="side-overlay"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}
      <aside className={`side ${mobileOpen ? "side-open" : ""}`}>
        <div className="side-brand">
          <div className="side-brand-mark">R</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="side-brand-name">ResolveAI</div>
            <div className="side-brand-tag">{role.user.role}</div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon side-close-btn"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <Icon name="x" size={14} className="" />
          </button>
        </div>

        <nav className="side-nav">
          {role.nav.map((sect, i) => (
            <Fragment key={i}>
              {sect.label && <div className="side-section">{sect.label}</div>}
              {sect.items.map((it) => {
                const isActive = currentNav === it.id;
                const handleClick = () => {
                  if (onNavChange) onNavChange(it.id);
                  setMobileOpen(false);
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
          onSignOut={onSignOut}
        />
      </aside>

      <main className="main">
        <button
          type="button"
          className="btn btn-ghost btn-icon mobile-menu-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>
        {children}
      </main>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
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

function UserMenu({ role, theme, onThemeChange, onSignOut }) {
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
              {role.user.email || role.user.role}
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
