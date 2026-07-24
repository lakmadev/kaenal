import { Chip } from "./chip";

/**
 * Semantic badges (ported from the visual spec's primitive palette). Each maps a
 * domain enum → a fixed colour + label, so status/priority/risk read the same
 * everywhere. Colour always pairs with text, never colour alone (04 §8).
 */

interface Style {
  label: string;
  bg: string;
  fg: string;
  dot?: string;
}

const STATUS_STYLES: Record<string, Style> = {
  draft: { label: "Draft", bg: "rgba(167,139,250,0.12)", fg: "#7c3aed", dot: "#a78bfa" },
  scheduled: { label: "Scheduled", bg: "rgba(59,130,246,0.12)", fg: "#1d4ed8", dot: "#3b82f6" },
  open: { label: "Open", bg: "rgba(59,130,246,0.12)", fg: "#1d4ed8", dot: "#3b82f6" },
  assigned: { label: "Assigned", bg: "rgba(99,102,241,0.12)", fg: "#4f46e5", dot: "#6366f1" },
  in_progress: { label: "In Progress", bg: "rgba(245,158,11,0.14)", fg: "#b45309", dot: "#f59e0b" },
  resolved: { label: "Resolved", bg: "rgba(34,197,94,0.14)", fg: "#15803d", dot: "#22c55e" },
  verified: { label: "Verified", bg: "rgba(16,185,129,0.14)", fg: "#047857", dot: "#10b981" },
  closed: { label: "Closed", bg: "rgba(100,116,139,0.16)", fg: "#475569", dot: "#64748b" },
  completed: { label: "Completed", bg: "rgba(34,197,94,0.14)", fg: "#15803d", dot: "#22c55e" },
  overdue: { label: "Overdue", bg: "rgba(220,38,38,0.12)", fg: "#b91c1c", dot: "#dc2626" },
  escalated: { label: "Escalated", bg: "rgba(236,72,153,0.12)", fg: "#be185d", dot: "#ec4899" },
  cancelled: { label: "Cancelled", bg: "rgba(100,116,139,0.16)", fg: "#475569", dot: "#64748b" },
  active: { label: "Active", bg: "rgba(245,158,11,0.14)", fg: "#b45309", dot: "#f59e0b" },
  pending: { label: "Pending", bg: "rgba(100,116,139,0.16)", fg: "#475569", dot: "#94a3b8" },
};

const PRIORITY_STYLES: Record<string, Style> = {
  critical: { label: "Critical", bg: "rgba(220,38,38,0.12)", fg: "#b91c1c" },
  major: { label: "Major", bg: "rgba(234,88,12,0.14)", fg: "#c2410c" },
  minor: { label: "Minor", bg: "rgba(245,158,11,0.14)", fg: "#b45309" },
};

const RISK_STYLES: Record<string, Style> = {
  critical: { label: "Critical", bg: "rgba(220,38,38,0.12)", fg: "#b91c1c" },
  high: { label: "High", bg: "rgba(234,88,12,0.14)", fg: "#c2410c" },
  major: { label: "Major", bg: "rgba(234,88,12,0.14)", fg: "#c2410c" },
  medium: { label: "Medium", bg: "rgba(245,158,11,0.14)", fg: "#b45309" },
  minor: { label: "Minor", bg: "rgba(245,158,11,0.14)", fg: "#b45309" },
  low: { label: "Low", bg: "rgba(34,197,94,0.14)", fg: "#15803d" },
  info: { label: "Info", bg: "rgba(99,102,241,0.12)", fg: "#4338ca" },
};

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

export function StatusBadge({ status }: { status: string }): React.ReactElement {
  const s = STATUS_STYLES[status] ?? { label: titleCase(status), bg: "var(--bg-subtle)", fg: "var(--text-muted)" };
  return (
    <Chip bg={s.bg} fg={s.fg} {...(s.dot !== undefined ? { dot: s.dot } : {})}>
      {s.label}
    </Chip>
  );
}

export function PriorityBadge({ priority }: { priority: string }): React.ReactElement {
  const p = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.minor!;
  return (
    <Chip bg={p.bg} fg={p.fg} style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.06em" }}>
      {p.label}
    </Chip>
  );
}

export function RiskBadge({ risk }: { risk?: string | null }): React.ReactElement {
  if (risk === undefined || risk === null || risk === "") {
    return <span className="text-subtle">—</span>;
  }
  const r = RISK_STYLES[risk] ?? { label: titleCase(risk), bg: "var(--bg-subtle)", fg: "var(--text-muted)" };
  return (
    <Chip bg={r.bg} fg={r.fg}>
      {r.label}
    </Chip>
  );
}
