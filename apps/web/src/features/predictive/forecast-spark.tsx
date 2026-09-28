/**
 * Forecast sparkline (`predictive.jsx` `ForecastSpark`, lines 14-62) — history
 * rendered solid, the single-horizon forecast dashed, an 80% confidence fan,
 * and a "now" divider. Fed entirely by real `history`/`predictedValue`/
 * `bandLow`/`bandHigh` from `RiskPredictionDto` (P3 AC2) — the API returns one
 * forecast point per horizon (not the jsx's synthetic two-point `fore` array),
 * so the dashed segment here runs from "now" to that one point, with the band
 * widening from zero at "now" to the real `bandLow`/`bandHigh` at the forecast
 * point — the same widen-with-distance shape the jsx draws, driven by the
 * server's own band math instead of the jsx's invented 22% spread.
 */

const PRED_ACTUAL = "var(--text-muted)";
const PRED_FORE = "#d97706"; // amber-600 — projected / predicted (jsx colour, no token maps this accent)
const PRED_FORE_FILL = "rgba(217,119,6,0.13)";

export function ForecastSpark({
  history,
  predictedValue,
  bandLow,
  bandHigh,
  width = 168,
  height = 52,
}: {
  history: readonly number[];
  predictedValue: number;
  bandLow: number;
  bandHigh: number;
  width?: number;
  height?: number;
}): React.ReactElement {
  const padX = 5;
  const padT = 7;
  const padB = 9;
  const hist = history.length > 0 ? history : [0];
  const now = hist[hist.length - 1] ?? 0;
  const split = hist.length - 1;
  const n = hist.length + 1;

  const bandHiPts: [number, number][] = [
    [split, now],
    [split + 1, bandHigh],
  ];
  const bandLoPts: [number, number][] = [
    [split, now],
    [split + 1, bandLow],
  ];

  const vals = [...hist, predictedValue, bandLow, bandHigh, 0];
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const x = (i: number): number => padX + (i / (n - 1)) * (width - padX * 2);
  const y = (v: number): number => padT + (1 - (v - min) / range) * (height - padT - padB);

  const actualPts: [number, number][] = hist.map((v, i) => [x(i), y(v)]);
  const forePts: [number, number][] = [
    [x(split), y(now)],
    [x(split + 1), y(predictedValue)],
  ];
  const hiPts = bandHiPts.map(([i, v]) => [x(i), y(v)] as [number, number]);
  const loPts = bandLoPts.map(([i, v]) => [x(i), y(v)] as [number, number]);
  const bandPath =
    "M" +
    hiPts.map((p) => p.join(",")).join(" L") +
    " L" +
    loPts
      .slice()
      .reverse()
      .map((p) => p.join(","))
      .join(" L") +
    " Z";
  const toLine = (pts: [number, number][]): string => pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");

  return (
    <svg width={width} height={height} style={{ display: "block", flexShrink: 0 }} role="img" aria-label="Forecast trend">
      <path d={bandPath} fill={PRED_FORE_FILL} stroke="none" />
      <line
        x1={x(split)}
        x2={x(split)}
        y1={padT - 3}
        y2={height - padB + 2}
        stroke="var(--border-strong)"
        strokeWidth={1}
        strokeDasharray="2 2"
      />
      <path d={toLine(actualPts)} fill="none" stroke={PRED_ACTUAL} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d={toLine(forePts)}
        fill="none"
        stroke={PRED_FORE}
        strokeWidth={2}
        strokeDasharray="4 2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={x(split)} cy={y(now)} r={2.6} fill="var(--surface)" stroke={PRED_ACTUAL} strokeWidth={1.6} />
      <circle cx={forePts[1]![0]} cy={forePts[1]![1]} r={3.2} fill={PRED_FORE} />
    </svg>
  );
}
