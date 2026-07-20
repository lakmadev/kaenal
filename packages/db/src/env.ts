import { config } from "dotenv";
import { z } from "zod";

// Load the repo-root .env for scripts and tests. Apps load their own env.
config({ path: new URL("../../../.env", import.meta.url).pathname });

/**
 * Config is validated once at boot and crashes on anything missing or
 * malformed (01 §2) — a bad DATABASE_URL should fail the process, not surface
 * as a confusing error on the first request that happens to touch the DB.
 */
const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_APP_URL: z.string().url(),
  DATABASE_PUBLIC_URL: z.string().url().optional(),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(
    `Invalid database environment. Copy .env.example to .env and fill it in.\n${issues}`,
  );
}

export const env = parsed.data;
