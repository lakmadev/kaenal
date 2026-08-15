import { describe, expect, it } from "vitest";

import { advanceCursor, decodeCursor, encodeCursor, isAfter } from "../src/sync/cursor.js";
import { isUuidV7, uuidv7 } from "../src/sync/ids.js";
import { normalizeOutcome } from "../src/sync/pusher.js";

describe("delta cursor (05 §2.1)", () => {
  it("round-trips encode/decode", () => {
    const c = { updatedAt: "2026-08-15T00:00:00.000Z", id: "abc" };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor("garbage")).toBeNull();
  });

  it("isAfter compares by updatedAt then id keyset", () => {
    const cur = { updatedAt: "2026-08-15T00:00:00.000Z", id: "m" };
    expect(isAfter(null, { updatedAt: "x", id: "y" })).toBe(true);
    expect(isAfter(cur, { updatedAt: "2026-08-15T00:00:01.000Z", id: "a" })).toBe(true);
    expect(isAfter(cur, { updatedAt: "2026-08-15T00:00:00.000Z", id: "n" })).toBe(true); // same ts, id>
    expect(isAfter(cur, { updatedAt: "2026-08-15T00:00:00.000Z", id: "a" })).toBe(false); // same ts, id<
    expect(isAfter(cur, { updatedAt: "2026-08-14T00:00:00.000Z", id: "z" })).toBe(false);
  });

  it("advanceCursor takes the max of applied rows", () => {
    const rows = [
      { updatedAt: "2026-08-15T00:00:01.000Z", id: "a" },
      { updatedAt: "2026-08-15T00:00:03.000Z", id: "c" },
      { updatedAt: "2026-08-15T00:00:02.000Z", id: "b" },
    ];
    expect(advanceCursor(null, rows)).toEqual({ updatedAt: "2026-08-15T00:00:03.000Z", id: "c" });
    expect(advanceCursor(null, [])).toBeNull();
  });
});

describe("uuid v7", () => {
  it("generates time-ordered, well-formed v7 ids", () => {
    const a = uuidv7(1000);
    const b = uuidv7(2000);
    expect(isUuidV7(a)).toBe(true);
    expect(isUuidV7(b)).toBe(true);
    expect(a < b).toBe(true); // earlier timestamp sorts first
    expect(isUuidV7("not-a-uuid")).toBe(false);
    expect(isUuidV7("00000000-0000-4000-8000-000000000000")).toBe(false); // v4, not v7
  });
});

describe("push outcome normalisation (05 §2.3 wire mapping)", () => {
  it("maps HTTP status to outcome kinds", () => {
    expect(normalizeOutcome({ status: 201, body: { updatedAt: "t", version: 3 } })).toEqual({
      kind: "ok", serverUpdatedAt: "t", serverVersion: 3,
    });
    expect(normalizeOutcome({ status: 409, body: { code: "STALE_WRITE" } })).toEqual({ kind: "stale_write" });
    expect(normalizeOutcome({ status: 409, body: { message: "closed" } }).kind).toBe("conflict_transition");
    expect(normalizeOutcome({ status: 404, body: {} })).toEqual({ kind: "not_found" });
    expect(normalizeOutcome({ status: 401, body: {} })).toEqual({ kind: "auth" });
    expect(normalizeOutcome({ status: 422, body: { message: "bad" } })).toEqual({ kind: "validation", message: "bad" });
    expect(normalizeOutcome({ status: 500, body: {} })).toEqual({ kind: "transient" });
    expect(normalizeOutcome({ status: 0, body: {} })).toEqual({ kind: "transient" });
  });
});
