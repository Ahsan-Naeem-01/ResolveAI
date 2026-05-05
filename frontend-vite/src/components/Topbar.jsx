import Icon from "./Icon.jsx";

export default function Topbar({ crumb, title, actions, hasSearch = true }) {
  return (
    <header className="topbar">
      <h1>
        {crumb && <span className="crumb">{crumb} / </span>}
        {title}
      </h1>
      <div className="topbar-actions">
        {hasSearch && (
          <div className="search">
            <Icon name="search" size={12} />
            <span>Search tickets, customers…</span>
            <kbd>⌘K</kbd>
          </div>
        )}
        <button
          className="btn btn-icon btn-ghost"
          title="Notifications"
          style={{ position: "relative" }}
        >
          <Icon name="bell" size={14} />
          <span className="bell-n">3</span>
        </button>
        {actions}
      </div>
    </header>
  );
}
