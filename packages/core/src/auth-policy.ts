/**
 * Authentication policy (03 §2, 07 §4).
 *
 * Pure decisions about lockout, session lifetime and token expiry. They live
 * in core rather than in the API service because they are business rules an
 * auditor will ask about, they need testing without a database, and the mobile
 * app needs the same numbers to decide when to refresh.
 */

import { allow, deny, type Decision } from "./result.js";

/** 03 §2: 10 failed attempts → 15 minute lock. */
export const MAX_FAILED_ATTEMPTS = 10;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

/** 03 §2: web session 12h sliding; mobile access 15 min, refresh 30 days. */
export const WEB_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** 03 §2: invitations 7 days, password resets 30 minutes, both single-use. */
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

export interface LockoutState {
  readonly failedAttempts: number;
  readonly lockedUntil: Date | null;
}

export function isLocked(state: LockoutState, now: Date): boolean {
  return state.lockedUntil !== null && state.lockedUntil.getTime() > now.getTime();
}

/**
 * The new lockout state after a failed attempt.
 *
 * The counter keeps climbing past the threshold rather than resetting on lock,
 * so a caller who waits out one lock and fails once more is locked again
 * immediately instead of getting a fresh budget of ten.
 */
export function registerFailure(state: LockoutState, now: Date): LockoutState {
  const failedAttempts = state.failedAttempts + 1;
  return failedAttempts >= MAX_FAILED_ATTEMPTS
    ? { failedAttempts, lockedUntil: new Date(now.getTime() + LOCKOUT_DURATION_MS) }
    : { failedAttempts, lockedUntil: null };
}

export function registerSuccess(): LockoutState {
  return { failedAttempts: 0, lockedUntil: null };
}

/**
 * Password strength (07 §4 requires zxcvbn ≥ 3).
 *
 * These structural rules are a floor, not the requirement: real scoring needs
 * the zxcvbn dictionary and lands with the web app, where the meter is shown
 * as the user types. Length dominates because it is the only property that
 * reliably resists an offline attack on a stolen hash.
 */
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 256;

export function checkPasswordPolicy(password: string, email?: string): Decision {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return deny("VALIDATION_FAILED", `Password must be at least ${MIN_PASSWORD_LENGTH} characters`, {
      field: "password",
      minLength: MIN_PASSWORD_LENGTH,
    });
  }

  // Bounded to keep a megabyte "password" from becoming a CPU exhaustion
  // vector: argon2 hashes whatever it is given.
  if (password.length > MAX_PASSWORD_LENGTH) {
    return deny("VALIDATION_FAILED", `Password must be at most ${MAX_PASSWORD_LENGTH} characters`, {
      field: "password",
      maxLength: MAX_PASSWORD_LENGTH,
    });
  }

  if (email !== undefined && email !== "") {
    const localPart = email.split("@")[0]?.toLowerCase() ?? "";
    const lower = password.toLowerCase();
    if (lower.includes(email.toLowerCase()) || (localPart.length >= 3 && lower.includes(localPart))) {
      return deny("VALIDATION_FAILED", "Password must not contain your email address", {
        field: "password",
      });
    }
  }

  return allow();
}

/** Sliding expiry for web sessions (03 §2). */
export function slideSessionExpiry(now: Date): Date {
  return new Date(now.getTime() + WEB_SESSION_TTL_MS);
}

export function isExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export interface TokenRecord {
  readonly expiresAt: Date;
  readonly usedAt: Date | null;
  readonly revokedAt: Date | null;
}

/**
 * Whether a single-use token (invitation, password reset) may be redeemed.
 *
 * Every rejection returns the same code and message on purpose: telling a
 * caller that a token is "already used" rather than "expired" confirms the
 * token was real, which is information an attacker holding a guessed token
 * does not otherwise have.
 */
export function canRedeemToken(record: TokenRecord, now: Date): Decision {
  const invalid = deny("NOT_FOUND", "This link is invalid or has expired");

  if (record.revokedAt !== null) return invalid;
  if (record.usedAt !== null) return invalid;
  if (isExpired(record.expiresAt, now)) return invalid;
  return allow();
}
