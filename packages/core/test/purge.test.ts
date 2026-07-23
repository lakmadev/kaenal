import { describe, expect, it } from "vitest";
import {
  PURGE_RETENTION_DAYS,
  purgeCutoff,
  isTenantWideScope,
  holdBlocks,
  isBlockedByHolds,
  hasTenantWideHold,
  type LegalHoldScope,
} from "../src/purge.js";

/**
 * Soft-delete retention + legal-hold scoping (06 §1 `housekeeping`, 07 §5). The
 * cutoff arithmetic and the "does this hold protect this row" decision gate a
 * permanent, irreversible delete, so the boundaries are pinned exactly — the
 * safe direction on any ambiguity is to keep the data.
 */

const now = new Date("2026-07-22T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

describe("purgeCutoff", () => {
  it("is the retention window before now", () => {
    expect(purgeCutoff(now).getTime()).toBe(now.getTime() - PURGE_RETENTION_DAYS * DAY);
  });

  it("honours an overridden retention window", () => {
    expect(purgeCutoff(now, 7).getTime()).toBe(now.getTime() - 7 * DAY);
  });
});

describe("isTenantWideScope", () => {
  it("treats an empty scope as tenant-wide", () => {
    expect(isTenantWideScope({})).toBe(true);
    expect(isTenantWideScope({ entityKind: "" })).toBe(true);
    expect(isTenantWideScope({ entityKinds: [] })).toBe(true);
  });

  it("is not tenant-wide once it targets a kind", () => {
    expect(isTenantWideScope({ entityKind: "ncr" })).toBe(false);
    expect(isTenantWideScope({ entityKinds: ["capa"] })).toBe(false);
  });
});

describe("holdBlocks", () => {
  const ncrRow = { entityKind: "ncr", entityId: "n1" };
  const capaRow = { entityKind: "capa", entityId: "c1" };

  it("a tenant-wide hold blocks anything", () => {
    expect(holdBlocks({}, ncrRow)).toBe(true);
    expect(holdBlocks({}, capaRow)).toBe(true);
  });

  it("an entityKinds hold blocks the listed kinds only", () => {
    const scope: LegalHoldScope = { entityKinds: ["ncr", "eight_d"] };
    expect(holdBlocks(scope, ncrRow)).toBe(true);
    expect(holdBlocks(scope, capaRow)).toBe(false);
  });

  it("a kind-only hold blocks every row of that kind", () => {
    const scope: LegalHoldScope = { entityKind: "ncr" };
    expect(holdBlocks(scope, ncrRow)).toBe(true);
    expect(holdBlocks(scope, { entityKind: "ncr", entityId: "n2" })).toBe(true);
    expect(holdBlocks(scope, capaRow)).toBe(false);
  });

  it("a kind+id hold blocks only that exact row", () => {
    const scope: LegalHoldScope = { entityKind: "ncr", entityId: "n1" };
    expect(holdBlocks(scope, ncrRow)).toBe(true);
    expect(holdBlocks(scope, { entityKind: "ncr", entityId: "n2" })).toBe(false);
    expect(holdBlocks(scope, capaRow)).toBe(false);
  });
});

describe("isBlockedByHolds / hasTenantWideHold", () => {
  const row = { entityKind: "ncr", entityId: "n1" };

  it("blocks when any hold covers the row", () => {
    expect(isBlockedByHolds([{ entityKind: "capa" }, { entityKind: "ncr", entityId: "n1" }], row)).toBe(true);
    expect(isBlockedByHolds([{ entityKind: "capa" }], row)).toBe(false);
    expect(isBlockedByHolds([], row)).toBe(false);
  });

  it("detects a tenant-wide hold among many", () => {
    expect(hasTenantWideHold([{ entityKind: "ncr" }, {}])).toBe(true);
    expect(hasTenantWideHold([{ entityKind: "ncr" }, { entityKinds: ["capa"] }])).toBe(false);
  });
});
