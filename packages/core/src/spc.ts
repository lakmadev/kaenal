/**
 * Statistical Process Control math (Data Platform B5; qms-risk-spc.jsx).
 * Pure functions — no DB — so the control-limit and runs-rule logic is unit
 * testable against known worked examples. The API groups measurements by
 * subgroup and calls {@link computeXbarR}; the same result shapes the chart and
 * the alarm banner.
 *
 * X̄/R control limits use the standard Shewhart constants (A2, D3, D4) and the
 * unbiasing constant d2; Western-Electric runs rules 1–4 are evaluated on the
 * subgroup means against the ±1σ/±2σ/±3σ zones.
 */

export interface SpcConstants {
  readonly a2: number;
  readonly d3: number;
  readonly d4: number;
  readonly d2: number;
}

/**
 * Shewhart constants by subgroup size n (2–10) — the standard AIAG/ASTM table.
 * A2 sets the X̄ limits from R̄; D3/D4 the R limits; d2 unbiases σ̂ = R̄/d2.
 */
export const SPC_CONSTANTS: Readonly<Record<number, SpcConstants>> = {
  2: { a2: 1.88, d3: 0, d4: 3.267, d2: 1.128 },
  3: { a2: 1.023, d3: 0, d4: 2.574, d2: 1.693 },
  4: { a2: 0.729, d3: 0, d4: 2.282, d2: 2.059 },
  5: { a2: 0.577, d3: 0, d4: 2.114, d2: 2.326 },
  6: { a2: 0.483, d3: 0, d4: 2.004, d2: 2.534 },
  7: { a2: 0.419, d3: 0.076, d4: 1.924, d2: 2.704 },
  8: { a2: 0.373, d3: 0.136, d4: 1.864, d2: 2.847 },
  9: { a2: 0.337, d3: 0.184, d4: 1.816, d2: 2.970 },
  10: { a2: 0.308, d3: 0.223, d4: 1.777, d2: 3.078 },
};

export function spcConstants(n: number): SpcConstants | undefined {
  return Object.prototype.hasOwnProperty.call(SPC_CONSTANTS, n) ? SPC_CONSTANTS[n] : undefined;
}

export class SpcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpcError";
  }
}

export interface SpcPoint {
  readonly subgroup: number;
  readonly mean: number;
  readonly range: number;
  readonly values: number[];
}

export interface SpcViolation {
  readonly rule: "WE-1" | "WE-2" | "WE-3" | "WE-4";
  readonly description: string;
  readonly subgroups: number[];
}

export interface SpcCapability {
  readonly cp: number | null;
  readonly cpk: number | null;
  readonly sigma: number;
  readonly usl: number | null;
  readonly lsl: number | null;
}

export interface SpcResult {
  readonly points: SpcPoint[];
  readonly subgroupSize: number;
  readonly centerLine: number;
  readonly uclX: number;
  readonly lclX: number;
  readonly rBar: number;
  readonly uclR: number;
  readonly lclR: number;
  readonly capability: SpcCapability;
  readonly violations: SpcViolation[];
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const range = (xs: number[]): number => Math.max(...xs) - Math.min(...xs);

/**
 * Compute the X̄/R chart for a set of equal-sized subgroups. Requires a uniform
 * subgroup size 2–10 (the constant table's domain). `spec` supplies USL/LSL for
 * capability; omit for the control chart alone.
 */
export function computeXbarR(
  subgroups: readonly (readonly number[])[],
  spec?: { usl?: number | null; lsl?: number | null },
): SpcResult {
  if (subgroups.length === 0) throw new SpcError("No subgroups to chart");
  const n = subgroups[0]!.length;
  const k = spcConstants(n);
  if (k === undefined) throw new SpcError(`Unsupported subgroup size ${n} (must be 2–10)`);
  if (subgroups.some((s) => s.length !== n)) {
    throw new SpcError("All subgroups must be the same size for an X̄/R chart");
  }

  const points: SpcPoint[] = subgroups.map((s, i) => ({
    subgroup: i,
    mean: mean([...s]),
    range: range([...s]),
    values: [...s],
  }));

  const centerLine = mean(points.map((p) => p.mean));
  const rBar = mean(points.map((p) => p.range));
  const uclX = centerLine + k.a2 * rBar;
  const lclX = centerLine - k.a2 * rBar;
  const uclR = k.d4 * rBar;
  const lclR = k.d3 * rBar;

  // σ̂ of the individual values (R̄/d2); the σ of the subgroup means (what the
  // ±1σ/±2σ zones are drawn in) is σ̂/√n = (UCL−CL)/3.
  const sigmaIndiv = rBar / k.d2;
  const sigmaMean = (uclX - centerLine) / 3;

  const violations = westernElectric(points.map((p) => p.mean), centerLine, sigmaMean);
  const capability = computeCapability(centerLine, sigmaIndiv, spec);

  return { points, subgroupSize: n, centerLine, uclX, lclX, rBar, uclR, lclR, capability, violations };
}

function computeCapability(
  centerLine: number,
  sigma: number,
  spec?: { usl?: number | null; lsl?: number | null },
): SpcCapability {
  const usl = spec?.usl ?? null;
  const lsl = spec?.lsl ?? null;
  if (sigma === 0 || (usl === null && lsl === null)) {
    return { cp: null, cpk: null, sigma, usl, lsl };
  }
  // Cp needs both limits; Cpk works one-sided.
  const cp = usl !== null && lsl !== null ? (usl - lsl) / (6 * sigma) : null;
  const upper = usl !== null ? (usl - centerLine) / (3 * sigma) : Infinity;
  const lower = lsl !== null ? (centerLine - lsl) / (3 * sigma) : Infinity;
  const cpk = Math.min(upper, lower);
  return { cp, cpk: Number.isFinite(cpk) ? cpk : null, sigma, usl, lsl };
}

/**
 * Western-Electric runs rules on the subgroup means. Zones are ±1σ/±2σ/±3σ of
 * the mean-of-means (σ here is the σ of the subgroup means).
 *  WE-1: one point beyond 3σ.
 *  WE-2: 2 of 3 consecutive points beyond 2σ on the same side.
 *  WE-3: 4 of 5 consecutive points beyond 1σ on the same side.
 *  WE-4: 8 consecutive points on the same side of the center line.
 */
export function westernElectric(means: number[], center: number, sigma: number): SpcViolation[] {
  const out: SpcViolation[] = [];
  if (sigma === 0) return out;
  // zone[i] = how many σ above (positive) / below (negative) center point i is.
  const z = means.map((m) => (m - center) / sigma);

  const we1 = means.map((_, i) => i).filter((i) => Math.abs(z[i]!) > 3);
  if (we1.length > 0) out.push({ rule: "WE-1", description: "Point beyond ±3σ", subgroups: we1 });

  const we2 = windowRule(z, 3, 2, 2);
  if (we2.length > 0) out.push({ rule: "WE-2", description: "2 of 3 points beyond ±2σ (same side)", subgroups: we2 });

  const we3 = windowRule(z, 5, 4, 1);
  if (we3.length > 0) out.push({ rule: "WE-3", description: "4 of 5 points beyond ±1σ (same side)", subgroups: we3 });

  const we4 = consecutiveSameSide(z, 8);
  if (we4.length > 0) out.push({ rule: "WE-4", description: "8 consecutive points on one side of center", subgroups: we4 });

  return out;
}

/**
 * "m of the last `windowSize` points beyond `threshold`σ on the same side."
 * Flags the triggering point (the last of the window) — and, so the chart can
 * highlight the pattern, every point in the window that is on the flagged side.
 */
function windowRule(z: number[], windowSize: number, need: number, threshold: number): number[] {
  const flagged = new Set<number>();
  for (let i = windowSize - 1; i < z.length; i++) {
    for (const sign of [1, -1] as const) {
      const inWindow: number[] = [];
      for (let j = i - windowSize + 1; j <= i; j++) {
        if (sign === 1 ? z[j]! > threshold : z[j]! < -threshold) inWindow.push(j);
      }
      if (inWindow.length >= need) for (const j of inWindow) flagged.add(j);
    }
  }
  return [...flagged].sort((a, b) => a - b);
}

/** Longest-runs rule: any run of ≥ `need` consecutive points strictly one side. */
function consecutiveSameSide(z: number[], need: number): number[] {
  const flagged = new Set<number>();
  let start = 0;
  for (let i = 1; i <= z.length; i++) {
    const sameSide = i < z.length && Math.sign(z[i]!) === Math.sign(z[i - 1]!) && Math.sign(z[i]!) !== 0;
    if (!sameSide) {
      if (i - start >= need) for (let j = start; j < i; j++) flagged.add(j);
      start = i;
    }
  }
  return [...flagged].sort((a, b) => a - b);
}
