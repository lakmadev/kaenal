import {
  LayoutDashboard,
  ClipboardCheck,
  TriangleAlert,
  GitBranch,
  ShieldCheck,
  FileText,
  FileCheck,
  Truck,
  Network,
  LineChart,
  BarChart3,
  Bell,
  Settings,
  type LucideIcon,
} from "lucide-react";

/**
 * The sidebar/route map (04 §3–4), matching `shell.jsx`: grouped items, some with
 * expandable sub-navigation. Sub-items are only listed when their target route
 * actually exists — a nav link that leads nowhere is worse than no link. As each
 * module is built, its sub-nav fills in.
 *
 * `capability` gates visibility (04 §6.6 — never show a control that will 403).
 */
export interface NavChild {
  label: string;
  href: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  capability?: string;
  children?: NavChild[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Core",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      {
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
        label: "Non-Conformities",
        href: "/ncrs",
        icon: TriangleAlert,
        children: [
          { label: "All NCRs", href: "/ncrs" },
          { label: "My Assignments", href: "/ncrs?view=mine" },
          { label: "Overdue", href: "/ncrs?view=overdue" },
        ],
      },
      { label: "8D", href: "/8d", icon: GitBranch },
      { label: "CAPA", href: "/capa", icon: ShieldCheck },
    ],
  },
  {
    label: "Quality system",
    items: [
      { label: "Audits", href: "/audits", icon: ShieldCheck },
      { label: "Documents", href: "/documents", icon: FileText },
      { label: "Reports", href: "/reports", icon: BarChart3 },
    ],
  },
  {
    label: "Supply chain",
    items: [
      { label: "Suppliers", href: "/suppliers", icon: Truck, capability: "supplier:view" },
      { label: "PPAP", href: "/ppap", icon: FileCheck, capability: "ppap:view" },
    ],
  },
  {
    label: "Platform",
    items: [
      { label: "Knowledge graph", href: "/graph", icon: Network, capability: "graph:read" },
      { label: "Predictive risk", href: "/predictive", icon: LineChart, capability: "analytics:read" },
      { label: "Notifications", href: "/notifications", icon: Bell },
      { label: "Settings", href: "/settings/personal", icon: Settings },
    ],
  },
];

/** Flat lookup for breadcrumbs: first path segment → label. */
export const ROUTE_LABELS: Record<string, string> = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.items).map((i) => [i.href.split("/")[1] ?? "", i.label]),
);
