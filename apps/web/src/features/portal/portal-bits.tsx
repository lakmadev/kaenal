import type { PpapElementStatus, PpapStatus, ScarSeverity, ScarStatus } from "@kaenal/types";
import { Chip } from "@/components/ui";

/**
 * The portal wears a distinct TEAL accent so a supplier always knows they are in
 * the external surface, not the internal app (matches `supplier-portal.jsx`).
 * These tokens are local to the portal feature.
 */
export const TEAL = "#0d9488";
export const TEAL_DARK = "#0f766e";
export const TEAL_SOFT = "#ccfbf1";

const SCAR_STATUS: Record<ScarStatus, { label: string; bg: string; fg: string }> = {
  draft: { label: "Draft", bg: "rgba(100,116,139,0.16)", fg: "#475569" },
  open: { label: "Action needed", bg: "rgba(245,158,11,0.14)", fg: "#b45309" },
  responded: { label: "Awaiting QA", bg: "rgba(59,130,246,0.12)", fg: "#1d4ed8" },
  closed: { label: "Closed", bg: TEAL_SOFT, fg: TEAL_DARK },
  rejected: { label: "Rejected", bg: "rgba(220,38,38,0.12)", fg: "#b91c1c" },
  cancelled: { label: "Cancelled", bg: "var(--bg-subtle)", fg: "var(--text-muted)" },
};

export function PortalScarStatus({ status }: { status: ScarStatus }): React.ReactElement {
  const s = SCAR_STATUS[status];
  return (
    <Chip bg={s.bg} fg={s.fg} style={{ fontWeight: 600 }}>
      {s.label}
    </Chip>
  );
}

const SEVERITY: Record<ScarSeverity, { bg: string; fg: string }> = {
  critical: { bg: "rgba(220,38,38,0.10)", fg: "#b91c1c" },
  major: { bg: "rgba(234,88,12,0.10)", fg: "#9a3412" },
  minor: { bg: "rgba(245,158,11,0.12)", fg: "#92400e" },
};

export function PortalSeverity({ severity }: { severity: ScarSeverity }): React.ReactElement {
  const s = SEVERITY[severity];
  return (
    <Chip bg={s.bg} fg={s.fg} style={{ textTransform: "capitalize" }}>
      {severity}
    </Chip>
  );
}

const PPAP_STATUS: Record<PpapStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: "Pending", bg: "rgba(100,116,139,0.16)", fg: "#475569" },
  in_review: { label: "In review", bg: "rgba(245,158,11,0.14)", fg: "#b45309" },
  interim: { label: "Interim", bg: "rgba(59,130,246,0.12)", fg: "#1d4ed8" },
  approved: { label: "Approved", bg: TEAL_SOFT, fg: TEAL_DARK },
  rejected: { label: "Rejected", bg: "rgba(220,38,38,0.12)", fg: "#b91c1c" },
};

export function PortalPpapStatus({ status }: { status: PpapStatus }): React.ReactElement {
  const s = PPAP_STATUS[status];
  return (
    <Chip bg={s.bg} fg={s.fg} style={{ fontWeight: 600 }}>
      {s.label}
    </Chip>
  );
}

const ELEMENT: Record<PpapElementStatus, { label: string; bg: string; fg: string }> = {
  approved: { label: "Approved", bg: TEAL_SOFT, fg: TEAL_DARK },
  pending: { label: "Pending", bg: "rgba(100,116,139,0.16)", fg: "#475569" },
  changes_requested: { label: "Changes requested", bg: "rgba(234,88,12,0.12)", fg: "#9a3412" },
  n_a: { label: "N/A", bg: "var(--bg-subtle)", fg: "var(--text-muted)" },
};

export function PortalElementBadge({ status }: { status: PpapElementStatus }): React.ReactElement {
  const s = ELEMENT[status];
  return (
    <Chip bg={s.bg} fg={s.fg}>
      {s.label}
    </Chip>
  );
}

// The 8D stepper + stage label are visual-neutral (green/amber), so the portal
// reuses the SCAR feature's implementation rather than duplicating it.
export { DSteps, stageLabel } from "@/features/scar/scar-bits";
