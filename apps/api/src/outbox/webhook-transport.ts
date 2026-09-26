import { lookup as dnsLookup } from "node:dns";
import http from "node:http";
import https from "node:https";
import type { LookupAddress, LookupOptions } from "node:dns";
import { isBlockedIp, validateWebhookUrl, type WebhookTargetPolicy } from "@kaenal/types";
import { webhookPolicyFromEnv } from "./webhook-secret-box.js";

/**
 * The HTTP seam for webhook delivery (Sequence 2, delivery slice).
 *
 * Isolating the actual network call behind a tiny port keeps the delivery
 * handler unit-testable without a live server (tests inject a fake that records
 * calls and returns a canned status), and keeps timeout/abort/SSRF policy in one
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

export interface FetchWebhookTransportOptions {
  readonly timeoutMs?: number;
  /** SSRF policy; defaults to the environment's (`WEBHOOK_ALLOW_PRIVATE_TARGETS`). */
  readonly policy?: WebhookTargetPolicy;
}

/**
 * Production transport over node's http(s) client. SSRF is enforced at DELIVERY
 * time, not just at save (a saved hostname can be re-pointed at an internal IP):
 * the URL is re-validated, and the socket's DNS lookup is replaced with one that
 * rejects any private/loopback/link-local/metadata answer — checking the address
 * actually connected to closes the DNS-rebinding window. Redirects are never
 * followed (a 3xx is a failed delivery), so a public host cannot bounce a signed
 * request to an internal one. Aborts on timeout.
 */
export class FetchWebhookTransport implements WebhookTransport {
  private readonly timeoutMs: number;
  private readonly policy: WebhookTargetPolicy;

  constructor(options: FetchWebhookTransportOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.policy = options.policy ?? webhookPolicyFromEnv();
  }

  post(url: string, headers: Record<string, string>, body: string): Promise<WebhookResponse> {
    const violation = validateWebhookUrl(url, this.policy);
    if (violation !== null) return Promise.reject(new Error(`destination not allowed: ${violation}`));

    const target = new URL(url);
    const client = target.protocol === "https:" ? https : http;
    const guarded = !this.policy.allowPrivateTargets;

    return new Promise<WebhookResponse>((resolve, reject) => {
      const req = client.request(
        target,
        {
          method: "POST",
          headers: { ...headers, "content-length": String(Buffer.byteLength(body)) },
          timeout: this.timeoutMs,
          ...(guarded ? { lookup: guardedLookup } : {}),
        },
        (res) => {
          res.resume(); // drain; the body is irrelevant
          res.on("end", () => resolve({ status: res.statusCode ?? 0 }));
          res.on("error", reject);
        },
      );
      req.on("timeout", () => req.destroy(new Error(`timed out after ${this.timeoutMs}ms`)));
      req.on("error", reject);
      req.end(body);
    });
  }
}

type LookupCb = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/** `dns.lookup` that refuses to hand back a non-public address. */
export function guardedLookup(hostname: string, options: LookupOptions, cb: LookupCb): void {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err !== null) return cb(err, "", 0);
    const list = addresses;
    const bad = list.find((a) => isBlockedIp(a.address));
    if (bad !== undefined || list.length === 0) {
      return cb(new Error("destination not allowed: resolves to a private or reserved address"), "", 0);
    }
    if (options.all === true) return cb(null, list);
    const first = list[0] as LookupAddress;
    return cb(null, first.address, first.family);
  });
}
