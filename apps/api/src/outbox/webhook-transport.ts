/**
 * The HTTP seam for webhook delivery (Sequence 2, delivery slice).
 *
 * Isolating the actual network call behind a tiny port keeps the delivery
 * handler unit-testable without a live server (tests inject a fake that records
 * calls and returns a canned status), and keeps timeout/abort policy in one
 * place. A delivery is a fire-once POST — no retry lives here; retry is the
 * outbox drainer's job (backoff + attempts), so a transient failure surfaces as
 * a thrown error and the event is re-attempted later.
 */

export interface WebhookResponse {
  readonly status: number;
}

export interface WebhookTransport {
  post(url: string, headers: Record<string, string>, body: string): Promise<WebhookResponse>;
}

/** Default timeout for a single delivery POST. A slow endpoint must not pin a
 *  drain worker; the drainer retries the whole event later. */
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Production transport over the platform `fetch` (Node 20+). Aborts on timeout
 * so a hung receiver can't hold the connection open; the abort surfaces as a
 * rejection, which the handler treats as a failed delivery.
 */
export class FetchWebhookTransport implements WebhookTransport {
  constructor(private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS) {}

  async post(url: string, headers: Record<string, string>, body: string): Promise<WebhookResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { method: "POST", headers, body, signal: controller.signal });
      return { status: res.status };
    } finally {
      clearTimeout(timer);
    }
  }
}
