import type { MeDto } from "@kaenal/types";

import type { MobileRole } from "@/config/rbac";

// DEV ONLY. A stand-in for the real GET /v1/me response so the app shell is
// navigable before the auth flow exists (M4). Deleted / replaced by real sign-in
// in M4 — never ships in a release build. Capabilities here are a representative
// subset per role, not the authoritative matrix (that's server-side in
// packages/core/rbac.ts and enforced on every request).
const CAPS: Record<MobileRole, string[]> = {
  inspector: ["inspection:view", "inspection:perform", "ncr:view", "ncr:create", "capa:view"],
  viewer: ["inspection:view", "ncr:view", "capa:view", "document:view"],
  auditor: ["inspection:view", "ncr:view", "ncr:verify", "audit:view", "capa:view", "document:view"],
  manager: [
    "inspection:view",
    "inspection:perform",
    "ncr:view",
    "ncr:create",
    "ncr:manage",
    "capa:view",
    "capa:manage",
    "document:approve",
  ],
  admin: [
    "inspection:view",
    "ncr:view",
    "ncr:manage",
    "capa:manage",
    "document:approve",
    "auditlog:read",
    "settings:manage",
    "members:manage",
  ],
};

const NAMES: Record<MobileRole, string> = {
  inspector: "Sara Chen",
  viewer: "Devon Park",
  auditor: "Amara Osei",
  manager: "Marcus Reyes",
  admin: "Priya Iyer",
};

export function makeMockMe(role: MobileRole): MeDto {
  return {
    userId: "00000000-0000-7000-8000-000000000001",
    tenantSlug: "acme",
    tenantName: "Northstar Mfg",
    role,
    capabilities: CAPS[role],
    name: NAMES[role],
    email: `${NAMES[role].split(" ")[0]?.toLowerCase()}@northstar.test`,
    mfaEnabled: true,
    lastLoginAt: new Date().toISOString(),
    plants: [],
    openNcrs: 3,
    openCapas: 2,
  };
}
