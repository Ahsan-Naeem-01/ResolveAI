import { Fragment } from "react";
import Icon from "./Icon.jsx";

export default function Sidebar({ role, items, activeId, onNav, user }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">R</div>
        <div>
          <div className="brand-name">ResolveAI</div>
          <div className="small muted" style={{ fontSize: 10.5, marginTop: -2 }}>
            {role}
          </div>
        </div>
      </div>
      {items.map((sect, i) => (
        <Fragment key={i}>
          {sect.label && <div className="nav-section">{sect.label}</div>}
          {sect.items.map((it) => (
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
        </Fragment>
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
}
