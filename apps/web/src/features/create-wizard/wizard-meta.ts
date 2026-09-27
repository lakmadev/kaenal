import { ClipboardCheck, TriangleAlert, Brain, FileText, type LucideIcon } from "lucide-react";
import type { WizardType } from "@kaenal/core";

/**
 * Visual-only per-type metadata (icon + tint) — createwizard.jsx `ENTITY_TYPES`
 * `icon`/`color`. Everything behavioural (label, templates, capability) comes
 * from `@kaenal/core`'s `WIZARD_TYPES`; this file is purely presentation.
 */
export const WIZARD_ICON: Record<WizardType, LucideIcon> = {
  inspection: ClipboardCheck,
  ncr: TriangleAlert,
  "8d": Brain,
  document: FileText,
};

export const WIZARD_COLOR: Record<WizardType, string> = {
  inspection: "#2563eb",
  ncr: "#ea580c",
  "8d": "#6366f1",
  document: "#0d9488",
};
