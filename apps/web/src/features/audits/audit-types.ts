import { ShieldCheck, Truck, Building2, Target, ClipboardCheck } from "lucide-react";
import type { AuditType } from "@kaenal/types";

/**
 * `AUDIT_TYPES` style map (`audits.jsx:4-10`). These hex values have no
 * equivalent in `tokens.css` (only `certification`'s orange and `gap`'s slate
 * do — `--slate-600`, per the designer's addendum, DESIGN-02-audits.md §7), so
 * they are ported as literal constants the same way `capa-list.tsx` and
 * `templates-view.tsx` already do for their own jsx-sourced KPI colours — not a
 * new pattern.
 */
export const AUDIT_TYPE_STYLES: Readonly<Record<AuditType, { label: string; color: string; bg: string; icon: typeof ShieldCheck }>> = {
  internal: { label: "Internal", color: "#2563eb", bg: "rgba(37,99,235,0.10)", icon: ClipboardCheck },
  supplier: { label: "Supplier", color: "#0891b2", bg: "rgba(8,145,178,0.10)", icon: Truck },
  customer: { label: "Customer", color: "#9333ea", bg: "rgba(147,51,234,0.10)", icon: Building2 },
  certification: { label: "Certification", color: "#ea580c", bg: "rgba(234,88,12,0.10)", icon: ShieldCheck },
  gap: { label: "Gap Analysis", color: "#475569", bg: "rgba(71,85,105,0.10)", icon: Target },
};
