import { describe, expect, it } from "vitest";
import { counterYear, formatCode, parseCode } from "../src/index.js";

describe("formatCode", () => {
  it("formats the documented shape", () => {
    expect(formatCode("ncr", 2026, 142)).toBe("NCR-2026-0142");
  });

  it("pads short sequences", () => {
    expect(formatCode("ncr", 2026, 1)).toBe("NCR-2026-0001");
  });

  it("grows rather than wrapping past the pad width", () => {
    expect(formatCode("ncr", 2026, 12345)).toBe("NCR-2026-12345");
  });

  it.each([
    ["inspection", "INS-2026-0007"],
    ["eight_d", "8D-2026-0007"],
    ["capa", "CAPA-2026-0007"],
    ["audit", "AUD-2026-0007"],
    ["document", "DOC-2026-0007"],
    ["scar", "SCAR-2026-0007"],
    ["supplier", "SUP-2026-0007"],
  ] as const)("prefixes %s correctly", (kind, expected) => {
    expect(formatCode(kind, 2026, 7)).toBe(expected);
  });

  it("rejects a zero or negative sequence", () => {
    expect(() => formatCode("ncr", 2026, 0)).toThrow(/positive integer/i);
    expect(() => formatCode("ncr", 2026, -1)).toThrow(/positive integer/i);
  });

  it("rejects a non-integer sequence", () => {
    expect(() => formatCode("ncr", 2026, 1.5)).toThrow(/positive integer/i);
  });

  it("rejects an out-of-range year", () => {
    expect(() => formatCode("ncr", 199, 1)).toThrow(/year out of range/i);
  });
});

describe("parseCode", () => {
  it("round-trips a formatted code", () => {
    expect(parseCode(formatCode("ncr", 2026, 142))).toEqual({
      kind: "ncr",
      year: 2026,
      sequence: 142,
    });
  });

  it("tolerates surrounding whitespace and lowercase input", () => {
    expect(parseCode("  ncr-2026-0142 ")).toEqual({ kind: "ncr", year: 2026, sequence: 142 });
  });

  it("returns null for an unknown prefix", () => {
    expect(parseCode("XYZ-2026-0001")).toBeNull();
  });

  it.each(["", "NCR", "NCR-2026", "NCR-26-0001", "NCR-2026-abc", "NCR-2026-0000"])(
    "returns null for malformed input %j",
    (input) => {
      expect(parseCode(input)).toBeNull();
    },
  );
});

describe("counterYear — year rollover in the tenant's timezone (02 §7)", () => {
  it("uses the tenant's local year, not UTC's", () => {
    // 2026-01-01 12:00 in Auckland is still 2025-12-31 23:00 UTC. A plant in
    // New Zealand raising an NCR at lunchtime on New Year's Day must get a
    // 2026 code, not a 2025 one.
    const instant = new Date("2025-12-31T23:00:00Z");
    expect(counterYear(instant, "Pacific/Auckland")).toBe(2026);
    expect(counterYear(instant, "UTC")).toBe(2025);
  });

  it("works the other way for zones behind UTC", () => {
    // 2026-01-01 02:00 UTC is still 2025-12-31 21:00 in New York.
    const instant = new Date("2026-01-01T02:00:00Z");
    expect(counterYear(instant, "America/New_York")).toBe(2025);
    expect(counterYear(instant, "UTC")).toBe(2026);
  });

  it("agrees with UTC mid-year", () => {
    expect(counterYear(new Date("2026-06-15T12:00:00Z"), "Europe/Berlin")).toBe(2026);
  });
});
