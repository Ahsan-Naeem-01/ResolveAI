export default function Chrome({ url, children }) {
  return (
    <div className="surface">
      <div className="chrome">
        <div className="chrome-dots">
          <span />
          <span />
          <span />
        </div>
        <div className="chrome-url">{url}</div>
        <div style={{ width: 38 }} />
      </div>
      {children}
    </div>
  );
}
