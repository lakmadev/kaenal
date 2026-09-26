import { describe, expect, it } from "vitest";
import {
  mergedFields,
  nextConnectivity,
  parseStaleWrite,
  reapplyChange,
  versionKeyOf,
  formatRelative,
  resolveLocale,
} from "../src/index.js";

describe("parseStaleWrite", () => {
  it("reads the 409 envelope", () => {
    const body = { error: { code: "STALE_WRITE", message: "m", details: { expected: 1, actual: 2, updatedBy: "u" } } };
    expect(parseStaleWrite(409, body)).toEqual({ message: "m", expected: 1, actual: 2, updatedBy: "u" });
  });
  it("reads updatedBy {id,name} and tolerates nulls", () => {
    const body = { error: { code: "STALE_WRITE", message: "m", details: { expected: 1, actual: 2, updatedAt: "2026-01-01T00:00:00.000Z", updatedBy: { id: "u1", name: "Ada" } } } };
    expect(parseStaleWrite(409, body)).toEqual({ message: "m", expected: 1, actual: 2, updatedAt: "2026-01-01T00:00:00.000Z", updatedBy: "u1", updatedByName: "Ada" });
    const nul = { error: { code: "STALE_WRITE", message: "m", details: { updatedAt: null, updatedBy: null } } };
    expect(parseStaleWrite(409, nul)).toEqual({ message: "m" });
  });
  it("ignores other responses", () => {
    expect(parseStaleWrite(409, { error: { code: "INVALID_TRANSITION", message: "x" } })).toBeNull();
    expect(parseStaleWrite(500, { error: { code: "STALE_WRITE" } })).toBeNull();
    expect(parseStaleWrite(409, null)).toBeNull();
  });
});

describe("reapplyChange", () => {
  const original = { severity: "major", description: "a", due: "x" };
  it("classifies clean, no-op and conflicting fields", () => {
    const mine = { severity: "critical", description: "b", due: "x" };
    const fresh = { severity: "minor", description: "a", due: "x" };
    const r = reapplyChange(original, mine, fresh);
    expect(r.clean).toEqual([{ field: "description", mine: "b" }]);
    expect(r.conflicts.map((c) => c.field)).toEqual(["severity"]);
    expect(mergedFields(r, new Set())).toEqual({ description: "b", severity: "critical" });
    expect(mergedFields(r, new Set(["severity"]))).toEqual({ description: "b" });
  });
  it("skips fields the server already holds", () => {
    const r = reapplyChange(original, { severity: "minor" }, { severity: "minor" });
    expect(r).toEqual({ clean: [], conflicts: [] });
  });
});

describe("misc", () => {
  it("versionKeyOf", () => {
    expect(versionKeyOf({ lockVersion: 1 })).toBe("lockVersion");
    expect(versionKeyOf({ version: 1 })).toBe("version");
    expect(versionKeyOf({})).toBeNull();
  });
  it("connectivity machine", () => {
    expect(nextConnectivity("online", "went-offline")).toBe("offline");
    expect(nextConnectivity("offline", "retry")).toBe("checking");
    expect(nextConnectivity("checking", "retry-failed")).toBe("offline");
    expect(nextConnectivity("checking", "went-online")).toBe("restored");
    expect(nextConnectivity("restored", "dismiss")).toBe("online");
  });
  it("locale", () => {
    expect(resolveLocale({ acceptLanguage: "de,en;q=0.5" })).toBe("en");
    const now = Date.parse("2026-01-01T12:00:00Z");
    expect(formatRelative("2026-01-01T11:52:00Z", "en", now)).toBe("8m ago");
  });
});
