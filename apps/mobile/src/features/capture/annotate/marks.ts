// Annotation model (m-capture.jsx CapAnnotate). Marks are stored in the photo
// view's pixel space so they render identically live (react-native-svg) and when
// flattened (native view-shot / web canvas). Draw/Circle/Arrow/Text/Measure are
// the five tools wired end to end. Measure is a two-point ruler: a photo carries
// no intrinsic scale, so the first measurement CALIBRATES (the user enters the
// real length of one segment → mm-per-pixel) and every ruler then reads out in mm
// (design: "Porosity cluster · ~3mm"). Uncalibrated rulers read out in px.

export type Tool = "draw" | "circle" | "arrow" | "text" | "measure";

export interface Pt {
  x: number;
  y: number;
}

export interface Mark {
  id: string;
  tool: Tool;
  color: string;
  /** draw: polyline; circle/arrow/measure: [from, to]; text: [anchor]. */
  pts: Pt[];
  text?: string;
}

/** Straight-line pixel distance between the two endpoints of a ruler. */
export function segLength(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Midpoint of a segment — where a ruler's readout label is anchored. */
export function midpoint(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * A ruler's readout. Once the photo is calibrated (`mmPerPx` known), a ruler
 * reads real millimetres; before calibration it reads pixels so the tool is
 * still usable and honest about what it knows.
 */
export function measureLabel(a: Pt, b: Pt, mmPerPx: number | null): string {
  const px = segLength(a, b);
  if (mmPerPx === null) return `${Math.round(px)} px`;
  const mm = px * mmPerPx;
  return mm < 10 ? `${mm.toFixed(1)} mm` : `${Math.round(mm)} mm`;
}

/**
 * Calibration factor from a reference segment of known real length. Returns
 * `null` for a degenerate (zero-length) or non-positive reference so a bad
 * calibration can never poison later readouts.
 */
export function calibrationMmPerPx(a: Pt, b: Pt, knownMm: number): number | null {
  const px = segLength(a, b);
  if (px <= 0 || knownMm <= 0 || !Number.isFinite(knownMm)) return null;
  return knownMm / px;
}

export const ANNOTATE_COLORS = ["#fbbf24", "#ef4444", "#22d3ee", "#ffffff"] as const;
export const STROKE = 4;

export function polylinePoints(pts: Pt[]): string {
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

export function radiusOf(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** The two barb points of an arrowhead at `to`, pointing from `from`. */
export function arrowHead(from: Pt, to: Pt, len = 18, spread = 0.5): [Pt, Pt] {
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  return [
    { x: to.x - len * Math.cos(ang - spread), y: to.y - len * Math.sin(ang - spread) },
    { x: to.x - len * Math.cos(ang + spread), y: to.y - len * Math.sin(ang + spread) },
  ];
}
