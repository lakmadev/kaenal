/**
 * Role capabilities (03 §3).
 *
 * This lives in core, not in the API guard, because three places need the same
 * answer and they must never disagree: the API guard (enforcement), `GET
 * /v1/me` (which tells the UI what to render), and the web/mobile clients
 * (which hide what the role can't do). A UI that shows a button the guard will
 * reject is a bug report; a UI that hides a button the guard would have
 * allowed is a support ticket. One table, three consumers.
 *
 * Enforcement still happens server-side. The capability list handed to a
 * client is a rendering hint, never a security decision.
 */

import type { Role } from "@kaenal/types";
import { allow, deny, type Decision } from "./result.js";

export const CAPABILITIES = [
  "inspection:view",
  "inspection:perform",
  "ncr:view",
  "ncr:create",
  "ncr:manage",
  "ncr:verify",
  "capa:view",
  "capa:manage",
  "audit:view",
  "audit:manage",
  "document:view",
  "document:manage",
  "document:approve",
  "settings:manage",
  "members:manage",
  "apikeys:manage",
  "billing:manage",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/**
 * Direct transcription of the 03 §3 matrix. Deliberately written out per role
 * rather than derived by role hierarchy: `auditor` can verify an NCR but
 * cannot assign or close one, so the roles are not a strict ordering and any
 * "manager includes auditor" shorthand would quietly grant the wrong thing.
 */
const ROLE_CAPABILITIES: Readonly<Record<Role, readonly Capability[]>> = {
  admin: [...CAPABILITIES],

  manager: [
    "inspection:view",
    "inspection:perform",
    "ncr:view",
    "ncr:create",
    "ncr:manage",
    "ncr:verify",
    "capa:view",
    "capa:manage",
    "audit:view",
    "audit:manage",
    "document:view",
    "document:manage",
    "document:approve",
    "settings:manage",
  ],

  auditor: [
    "inspection:view",
    "inspection:perform",
    "ncr:view",
    "ncr:create",
    "ncr:verify",
    "capa:view",
    "audit:view",
    "audit:manage",
    "document:view",
  ],

  inspector: [
    "inspection:view",
    "inspection:perform",
    "ncr:view",
    "ncr:create",
    "capa:view",
    "audit:view",
    "document:view",
  ],

  viewer: ["inspection:view", "ncr:view", "capa:view", "audit:view", "document:view"],
};

export function capabilitiesFor(role: Role): readonly Capability[] {
  return ROLE_CAPABILITIES[role];
}

export function hasCapability(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability);
}

/**
 * Roles whose visibility is limited to their own work and assigned plants
 * (03 §3, "Additional scoping"). Returned as data so the query layer applies
 * `WHERE plant_id = ANY(...)` rather than each handler remembering to.
 */
const PLANT_SCOPED_ROLES: ReadonlySet<Role> = new Set<Role>(["inspector", "viewer"]);

export function isPlantScoped(role: Role): boolean {
  return PLANT_SCOPED_ROLES.has(role);
}

export interface Membership {
  readonly role: Role;
  /** Empty array = no restriction (03 §3: scoping applies "when set"). */
  readonly plantIds: readonly string[];
}

/**
 * The guard's question, answered as a `Decision` so the denial carries the
 * missing capability name — 03 §3 requires the 403 to say which one.
 */
export function authorize(membership: Membership, capability: Capability): Decision {
  if (!hasCapability(membership.role, capability)) {
    return deny("FORBIDDEN", `Role '${membership.role}' lacks capability '${capability}'`, {
      required: capability,
      role: membership.role,
    });
  }
  return allow();
}

/**
 * Plant-level scoping for a specific record.
 *
 * Returns NOT_FOUND, not FORBIDDEN: an inspector asking about a plant they are
 * not assigned to must not learn that the plant exists. Same reasoning as the
 * cross-tenant 404 in rule 8, one level down.
 */
export function authorizePlant(membership: Membership, plantId: string | null): Decision {
  if (!isPlantScoped(membership.role)) return allow();
  if (membership.plantIds.length === 0) return allow();
  if (plantId !== null && membership.plantIds.includes(plantId)) return allow();
  return deny("NOT_FOUND", "Resource not found");
}

/**
 * Four-eyes rule (03 §3, 02 §4): a manager may verify an NCR, but not one they
 * resolved themselves. Admins are exempt per the matrix — the check that
 * matters is enforced in the DB by `ncrs_four_eyes_ck` as well, because a rule
 * an auditor asks about should not live only in application code.
 */
export function authorizeVerify(
  membership: Membership,
  actorId: string,
  resolvedByUserId: string | null,
): Decision {
  const base = authorize(membership, "ncr:verify");
  if (!base.ok) return base;

  if (membership.role === "manager" && resolvedByUserId !== null && resolvedByUserId === actorId) {
    return deny("FORBIDDEN", "The person who resolved an NCR cannot also verify it", {
      required: "ncr:verify",
      rule: "four_eyes",
    });
  }
  return allow();
}
