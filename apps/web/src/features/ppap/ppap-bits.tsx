import { Check, Clock, Eye, Pencil, X, Minus, Sparkles, type LucideIcon } from "lucide-react";
import type { PpapElementStatus, PpapStatus } from "@kaenal/types";
import { Chip } from "@/components/ui";

/** Submission-status colours (matches `suppliers-ppap.jsx` PpapStatusBadge). */
const STATUS_STYLES: Record<PpapStatus, { label: string; bg: string; fg: string; dot: string }> = {
  pending: { label: "Pending", bg: "rgba(100,116,139,0.16)", fg: "#475569", dot: "#94a3b8" },
  in_review: { label: "In review", bg: "rgba(245,158,11,0.14)", fg: "#b45309", dot: "#f59e0b" },
  interim: { label: "Interim", bg: "rgba(59,130,246,0.12)", fg: "#1d4ed8", dot: "#3b82f6" },
  approved: { label: "Approved", bg: "rgba(34,197,94,0.14)", fg: "#15803d", dot: "#22c55e" },
  rejected: { label: "Rejected", bg: "rgba(220,38,38,0.12)", fg: "#b91c1c", dot: "#dc2626" },
};

export function PpapStatusBadge({ status }: { status: PpapStatus }): React.ReactElement {
  const s = STATUS_STYLES[status];
  return (
    <Chip bg={s.bg} fg={s.fg} dot={s.dot} style={{ fontWeight: 600 }}>
      {s.label}
    </Chip>
  );
}

export function LevelChip({ level }: { level: number }): React.ReactElement {
  return (
    <Chip bg="var(--bg-subtle)" style={{ fontSize: 10.5 }}>
      Level {level}
    </Chip>
  );
}

/** Per-element review state: icon + colour + label. */
export const ELEMENT_STYLES: Record<
  PpapElementStatus,
  { label: string; icon: LucideIcon; color: string; bg: string; fg: string }
> = {
  approved: { label: "Approved", icon: Check, color: "#16a34a", bg: "rgba(34,197,94,0.14)", fg: "#15803d" },
  pending: { label: "Pending", icon: Clock, color: "#94a3b8", bg: "rgba(100,116,139,0.16)", fg: "#475569" },
  changes_requested: { label: "Changes requested", icon: Pencil, color: "#ea580c", bg: "rgba(234,88,12,0.12)", fg: "#9a3412" },
  n_a: { label: "N/A", icon: Minus, color: "#cbd5e1", bg: "var(--bg-subtle)", fg: "var(--text-muted)" },
};

export function ElementStatusBadge({ status }: { status: PpapElementStatus }): React.ReactElement {
  const s = ELEMENT_STYLES[status];
  return (
    <Chip bg={s.bg} fg={s.fg}>
      {s.label}
    </Chip>
  );
}

/** Round status marker used at the head of each element row. */
export function ElementMarker({ status, size = 26 }: { status: PpapElementStatus; size?: number }): React.ReactElement {
  const s = ELEMENT_STYLES[status];
  const Icon = s.icon;
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-white"
      style={{ width: size, height: size, background: s.color }}
      aria-hidden
    >
      <Icon size={13} strokeWidth={3} />
    </div>
  );
}

// Re-export for callers that need the icon glyph in inline contexts.
export { Eye, X };

/** The AI deadline-prediction pill for the list (compact). */
export function AiPredictionPill({
  willMissDeadline,
  confidence,
  daysLikelyOver,
}: {
  willMissDeadline: boolean | null | undefined;
  confidence: number | null | undefined;
  daysLikelyOver: number | null | undefined;
}): React.ReactElement | null {
  if (willMissDeadline == null) return null;
  const bg = willMissDeadline ? "rgba(220,38,38,0.10)" : "rgba(34,197,94,0.10)";
  const fg = willMissDeadline ? "#b91c1c" : "#15803d";
  const label = willMissDeadline
    ? `Miss risk${daysLikelyOver != null ? ` · ~${daysLikelyOver}d` : ""}`
    : "On track";
  return (
    <Chip bg={bg} fg={fg} title={confidence != null ? `AI confidence ${confidence}%` : undefined}>
      <Sparkles size={10} />
      {label}
    </Chip>
  );
}
