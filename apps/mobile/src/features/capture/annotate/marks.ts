// Annotation model (m-capture.jsx CapAnnotate). Marks are stored in the photo
// view's pixel space so they render identically live (react-native-svg) and when
// flattened (native view-shot / web canvas). Draw/Circle/Arrow/Text are the four
// tools wired end to end; the design's fifth "Measure" is deferred honestly (a
// real-world measurement needs a scale reference the photo doesn't carry).

export type Tool = "draw" | "circle" | "arrow" | "text";

export interface Pt {
  x: number;
  y: number;
}

export interface Mark {
  id: string;
  tool: Tool;
  color: string;
  /** draw: polyline; circle/arrow: [from, to]; text: [anchor]. */
  pts: Pt[];
  text?: string;
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
