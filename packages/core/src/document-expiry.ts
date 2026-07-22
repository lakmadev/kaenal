/**
 * Controlled-document expiry thresholds (06 §1 `docs`).
 *
 * The daily `docs` job reminds a document's owner as its `expires_at`
 * approaches — at 90, then 30, then 7 days out. The "which reminder is due now"
 * decision is the pure, testable part and lives here; the job just queries and
 * notifies. Each threshold fires once (the job dedupes on `(doc, threshold)`),
 * so a document created already inside a window only gets that window's notice,
 * not the ones it skipped past.
 */

/** Reminder thresholds in days, largest first (06 §1: 90/30/7). */
export const EXPIRY_THRESHOLDS = [90, 30, 7] as const;
export type ExpiryThreshold = (typeof EXPIRY_THRESHOLDS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days from `now` until `expiresAt`, rounded up — a document 29.5 days
 * out has 30 days remaining, so it counts as inside the 30-day window. Negative
 * once expired.
 */
export function daysUntilExpiry(expiresAt: Date, now: Date): number {
  return Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS);
}

/**
 * The reminder threshold currently in effect for a document, or null when it is
 * more than 90 days out (nothing due yet). Returns the *smallest* threshold the
 * document has crossed — the most urgent applicable reminder — so an already-
 * expired or near-expiry document surfaces the 7-day notice, not the 90-day one.
 */
export function activeExpiryThreshold(expiresAt: Date, now: Date): ExpiryThreshold | null {
  const days = daysUntilExpiry(expiresAt, now);
  let active: ExpiryThreshold | null = null;
  for (const t of EXPIRY_THRESHOLDS) {
    if (days <= t) active = t; // keep narrowing; the last (smallest) wins
  }
  return active;
}
