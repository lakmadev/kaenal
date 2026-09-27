import { ClipboardCheck, TriangleAlert, Brain, FileText, ClipboardList, type LucideIcon } from "lucide-react";

/**
 * Things a user can create from anywhere (palette quick actions, ⌘I / ⌘D).
 * `capability` is the same one the API enforces on the create endpoint, so a row
 * the user cannot use is never shown. Inspection / NCR / 8D / document open the
 * full-page create wizard (`/create/[type]`); CAPA keeps its dialog on `/capa`.
 */
export interface QuickCreateTarget {
  id: "inspection" | "ncr" | "8d" | "document" | "capa";
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
];

export function quickCreateTarget(id: QuickCreateTarget["id"]): QuickCreateTarget | undefined {
  return QUICK_CREATE.find((t) => t.id === id);
}
