import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { fromBase64, seedUpdate, stringDiff, toBase64, ytextString } from "../src/features/collab/crdt";

/**
 * Mobile collaborative-text CRDT (Phase R6.2). The native mirror of the web
 * helpers, with a hand-rolled base64 (RN has no btoa/atob). Two things must be
 * exactly right: the base64 must match STANDARD base64 (so a web/server-relayed
 * update decodes correctly — cross-platform co-editing), and the deterministic
 * seed must converge under concurrent edits.
 */

describe("stringDiff", () => {
  it("detects append / prepend / delete / replace", () => {
    expect(stringDiff("abc", "abcd")).toEqual({ index: 3, remove: 0, insert: "d" });
    expect(stringDiff("bc", "abc")).toEqual({ index: 0, remove: 0, insert: "a" });
    expect(stringDiff("abcd", "abd")).toEqual({ index: 2, remove: 1, insert: "" });
    expect(stringDiff("cat", "cot")).toEqual({ index: 1, remove: 1, insert: "o" });
  });
});

describe("base64 (RN, no btoa)", () => {
  it("round-trips arbitrary binary", () => {
    const bytes = new Uint8Array([0, 1, 2, 63, 64, 65, 128, 200, 254, 255]);
    expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes));
  });

  it("matches STANDARD base64 (interoperable with web btoa / server Buffer)", () => {
    for (const len of [0, 1, 2, 3, 4, 5, 17, 64, 255]) {
      const bytes = new Uint8Array(len).map((_, i) => (i * 37 + 11) & 0xff);
      const standard = Buffer.from(bytes).toString("base64");
      expect(toBase64(bytes)).toBe(standard);
      expect(Array.from(fromBase64(standard))).toEqual(Array.from(bytes));
    }
  });
});

describe("seedUpdate + convergence", () => {
  it("is deterministic", () => {
    expect(toBase64(seedUpdate("root cause"))).toBe(toBase64(seedUpdate("root cause")));
  });

  it("two peers seeded identically converge under concurrent edits", () => {
    const seed = seedUpdate("cause: ");
    const a = new Y.Doc();
    const b = new Y.Doc();
    Y.applyUpdate(a, seed, "seed");
    Y.applyUpdate(b, seed, "seed");

    let aUpdate: Uint8Array = new Uint8Array();
    let bUpdate: Uint8Array = new Uint8Array();
    a.on("update", (u: Uint8Array, o: unknown) => {
      if (o !== "remote") aUpdate = u;
    });
    b.on("update", (u: Uint8Array, o: unknown) => {
      if (o !== "remote") bUpdate = u;
    });

    a.getText("t").insert(a.getText("t").length, "worn bearing");
    b.getText("t").insert(0, "[D5] ");

    // Relay through base64 (as the transport does) to exercise the codec too.
    Y.applyUpdate(b, fromBase64(toBase64(aUpdate)), "remote");
    Y.applyUpdate(a, fromBase64(toBase64(bUpdate)), "remote");

    expect(ytextString(a.getText("t"))).toBe(ytextString(b.getText("t")));
    expect(ytextString(a.getText("t"))).toBe("[D5] cause: worn bearing");
  });
});
