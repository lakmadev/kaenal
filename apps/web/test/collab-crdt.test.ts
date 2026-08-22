import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { fromBase64, seedUpdate, stringDiff, toBase64, ytextString } from "../src/lib/collab-crdt";

/**
 * The CRDT foundations of collaborative editing (Phase R5). The two things that
 * must be exactly right: the single-region text diff (how a textarea edit becomes
 * a Yjs op) and the *deterministic* seed (so independently-created client docs
 * converge instead of duplicating the base text). Includes an end-to-end
 * convergence check of two peers making concurrent edits.
 */

describe("stringDiff", () => {
  it("detects an append", () => {
    expect(stringDiff("abc", "abcdef")).toEqual({ index: 3, remove: 0, insert: "def" });
  });
  it("detects a prepend", () => {
    expect(stringDiff("world", "hello world")).toEqual({ index: 0, remove: 0, insert: "hello " });
  });
  it("detects a middle insertion", () => {
    expect(stringDiff("ac", "abc")).toEqual({ index: 1, remove: 0, insert: "b" });
  });
  it("detects a deletion", () => {
    expect(stringDiff("abcdef", "abef")).toEqual({ index: 2, remove: 2, insert: "" });
  });
  it("detects a replacement", () => {
    expect(stringDiff("cat", "cot")).toEqual({ index: 1, remove: 1, insert: "o" });
  });
  it("is a no-op for identical strings", () => {
    expect(stringDiff("same", "same")).toEqual({ index: 4, remove: 0, insert: "" });
  });
});

describe("base64", () => {
  it("round-trips binary bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255, 128, 64]);
    expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes));
  });
});

describe("seedUpdate", () => {
  it("is deterministic — identical bytes for the same base", () => {
    expect(toBase64(seedUpdate("root cause"))).toBe(toBase64(seedUpdate("root cause")));
  });

  it("two peers seeded identically converge under concurrent edits (no duplication)", () => {
    const seed = seedUpdate("cause: ");
    const a = new Y.Doc();
    const b = new Y.Doc();
    Y.applyUpdate(a, seed, "seed");
    Y.applyUpdate(b, seed, "seed");

    let aUpdate: Uint8Array | null = null;
    let bUpdate: Uint8Array | null = null;
    a.on("update", (u: Uint8Array, origin: unknown) => {
      if (origin !== "remote") aUpdate = u;
    });
    b.on("update", (u: Uint8Array, origin: unknown) => {
      if (origin !== "remote") bUpdate = u;
    });

    // Concurrent edits: A appends, B prepends.
    a.getText("t").insert(a.getText("t").length, "worn bearing");
    b.getText("t").insert(0, "[D5] ");

    // Relay each peer's update to the other.
    Y.applyUpdate(b, aUpdate as unknown as Uint8Array, "remote");
    Y.applyUpdate(a, bUpdate as unknown as Uint8Array, "remote");

    expect(ytextString(a.getText("t"))).toBe(ytextString(b.getText("t")));
    expect(ytextString(a.getText("t"))).toBe("[D5] cause: worn bearing");
  });
});
