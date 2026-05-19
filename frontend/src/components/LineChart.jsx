import { useMemo, useState } from 'react';

/**
 * Tiny dependency-free SVG line chart.
 *
 * props:
 *   data       Array<{ t: ms-or-Date, v: number }>  — points (in any order; we sort)
 *   color      stroke colour (default --primary)
 *   gradient   true to draw a subtle area fill under the line
 *   unit       suffix shown in the hover tooltip (e.g. "°C", "%", "%")
 *   height     px (default 220)
 *   tickFormat optional fn to format the X-axis tick labels
 *
 * Auto-scales Y to the data range with a small padding above/below, picks
 * 4-5 X-axis ticks, and highlights the min and max as dots. Hovering the
 * chart shows a vertical guide + tooltip with the nearest point's value.
 */
export default function LineChart({
  data,
  color = '#2563eb',
  gradient = true,
  unit = '',
  height = 220,
  tickFormat,
}) {
  const points = useMemo(() => {
    return (data || [])
      .filter((p) => Number.isFinite(Number(p.v)))
      .map((p) => ({ t: +new Date(p.t), v: Number(p.v) }))
      .sort((a, b) => a.t - b.t);
  }, [data]);

  const [hover, setHover] = useState(null); // index of hovered point

  if (points.length < 2) {
    return (
      <div className="chart-empty">
        Not enough data points to draw a chart yet — come back after the next few transmissions.
      </div>
    );
  }

  // Coordinate space — fixed viewBox, SVG scales responsively.
  const VB_W = 800;
  const VB_H = height;
  const PAD = { top: 14, right: 18, bottom: 28, left: 44 };
  const innerW = VB_W - PAD.left - PAD.right;
  const innerH = VB_H - PAD.top - PAD.bottom;

  const tMin = points[0].t;
  const tMax = points[points.length - 1].t;
  const tSpan = Math.max(tMax - tMin, 1);

  const vMin = Math.min(...points.map((p) => p.v));
  const vMax = Math.max(...points.map((p) => p.v));
  // Pad the Y range so the line doesn't kiss the chart edges; clamp to a
  // sensible minimum span so a flat line still renders meaningfully.
  const vRange = Math.max(vMax - vMin, 0.5);
  const vPad = vRange * 0.18;
  const yLow = vMin - vPad;
  const yHigh = vMax + vPad;
  const ySpan = yHigh - yLow;

  const x = (t) => PAD.left + ((t - tMin) / tSpan) * innerW;
  const y = (v) => PAD.top + ((yHigh - v) / ySpan) * innerH;

  // Smooth line path (monotone-ish via simple midpoint smoothing).
  const linePath = points
    .map((p, i) => (i === 0 ? `M${x(p.t)},${y(p.v)}` : `L${x(p.t)},${y(p.v)}`))
    .join(' ');

  // Area fill path: same line, then close to baseline.
  const areaPath = `${linePath} L${x(points[points.length - 1].t)},${PAD.top + innerH} L${x(points[0].t)},${PAD.top + innerH} Z`;

  // Y-axis tick values — 4 evenly-spaced lines covering the padded range.
  const yTicks = Array.from({ length: 4 }, (_, i) => yLow + (i / 3) * ySpan);

  // X-axis tick positions — 5 evenly spaced along time.
  const xTicks = Array.from({ length: 5 }, (_, i) => tMin + (i / 4) * tSpan);
  const formatTick = tickFormat || defaultTickFormat;

  // Min / max highlight dots.
  const minIdx = points.findIndex((p) => p.v === vMin);
  const maxIdx = points.findIndex((p) => p.v === vMax);

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const ratio = localX / rect.width;
    const targetT = tMin + ratio * tSpan;
    // Find nearest point by time.
    let nearest = 0, best = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i].t - targetT);
      if (d < best) { best = d; nearest = i; }
    }
    setHover(nearest);
  };

  const gradId = `lc-grad-${Math.abs(hashColor(color))}`;

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        className="chart-svg"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y gridlines + labels */}
        {yTicks.map((tv, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={y(tv)} x2={VB_W - PAD.right} y2={y(tv)}
                  stroke="#e2e8f0" strokeWidth="1" />
            <text x={PAD.left - 6} y={y(tv) + 3} textAnchor="end"
                  fontSize="10" fill="#94a3b8" fontFamily="ui-monospace, monospace">
              {tv.toFixed(1)}
            </text>
          </g>
        ))}

        {/* X-axis ticks */}
        {xTicks.map((tt, i) => (
          <g key={i}>
            <line x1={x(tt)} y1={PAD.top + innerH} x2={x(tt)} y2={PAD.top + innerH + 4}
                  stroke="#cbd5e1" strokeWidth="1" />
            <text x={x(tt)} y={PAD.top + innerH + 16} textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}
                  fontSize="10" fill="#64748b">
              {formatTick(tt)}
            </text>
          </g>
        ))}

        {/* Area fill */}
        {gradient && <path d={areaPath} fill={`url(#${gradId})`} />}

        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />

        {/* Min / max dots */}
        {minIdx >= 0 && (
          <circle cx={x(points[minIdx].t)} cy={y(points[minIdx].v)} r="3.5" fill="#fff" stroke={color} strokeWidth="2" />
        )}
        {maxIdx >= 0 && (
          <circle cx={x(points[maxIdx].t)} cy={y(points[maxIdx].v)} r="3.5" fill="#fff" stroke={color} strokeWidth="2" />
        )}

        {/* Hover guide + tooltip */}
        {hover != null && (
          <>
            <line
              x1={x(points[hover].t)} x2={x(points[hover].t)}
              y1={PAD.top} y2={PAD.top + innerH}
              stroke="#cbd5e1" strokeDasharray="3 3" strokeWidth="1"
            />
            <circle cx={x(points[hover].t)} cy={y(points[hover].v)} r="4.5" fill={color} stroke="#fff" strokeWidth="2" />
          </>
        )}
      </svg>

      {hover != null && (
        <div
          className="chart-tooltip"
          style={{
            left: `calc(${((x(points[hover].t) - PAD.left) / innerW) * 100}% + ${PAD.left * (1 / VB_W) * 100}%)`,
          }}
        >
          <div className="chart-tooltip-time">{new Date(points[hover].t).toLocaleString()}</div>
          <div className="chart-tooltip-value" style={{ color }}>
            {points[hover].v}{unit}
          </div>
        </div>
      )}
    </div>
  );
}

function defaultTickFormat(t) {
  const d = new Date(t);
  // If the range crosses days show date, else show time.
  const sameDay = (new Date()).toDateString() === d.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function hashColor(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
