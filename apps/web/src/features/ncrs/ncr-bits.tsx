import type { SlaState } from "@kaenal/types";

const SLA: Record<SlaState, { label: string; color: string }> = {
  on_track: { label: "On track", color: "var(--success-600)" },
  at_risk: { label: "At risk", color: "var(--warning-600)" },
  breached: { label: "Breach", color: "var(--danger-600)" },
};

/** SLA chip: a coloured dot + text (colour is never the only signal — 04 §8). */
export function SlaIndicator({ state }: { state: SlaState }): React.ReactElement {
  const s = SLA[state];
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: s.color }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
      {s.label}
    </span>
  );
}
// Owner display now uses the shared <MemberCell> (real names via /v1/members).
