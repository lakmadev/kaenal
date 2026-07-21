import { z } from "zod";
import { InspectionStatus, RiskLevel, TemplateStatus } from "./enums.js";
import { FormResponses, FormSchema } from "./form.js";

/**
 * Wire representations (03 §1). camelCase, the API's public shape — distinct
 * from the snake_case database rows. A service maps a row onto one of these; a
 * column rename never leaks to the client because the mapping is explicit.
 */

// --- Inspection templates ---------------------------------------------------

export const TemplateDto = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  version: z.number().int().positive(),
  status: TemplateStatus,
  schema: FormSchema,
  usageCount: z.number().int().nonnegative(),
  lockVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TemplateDto = z.infer<typeof TemplateDto>;

export const CreateTemplateBody = z.object({
  name: z.string().min(1).max(200),
  schema: FormSchema,
});
export type CreateTemplateBody = z.infer<typeof CreateTemplateBody>;

// --- Inspections ------------------------------------------------------------

export const InspectionDto = z.object({
  id: z.string().uuid(),
  code: z.string(),
  title: z.string().min(1).max(200),
  templateId: z.string().uuid(),
  templateVersion: z.number().int().positive(),
  inspectorId: z.string().uuid().nullable(),
  plantId: z.string().uuid().nullable(),
  areaId: z.string().uuid().nullable(),
  status: InspectionStatus,
  risk: RiskLevel.nullable(),
  scheduledAt: z.string().datetime().nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  score: z.number().nullable(),
  responses: FormResponses,
  lockVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type InspectionDto = z.infer<typeof InspectionDto>;

export const CreateInspectionBody = z.object({
  title: z.string().min(1).max(200),
  templateId: z.string().uuid(),
  inspectorId: z.string().uuid().nullable().optional(),
  plantId: z.string().uuid().nullable().optional(),
  areaId: z.string().uuid().nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});
export type CreateInspectionBody = z.infer<typeof CreateInspectionBody>;

/**
 * Completing an inspection submits the answers and the concurrency token. The
 * server validates the responses against the template schema and computes the
 * score — the client never sends a score, because a client-computed score is a
 * number a customer can forge.
 */
export const CompleteInspectionBody = z.object({
  responses: FormResponses,
  version: z.number().int().nonnegative(),
});
export type CompleteInspectionBody = z.infer<typeof CompleteInspectionBody>;

export const StartInspectionBody = z.object({
  version: z.number().int().nonnegative(),
});
export type StartInspectionBody = z.infer<typeof StartInspectionBody>;

// --- Me (session identity) --------------------------------------------------

export const MeDto = z.object({
  userId: z.string().uuid(),
  tenantSlug: z.string(),
  role: z.string(),
  capabilities: z.array(z.string()),
});
export type MeDto = z.infer<typeof MeDto>;
