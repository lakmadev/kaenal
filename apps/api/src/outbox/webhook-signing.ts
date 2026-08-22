import { createHmac, createHash } from "node:crypto";

/**
 * Webhook signing + subscription matching (Sequence 2, delivery slice). Pure
 * (no I/O), so it is unit-tested directly.
 *
 * Signing follows the widely-adopted scheme (Stripe/GitHub-style): the HMAC is
 * taken over `${timestamp}.${body}`, NOT the body alone, so a captured request
 * cannot be replayed with a fresh timestamp — the receiver rejects a signature
 * whose timestamp is outside its tolerance. The receiver recomputes the same
 * HMAC with the shared secret and compares in constant time.
 */

/** Request headers carried on every delivery. */
export const WEBHOOK_HEADERS = {
  signature: "x-kaenal-signature",
  timestamp: "x-kaenal-timestamp",
  event: "x-kaenal-event",
  eventId: "x-kaenal-event-id",
} as const;

/**
 * HMAC-SHA256 of `${timestamp}.${body}` under `secret`, hex-encoded. The header
 * value is prefixed `sha256=` (see {@link signatureHeader}) so the algorithm is
 * explicit and the scheme can evolve without breaking receivers.
 */
export function signWebhook(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

/** The full `x-kaenal-signature` header value for a body. */
export function signatureHeader(secret: string, timestamp: string, body: string): string {
  return `sha256=${signWebhook(secret, timestamp, body)}`;
}

/**
 * SHA-256 of the delivered body, hex-encoded — stored on the delivery log
 * (`integration_events.payload_digest`) so an operator can confirm WHAT was sent
 * without the log holding a copy of the (potentially sensitive) payload.
 */
export function payloadDigest(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

/**
 * Whether an endpoint subscribed to `subscription` should receive `eventType`.
 *
 * `subscription` is the endpoint's `config.events` string:
 *  - absent / empty / `*`         → every event,
 *  - a comma-separated list of    → exact names (`ncr.created`) or
 *    patterns                       domain wildcards (`ncr.*`).
 *
 * Matching is deliberately simple and total — an endpoint over-subscribes at
 * worst (the receiver ignores what it doesn't want), never silently mis-routes.
 */
export function webhookSubscribes(subscription: string | undefined, eventType: string): boolean {
  const spec = (subscription ?? "").trim();
  if (spec === "" || spec === "*") return true;
  return spec
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "")
    .some((pattern) => {
      if (pattern === eventType || pattern === "*") return true;
      if (pattern.endsWith(".*")) return eventType.startsWith(pattern.slice(0, -1)); // "ncr." prefix
      return false;
    });
}
