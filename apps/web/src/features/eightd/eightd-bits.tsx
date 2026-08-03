import type { EightDDto, EightDStatus, EightDStepStatus } from "@kaenal/types";
import { Chip } from "@/components/ui";

/**
 * The eight disciplines (03 §5). Titles/descriptions are presentation, so they
 * live here; the completion GATING (prerequisites, D3∥D2) is the pure core rule
 * (`canCompleteStep`) enforced server-side. `fields` are the freeform `data`
 * keys the simple D5–D8 panels edit — the payload is open jsonb, so these are a
 * convention, not a schema. The rich panels (D1–D4) read/write their own keys
 * (`problemStatement`, `isIsNot`, `actions`, `fiveWhys`, …) directly.
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
  { n: 1, key: "d1", code: "D1", title: "Team", desc: "Form the team", fields: [] },
  { n: 2, key: "d2", code: "D2", title: "Problem", desc: "Describe the problem", fields: [] },
  { n: 3, key: "d3", code: "D3", title: "Contain", desc: "Interim containment", fields: [] },
  { n: 4, key: "d4", code: "D4", title: "Root Cause", desc: "Analyze & verify", fields: [] },
  { n: 5, key: "d5", code: "D5", title: "Corrective", desc: "Choose permanent actions", fields: [
    { key: "corrective", label: "Permanent corrective actions", placeholder: "The chosen permanent corrective action(s)…", rows: 4 },
    { key: "verificationPlan", label: "Verification plan", placeholder: "How the permanent action will be validated…", rows: 3 },
  ] },
  { n: 6, key: "d6", code: "D6", title: "Implement", desc: "Validate effectiveness", fields: [
    { key: "implementation", label: "Implementation", placeholder: "How the corrective action was implemented…", rows: 3 },
    { key: "validation", label: "Validation of effectiveness", placeholder: "Evidence the action worked (data, dates)…", rows: 3 },
  ] },
  { n: 7, key: "d7", code: "D7", title: "Prevent", desc: "Systemic changes", fields: [
    { key: "preventive", label: "Systemic / preventive actions", placeholder: "FMEA, control-plan, procedure updates to prevent recurrence…", rows: 4 },
  ] },
  { n: 8, key: "d8", code: "D8", title: "Close", desc: "Congratulate team", fields: [
    { key: "closure", label: "Closure & recognition", placeholder: "Lessons learned, team recognition, closure notes…", rows: 4 },
  ] },
];

export function disciplineFor(n: number): Discipline {
  return DISCIPLINES[n - 1] ?? DISCIPLINES[0]!;
}

/** The `.data` payload of a discipline, typed as an open record for the panels. */
export function stepData(report: EightDDto, key: string): Record<string, unknown> {
  return report.steps[key]?.data ?? {};
}

/** Short "Apr 16"-style date for the stepper's completed marks (jsx `fmtStepDate`). */
export function fmtStepDate(iso: string | null | undefined): string {
  if (iso == null || iso === "") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
 * The 8-segment progress bar the LIST uses (jsx `StepperMini`): filled green for
 * complete steps, amber for the current one, faint for the rest, with a `D{n}/8`
 * tag. `current` is the discipline in progress (1-based).
 */
export function StepperMini({ current }: { current: number }): React.ReactElement {
  return (
    <div className="flex items-center gap-[3px]">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
        <span
          key={n}
          className="h-1.5 flex-1 rounded-[3px]"
          style={{ background: n < current ? "var(--success-500)" : n === current ? "var(--warning-500)" : "var(--border)" }}
        />
      ))}
      <span className="mono ml-1.5 text-[11px] font-semibold text-muted">D{current}/8</span>
    </div>
  );
}
