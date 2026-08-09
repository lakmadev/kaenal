import { describe, expect, it } from "vitest";
import { actionPriority, apDistribution, rpn, RPN_ACTION_THRESHOLD } from "../src/fmea.js";

describe("rpn", () => {
  it("multiplies S × O × D", () => {
    expect(rpn(9, 4, 3)).toBe(108);
    expect(rpn(10, 10, 10)).toBe(1000);
    expect(rpn(1, 1, 1)).toBe(1);
  });
  it("clamps ratings into 1–10", () => {
    expect(rpn(99, 0, 5)).toBe(10 * 1 * 5);
  });
});

describe("actionPriority", () => {
  it("severity 1 is always Low (no discernible effect)", () => {
    expect(actionPriority(1, 10, 10)).toBe("L");
  });

  it("severity 9–10 with occurrence ≥ 2 is High", () => {
    expect(actionPriority(9, 4, 3)).toBe("H"); // the design's row #1
    expect(actionPriority(9, 2, 2)).toBe("H"); // the design's row #4
    expect(actionPriority(10, 2, 1)).toBe("H");
  });

  it("severity 9–10 with occurrence 1 is not automatically High, but at least Medium", () => {
    expect(actionPriority(9, 1, 1)).toBe("M");
  });

  it("severity 7–8 with occurrence × detection ≥ 6 is High", () => {
    expect(actionPriority(8, 3, 4)).toBe("H"); // the design's row #2 (12 ≥ 6)
    expect(actionPriority(8, 3, 2)).toBe("H"); // exactly 6
  });

  it("a low-severity mode with a high RPN is Medium", () => {
    // S6 O4 D3 = RPN 72 → below threshold → Low (design row #6 is 'L').
    expect(actionPriority(6, 4, 3)).toBe("L");
    // Push RPN to the threshold → Medium.
    expect(rpn(5, 5, 4)).toBeGreaterThanOrEqual(RPN_ACTION_THRESHOLD);
    expect(actionPriority(5, 5, 4)).toBe("M");
  });

  it("a benign mode with low RPN is Low (design row #3)", () => {
    expect(actionPriority(4, 5, 3)).toBe("L"); // RPN 60
  });
});

describe("apDistribution", () => {
  // The design's mock rows hard-code some AP labels that don't match its own
  // stated rule (row 2, S8×O3×D4, is labelled 'M' but Occ×Det=12 ≥ 6 → High);
  // we follow the stated rule, so the honest tally is 4 High / 0 Medium / 2 Low.
  it("tallies the six design rows by the stated AP rule", () => {
    const rows = [
      { severity: 9, occurrence: 4, detection: 3 }, // H
      { severity: 8, occurrence: 3, detection: 4 }, // H
      { severity: 4, occurrence: 5, detection: 3 }, // L
      { severity: 9, occurrence: 2, detection: 2 }, // H
      { severity: 8, occurrence: 3, detection: 2 }, // H (occ×det = 6)
      { severity: 6, occurrence: 4, detection: 3 }, // L
    ];
    expect(apDistribution(rows)).toEqual({ H: 4, M: 0, L: 2 });
  });
});
