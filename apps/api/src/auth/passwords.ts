import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";

/**
 * Credential primitives (03 §2, 07 §4).
 */

/**
 * argon2id with OWASP's recommended floor (19 MiB, t=2, p=1).
 *
 * argon2id rather than bcrypt because the memory cost is what actually blunts
 * GPU cracking of a stolen hash; bcrypt's work factor is CPU-only. The
 * parameters are encoded in the hash string, so raising them later re-hashes
 * on next sign-in without invalidating existing passwords.
 */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

/**
 * Verifies a password against a stored hash.
 *
 * Never throws on a malformed hash — a corrupted or legacy value must read as
 * "wrong password", not as a 500 that tells the caller their account is
 * special in some way.
 */
export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/**
 * A dummy hash used to keep sign-in timing flat for unknown accounts.
 *
 * Without this, "no such user" returns in microseconds while a real user costs
 * an argon2 verify — a timing oracle that turns the login form into a user
 * enumeration endpoint. Computed once at module load against a random secret.
 */
let dummyHash: string | null = null;

export async function equalizeTiming(plain: string): Promise<void> {
  dummyHash ??= await hashPassword(randomBytes(32).toString("hex"));
  await verifyPassword(dummyHash, plain);
}

/**
 * Opaque token for sessions, invitations and password resets.
 *
 * 32 bytes from the CSPRNG, base64url so it survives a URL unencoded. Only the
 * SHA-256 is ever stored: a leaked database backup must not yield working
 * links or sessions. SHA-256 rather than argon2 here on purpose — these tokens
 * are already high-entropy, so there is nothing to slow-hash against, and
 * session lookup happens on every request.
 */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Constant-time comparison for values that are compared outside a DB lookup
 * (CSRF tokens). Length is not secret; content is.
 */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
