import { User } from "lucide-react";
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

/**
 * Owner display. The API exposes only `ownerId` (no members endpoint yet), so we
 * show "You" for the current user, "Unassigned" for null, and a neutral member
 * chip (short id) otherwise — never a fabricated name.
 */
export function OwnerCell({
  ownerId,
  meId,
}: {
  ownerId: string | null;
  meId: string | undefined;
}): React.ReactElement {
  if (ownerId === null) return <span className="text-subtle">Unassigned</span>;
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
