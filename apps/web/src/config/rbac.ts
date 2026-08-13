import { NAV, isDivider } from "./navigation";

/**
 * Role-based UI curation — a faithful port of the design's `src/rbac.jsx`
 * `visibleNav` (RBAC handoff). This decides which modules the shell *surfaces*
 * for each role so every role gets a focused surface instead of the full
 * 30-module map.
 *
 * It is NOT the security boundary: the API re-checks the real capability on
 * every request and 403s hidden routes (07 / `@RequireCapability` / `@Internal`).
 * The role always comes from the authenticated session (`GET /me`) — there is no
 * client role switcher, so what the UI shows can never diverge from what the
 * server allows into a privilege escalation.
 */

// Platform/admin-only modules — hidden below admin. Managers get
// "all-minus-platform"; narrower roles get an explicit allow-list.
const PLATFORM_ROOTS: ReadonlySet<string> = new Set([
  "ai-governance",
  "dev-platform",
  "multi-tenancy",
  "pricing",
  "pdf-designer",
]);

type NavVisibility = "all" | "all-minus-platform" | ReadonlySet<string>;

/** Per-role visible root nav ids (ids match `config/navigation.ts`). */
const ROLE_NAV: Record<string, NavVisibility> = {
  admin: "all",
  manager: "all-minus-platform",
  auditor: new Set([
    "dashboard",
    "inspections",
    "ncrs",
    "8d",
    "audits",
    "capa",
    "documents",
    "graph",
    "predictive",
    "reports",
    "notifications",
  ]),
  inspector: new Set(["dashboard", "inspections", "ncrs", "documents", "notifications"]),
  viewer: new Set(["dashboard", "documents", "reports", "notifications"]),
  partner: new Set<string>(), // external — routed to /portal, never this shell
};

/** Does this role's UI surface the given sidebar module? */
export function roleSeesNavRoot(role: string | undefined, id: string): boolean {
  const v = role !== undefined ? ROLE_NAV[role] : undefined;
  if (v === undefined) return false;
  if (v === "all") return true;
  if (v === "all-minus-platform") return !PLATFORM_ROOTS.has(id);
  return v.has(id);
}

// First path segment → nav root id (covers ids whose href differs, e.g.
// dev-platform → /developer, pdf-designer → /pdf-templates).
const SEGMENT_TO_ID: Record<string, string> = {};
for (const e of NAV) {
  if (isDivider(e)) continue;
  const seg = e.href.split("/")[1]?.split("?")[0] ?? "";
  if (seg !== "") SEGMENT_TO_ID[seg] = e.id;
}

// Always reachable regardless of role-nav curation (settings hosts Personal
// sections for everyone; dashboard is every role's home).
const ALWAYS_ROUTES: ReadonlySet<string> = new Set(["", "dashboard", "settings"]);

/** Route guard: may this role open `pathname`? Unknown non-module routes pass. */
export function roleSeesRoute(role: string | undefined, pathname: string): boolean {
  const seg = pathname.split("/")[1]?.split("?")[0] ?? "";
  if (ALWAYS_ROUTES.has(seg)) return true;
  const id = SEGMENT_TO_ID[seg];
  if (id === undefined) return true; // not a known module root → don't block
  return roleSeesNavRoot(role, id);
}

/**
 * The design's `settingsFull` — only an admin sees the Workspace / Security &
 * Identity / Compliance / Platform / Process / Developer settings groups; the
 * Personal group is visible to everyone.
 */
export function settingsFull(role: string | undefined): boolean {
  return role === "admin";
}
