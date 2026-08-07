import { describe, expect, it } from "vitest";
import { roleSeesNavRoot, roleSeesRoute, settingsFull } from "@/config/rbac";

/**
 * Role-based UI curation (RBAC) — the client mirror of the design's `visibleNav`.
 * These are pure functions driven by the authenticated `me.role`, so they pin the
 * per-role surface precisely (the server still enforces the real capability on
 * every request; this only decides what the shell shows).
 */
describe("roleSeesNavRoot", () => {
  it("admin sees everything, including platform modules", () => {
    for (const id of ["dashboard", "ncrs", "ai-governance", "pdf-designer", "multi-tenancy"]) {
      expect(roleSeesNavRoot("admin", id)).toBe(true);
    }
  });

  it("manager sees everything except platform/admin modules", () => {
    expect(roleSeesNavRoot("manager", "suppliers")).toBe(true);
    expect(roleSeesNavRoot("manager", "pqe")).toBe(true);
    expect(roleSeesNavRoot("manager", "ai-governance")).toBe(false);
    expect(roleSeesNavRoot("manager", "dev-platform")).toBe(false);
    expect(roleSeesNavRoot("manager", "pdf-designer")).toBe(false);
  });

  it("auditor sees the quality workflow but not quicklog/suppliers/platform", () => {
    expect(roleSeesNavRoot("auditor", "audits")).toBe(true);
    expect(roleSeesNavRoot("auditor", "8d")).toBe(true);
    expect(roleSeesNavRoot("auditor", "quicklog")).toBe(false);
    expect(roleSeesNavRoot("auditor", "suppliers")).toBe(false);
    expect(roleSeesNavRoot("auditor", "ai-governance")).toBe(false);
  });

  it("inspector sees the field-user set only", () => {
    expect(roleSeesNavRoot("inspector", "inspections")).toBe(true);
    expect(roleSeesNavRoot("inspector", "ncrs")).toBe(true);
    expect(roleSeesNavRoot("inspector", "quicklog")).toBe(true);
    expect(roleSeesNavRoot("inspector", "8d")).toBe(false);
    expect(roleSeesNavRoot("inspector", "audits")).toBe(false);
    expect(roleSeesNavRoot("inspector", "reports")).toBe(false);
  });

  it("viewer sees read-only surfaces only", () => {
    expect(roleSeesNavRoot("viewer", "documents")).toBe(true);
    expect(roleSeesNavRoot("viewer", "reports")).toBe(true);
    expect(roleSeesNavRoot("viewer", "ncrs")).toBe(false);
    expect(roleSeesNavRoot("viewer", "inspections")).toBe(false);
  });

  it("an unknown/undefined role (e.g. partner) sees nothing in this shell", () => {
    expect(roleSeesNavRoot("partner", "dashboard")).toBe(false);
    expect(roleSeesNavRoot(undefined, "dashboard")).toBe(false);
  });
});

describe("roleSeesRoute", () => {
  it("always allows dashboard and settings regardless of role", () => {
    for (const role of ["viewer", "inspector", "auditor"]) {
      expect(roleSeesRoute(role, "/dashboard")).toBe(true);
      expect(roleSeesRoute(role, "/settings/profile")).toBe(true);
    }
  });

  it("blocks a module route the role's UI does not surface", () => {
    expect(roleSeesRoute("inspector", "/8d/8D-2026-0001")).toBe(false);
    expect(roleSeesRoute("viewer", "/suppliers")).toBe(false);
    expect(roleSeesRoute("manager", "/developer")).toBe(false); // dev-platform id, /developer href
    expect(roleSeesRoute("manager", "/pdf-templates")).toBe(false); // pdf-designer
  });

  it("allows a module route the role does surface (incl. detail/query paths)", () => {
    expect(roleSeesRoute("inspector", "/ncrs/NCR-2026-0001")).toBe(true);
    expect(roleSeesRoute("auditor", "/audits?view=mine")).toBe(true);
  });

  it("does not block unknown non-module routes", () => {
    expect(roleSeesRoute("viewer", "/some-unknown-page")).toBe(true);
  });
});

describe("settingsFull", () => {
  it("is admin-only", () => {
    expect(settingsFull("admin")).toBe(true);
    expect(settingsFull("manager")).toBe(false);
    expect(settingsFull("viewer")).toBe(false);
    expect(settingsFull(undefined)).toBe(false);
  });
});
