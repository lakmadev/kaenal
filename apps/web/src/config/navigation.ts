import {
  LayoutDashboard,
  ClipboardCheck,
  TriangleAlert,
  GitBranch,
  ShieldCheck,
  FileText,
  Truck,
  Network,
  LineChart,
  BarChart3,
  Bell,
  Settings,
  type LucideIcon,
} from "lucide-react";

/**
 * The sidebar/route map (04 §3–4). Grouped exactly as the visual spec's shell.
 * `capability` gates visibility: an item whose capability the user lacks is not
 * rendered (04 §6.6 — never show a control that will 403). Items with no
 * capability are visible to every member.
 */
export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Capability required to see this item (from `GET /v1/me`). */
  capability?: string;
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
      { label: "Inspections", href: "/inspections", icon: ClipboardCheck },
      { label: "NCRs", href: "/ncrs", icon: TriangleAlert },
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
    items: [{ label: "Suppliers", href: "/suppliers", icon: Truck, capability: "suppliers:read" }],
  },
  {
    label: "Platform",
    items: [
      { label: "Graph", href: "/graph", icon: Network, capability: "graph:read" },
      { label: "Predictive", href: "/predictive", icon: LineChart, capability: "analytics:read" },
      { label: "Notifications", href: "/notifications", icon: Bell },
      { label: "Settings", href: "/settings/personal", icon: Settings },
    ],
  },
];

/** Flat lookup for breadcrumbs: first path segment → label. */
export const ROUTE_LABELS: Record<string, string> = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.items).map((i) => [i.href.split("/")[1] ?? "", i.label]),
);
