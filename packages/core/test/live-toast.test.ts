import { describe, expect, it } from "vitest";
import { shouldToast } from "../src/live-toast.js";

const routable = (k: string): boolean => k === "ncr";
const base = { id: "n1", actorId: "u2", entityKind: "ncr", entityId: "e1" };

describe("shouldToast", () => {
  it("toasts when someone else acted on a routable record", () => {
    expect(shouldToast(base, "u1", routable)).toBe(true);
  });
  it("never toasts the user's own action", () => {
    expect(shouldToast({ ...base, actorId: "u1" }, "u1", routable)).toBe(false);
  });
  it("toasts system events with no actor", () => {
    expect(shouldToast({ ...base, actorId: null }, "u1", routable)).toBe(true);
  });
  it("skips unroutable kinds and missing records", () => {
    expect(shouldToast({ ...base, entityKind: "audit" }, "u1", routable)).toBe(false);
    expect(shouldToast({ ...base, entityId: null }, "u1", routable)).toBe(false);
  });
});
