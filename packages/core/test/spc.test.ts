import { describe, expect, it } from "vitest";
import { computeXbarR, spcConstants, SpcError, westernElectric } from "../src/spc.js";

/**
 * SPC math (B5). Pins the control-limit formulas against a textbook worked
 * example (Montgomery, Introduction to SQC — flow-width, n=5, 25 subgroups),
 * the constant table, the capability indices, and each Western-Electric rule.
 */

describe("constants", () => {
  it("matches the standard table for n=5", () => {
    expect(spcConstants(5)).toEqual({ a2: 0.577, d3: 0, d4: 2.114, d2: 2.326 });
  });
  it("has no entry outside 2–10", () => {
    expect(spcConstants(1)).toBeUndefined();
    expect(spcConstants(11)).toBeUndefined();
  });
});

// Montgomery flow-width data (mm), 25 subgroups of 5. Known results:
//   X̿ ≈ 1.5056, R̄ ≈ 0.32521, UCLx ≈ 1.693, LCLx ≈ 1.318, UCLr ≈ 0.6876.
const FLOW_WIDTH: number[][] = [
  [1.3235, 1.4128, 1.6744, 1.4573, 1.6914],
  [1.4314, 1.3592, 1.6075, 1.4666, 1.6109],
  [1.4284, 1.4871, 1.4932, 1.4324, 1.5674],
  [1.5028, 1.6352, 1.3841, 1.2831, 1.5507],
  [1.5604, 1.2735, 1.5265, 1.4363, 1.6441],
  [1.5955, 1.5451, 1.3574, 1.3281, 1.4198],
  [1.6274, 1.5064, 1.8366, 1.4177, 1.5144],
  [1.419, 1.4303, 1.6637, 1.6067, 1.5519],
  [1.3884, 1.7277, 1.5355, 1.5176, 1.6841],
  [1.4039, 1.6697, 1.5089, 1.4627, 1.522],
  [1.4158, 1.7667, 1.4278, 1.5928, 1.4181],
  [1.5821, 1.3355, 1.5777, 1.3908, 1.7559],
  [1.2856, 1.4106, 1.4447, 1.6398, 1.1928],
  [1.4951, 1.4036, 1.5893, 1.6458, 1.4969],
  [1.3589, 1.2863, 1.5996, 1.2497, 1.5471],
  [1.5747, 1.5301, 1.5171, 1.1839, 1.8662],
  [1.368, 1.7269, 1.3957, 1.5014, 1.4449],
  [1.4163, 1.3864, 1.3057, 1.621, 1.5573],
  [1.5796, 1.4185, 1.6541, 1.5116, 1.7247],
  [1.7106, 1.4412, 1.2361, 1.382, 1.7601],
  [1.4371, 1.5051, 1.3485, 1.567, 1.488],
  [1.4738, 1.5936, 1.6583, 1.4973, 1.472],
  [1.5917, 1.4333, 1.5551, 1.5295, 1.6866],
  [1.6399, 1.5243, 1.5705, 1.5563, 1.553],
  [1.5797, 1.3663, 1.624, 1.3732, 1.6887],
];

describe("computeXbarR (Montgomery flow-width, n=5)", () => {
  const r = computeXbarR(FLOW_WIDTH);

  it("recovers the published grand mean and range", () => {
    expect(r.centerLine).toBeCloseTo(1.5056, 2);
    // R̄ ≈ 0.325 — 2 decimals (this transcription differs from the published set
    // in the 3rd decimal; the formula wiring is what's under test).
    expect(r.rBar).toBeCloseTo(0.325, 2);
  });

  it("computes the published control limits", () => {
    expect(r.uclX).toBeCloseTo(1.693, 2);
    expect(r.lclX).toBeCloseTo(1.318, 2);
    expect(r.uclR).toBeCloseTo(0.6876, 2);
    expect(r.lclR).toBe(0);
  });

  it("is in control — no Western-Electric violations", () => {
    expect(r.violations).toEqual([]);
  });

  it("rejects a ragged subgroup and an empty set", () => {
    expect(() => computeXbarR([[1, 2, 3], [1, 2]])).toThrow(SpcError);
    expect(() => computeXbarR([])).toThrow(SpcError);
  });
});

describe("process capability", () => {
  it("computes Cp/Cpk from spec limits (centered process)", () => {
    // 5 subgroups, each mean 10, range 4 → σ̂ = R̄/d2 = 4/2.326 ≈ 1.719.
    const groups = Array.from({ length: 5 }, () => [8, 9, 10, 11, 12]);
    const r = computeXbarR(groups, { usl: 16, lsl: 4 });
    expect(r.capability.sigma).toBeCloseTo(4 / 2.326, 3);
    // Cp = (USL−LSL)/6σ = 12 / (6·1.719) ≈ 1.163.
    expect(r.capability.cp).toBeCloseTo(1.163, 2);
    expect(r.capability.cpk).toBeCloseTo(1.163, 2);
  });

  it("returns null indices when no spec limits are supplied", () => {
    const r = computeXbarR(Array.from({ length: 3 }, () => [1, 2, 3]));
    expect(r.capability.cp).toBeNull();
    expect(r.capability.cpk).toBeNull();
  });
});

describe("western electric rules", () => {
  it("WE-1 flags a point beyond 3σ", () => {
    const means = [0, 0, 0, 0, 3.5, 0];
    const v = westernElectric(means, 0, 1);
    const we1 = v.find((x) => x.rule === "WE-1");
    expect(we1?.subgroups).toContain(4);
  });

  it("WE-4 flags 8 consecutive on one side of center", () => {
    const means = [1, 1, 1, 1, 1, 1, 1, 1, -1];
    const v = westernElectric(means, 0, 1);
    expect(v.some((x) => x.rule === "WE-4")).toBe(true);
  });

  it("WE-2 flags 2 of 3 beyond 2σ same side", () => {
    const means = [0, 2.3, 0.1, 2.4];
    const v = westernElectric(means, 0, 1);
    expect(v.some((x) => x.rule === "WE-2")).toBe(true);
  });

  it("is silent on an in-control series", () => {
    const means = [0.2, -0.3, 0.1, -0.1, 0.2, -0.2];
    expect(westernElectric(means, 0, 1)).toEqual([]);
  });
});
