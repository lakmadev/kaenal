import { NAV, ROUTE_LABELS, isDivider } from "./navigation";

/** One top-bar crumb. No `href` = not clickable (current page or a group label). */
export interface Crumb {
  label: string;
  href?: string;
}

/** Non-clickable group crumb shown before a module (Kaenal.html `BREADCRUMBS`). */
const GROUP_BY_ROOT: Record<string, string> = {
  graph: "Intelligence",
  predictive: "Intelligence",
  suppliers: "Supply chain",
  ppap: "Supply chain",
  scars: "Supply chain",
  training: "Quality system",
  calibration: "Quality system",
  complaints: "Quality system",
  ecn: "Quality system",
  risk: "Quality system",
  fmea: "Quality system",
  spc: "Quality system",
  msa: "Quality system",
  "ai-governance": "Platform",
  developer: "Platform",
  "multi-tenancy": "Platform",
  pricing: "Platform",
};

/** Where the design's crumb label differs from the sidebar label. */
const LABEL_OVERRIDE: Record<string, string> = { fmea: "FMEA" };

function titleCase(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ");
}

/** Sidebar child label for `/root?view=<view>` (e.g. "My Assignments"), if any. */
function viewLabel(root: string, view: string): string | undefined {
  for (const entry of NAV) {
    if (isDivider(entry) || entry.children === undefined) continue;
    for (const child of entry.children) {
      if (child.href === `/${root}?view=${view}`) return child.label;
    }
  }
  return undefined;
}

/**
 * Page-driven breadcrumbs from the route (shell.jsx `TopBar` breadcrumbs):
 * parents are links, the last crumb is the current page. Pure; unit-tested.
 */
export function breadcrumbsFor(pathname: string, view: string | null): Crumb[] {
  const segs = pathname.split("/").filter(Boolean);
  const root = segs[0] ?? "dashboard";
  const label = LABEL_OVERRIDE[root] ?? ROUTE_LABELS[root] ?? titleCase(root);
  const group = GROUP_BY_ROOT[root];
  const lead: Crumb[] = group !== undefined ? [{ label: group }] : [];
  const rootHref = `/${root}`;

  if (root === "settings") return [{ label: "Settings" }];

  if (segs.length === 1) {
    const sub = view !== null ? viewLabel(root, view) : undefined;
    if (sub === undefined) return [...lead, { label }];
    return [...lead, { label, href: rootHref }, { label: sub }];
  }

  const sub = segs[1] ?? "";
  if (root === "inspections" && sub === "templates") {
    if (segs.length === 2)
      return [{ label, href: rootHref }, { label: "Templates" }];
    return [
      { label, href: rootHref },
      { label: "Templates", href: "/inspections/templates" },
      { label: "Editor" },
    ];
  }
  if (root === "inspections" && sub === "schedule")
    return [{ label, href: rootHref }, { label: "Schedule" }];
  return [...lead, { label, href: rootHref }, { label: "Detail" }];
}
