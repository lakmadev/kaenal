import { z } from "zod";
import { TenancyModel, TenantStatus } from "./enums.js";

/**
 * Tenant slug = the subdomain (`bosch` → `bosch.kaenal.app`), per 01 §3.2.
 * Shape: starts and ends alphanumeric, 3–40 chars, lowercase, inner hyphens ok.
 */
export const TENANT_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/**
 * Slugs that would collide with platform hostnames or shadow a real route.
 * Reserving these is cheap; reclaiming one after a tenant owns it is not.
 */
export const RESERVED_TENANT_SLUGS = new Set([
  "www",
  "api",
  "admin",
  "app",
  "status",
  "docs",
]);

export const TenantSlug = z
  .string()
  .regex(
    TENANT_SLUG_PATTERN,
    "Slug must be 3–40 lowercase alphanumeric characters, hyphens allowed inside",
  )
  .refine((slug) => !RESERVED_TENANT_SLUGS.has(slug), {
    message: "Slug is reserved",
  });

export const Tenant = z.object({
  id: z.string().uuid(),
  slug: TenantSlug,
  name: z.string().min(1).max(120),
  model: TenancyModel,
  databaseUrlSecretRef: z.string().nullable(),
  region: z.string().min(1),
  status: TenantStatus,
  createdAt: z.date(),
});
export type Tenant = z.infer<typeof Tenant>;
