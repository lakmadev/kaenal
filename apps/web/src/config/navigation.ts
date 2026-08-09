import {
  LayoutDashboard,
  ClipboardCheck,
  TriangleAlert,
  Brain,
  ClipboardList,
  ShieldCheck,
  FileText,
  Network,
  TrendingUp,
  Sparkles,
  Truck,
  Package,
  FileWarning,
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
  Bell,
  PenTool,
  Settings,
  type LucideIcon,
} from "lucide-react";

/**
 * The sidebar/route map — a faithful port of `shell.jsx`'s `NAV` (design rule #9).
 * The list is a flat sequence of dividers and items, exactly as the prototype:
 * an ungrouped top cluster (Dashboard → Quality Engine), then the "Supply chain",
 * "Quality system", "Platform", and "External" sections. Items carry count badges,
 * expandable sub-navigation, and capability gates (04 §6.6 — never show a control
 * that will 403).
 *
 * Modules whose screens aren't built yet still appear (per product decision): their
 * `href` points at a real route today, or at a slug served by the `[...slug]`
 * placeholder catch-all (`config/planned-modules.ts`) so nothing 404s. The
 * prototype's dev-only "Design patterns" items (Empty states / Loading skeletons)
 * are intentionally omitted — they aren't product surface.
 */
export interface NavChild {
  label: string;
  href: string;
}

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Count pill shown on the right when expanded. */
  badge?: number;
  /** Pill colour: danger = solid red, warn = solid amber, else subtle. */
  badgeAccent?: "danger" | "warn";
  capability?: string;
  children?: NavChild[];
  /** Opens outside the app shell (the supplier portal). */
  external?: boolean;
}

export interface NavDivider {
  divider: true;
  /** Section overline label. */
  label: string;
}

export type NavEntry = NavItem | NavDivider;

export function isDivider(e: NavEntry): e is NavDivider {
  return "divider" in e;
}

export const NAV: NavEntry[] = [
  // ── Top cluster (ungrouped, no section header) ──────────────────────────
  // Quick-Log and Inspections › Mobile App are intentionally excluded — see
  // apps/web/src/config/excluded.md.
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    id: "inspections",
    label: "Inspections",
    href: "/inspections",
    icon: ClipboardCheck,
    children: [
      { label: "All Inspections", href: "/inspections" },
      { label: "Templates", href: "/inspections/templates" },
      { label: "Schedule", href: "/inspections/schedule" },
    ],
  },
  {
    id: "ncrs",
    label: "Non-Conformities",
    href: "/ncrs",
    icon: TriangleAlert,
    children: [
      { label: "All NCRs", href: "/ncrs" },
      { label: "My Assignments", href: "/ncrs?view=mine" },
      { label: "Overdue", href: "/ncrs?view=overdue" },
    ],
  },
  {
    id: "8d",
    label: "8D Reports",
    href: "/8d",
    icon: Brain,
    children: [
      { label: "Active", href: "/8d" },
      { label: "Completed", href: "/8d?view=completed" },
      { label: "Templates", href: "/8d?view=templates" },
    ],
  },
  {
    id: "audits",
    label: "Audits",
    href: "/audits",
    icon: ClipboardList,
    children: [
      { label: "All Audits", href: "/audits" },
      { label: "My Audits", href: "/audits?view=mine" },
      { label: "Schedule", href: "/audits?view=schedule" },
    ],
  },
  {
    id: "capa",
    label: "CAPA",
    href: "/capa",
    icon: ShieldCheck,
    children: [
      { label: "All CAPAs", href: "/capa" },
      { label: "My CAPAs", href: "/capa?view=mine" },
      { label: "At Risk", href: "/capa?view=overdue" },
    ],
  },
  { id: "documents", label: "Documents", href: "/documents", icon: FileText },
  { id: "graph", label: "Knowledge graph", href: "/graph", icon: Network },
  { id: "predictive", label: "Predictive risk", href: "/predictive", icon: TrendingUp },
  { id: "pqe", label: "Quality Engine", href: "/pqe", icon: Sparkles },

  // ── Supply chain ────────────────────────────────────────────────────────
  { divider: true, label: "Supply chain" },
  {
    id: "suppliers",
    label: "Suppliers",
    href: "/suppliers",
    icon: Truck,
    capability: "supplier:view",
    children: [
      { label: "All suppliers", href: "/suppliers" },
      { label: "Scorecards", href: "/suppliers?view=scorecards" },
      { label: "Risk matrix", href: "/suppliers?view=risk" },
    ],
  },
  { id: "ppap", label: "PPAP submissions", href: "/ppap", icon: Package, capability: "ppap:view" },
  { id: "scars", label: "SCAR & chargebacks", href: "/scars", icon: FileWarning, capability: "scar:view" },

  // ── Quality system ──────────────────────────────────────────────────────
  { divider: true, label: "Quality system" },
  { id: "training", label: "Training & competency", href: "/training", icon: Award },
  { id: "calibration", label: "Calibration", href: "/calibration", icon: Wrench },
  { id: "complaints", label: "Customer complaints", href: "/complaints", icon: MessageSquare },
  { id: "ecn", label: "Engineering changes", href: "/ecn", icon: GitBranch },
  { id: "risk", label: "Risk register", href: "/risk", icon: Shield },
  { id: "fmea", label: "FMEA workbench", href: "/fmea", icon: Grid3x3 },
  { id: "spc", label: "SPC charts", href: "/spc", icon: BarChart3 },
  { id: "msa", label: "MSA / Gauge R&R", href: "/msa", icon: Target },

  // ── Platform ────────────────────────────────────────────────────────────
  { divider: true, label: "Platform" },
  { id: "ai-governance", label: "AI Governance", href: "/ai-governance", icon: Sparkles },
  { id: "dev-platform", label: "Developer Platform", href: "/developer", icon: Code },
  { id: "multi-tenancy", label: "Multi-tenancy", href: "/multi-tenancy", icon: Building2 },
  { id: "pricing", label: "Plans & add-ons", href: "/pricing", icon: Package },
  {
    id: "reports",
    label: "Reports",
    href: "/reports",
    icon: BarChart3,
    children: [
      { label: "My Reports", href: "/reports" },
      { label: "Dashboards", href: "/reports?view=dashboards" },
      { label: "Builder", href: "/reports?view=builder" },
    ],
  },
  { id: "notifications", label: "Notifications", href: "/notifications", icon: Bell },

  // ── External ────────────────────────────────────────────────────────────
  { divider: true, label: "External" },
  { id: "portal", label: "Supplier Portal", href: "/portal", icon: Truck, external: true },
  { id: "pdf-designer", label: "PDF Templates", href: "/pdf-templates", icon: PenTool },
];

/** Settings is pinned to the sidebar footer (not part of the scrolling nav). */
export const SETTINGS_ITEM: NavItem = {
  id: "settings",
  label: "Settings",
  href: "/settings/profile",
  icon: Settings,
};

/** Flat lookup for breadcrumbs: first path segment → label. */
export const ROUTE_LABELS: Record<string, string> = Object.fromEntries(
  NAV.filter((e): e is NavItem => !isDivider(e)).map((i) => [i.href.split("/")[1]?.split("?")[0] ?? "", i.label]),
);
