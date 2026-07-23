import type { TenantStatus } from "@kaenal/types";

/**
 * Tenant offboarding lifecycle logic (01 §3.4, 06 §1 `housekeeping`, 07 §5).
 *
 * Offboarding a tenant is staged and deliberately unhurried: `offboard-tenant`
 * flips the registry to `offboarding` (blocking logins) and starts a grace
 * clock; only after the grace elapses — AND no legal hold is active, AND the
 * export bundle has been taken — does the nightly job permanently purge the
 * tenant's data. The grace arithmetic is the pure, testable part and lives here;
 * the job checks holds, produces the export, and deletes.
 */

/** Days between offboarding start and the earliest permissible hard delete (01 §3.4). */
export const OFFBOARDING_GRACE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The instant the grace period ends and purge becomes permissible. */
export function offboardingGraceEndsAt(offboardingAt: Date): Date {
  return new Date(offboardingAt.getTime() + OFFBOARDING_GRACE_DAYS * DAY_MS);
}

/** Has the grace period elapsed as of `now`? */
export function isGraceElapsed(offboardingAt: Date, now: Date): boolean {
  return now.getTime() >= offboardingGraceEndsAt(offboardingAt).getTime();
}

export interface OffboardCandidate {
  readonly status: TenantStatus;
  /** When offboarding began; null if the tenant never entered offboarding. */
  readonly offboardingAt: Date | null;
}

/**
 * Is this tenant eligible for the permanent purge right now? Only a tenant that
 * is actually `offboarding`, with a recorded start whose grace has elapsed.
 * (Legal-hold and export-taken checks are enforced by the job against live DB
 * state, not derivable from these fields.)
 */
export function isOffboardPurgeEligible(candidate: OffboardCandidate, now: Date): boolean {
  return (
    candidate.status === "offboarding" &&
    candidate.offboardingAt !== null &&
    isGraceElapsed(candidate.offboardingAt, now)
  );
}
