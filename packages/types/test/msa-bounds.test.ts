import { describe, expect, it } from "vitest";
import { CreateMsaStudyBody } from "../src/dto.js";

/**
 * MSA study creation bounds (SPRINT-04 M1 AC4/AC5, M2 AC4): `average_range`
 * only covers the published K-table domain (trials 2-3, appraisers 2-3,
 * parts 2-10); `crossed_anova` needs at least 2/2/2 (its ANOVA degrees of
 * freedom hit 0 below that); both methods share an upper cap of 10
 * appraisers / 50 parts / 10 trials. Enforced by `CreateMsaStudyBody`'s
 * `.superRefine`, keyed on `method` — this is the "Zod `.refine()` keyed on
 * method" the slice's brief asks be tested at both methods' valid/invalid
 * boundaries.
 */

const base = {
  characteristic: "Bore diameter",
  gaugeLabel: "Zeiss Contura",
  tolerance: null as number | null,
};

function withDims(method: "crossed_anova" | "average_range", a: number, p: number, n: number) {
  return { ...base, method, nAppraisers: a, nParts: p, nTrials: n };
}

describe("CreateMsaStudyBody — average_range bounds (M1 AC4)", () => {
  it.each([
    ["min valid", 2, 2, 2],
    ["max valid", 3, 10, 3],
    ["AIAG long-form default", 3, 10, 3],
  ])("%s: a=%i p=%i n=%i accepted", (_label, a, p, n) => {
    expect(CreateMsaStudyBody.safeParse(withDims("average_range", a, p, n)).success).toBe(true);
  });

  it.each([
    ["trials=1, below the K1 domain", 3, 10, 1],
    ["trials=4, above the K1 domain", 3, 10, 4],
    ["appraisers=1, below the K2 domain", 1, 10, 3],
    ["appraisers=4, above the K2 domain", 4, 10, 3],
    ["parts=1, below the K3 domain", 3, 1, 3],
    ["parts=11, above the K3 domain", 3, 11, 3],
  ])("%s rejected", (_label, a, p, n) => {
    expect(CreateMsaStudyBody.safeParse(withDims("average_range", a, p, n)).success).toBe(false);
  });
});

describe("CreateMsaStudyBody — crossed_anova bounds (M1 AC5, N3)", () => {
  it.each([
    ["min valid (2/2/2 floor)", 2, 2, 2],
    ["shared upper cap", 10, 50, 10],
  ])("%s: a=%i p=%i n=%i accepted", (_label, a, p, n) => {
    expect(CreateMsaStudyBody.safeParse(withDims("crossed_anova", a, p, n)).success).toBe(true);
  });

  it.each([
    ["appraisers below the 2/2/2 floor", 1, 5, 5],
    ["parts below the 2/2/2 floor", 5, 1, 5],
    ["trials below the 2/2/2 floor", 5, 5, 1],
  ])("%s rejected", (_label, a, p, n) => {
    expect(CreateMsaStudyBody.safeParse(withDims("crossed_anova", a, p, n)).success).toBe(false);
  });
});

describe("CreateMsaStudyBody — shared upper cap, both methods (N3)", () => {
  it.each([
    ["appraisers > 10", "crossed_anova", 11, 10, 5],
    ["parts > 50", "crossed_anova", 5, 51, 5],
    ["trials > 10", "crossed_anova", 5, 10, 11],
  ] as const)("%s rejected", (_label, method, a, p, n) => {
    expect(CreateMsaStudyBody.safeParse(withDims(method, a, p, n)).success).toBe(false);
  });
});
