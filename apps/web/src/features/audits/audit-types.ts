import { ClipboardCheck, Truck, Building2, ShieldCheck, Target, type LucideIcon } from "lucide-react";
import type { AuditType, AuditPhase } from "@kaenal/types";

export interface AuditTypeMeta {
  label: string;
  color: string;
  bg: string;
  icon: LucideIcon;
}

/**
 * `audits.jsx` `AUDIT_TYPES` (lines 4-10) — the literal palette, reproduced
 * locally per `design-rules.md` ("a semantic accent the token system doesn't
 * cover" carve-out; same precedent as `capa-list.tsx`'s KPI colours). `gap`'s
 * `#475569` is exactly `tokens.css`'s `--slate-600` (DESIGN-02-audits.md §7
 * addendum) — no new colour introduced for the 5th frequency-chart series.
 * Icons: `ClipboardCheck`/`Truck`/`Building2`/`ShieldCheck`/`Target` mirror the
 * jsx's `audit`/`truck`/`building`/`shieldCheck`/`target` glyph names 1:1
 * (distinct from `entityIcon("audit")` = `ShieldCheck`, DESIGN-02-audits.md §2.5
 * — these are the per-type chip icons inside the module, not the entity glyph).
 */
export const AUDIT_TYPES: Record<AuditType, AuditTypeMeta> = {
  internal: { label: "Internal", color: "#2563eb", bg: "rgba(37,99,235,0.10)", icon: ClipboardCheck },
  supplier: { label: "Supplier", color: "#0891b2", bg: "rgba(8,145,178,0.10)", icon: Truck },
  customer: { label: "Customer", color: "#9333ea", bg: "rgba(147,51,234,0.10)", icon: Building2 },
  certification: { label: "Certification", color: "#ea580c", bg: "rgba(234,88,12,0.10)", icon: ShieldCheck },
  gap: { label: "Gap Analysis", color: "#475569", bg: "rgba(71,85,105,0.10)", icon: Target },
};

/** `audits.jsx` `PHASE_ORDER`/`PHASE_LABELS` (lines 12-13). `AuditDto.status`
 *  IS the phase (packages/types enums.ts `AuditPhase`) — there is no separate
 *  lifecycle status in the built schema. */
export const PHASE_ORDER: readonly AuditPhase[] = ["planned", "preparation", "fieldwork", "reporting", "closed"];

export const PHASE_LABELS: Record<AuditPhase, string> = {
  planned: "Planned",
  preparation: "Preparation",
  fieldwork: "Fieldwork",
  reporting: "Reporting",
  closed: "Closed",
};

/** Maps the audit's phase to the shared `StatusBadge` vocabulary, mirroring
 *  `audits.jsx` line 134 (`in_progress` / `scheduled` / the phase itself for
 *  `closed`, which `StatusBadge`'s `STATUS_STYLES` already understands). */
export function auditStatusBadgeValue(phase: AuditPhase): string {
  if (phase === "closed") return "closed";
  if (phase === "planned") return "scheduled";
  return "in_progress";
}
