import { z } from "zod";

/**
 * Boot-time configuration (01 §2).
 *
 * Parsed once, at module load, and the process dies if anything is missing or
 * malformed. The alternative — reading `process.env` at request time — turns a
 * deploy mistake into a 500 on a customer's request instead of a container
 * that never accepts traffic.
 */

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_APP_URL: z.string().url(),
  DATABASE_PUBLIC_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 bytes — generate with `openssl rand -base64 32`"),

  APP_BASE_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  PORT: z.coerce.number().int().positive().default(3001),

  /**
   * The apex the tenant subdomain hangs off (01 §3.2): with `kaenal.app`,
   * `bosch.kaenal.app` resolves to tenant `bosch`. Required, because guessing
   * it from the Host header is how subdomain confusion bugs start.
   */
  TENANT_ROOT_DOMAIN: z.string().min(1).default("kaenal.local"),

  /** Registry cache TTL in seconds (01 §3.2 specifies 60). */
  TENANT_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),

  /**
   * Model B (dedicated Postgres per tenant, 01 §3.3): the LRU cap on how many
   * per-tenant connection pools the API holds at once. Spec suggests ~20; the
   * least-recently-used tenant's pool is closed past this. Only relevant to
   * deployments that host dedicated tenants.
   */
  TENANT_MAX_DEDICATED_POOLS: z.coerce.number().int().positive().default(20),

  /**
   * Object storage (03 §7). MinIO locally, S3/R2 in cloud. Defaults target the
   * docker-compose MinIO so uploads work out of the box; production overrides
   * every value. `S3_FORCE_PATH_STYLE` is required for MinIO (no vhost buckets).
   */
  S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
  S3_BUCKET: z.string().min(1).default("kaenal-local"),
  S3_KEY: z.string().min(1).default("kaenal"),
  S3_SECRET: z.string().min(1).default("kaenal_local_pw"),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  /** Presigned-URL TTL in seconds — 03 §7 / §8 specify 15 minutes. */
  S3_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),

  /**
   * Rate limiting (03 §9). Left unset it follows the environment: on
   * everywhere except automated tests, which fire hundreds of requests as one
   * user in one second and would otherwise trip their own limiter. The
   * dedicated rate-limit test sets this true explicitly.
   */
  RATE_LIMIT_ENABLED: z.coerce.boolean().optional(),

  /**
   * Background jobs (06). When off, the API's job producers are no-ops (nothing
   * is enqueued and no BullMQ Redis connection is opened) — the default in
   * `test`, so suites never leak queue connections. The worker process
   * (`pnpm --filter @kaenal/api worker`) sets it on to consume.
   */
  JOBS_ENABLED: z.coerce.boolean().optional(),
}).transform((e) => ({
  ...e,
  RATE_LIMIT_ENABLED: e.RATE_LIMIT_ENABLED ?? e.NODE_ENV !== "test",
  JOBS_ENABLED: e.JOBS_ENABLED ?? e.NODE_ENV !== "test",
}));

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);

  if (!parsed.success) {
    // Field names only — never the values, which are mostly credentials (07 §4).
    const problems = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }

  return parsed.data;
}
