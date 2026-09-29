import {
  Sparkles,
  MessageSquare,
  GitBranch,
  Code,
  Building2,
  Package,
  PenTool,
  type LucideIcon,
} from "lucide-react";

/**
 * Modules that appear in the sidebar (design rule #9 — the full `shell.jsx` nav)
 * but whose screens aren't built yet. The `[...slug]` catch-all renders a
 * `ModulePlaceholder` for these so navigation is complete and nothing 404s; each
 * gets its real list/detail slice on the build plan later. A slug that isn't here
 * (a genuine typo) still 404s.
 */
export interface PlannedModule {
  title: string;
  icon: LucideIcon;
  description?: string;
}

export const PLANNED_MODULES: Record<string, PlannedModule> = {
  // Quick-Log, Mobile App and Quality Engine (pqe) are intentionally excluded — see config/excluded.md.
  // training/calibration are built — see app/(app)/training, app/(app)/calibration (Sprint 05). Not placeholders.
  complaints: { title: "Customer complaints", icon: MessageSquare },
  ecn: { title: "Engineering changes", icon: GitBranch },
  // fmea is built — see app/(app)/fmea (Phase F). Left out of PLANNED_MODULES so
  // the real route serves instead of the "coming soon" placeholder.
  // spc is built — see app/(app)/spc (features/spc). Not a placeholder.
  // risk is built — see app/(app)/risk (Sprint 04). Not a placeholder.
  // msa is built — see app/(app)/msa (Sprint 04). Not a placeholder.
  "ai-governance": { title: "AI Governance", icon: Sparkles },
  developer: { title: "Developer Platform", icon: Code },
  "multi-tenancy": { title: "Multi-tenancy", icon: Building2 },
  pricing: { title: "Plans & add-ons", icon: Package },
  "pdf-templates": { title: "PDF Templates", icon: PenTool },
};
