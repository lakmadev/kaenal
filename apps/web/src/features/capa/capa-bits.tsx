import { Plus, Brain, ClipboardList, Wrench, Check, ShieldCheck, Lock, User, type LucideIcon } from "lucide-react";
import type { CapaPhase, CapaType } from "@kaenal/types";
import { Chip } from "@/components/ui";

/**
 * The seven CAPA phases (02 §4), in forward order — ported from `capa.jsx`'s
 * `CAPA_PHASES` but keyed on the real `CapaPhase` enum (`root_cause`, not the
 * prototype's `rca`). Drives both the list-row progress bar and the detail
 * stepper, so the visual order always matches the server's state machine.
 */
export const CAPA_PHASES: { id: CapaPhase; label: string; icon: LucideIcon }[] = [
  { id: "initiation", label: "Initiation", icon: Plus },
  { id: "root_cause", label: "Root Cause", icon: Brain },
  { id: "action_plan", label: "Action Plan", icon: ClipboardList },
  { id: "implementation", label: "Implementation", icon: Wrench },
  { id: "verification", label: "Verification", icon: Check },
  { id: "effectiveness", label: "Effectiveness", icon: ShieldCheck },
  { id: "closed", label: "Closed", icon: Lock },
];

export function phaseIndex(phase: CapaPhase): number {
  return CAPA_PHASES.findIndex((p) => p.id === phase);
}

/** Corrective/preventive chip — the exact semantic colours from `capa.jsx`. */
export function TypeChip({ type }: { type: CapaType }): React.ReactElement {
  return type === "corrective" ? (
    <Chip bg="rgba(220,38,38,0.10)" fg="#b91c1c">
      Corrective
    </Chip>
  ) : (
    <Chip bg="rgba(37,99,235,0.10)" fg="#1d4ed8">
      Preventive
    </Chip>
  );
}

/** The compact per-row phase progress bar (list view): one segment per phase
 *  up to `closed`, filled to the current phase. */
export function PhaseProgress({ phase }: { phase: CapaPhase }): React.ReactElement {
  const idx = phaseIndex(phase);
  return (
    <div className="mt-1 flex gap-0.5">
      {CAPA_PHASES.slice(0, -1).map((p, i) => (
        <div
          key={p.id}
          className="h-[3px] flex-1 rounded-[1.5px]"
          style={{ background: i <= idx ? "var(--accent)" : "var(--border)" }}
        />
      ))}
    </div>
  );
}

/**
 * The full horizontal phase stepper (detail view) — a filled ink node for each
 * done/current phase (a check once passed), connectors that fill up to the
 * current phase, and the label bold on the current step. Faithful to `capa.jsx`.
 */
export function PhaseTracker({ phase }: { phase: CapaPhase }): React.ReactElement {
  const idx = phaseIndex(phase);
  return (
    <div className="flex gap-0">
      {CAPA_PHASES.map((p, i) => {
        const done = i < idx;
        const current = i === idx;
        const active = done || current;
        const Icon = p.icon;
        return (
          <div key={p.id} className="flex-1">
            <div className="flex items-center gap-1.5">
              <div
                className="flex shrink-0 items-center justify-center rounded-full"
                style={{
                  width: 26,
                  height: 26,
                  background: active ? "var(--accent)" : "var(--bg-subtle)",
                  color: active ? "var(--accent-fg)" : "var(--text-muted)",
                  border: `2px solid ${active ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                {done ? <Check size={12} /> : <Icon size={12} />}
              </div>
              {i < CAPA_PHASES.length - 1 && (
                <div className="h-0.5 flex-1" style={{ background: i < idx ? "var(--accent)" : "var(--border)" }} />
              )}
            </div>
            <div
              className="mt-1.5 text-[11px]"
              style={{
                fontWeight: current ? 600 : 500,
                color: current ? "var(--text)" : "var(--text-muted)",
              }}
            >
              {p.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Owner display. The API exposes only `ownerId` (no members endpoint yet), so we
 * show "You" for the current user, "Unassigned" for null, and a neutral member
 * chip (short id) otherwise — never a fabricated name. Mirrors the NCR module.
 */
export function OwnerCell({
  ownerId,
  meId,
  unassignedLabel = "Unassigned",
}: {
  ownerId: string | null;
  meId: string | undefined;
  unassignedLabel?: string;
}): React.ReactElement {
  if (ownerId === null) return <span className="text-subtle">{unassignedLabel}</span>;
  const isMe = meId !== undefined && ownerId === meId;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px]">
      <span
        className="inline-flex items-center justify-center rounded-full"
        style={{ width: 20, height: 20, background: "var(--bg-subtle)", color: "var(--text-muted)" }}
      >
        <User size={12} />
      </span>
      {isMe ? "You" : <span className="mono text-muted">{ownerId.slice(0, 8)}</span>}
    </span>
  );
}
