// Reusable skeleton primitives. Use these as visual placeholders while data is
// being fetched — they share the .skeleton shimmer animation from styles.css.

export function SkeletonLine({ width, height, style }) {
  return (
    <span
      className="skeleton sk-line"
      style={{ width: width ?? '100%', height: height ?? undefined, ...style }}
    />
  );
}

export function SkeletonCircle({ size = 38 }) {
  return <span className="skeleton sk-circle" style={{ width: size, height: size }} />;
}

export function SkeletonRect({ height = '2.2rem', width = '100%' }) {
  return <span className="skeleton sk-rect" style={{ width, height }} />;
}

// Table-row skeleton. Pass `cols` to control column count.
export function SkeletonRow({ cols = 4 }) {
  return (
    <tr className="sk-row">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}><SkeletonLine width={i === 0 ? '70%' : i === cols - 1 ? '40%' : '85%'} /></td>
      ))}
    </tr>
  );
}

// Stat-card skeleton used on the admin dashboard.
export function SkeletonStat() {
  return (
    <div className="card stat">
      <SkeletonLine width="55%" height="0.75rem" style={{ marginBottom: 4 }} />
      <SkeletonLine width="40%" height="2rem" />
      <div className="stat-icon" style={{ background: '#e2e8f0', color: 'transparent' }}>
        <SkeletonCircle size={20} />
      </div>
    </div>
  );
}
