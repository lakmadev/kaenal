import { z } from "zod";
import { IntegrationDto } from "./integration.js";

/**
 * Generic-webhook endpoint configuration (Sequence 2). ONE pure validator shared
 * by the API (at save AND at delivery time) and the web form (inline errors), so
 * the SSRF rules cannot drift between surfaces.
 *
 * SSRF posture: only http(s) URLs with no embedded credentials; https-only and
 * no private/loopback/link-local/CGNAT/metadata targets unless the deployment
 * sets `WEBHOOK_ALLOW_PRIVATE_TARGETS` (dev/tests). Literal-IP hosts are checked
 * here; hostnames are additionally resolved and re-checked at connect time by
 * the delivery transport (the only place DNS is trustworthy).
 */

export interface WebhookTargetPolicy {
  /** Dev/test only: allow http and private/loopback targets. */
  readonly allowPrivateTargets: boolean;
}

export const STRICT_WEBHOOK_POLICY: WebhookTargetPolicy = { allowPrivateTargets: false };

/** `*`, an exact event (`ncr.created`), or a domain wildcard (`ncr.*`). */
const EVENT_PATTERN = /^(\*|[a-z][a-z0-9_]*(\.[a-z0-9_]+)*|[a-z][a-z0-9_]*(\.[a-z0-9_]+)*\.\*)$/;

export const WebhookEventPattern = z
  .string()
  .max(80)
  .regex(EVENT_PATTERN, "Use '*', an exact event (ncr.created) or a domain wildcard (ncr.*)");

export const WebhookEvents = z.array(WebhookEventPattern).min(1, "Select at least one event").max(50);

// --- IP classification ------------------------------------------------------

function parseIPv4(s: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (m === null) return null;
  const parts = m.slice(1, 5).map(Number);
  return parts.every((n) => n >= 0 && n <= 255) ? parts : null;
}

function isBlockedIPv4(p: readonly number[]): boolean {
  const [a = 0, b = 0, c = 0] = p;
  return (
    a === 0 || // "this network"
    a === 10 ||
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local incl. cloud metadata 169.254.169.254
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) || // IETF protocol assignments
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast + reserved + broadcast
  );
}

/** Expand an IPv6 literal (no brackets/zone) to eight 16-bit groups, or null. */
function parseIPv6(input: string): number[] | null {
  let s = input;
  const v4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s);
  if (v4?.[1] !== undefined) {
    const p = parseIPv4(v4[1]);
    if (p === null) return null;
    s = `${s.slice(0, -v4[1].length)}${(((p[0] ?? 0) << 8) | (p[1] ?? 0)).toString(16)}:${(((p[2] ?? 0) << 8) | (p[3] ?? 0)).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] === "" || halves[0] === undefined ? [] : halves[0].split(":");
  const tail = halves.length === 2 ? (halves[1] === "" || halves[1] === undefined ? [] : halves[1].split(":")) : [];
  const fill = 8 - head.length - tail.length;
  if (halves.length === 2 ? fill < 1 : fill !== 0) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? fill : 0).fill("0"), ...tail];
  if (groups.length !== 8) return null;
  const out = groups.map((g) => (/^[0-9a-f]{1,4}$/i.test(g) ? parseInt(g, 16) : Number.NaN));
  return out.some(Number.isNaN) ? null : out;
}

/**
 * Whether an IP literal (v4 or v6, no brackets) is a non-public target. Anything
 * unparseable is treated as blocked — fail closed.
 */
export function isBlockedIp(ip: string): boolean {
  const v4 = parseIPv4(ip);
  if (v4 !== null) return isBlockedIPv4(v4);
  const g = parseIPv6(ip.toLowerCase());
  if (g === null) return true;
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = g;
  if (g.slice(0, 7).every((x) => x === 0) && (g7 === 0 || g7 === 1)) return true; // :: and ::1
  const embedded = [g6 >> 8, g6 & 255, g7 >> 8, g7 & 255];
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && (g5 === 0xffff || g5 === 0)) {
    return isBlockedIPv4(embedded); // IPv4-mapped / IPv4-compatible
  }
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) return isBlockedIPv4(embedded); // NAT64
  if (g0 === 0x2002) return isBlockedIPv4([g1 >> 8, g1 & 255, g2 >> 8, g2 & 255]); // 6to4
  if ((g0 & 0xffc0) === 0xfe80) return true; // link-local
  if ((g0 & 0xfe00) === 0xfc00) return true; // unique local
  if ((g0 & 0xff00) === 0xff00) return true; // multicast
  return false;
}

/** Hostnames that resolve privately by convention, whatever DNS says. */
function isBlockedHostname(host: string): boolean {
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localdomain") ||
    !host.includes(".") // single-label intranet names
  );
}

/**
 * Validate a webhook destination URL. Returns a human-readable error, or null
 * when acceptable. Pure (no DNS) — see the module note.
 */
export function validateWebhookUrl(raw: string, policy: WebhookTargetPolicy = STRICT_WEBHOOK_POLICY): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "Enter a valid URL";
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "Only http(s) URLs are allowed";
  if (u.username !== "" || u.password !== "") return "URLs with embedded credentials are not allowed";
  if (policy.allowPrivateTargets) return null;
  if (u.protocol !== "https:") return "Webhook URLs must use https";
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (host === "") return "Enter a valid URL";
  const isIp = host.includes(":") || parseIPv4(host) !== null;
  if (isIp) return isBlockedIp(host) ? "Private, loopback and link-local addresses are not allowed" : null;
  if (isBlockedHostname(host)) return "Internal hostnames are not allowed";
  return null;
}

/** Zod schema for a webhook config under a target policy (server passes its env-derived policy). */
export function webhookConfigSchema(policy: WebhookTargetPolicy) {
  return z.object({
    url: z
      .string()
      .trim()
      .min(1, "Enter the endpoint URL")
      .max(2048)
      .superRefine((v, ctx) => {
        const err = validateWebhookUrl(v, policy);
        if (err !== null) ctx.addIssue({ code: "custom", message: err });
      }),
    events: WebhookEvents,
  });
}
export type WebhookConfig = z.infer<ReturnType<typeof webhookConfigSchema>>;

/** Body of `PUT /v1/integrations/:id/webhook`. URL policy is enforced server-side per env. */
export const ConfigureWebhookBody = z.object({
  url: z.string().trim().min(1).max(2048),
  events: WebhookEvents,
  /** Generate a fresh signing secret (always done when none exists). The old one stops verifying at once. */
  rotateSecret: z.boolean().default(false),
  version: z.number().int().nonnegative(),
});
export type ConfigureWebhookBody = z.infer<typeof ConfigureWebhookBody>;

/**
 * `signingSecret` is present ONLY in the response that generated/rotated it —
 * the one-time reveal. It is never returned by any GET and never stored in
 * plaintext.
 */
export const ConfigureWebhookResult = z.object({
  integration: IntegrationDto,
  signingSecret: z.string().nullable(),
});
export type ConfigureWebhookResult = z.infer<typeof ConfigureWebhookResult>;

export const WebhookPolicyDto = z.object({ allowPrivateTargets: z.boolean() });
export type WebhookPolicyDto = z.infer<typeof WebhookPolicyDto>;

/** `config.events` is stored comma-joined (the integrations config map is string→string). */
export function encodeWebhookEvents(events: readonly string[]): string {
  return events.join(",");
}
export function decodeWebhookEvents(stored: string | undefined): string[] {
  const parts = (stored ?? "").split(",").map((s) => s.trim()).filter((s) => s !== "");
  return parts.length === 0 ? ["*"] : parts;
}
