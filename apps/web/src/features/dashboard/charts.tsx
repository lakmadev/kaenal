"use client";

import type { TrendPoint } from "./dashboard-data";

/**
 * Pure-SVG chart primitives ported from `dashboard.jsx`. No chart library — the
 * design draws these by hand so they inherit the token palette exactly. All are
 * presentational; data comes from the widget layer.
 */

export function Sparkline({
  data,
  color = "var(--accent)",
  width = 100,
  height = 32,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}): React.ReactElement {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    height - ((v - min) / range) * (height - 4) - 2,
  ]);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const area = `${path} L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <path d={area} fill={color} opacity="0.1" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export interface LineSeries {
  key: keyof TrendPoint;
  color: string;
  emphasis?: boolean;
}

export function LineChart({
  data,
  series,
  height = 220,
}: {
  data: TrendPoint[];
  series: LineSeries[];
  height?: number;
}): React.ReactElement {
  const padL = 40;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const width = 600;
  const allVals = series.flatMap((s) => data.map((d) => Number(d[s.key])));
  const max = Math.ceil(Math.max(...allVals) / 5) * 5;
  const x = (i: number): number => padL + (i / (data.length - 1)) * (width - padL - padR);
  const y = (v: number): number => padT + (1 - v / max) * (height - padT - padB);
  const yTicks = [0, max * 0.5, max];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", display: "block" }}>
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="var(--border)" />
          <text x={padL - 8} y={y(t) + 4} fontSize="10" fill="var(--text-subtle)" textAnchor="end">
            {Math.round(t)}
          </text>
        </g>
      ))}
      {data.map((d, i) => (
        <text key={i} x={x(i)} y={height - 8} fontSize="10" fill="var(--text-subtle)" textAnchor="middle">
          {d.month}
        </text>
      ))}
      {series.map((s) => {
        const pts = data.map((d, i) => [x(i), y(Number(d[s.key]))]);
        const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
        const last = pts[pts.length - 1]!;
        return (
          <g key={String(s.key)}>
            <path
              d={path}
              fill="none"
              stroke={s.color}
              strokeWidth={s.emphasis ? 2 : 1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx={last[0]} cy={last[1]} r="2.5" fill={s.color} />
          </g>
        );
      })}
    </svg>
  );
}

export function DonutChart({
  data,
  size = 180,
}: {
  data: { value: number; color: string }[];
  size?: number;
}): React.ReactElement {
  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 12;
  const r2 = r - 22;
  let acc = 0;
  const arcs = data.map((d) => {
    const start = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += d.value;
    const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const xi1 = cx + r2 * Math.cos(start);
    const yi1 = cy + r2 * Math.sin(start);
    const xi2 = cx + r2 * Math.cos(end);
    const yi2 = cy + r2 * Math.sin(end);
    return {
      d: `M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${xi2},${yi2} A${r2},${r2} 0 ${large} 0 ${xi1},${yi1} Z`,
      color: d.color,
    };
  });
  return (
    <svg width={size} height={size}>
      {arcs.map((a, i) => (
        <path key={i} d={a.d} fill={a.color} />
      ))}
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--text)">
        {total}
      </text>
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        fontSize="10"
        fill="var(--text-muted)"
        style={{ letterSpacing: "0.05em", textTransform: "uppercase" }}
      >
        OPEN NCRS
      </text>
    </svg>
  );
}

export function BarChart({
  data,
  color = "var(--accent)",
}: {
  data: { label: string; value: number; color?: string }[];
  color?: string;
}): React.ReactElement {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
          <div style={{ width: 80, color: "var(--text-muted)", fontWeight: 500 }}>{d.label}</div>
          <div
            style={{
              flex: 1,
              height: 16,
              background: "var(--bg-subtle)",
              borderRadius: "var(--r-sm)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                width: `${(d.value / max) * 100}%`,
                height: "100%",
                background: d.color ?? color,
                borderRadius: "var(--r-sm)",
              }}
            />
          </div>
          <div className="mono" style={{ width: 32, textAlign: "right", fontWeight: 600 }}>
            {d.value}
          </div>
        </div>
      ))}
    </div>
  );
}
