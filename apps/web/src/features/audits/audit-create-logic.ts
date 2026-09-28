import { z } from "zod";
import { AuditType } from "@kaenal/types";

/**
 * Pure form-validation logic for `audit-create-dialog.tsx`, kept apart from
 * the React component (same precedent as `lib/collab-crdt.ts`) so the
 * schema and the date conversion are unit-testable without rendering
 * anything.
 */

export const DateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .optional()
  .or(z.literal(""));

export const FormSchema = z
  .object({
    title: z.string().min(1, "errorTitleRequired").max(200),
    type: AuditType,
    standard: z.string().max(200).optional().or(z.literal("")),
    plantId: z.string().uuid().optional().or(z.literal("")),
    location: z.string().max(200).optional().or(z.literal("")),
    description: z.string().max(4000).optional().or(z.literal("")),
    scope: z.array(z.string().min(1).max(200)).max(50),
    startAt: DateOnly,
    endAt: DateOnly,
    leadAuditorId: z.string().uuid().optional().or(z.literal("")),
    team: z.array(z.string().uuid()),
    auditeeIds: z.array(z.string().uuid()),
  })
  .refine((v) => v.startAt === "" || v.endAt === "" || v.startAt === undefined || v.endAt === undefined || v.endAt >= v.startAt, {
    message: "errorEndBeforeStart",
    path: ["endAt"],
  });
export type FormValues = z.infer<typeof FormSchema>;

/** Converts the HTML date input's `YYYY-MM-DD` (or `""`/undefined) into the
 *  ISO datetime the create-audit contract expects, or `null` when unset. */
export function toIso(dateOnly: string | undefined): string | null {
  if (dateOnly === undefined || dateOnly === "") return null;
  return new Date(`${dateOnly}T00:00:00.000Z`).toISOString();
}
