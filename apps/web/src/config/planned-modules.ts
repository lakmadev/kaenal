import {
  Zap,
  Smartphone,
  Sparkles,
  Award,
  Wrench,
  MessageSquare,
  GitBranch,
  Shield,
  Grid3x3,
  BarChart3,
  Target,
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
  quicklog: { title: "Quick-Log", icon: Zap, description: "Fast mobile-first defect capture is next on the build plan." },
  mobile: { title: "Mobile App", icon: Smartphone, description: "The Expo inspector app ships alongside the web build." },
  pqe: { title: "Quality Engine", icon: Sparkles, description: "The AI-driven quality engine is next on the build plan." },
  training: { title: "Training & competency", icon: Award },
  calibration: { title: "Calibration", icon: Wrench },
  complaints: { title: "Customer complaints", icon: MessageSquare },
  ecn: { title: "Engineering changes", icon: GitBranch },
  risk: { title: "Risk register", icon: Shield },
  fmea: { title: "FMEA workbench", icon: Grid3x3 },
  spc: { title: "SPC charts", icon: BarChart3 },
  msa: { title: "MSA / Gauge R&R", icon: Target },
  "ai-governance": { title: "AI Governance", icon: Sparkles },
  developer: { title: "Developer Platform", icon: Code },
  "multi-tenancy": { title: "Multi-tenancy", icon: Building2 },
  pricing: { title: "Plans & add-ons", icon: Package },
  "pdf-templates": { title: "PDF Templates", icon: PenTool },
};
