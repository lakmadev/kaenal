import {
  LayoutDashboard,
  ClipboardCheck,
  TriangleAlert,
  Brain,
  ClipboardList,
  FileText,
  Truck,
  BarChart3,
  Bell,
  Settings,
  type LucideIcon,
} from "lucide-react";

interface NavTarget {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  href: string;
}

/** Navigation targets. Every href is a real route or a planned-module slug; the
 *  test in `test/palette.test.ts` asserts each one resolves. Grows with each sprint. */
export const NAV_TARGETS: readonly NavTarget[] = [
  { id: "nav-dashboard", labelKey: "navDashboard", icon: LayoutDashboard, href: "/dashboard" },
  { id: "nav-inspections", labelKey: "navInspections", icon: ClipboardCheck, href: "/inspections" },
  { id: "nav-ncrs", labelKey: "navNcrs", icon: TriangleAlert, href: "/ncrs" },
  { id: "nav-8d", labelKey: "nav8d", icon: Brain, href: "/8d" },
  { id: "nav-capa", labelKey: "navCapa", icon: ClipboardList, href: "/capa" },
  { id: "nav-documents", labelKey: "navDocuments", icon: FileText, href: "/documents" },
  { id: "nav-suppliers", labelKey: "navSuppliers", icon: Truck, href: "/suppliers" },
  { id: "nav-reports", labelKey: "navReports", icon: BarChart3, href: "/reports" },
  { id: "nav-notifications", labelKey: "navNotifications", icon: Bell, href: "/notifications" },
  { id: "nav-settings", labelKey: "navSettings", icon: Settings, href: "/settings/profile" },
];
