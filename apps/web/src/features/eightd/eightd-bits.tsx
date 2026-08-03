import type { EightDStatus, EightDStepStatus } from "@kaenal/types";
import { Chip } from "@/components/ui";

/**
 * The eight disciplines (03 §5). Titles/descriptions are presentation, so they
 * live here; the completion GATING (prerequisites, D3∥D2) is the pure core rule
 * (`canCompleteStep`) enforced server-side. Each discipline names the freeform
 * `data` fields the detail panel edits — the payload is open jsonb, so these are
 * a convention, not a schema.
 */
export interface StepField {
  readonly key: string;
  readonly label: string;
  readonly placeholder: string;
  readonly rows?: number;
}
export interface Discipline {
  readonly n: number;
  readonly key: string; // "d1".."d8" — matches EightDDto.steps keys
  readonly code: string; // "D1".."D8"
  readonly title: string;
  readonly desc: string;
  readonly fields: readonly StepField[];
}

export const DISCIPLINES: readonly Discipline[] = [
  { n: 1, key: "d1", code: "D1", title: "Team", desc: "Form the cross-functional team", fields: [
    { key: "charter", label: "Team charter / scope", placeholder: "Purpose, scope, and authority of the team…", rows: 3 },
  ] },
  { n: 2, key: "d2", code: "D2", title: "Problem", desc: "Describe the problem", fields: [
    { key: "problem", label: "Problem statement", placeholder: "What, where, when, and how big — quantified…", rows: 4 },
  ] },
  { n: 3, key: "d3", code: "D3", title: "Contain", desc: "Interim containment", fields: [
    { key: "containment", label: "Containment actions", placeholder: "Quarantine, sort, rework — protect the customer now…", rows: 3 },
    { key: "effectiveness", label: "Effectiveness check", placeholder: "How was containment verified effective?", rows: 2 },
  ] },
  { n: 4, key: "d4", code: "D4", title: "Root Cause", desc: "Analyze & verify", fields: [
    { key: "rootCause", label: "Root cause", placeholder: "The verified systemic root cause (5-Why / fishbone)…", rows: 3 },
    { key: "verification", label: "Verification", placeholder: "How was the root cause proven (turn the failure on/off)?", rows: 2 },
  ] },
  { n: 5, key: "d5", code: "D5", title: "Corrective", desc: "Choose permanent actions", fields: [
    { key: "corrective", label: "Permanent corrective actions", placeholder: "The chosen permanent corrective action(s)…", rows: 3 },
  ] },
  { n: 6, key: "d6", code: "D6", title: "Implement", desc: "Implement & validate", fields: [
    { key: "implementation", label: "Implementation", placeholder: "How the corrective action was implemented…", rows: 3 },
    { key: "validation", label: "Validation of effectiveness", placeholder: "Evidence the action worked (data, dates)…", rows: 2 },
  ] },
  { n: 7, key: "d7", code: "D7", title: "Prevent", desc: "Prevent recurrence", fields: [
    { key: "preventive", label: "Systemic / preventive actions", placeholder: "FMEA, control-plan, procedure updates to prevent recurrence…", rows: 3 },
  ] },
  { n: 8, key: "d8", code: "D8", title: "Close", desc: "Recognize the team & close", fields: [
    { key: "closure", label: "Closure & recognition", placeholder: "Lessons learned, team recognition, closure notes…", rows: 3 },
  ] },
];

export function disciplineFor(n: number): Discipline {
  return DISCIPLINES[n - 1] ?? DISCIPLINES[0]!;
}

const STATUS_STYLES: Record<EightDStatus, { label: string; bg: string; fg: string; dot: string }> = {
  active: { label: "Active", bg: "rgba(245,158,11,0.14)", fg: "#b45309", dot: "#f59e0b" },
  completed: { label: "Completed", bg: "rgba(34,197,94,0.14)", fg: "#15803d", dot: "#22c55e" },
  cancelled: { label: "Cancelled", bg: "var(--bg-subtle)", fg: "var(--text-muted)", dot: "#cbd5e1" },
};

export function EightDStatusBadge({ status }: { status: EightDStatus }): React.ReactElement {
  const s = STATUS_STYLES[status];
  return (
    <Chip bg={s.bg} fg={s.fg} dot={s.dot} style={{ fontWeight: 600 }}>
      {s.label}
    </Chip>
  );
}

export const STEP_STATUS_STYLES: Record<EightDStepStatus, { label: string; bg: string; fg: string; color: string }> = {
  pending: { label: "Pending", bg: "rgba(100,116,139,0.16)", fg: "#475569", color: "var(--bg-subtle)" },
  in_progress: { label: "In progress", bg: "rgba(245,158,11,0.14)", fg: "#b45309", color: "#f59e0b" },
  complete: { label: "Complete", bg: "rgba(34,197,94,0.14)", fg: "#15803d", color: "#16a34a" },
};

export function StepStatusBadge({ status }: { status: EightDStepStatus }): React.ReactElement {
  const s = STEP_STATUS_STYLES[status];
  return (
    <Chip bg={s.bg} fg={s.fg}>
      {s.label}
    </Chip>
  );
}

/**
 * The D1–D8 rail: each discipline a cell coloured by status, the active one
 * ringed. Mirrors `eightd.jsx`'s stepper. `statusOf(n)` reads the step's status.
 */
export function DisciplineRail({
  active,
  statusOf,
  onSelect,
}: {
  active: number;
  statusOf: (n: number) => EightDStepStatus;
  onSelect: (n: number) => void;
}): React.ReactElement {
  return (
    <div className="flex gap-1.5 overflow-x-auto">
      {DISCIPLINES.map((d) => {
        const st = statusOf(d.n);
        const isActive = d.n === active;
        const s = STEP_STATUS_STYLES[st];
        const filled = st === "complete" || st === "in_progress";
        return (
          <button
            key={d.n}
            onClick={() => onSelect(d.n)}
            title={`${d.code} · ${d.title}`}
            className="flex min-w-[76px] flex-1 flex-col items-center gap-1 rounded-lg border px-2 py-2 transition-colors"
            style={{
              borderColor: isActive ? "var(--accent)" : "var(--border)",
              borderWidth: isActive ? 2 : 1,
              background: isActive ? "var(--bg-subtle)" : "transparent",
            }}
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold"
              style={{ background: filled ? s.color : "var(--bg-subtle)", color: filled ? "white" : "var(--text-muted)" }}
            >
              {d.n}
            </span>
            <span className="text-[11px] font-semibold leading-none" style={{ color: isActive ? "var(--text)" : "var(--text-muted)" }}>
              {d.code}
            </span>
            <span className="text-[10px] leading-none text-muted">{d.title}</span>
          </button>
        );
      })}
    </div>
  );
}
