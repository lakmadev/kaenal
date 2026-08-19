import type { TabItem } from "@/ui";

// Mobile RBAC — presentation curation only. The server enforces the real
// capability on every request (see packages/core/rbac.ts); this just decides what
// the UI offers, mirroring the web client. There is no client-side role switcher —
// role + capabilities come from the authenticated session (`GET /v1/me`).

/** Internal roles that use the mobile app. "partner" (supplier) is web-only. */
export type MobileRole = "admin" | "manager" | "auditor" | "inspector" | "viewer";

/** True if the resolved capability set (from /v1/me) includes `cap`. */
export function can(capabilities: readonly string[], cap: string): boolean {
  return capabilities.includes(cap);
}

/** Whether a role is a known mobile role (partner/unknown → treated as viewer). */
export function toMobileRole(role: string): MobileRole {
  switch (role) {
    case "admin":
    case "manager":
    case "auditor":
    case "inspector":
    case "viewer":
      return role;
    default:
      return "viewer";
  }
}

// Bottom-tab sets per role, straight from the design (project_brain/mobile/src/m-home.jsx).
// The center FAB (capture/raise) is present only for roles that can create.
const TAB_SETS: Record<MobileRole, TabItem[]> = {
  inspector: [
    { id: "home", icon: "home", label: "Home" },
    { id: "tasks", icon: "clipboard", label: "Tasks" },
    { id: "capture", fab: true },
    { id: "ncr", icon: "alert", label: "NCRs" },
    { id: "me", icon: "user", label: "Me" },
  ],
  viewer: [
    { id: "home", icon: "home", label: "Home" },
    { id: "records", icon: "folder", label: "Records" },
    { id: "alerts", icon: "bell", label: "Alerts" },
    { id: "me", icon: "user", label: "Me" },
  ],
  auditor: [
    { id: "home", icon: "home", label: "Home" },
    { id: "tasks", icon: "clipboard", label: "Review" },
    { id: "ncr", icon: "alert", label: "NCRs" },
    { id: "me", icon: "user", label: "Me" },
  ],
  manager: [
    { id: "home", icon: "home", label: "Home" },
    { id: "approvals", icon: "check", label: "Approvals" },
    { id: "capture", fab: true },
    { id: "team", icon: "users", label: "Team" },
    { id: "me", icon: "user", label: "Me" },
  ],
  admin: [
    { id: "home", icon: "home", label: "Pulse" },
    { id: "approvals", icon: "check", label: "Approvals" },
    { id: "capture", fab: true },
    { id: "audit", icon: "shield", label: "Audit" },
    { id: "me", icon: "user", label: "Me" },
  ],
};

export function tabsForRole(role: MobileRole): TabItem[] {
  return TAB_SETS[role];
}
