import { describe, expect, it } from "vitest";
import { Role } from "@kaenal/types";
import {
  authorize,
  authorizePlant,
  authorizeSupplier,
  authorizeVerify,
  CAPABILITIES,
  capabilitiesFor,
  hasCapability,
  isPartner,
  isPlantScoped,
  type Capability,
} from "../src/rbac.js";

/**
 * RBAC matrix tests (03 §3).
 *
 * The full (role × capability) grid is asserted explicitly rather than spot-
 * checked. A permission matrix is exactly the kind of table where a
 * copy-paste slip grants `settings:manage` to `viewer` and no happy-path test
 * ever notices, so every cell is pinned — including, especially, the denials.
 */

const ROLES = Role.values;

/** The 03 §3 table, transcribed independently of the implementation. */
const EXPECTED: Record<string, readonly Capability[]> = {
  admin: [
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
    "supplier:view",
    "supplier:manage",
    "ppap:view",
    "ppap:manage",
    "scar:view",
    "scar:manage",
    "fmea:view",
    "fmea:manage",
    "spc:view",
    "measurement:manage",
    "report:view",
    "report:manage",
    "integration:manage",
    "import:run",
    "settings:manage",
    "members:manage",
    "apikeys:manage",
    "billing:manage",
    "portal:view",
    "portal:respond",
  ],
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
    "supplier:view",
    "supplier:manage",
    "ppap:view",
    "ppap:manage",
    "scar:view",
    "scar:manage",
    "fmea:view",
    "fmea:manage",
    "spc:view",
    "measurement:manage",
    "report:view",
    "report:manage",
    "import:run",
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
    "supplier:view",
    "ppap:view",
    "ppap:manage",
    "scar:view",
    "scar:manage",
    "fmea:view",
    "fmea:manage",
    "spc:view",
    "report:view",
  ],
  inspector: [
    "inspection:view",
    "inspection:perform",
    "ncr:view",
    "ncr:create",
    "capa:view",
    "audit:view",
    "document:view",
    "supplier:view",
    "ppap:view",
    "scar:view",
    "fmea:view",
    "spc:view",
    "measurement:manage",
  ],
  viewer: [
    "inspection:view",
    "ncr:view",
    "capa:view",
    "audit:view",
    "document:view",
    "supplier:view",
    "ppap:view",
    "scar:view",
    "fmea:view",
    "spc:view",
    "report:view",
  ],
  partner: ["portal:view", "portal:respond"],
};

describe("capability matrix — every cell", () => {
  const cells = ROLES.flatMap((role) =>
    CAPABILITIES.map((cap) => ({ role, cap, granted: EXPECTED[role]?.includes(cap) ?? false })),
  );

  it.each(cells)("$role $cap → $granted", ({ role, cap, granted }) => {
    expect(hasCapability(role, cap)).toBe(granted);
  });

  it("covers every role in the enum", () => {
    // If a role is added to packages/types and not to the matrix, this fails
    // rather than the new role silently inheriting an empty capability set.
    for (const role of ROLES) {
      expect(Object.keys(EXPECTED)).toContain(role);
      expect(capabilitiesFor(role).length).toBeGreaterThan(0);
    }
  });
});

describe("the denials that matter most", () => {
  it("only admin manages members, api keys and billing", () => {
    for (const cap of ["members:manage", "apikeys:manage", "billing:manage"] as const) {
      expect(hasCapability("admin", cap)).toBe(true);
      for (const role of ["manager", "auditor", "inspector", "viewer"] as const) {
        expect(hasCapability(role, cap)).toBe(false);
      }
    }
  });

  it("auditor can verify an NCR but cannot assign or close one", () => {
    // The reason the matrix is not a role hierarchy.
    expect(hasCapability("auditor", "ncr:verify")).toBe(true);
    expect(hasCapability("auditor", "ncr:manage")).toBe(false);
    expect(hasCapability("auditor", "capa:manage")).toBe(false);
  });

  it("viewer is read-only", () => {
    for (const cap of CAPABILITIES) {
      if (cap.endsWith(":view")) continue;
      expect(hasCapability("viewer", cap)).toBe(false);
    }
  });

  it("inspector cannot approve documents", () => {
    expect(hasCapability("inspector", "document:approve")).toBe(false);
  });
});

describe("partner is portal-only (P11 external boundary)", () => {
  it("holds only the portal capabilities and NOTHING internal", () => {
    expect(hasCapability("partner", "portal:view")).toBe(true);
    expect(hasCapability("partner", "portal:respond")).toBe(true);
    for (const cap of CAPABILITIES) {
      if (cap === "portal:view" || cap === "portal:respond") continue;
      expect(hasCapability("partner", cap)).toBe(false);
    }
  });

  it("only admin (all-caps) and partner hold the portal capabilities", () => {
    for (const cap of ["portal:view", "portal:respond"] as const) {
      expect(hasCapability("admin", cap)).toBe(true);
      expect(hasCapability("partner", cap)).toBe(true);
      for (const role of ["manager", "auditor", "inspector", "viewer"] as const) {
        expect(hasCapability(role, cap)).toBe(false);
      }
    }
  });
});

describe("supplier scoping (P11) — one boundary out from plant scope", () => {
  const partner = (supplierScope: string | null) =>
    ({ role: "partner", plantIds: [], supplierScope }) as const;

  it("allows a partner to reach their own supplier's record", () => {
    expect(authorizeSupplier(partner("sup-1"), "sup-1").ok).toBe(true);
  });

  it("denies another supplier's record as NOT_FOUND, never FORBIDDEN (rule 8)", () => {
    const result = authorizeSupplier(partner("sup-1"), "sup-2");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_FOUND");
    expect(result.message).not.toMatch(/supplier|permission|forbidden/i);
  });

  it("denies a partner with no scope (should be impossible via the DB CHECK)", () => {
    expect(authorizeSupplier(partner(null), "sup-1").ok).toBe(false);
  });

  it("is a no-op for internal roles (they are not supplier-scoped)", () => {
    for (const role of ["admin", "manager", "auditor", "inspector", "viewer"] as const) {
      expect(authorizeSupplier({ role, plantIds: [] }, "sup-1").ok).toBe(true);
    }
    expect(isPartner("partner")).toBe(true);
    expect(isPartner("admin")).toBe(false);
  });
});

describe("authorize", () => {
  it("names the missing capability in the denial (03 §3)", () => {
    const result = authorize({ role: "viewer", plantIds: [] }, "ncr:create");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("FORBIDDEN");
    expect(result.details).toEqual({ required: "ncr:create", role: "viewer" });
  });

  it("allows a granted capability", () => {
    expect(authorize({ role: "manager", plantIds: [] }, "ncr:manage").ok).toBe(true);
  });
});

describe("plant scoping", () => {
  it("applies to inspector and viewer only", () => {
    expect(isPlantScoped("inspector")).toBe(true);
    expect(isPlantScoped("viewer")).toBe(true);
    for (const role of ["admin", "manager", "auditor"] as const) {
      expect(isPlantScoped(role)).toBe(false);
    }
  });

  it("is a no-op when the membership lists no plants", () => {
    // 03 §3 scopes "when set" — an empty list means unrestricted, not locked out.
    expect(authorizePlant({ role: "inspector", plantIds: [] }, "plant-1").ok).toBe(true);
  });

  it("allows an assigned plant", () => {
    expect(authorizePlant({ role: "inspector", plantIds: ["p1", "p2"] }, "p2").ok).toBe(true);
  });

  it("denies an unassigned plant as NOT_FOUND, never FORBIDDEN", () => {
    // A 403 would confirm the plant exists. Same reasoning as rule 8's
    // cross-tenant 404, one level down.
    const result = authorizePlant({ role: "inspector", plantIds: ["p1"] }, "p9");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NOT_FOUND");
    expect(result.message).not.toMatch(/plant|permission|forbidden/i);
  });

  it("denies a null plant for a scoped membership", () => {
    expect(authorizePlant({ role: "viewer", plantIds: ["p1"] }, null).ok).toBe(false);
  });

  it("does not restrict a manager to their plant list", () => {
    expect(authorizePlant({ role: "manager", plantIds: ["p1"] }, "p9").ok).toBe(true);
  });
});

describe("four-eyes verification (03 §3, 02 §4)", () => {
  const manager = { role: "manager", plantIds: [] } as const;

  it("blocks a manager verifying an NCR they resolved", () => {
    const result = authorizeVerify(manager, "user-1", "user-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("FORBIDDEN");
    expect(result.details?.["rule"]).toBe("four_eyes");
  });

  it("allows a manager verifying someone else's resolution", () => {
    expect(authorizeVerify(manager, "user-1", "user-2").ok).toBe(true);
  });

  it("allows a manager verifying an NCR with no recorded resolver", () => {
    expect(authorizeVerify(manager, "user-1", null).ok).toBe(true);
  });

  it("exempts admin per the matrix", () => {
    expect(authorizeVerify({ role: "admin", plantIds: [] }, "u1", "u1").ok).toBe(true);
  });

  it("denies a role without ncr:verify before considering four-eyes", () => {
    const result = authorizeVerify({ role: "inspector", plantIds: [] }, "u1", "u2");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.details?.["rule"]).toBeUndefined();
  });
});
