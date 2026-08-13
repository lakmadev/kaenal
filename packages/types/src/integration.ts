import { z } from "zod";

/**
 * The connector registry (09-INTEGRATIONS §1; report-data.jsx `RB_CONNECTORS`).
 * One shape for every external system — messaging, ERP, warehouse, REST, file.
 * Secrets never cross this boundary: an integration carries only non-secret
 * `config` and a `credentialsRef` *pointer*, never a token.
 */

export const INTEGRATION_PROVIDERS = [
  "slack",
  "ms_teams",
  "ms365",
  "google",
  "smtp",
  "sap",
  "snowflake",
  "oracle",
  "powerbi",
  "sheets",
  "rest",
  "csv",
  "generic_webhook",
] as const;
export const IntegrationProvider = z.enum(INTEGRATION_PROVIDERS);
export type IntegrationProvider = z.infer<typeof IntegrationProvider>;

export const INTEGRATION_STATUSES = ["connected", "error", "disconnected"] as const;
export const IntegrationStatus = z.enum(INTEGRATION_STATUSES);
export type IntegrationStatus = z.infer<typeof IntegrationStatus>;

/** Non-secret settings only. A string→string map keeps it safe to return + audit. */
export const IntegrationConfig = z.record(z.string(), z.string()).default({});
export type IntegrationConfig = z.infer<typeof IntegrationConfig>;

export const IntegrationDto = z.object({
  id: z.string(),
  provider: IntegrationProvider,
  name: z.string(),
  status: IntegrationStatus,
  config: z.record(z.string(), z.string()),
  /** Whether a credential pointer is stored — never the secret itself. */
  hasCredentials: z.boolean(),
  lastError: z.string().nullable(),
  connectedAt: z.string().nullable(),
  lastOkAt: z.string().nullable(),
  connectedBy: z.string().nullable(),
  lockVersion: z.number(),
});
export type IntegrationDto = z.infer<typeof IntegrationDto>;

export const IntegrationEventDto = z.object({
  id: z.string(),
  direction: z.enum(["out", "in"]),
  kind: z.string(),
  status: z.enum(["ok", "failed", "retrying"]),
  attempts: z.number(),
  detail: z.string().nullable(),
  createdAt: z.string(),
});
export type IntegrationEventDto = z.infer<typeof IntegrationEventDto>;

export const CreateIntegrationBody = z.object({
  provider: IntegrationProvider,
  name: z.string().min(1).max(120),
  config: z.record(z.string(), z.string()).optional(),
});
export type CreateIntegrationBody = z.infer<typeof CreateIntegrationBody>;

export const UpdateIntegrationBody = z.object({
  name: z.string().min(1).max(120),
  config: z.record(z.string(), z.string()).optional(),
  version: z.number().int().nonnegative(),
});
export type UpdateIntegrationBody = z.infer<typeof UpdateIntegrationBody>;

/**
 * Connect records a status flip and a credential *pointer* (into the secret
 * manager). The real OAuth/token exchange is out of scope for the substrate —
 * `credentialsRef` is the pointer the callback would have stored; a value is
 * never a token.
 */
export const ConnectIntegrationBody = z.object({
  credentialsRef: z.string().max(200).optional(),
  config: z.record(z.string(), z.string()).optional(),
});
export type ConnectIntegrationBody = z.infer<typeof ConnectIntegrationBody>;

/** A field a connector's schema exposes (adapter `listSchema()`). */
export const ConnectorField = z.object({ key: z.string(), label: z.string(), type: z.enum(["text", "num"]) });
export type ConnectorField = z.infer<typeof ConnectorField>;

export const ConnectorSchemaResult = z.object({ fields: z.array(ConnectorField) });
export type ConnectorSchemaResult = z.infer<typeof ConnectorSchemaResult>;
