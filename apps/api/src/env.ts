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
   * Rate limiting (03 §9). Left unset it follows the environment: on
   * everywhere except automated tests, which fire hundreds of requests as one
   * user in one second and would otherwise trip their own limiter. The
   * dedicated rate-limit test sets this true explicitly.
   */
  RATE_LIMIT_ENABLED: z.coerce.boolean().optional(),
}).transform((e) => ({
  ...e,
  RATE_LIMIT_ENABLED: e.RATE_LIMIT_ENABLED ?? e.NODE_ENV !== "test",
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
