import { z } from "zod";

/**
 * SPC analytics (Data Platform B5; qms-risk-spc.jsx `SPCCharts`). Measurements
 * are ingested per characteristic + subgroup; `/v1/spc` computes X̄/R control
 * limits, Western-Electric runs rules, and process capability (Cp/Cpk) — all in
 * `packages/core/spc.ts`, so the math is pure and testable. These are the wire
 * shapes.
 */

export const MEASUREMENT_SOURCES = ["manual", "gauge", "inspection", "connector"] as const;
export const MeasurementSource = z.enum(MEASUREMENT_SOURCES);
export type MeasurementSource = z.infer<typeof MeasurementSource>;

/** One measured value in a subgroup. */
export const MeasurementInput = z.object({
  value: z.number().finite(),
  subgroup: z.number().int().nonnegative(),
  takenAt: z.string().datetime().optional(),
});
export type MeasurementInput = z.infer<typeof MeasurementInput>;

/** Bulk ingest for one characteristic (all rows share part/characteristic/spec). */
export const IngestMeasurementsBody = z.object({
  part: z.string().min(1).max(120),
  characteristic: z.string().min(1).max(120),
  unit: z.string().max(24).optional(),
  usl: z.number().finite().optional(),
  lsl: z.number().finite().optional(),
  target: z.number().finite().optional(),
  source: MeasurementSource.default("manual"),
  points: z.array(MeasurementInput).min(1).max(5000),
});
export type IngestMeasurementsBody = z.infer<typeof IngestMeasurementsBody>;

/** A characteristic that has measurement data (the chart's series picker). */
export const SpcCharacteristicDto = z.object({
  part: z.string(),
  characteristic: z.string(),
  unit: z.string().nullable(),
  subgroups: z.number(),
  measurements: z.number(),
});
export type SpcCharacteristicDto = z.infer<typeof SpcCharacteristicDto>;

export const SpcCharacteristicsResult = z.object({ items: z.array(SpcCharacteristicDto) });
export type SpcCharacteristicsResult = z.infer<typeof SpcCharacteristicsResult>;

/** One subgroup's mean + range, with the raw values (for plotting). */
export const SpcPointDto = z.object({
  subgroup: z.number(),
  mean: z.number(),
  range: z.number(),
  values: z.array(z.number()),
});
export type SpcPointDto = z.infer<typeof SpcPointDto>;

/** A Western-Electric violation: which rule, and the subgroup indices it flags. */
export const SpcViolationDto = z.object({
  rule: z.enum(["WE-1", "WE-2", "WE-3", "WE-4"]),
  description: z.string(),
  subgroups: z.array(z.number()),
});
export type SpcViolationDto = z.infer<typeof SpcViolationDto>;

/** Process-capability indices (null when spec limits aren't supplied). */
export const SpcCapabilityDto = z.object({
  cp: z.number().nullable(),
  cpk: z.number().nullable(),
  sigma: z.number(),
  usl: z.number().nullable(),
  lsl: z.number().nullable(),
});
export type SpcCapabilityDto = z.infer<typeof SpcCapabilityDto>;

/** The computed X̄/R chart for a characteristic. */
export const SpcChartDto = z.object({
  part: z.string(),
  characteristic: z.string(),
  unit: z.string().nullable(),
  subgroupSize: z.number(),
  points: z.array(SpcPointDto),
  centerLine: z.number(),
  uclX: z.number(),
  lclX: z.number(),
  rBar: z.number(),
  uclR: z.number(),
  lclR: z.number(),
  capability: SpcCapabilityDto,
  violations: z.array(SpcViolationDto),
});
export type SpcChartDto = z.infer<typeof SpcChartDto>;
