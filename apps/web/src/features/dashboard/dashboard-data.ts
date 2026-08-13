/**
 * Demo data for dashboard widgets, ported verbatim from the design's `data.js`
 * (`NCR_TREND`, `RISK_DIST`, `ACTIVITY`, `HEATMAP`). These drive the analytics
 * widgets until their aggregate endpoints exist (06 §jobs/AI). The KPI tiles and
 * the assignment/NCR widgets read live data where an endpoint already exists; the
 * rest render this fixture so the board matches `dashboard.jsx` pixel-for-pixel.
 */

export interface TrendPoint {
  month: string;
  created: number;
  resolved: number;
  open: number;
}

export const NCR_TREND: TrendPoint[] = [
  { month: "May", created: 22, resolved: 19, open: 8 },
  { month: "Jun", created: 18, resolved: 21, open: 5 },
  { month: "Jul", created: 25, resolved: 22, open: 8 },
  { month: "Aug", created: 31, resolved: 26, open: 13 },
  { month: "Sep", created: 28, resolved: 30, open: 11 },
  { month: "Oct", created: 24, resolved: 27, open: 8 },
  { month: "Nov", created: 19, resolved: 22, open: 5 },
  { month: "Dec", created: 15, resolved: 17, open: 3 },
  { month: "Jan", created: 27, resolved: 21, open: 9 },
  { month: "Feb", created: 32, resolved: 28, open: 13 },
  { month: "Mar", created: 29, resolved: 31, open: 11 },
  { month: "Apr", created: 34, resolved: 25, open: 20 },
];

export interface RiskSlice {
  label: string;
  value: number;
  color: string;
}

export const RISK_DIST: RiskSlice[] = [
  { label: "Critical", value: 3, color: "#dc2626" },
  { label: "High", value: 8, color: "#ea580c" },
  { label: "Medium", value: 14, color: "#f59e0b" },
  { label: "Low", value: 27, color: "#22c55e" },
];

/** Ink severity palette (matches the design's SEVERITY_INK). */
export const SEVERITY_INK: Record<string, string> = {
  Critical: "#b91c1c",
  High: "#c2410c",
  Medium: "#b45309",
  Low: "#3f6212",
};

export interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
}

export const ACTIVITY: ActivityItem[] = [
  { id: "a1", actor: "Sarah Chen", action: "advanced D4 on", target: "8D-2026-0015", time: "8m ago" },
  { id: "a2", actor: "Aria Kim", action: "created", target: "NCR-2026-0089", time: "1h ago" },
  { id: "a3", actor: "Aria Kim", action: "completed", target: "INS-2026-0042", time: "1h ago" },
  { id: "a4", actor: "Manjunath K.", action: "assigned", target: "NCR-2026-0091", time: "1h ago" },
  { id: "a5", actor: "Priya Nair", action: "uploaded evidence to", target: "NCR-2026-0085", time: "3h ago" },
  { id: "a6", actor: "Marco Reyes", action: "completed", target: "INS-2026-0043", time: "4h ago" },
  { id: "a7", actor: "Marco Reyes", action: "closed", target: "NCR-2026-0087", time: "6h ago" },
  { id: "a8", actor: "Sarah Chen", action: "commented on", target: "8D-2026-0015", time: "8h ago" },
  { id: "a9", actor: "Lin Wei", action: "started", target: "INS-2026-0044", time: "10h ago" },
];

export interface Heatmap {
  rows: string[];
  cols: string[];
  values: number[][];
}

export const HEATMAP: Heatmap = {
  rows: ["Safety", "Quality", "Process", "Environmental", "Supplier"],
  cols: ["Plant A — Weld", "Plant A — Assy", "Plant A — Paint", "Plant B — Mach", "Plant B — Paint", "Incoming"],
  values: [
    [1, 0, 1, 0, 1, 0],
    [4, 1, 2, 2, 1, 1],
    [2, 1, 1, 1, 0, 0],
    [0, 0, 2, 0, 1, 0],
    [0, 0, 0, 0, 0, 3],
  ],
};

export interface DemoAssignment {
  id: string;
  title: string;
  priority: string;
  status: string;
  due: string;
  area: string;
}

export const ASSIGNMENTS: DemoAssignment[] = [
  { id: "NCR-2026-0091", title: "Torque wrench fleet calibration gap", priority: "major", status: "in_progress", due: "May 12", area: "Plant A — Assy" },
  { id: "NCR-2026-0089", title: "Recurring weld porosity on Part #A-7742", priority: "critical", status: "assigned", due: "May 08", area: "Plant A — Weld" },
  { id: "NCR-2026-0085", title: "Supplier wire batch variation — ER70S-6", priority: "major", status: "in_progress", due: "May 10", area: "Incoming" },
  { id: "NCR-2026-0084", title: "Paint adhesion failure — batch #H-884", priority: "minor", status: "open", due: "May 15", area: "Plant A — Paint" },
];
