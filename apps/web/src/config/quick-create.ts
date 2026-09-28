import { ClipboardCheck, TriangleAlert, Brain, FileText, ClipboardList, ShieldCheck, type LucideIcon } from "lucide-react";

/**
 * Things a user can create from anywhere (palette quick actions, ⌘I / ⌘D).
 * `capability` is the same one the API enforces on the create endpoint, so a row
 * the user cannot use is never shown. Inspection / NCR / 8D / document open the
 * full-page create wizard (`/create/[type]`); CAPA and Audit keep their own
 * dialog on their list page (`?new=1`) — neither is a `WizardType` step
 * (Sprint 02 S2-3, mirroring the CAPA precedent). Both are still deliberately
 * excluded from the shell topbar "New" menu (`components/shell/quick-create.tsx`
 * reads `creatableTypes()`, not this config) — they are per-entity dialogs, not
 * wizard flows.
 */
export interface QuickCreateTarget {
  id: "inspection" | "ncr" | "8d" | "document" | "capa" | "audit";
  labelKey: string;
  icon: LucideIcon;
  capability: string;
  href: string;
}

export const QUICK_CREATE: readonly QuickCreateTarget[] = [
  { id: "inspection", labelKey: "newInspection", icon: ClipboardCheck, capability: "inspection:perform", href: "/create/inspection" },
  { id: "ncr", labelKey: "newNcr", icon: TriangleAlert, capability: "ncr:create", href: "/create/ncr" },
  { id: "8d", labelKey: "newEightD", icon: Brain, capability: "ncr:manage", href: "/create/8d" },
  { id: "document", labelKey: "newDocument", icon: FileText, capability: "document:manage", href: "/create/document" },
  { id: "capa", labelKey: "newCapa", icon: ClipboardList, capability: "capa:manage", href: "/capa?new=1" },
  { id: "audit", labelKey: "scheduleAudit", icon: ShieldCheck, capability: "audit:manage", href: "/audits?new=1" },
];

export function quickCreateTarget(id: QuickCreateTarget["id"]): QuickCreateTarget | undefined {
  return QUICK_CREATE.find((t) => t.id === id);
}
