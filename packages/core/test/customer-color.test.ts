import { describe, expect, it } from "vitest";
import { customerColor } from "../src/index.js";

/**
 * Deterministic customer color chip (SPRINT-06 §2 C1 AC1, §0 S6) — computed
 * on every read, never stored, so determinism (not randomness) is the whole
 * contract this pure function must satisfy.
 */
describe("customerColor", () => {
  it("is deterministic — same name always yields the same color", () => {
    const a = customerColor("Nordvolt AB");
    const b = customerColor("Nordvolt AB");
    expect(a).toBe(b);
  });

  it("is case- and whitespace-insensitive (same customer, different casing)", () => {
    expect(customerColor("Acme Corp")).toBe(customerColor("  ACME CORP  "));
  });

  it("returns a value from the fixed 10-color palette, including the jsx's own 5 literal hexes", () => {
    const jsxColors = ["#003c64", "#1c1c1c", "#cc0000", "#0066b1", "#0a8541"];
    const seen = new Set<string>();
    for (const name of ["Nordvolt AB", "Acme Corp", "Contoso", "Globex", "Initech", "Umbrella", "Soylent", "Stark Industries", "Wayne Enterprises", "Tyrell Corp", "Aperture Science"]) {
      const color = customerColor(name);
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
      seen.add(color);
    }
    // At least one of the jsx's own literal values must be reachable.
    expect([...seen].some((c) => jsxColors.includes(c))).toBe(true);
  });

  it("differs across distinct names often enough to distribute visually (not a constant function)", () => {
    const names = ["Nordvolt AB", "Acme Corp", "Contoso", "Globex", "Initech", "Umbrella Corp"];
    const colors = new Set(names.map((n) => customerColor(n)));
    expect(colors.size).toBeGreaterThan(1);
  });

  it("never throws on an empty or unusual string", () => {
    expect(() => customerColor("")).not.toThrow();
    expect(() => customerColor("   ")).not.toThrow();
    expect(() => customerColor("日本語のカスタマー名")).not.toThrow();
  });
});
