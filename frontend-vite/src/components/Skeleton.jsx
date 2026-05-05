/* Skeleton loaders — replace empty spinners with content-shaped placeholders. */

export function Skeleton({ width = "100%", height = 14, radius = 6, style }) {
  return (
    <div
      className="skel"
      style={{
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

export function SkeletonKpiRow({ cols = 4 }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 14,
        marginBottom: 18,
      }}
    >
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="kpi">
          <Skeleton width={90} height={11} />
          <Skeleton width={120} height={28} />
          <Skeleton width="100%" height={28} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ height = 200 }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <Skeleton width={160} height={14} style={{ marginBottom: 14 }} />
      <Skeleton width="100%" height={height - 50} />
    </div>
  );
}

export function SkeletonRows({ rows = 5, cols = 4 }) {
  return (
    <div style={{ padding: "16px 18px" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 12,
            padding: "10px 0",
            borderBottom: "1px solid var(--line)",
          }}
        >
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} height={12} width={`${60 + Math.random() * 30}%`} />
          ))}
        </div>
      ))}
    </div>
  );
}
