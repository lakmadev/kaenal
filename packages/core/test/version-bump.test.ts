import { describe, expect, it } from "vitest";
import { bumpMinorVersion, isBumpableVersion } from "../src/index.js";

/**
 * Minor-version bumper for ECN's E5 auto-revise mechanism (SPRINT-06 §2 E5
 * AC4) — parses a numeric-dot "X.Y" string and increments Y, rejecting
 * anything else as the named `bad_version_format` skip reason (checked by
 * the caller via `isBumpableVersion` before ever opening a SAVEPOINT).
 */
describe("bumpMinorVersion", () => {
  it("increments the minor component, leaving major untouched", () => {
    expect(bumpMinorVersion("1.0")).toBe("1.1");
    expect(bumpMinorVersion("2.9")).toBe("2.10");
    expect(bumpMinorVersion("0.0")).toBe("0.1");
  });

  it("tolerates surrounding whitespace", () => {
    expect(bumpMinorVersion(" 1.2 ")).toBe("1.3");
  });

  it("throws on a malformed version string (semver-with-patch, non-numeric, empty)", () => {
    expect(() => bumpMinorVersion("1.2.3")).toThrow();
    expect(() => bumpMinorVersion("v1.2")).toThrow();
    expect(() => bumpMinorVersion("abc")).toThrow();
    expect(() => bumpMinorVersion("")).toThrow();
    expect(() => bumpMinorVersion("1.")).toThrow();
    expect(() => bumpMinorVersion(".1")).toThrow();
  });
});

describe("isBumpableVersion", () => {
  it("agrees with bumpMinorVersion's own success/failure split", () => {
    expect(isBumpableVersion("1.0")).toBe(true);
    expect(isBumpableVersion("2.9")).toBe(true);
    expect(isBumpableVersion("1.2.3")).toBe(false);
    expect(isBumpableVersion("v1.2")).toBe(false);
    expect(isBumpableVersion("")).toBe(false);
  });
});
