import { describe, expect, it } from "vitest";
import {
  ACCESS_TOKEN_TTL_MS,
  canRedeemToken,
  checkPasswordPolicy,
  isExpired,
  isLocked,
  LOCKOUT_DURATION_MS,
  MAX_FAILED_ATTEMPTS,
  MIN_PASSWORD_LENGTH,
  REFRESH_TOKEN_TTL_MS,
  registerFailure,
  registerSuccess,
  slideSessionExpiry,
  WEB_SESSION_TTL_MS,
} from "../src/auth-policy.js";

const NOW = new Date("2026-07-20T12:00:00.000Z");

describe("lockout (03 §2: 10 failures → 15 minutes)", () => {
  it("does not lock before the threshold", () => {
    let state = { failedAttempts: 0, lockedUntil: null as Date | null };
    for (let i = 1; i < MAX_FAILED_ATTEMPTS; i++) {
      state = registerFailure(state, NOW);
      expect(isLocked(state, NOW), `after ${i} failures`).toBe(false);
    }
    expect(state.failedAttempts).toBe(MAX_FAILED_ATTEMPTS - 1);
  });

  it("locks exactly on the 10th failure", () => {
    let state = { failedAttempts: MAX_FAILED_ATTEMPTS - 1, lockedUntil: null as Date | null };
    state = registerFailure(state, NOW);
    expect(isLocked(state, NOW)).toBe(true);
    expect(state.lockedUntil?.getTime()).toBe(NOW.getTime() + LOCKOUT_DURATION_MS);
  });

  it("expires the lock after exactly 15 minutes", () => {
    const state = registerFailure({ failedAttempts: 9, lockedUntil: null }, NOW);
    const justBefore = new Date(NOW.getTime() + LOCKOUT_DURATION_MS - 1);
    const justAfter = new Date(NOW.getTime() + LOCKOUT_DURATION_MS + 1);

    expect(isLocked(state, justBefore)).toBe(true);
    expect(isLocked(state, justAfter)).toBe(false);
  });

  it("re-locks immediately on the next failure after a lock expires", () => {
    // The counter does not reset when the lock lapses, so waiting out one
    // lockout does not buy another ten attempts.
    let state = registerFailure({ failedAttempts: 9, lockedUntil: null }, NOW);
    const later = new Date(NOW.getTime() + LOCKOUT_DURATION_MS + 1000);
    expect(isLocked(state, later)).toBe(false);

    state = registerFailure(state, later);
    expect(isLocked(state, later)).toBe(true);
    expect(state.failedAttempts).toBe(MAX_FAILED_ATTEMPTS + 1);
  });

  it("clears the counter on success", () => {
    expect(registerSuccess()).toEqual({ failedAttempts: 0, lockedUntil: null });
  });

  it("treats a null lockedUntil as unlocked", () => {
    expect(isLocked({ failedAttempts: 3, lockedUntil: null }, NOW)).toBe(false);
  });
});

describe("password policy", () => {
  it("rejects anything under the minimum length", () => {
    const result = checkPasswordPolicy("x".repeat(MIN_PASSWORD_LENGTH - 1));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("VALIDATION_FAILED");
  });

  it("accepts the minimum length exactly", () => {
    expect(checkPasswordPolicy("x".repeat(MIN_PASSWORD_LENGTH)).ok).toBe(true);
  });

  it("rejects an absurdly long password", () => {
    // argon2 will hash whatever it is handed, so an unbounded password is a
    // CPU exhaustion vector on an unauthenticated endpoint.
    expect(checkPasswordPolicy("x".repeat(100_000)).ok).toBe(false);
  });

  it("rejects a password containing the email address", () => {
    expect(checkPasswordPolicy("ada@example.com!!", "ada@example.com").ok).toBe(false);
  });

  it("rejects a password containing the email local part", () => {
    expect(checkPasswordPolicy("adalovelace2026", "ada@example.com").ok).toBe(false);
  });

  it("is case-insensitive about that", () => {
    expect(checkPasswordPolicy("ADALOVELACE2026", "ada@example.com").ok).toBe(false);
  });

  it("does not reject on a 2-character local part appearing by chance", () => {
    // "jo" would otherwise ban half the dictionary.
    expect(checkPasswordPolicy("projectorlamp99", "jo@example.com").ok).toBe(true);
  });

  it("accepts a reasonable passphrase", () => {
    expect(checkPasswordPolicy("correct-horse-battery-staple", "ada@example.com").ok).toBe(true);
  });
});

describe("session lifetimes (03 §2)", () => {
  it("uses the documented TTLs", () => {
    expect(WEB_SESSION_TTL_MS).toBe(12 * 60 * 60 * 1000);
    expect(ACCESS_TOKEN_TTL_MS).toBe(15 * 60 * 1000);
    expect(REFRESH_TOKEN_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("slides the expiry forward from now", () => {
    expect(slideSessionExpiry(NOW).getTime()).toBe(NOW.getTime() + WEB_SESSION_TTL_MS);
  });

  it("treats the exact expiry instant as expired", () => {
    // Boundary chosen deliberately: a token valid AT its expiry is valid for
    // one more request than it should be.
    expect(isExpired(NOW, NOW)).toBe(true);
    expect(isExpired(new Date(NOW.getTime() + 1), NOW)).toBe(false);
  });
});

describe("single-use tokens", () => {
  const fresh = { expiresAt: new Date(NOW.getTime() + 1000), usedAt: null, revokedAt: null };

  it("accepts a fresh token", () => {
    expect(canRedeemToken(fresh, NOW).ok).toBe(true);
  });

  it.each([
    ["expired", { ...fresh, expiresAt: new Date(NOW.getTime() - 1) }],
    ["already used", { ...fresh, usedAt: NOW }],
    ["revoked", { ...fresh, revokedAt: NOW }],
  ])("rejects a %s token", (_label, record) => {
    expect(canRedeemToken(record, NOW).ok).toBe(false);
  });

  it("gives an IDENTICAL response for every rejection reason", () => {
    // "Already used" would confirm the token was genuine, which is exactly
    // what someone holding a guessed token wants to learn.
    const reasons = [
      { ...fresh, expiresAt: new Date(NOW.getTime() - 1) },
      { ...fresh, usedAt: NOW },
      { ...fresh, revokedAt: NOW },
    ].map((r) => canRedeemToken(r, NOW));

    for (const r of reasons) {
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.code).toBe("NOT_FOUND");
      expect(r.message).toBe("This link is invalid or has expired");
    }
  });
});
