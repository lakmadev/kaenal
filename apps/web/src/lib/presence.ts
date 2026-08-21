import type { PresenceEntity, PresenceSnapshot } from "@kaenal/types";
import { env } from "@/lib/env";
import { getActiveTenant } from "@/lib/tenant";

/**
 * Presence REST calls (Phase R4). Plain `fetch` — presence isn't in the ts-rest
 * contract (like MFA/sessions) — carrying the session cookie, the tenant header,
 * and the double-submit CSRF token on these unsafe POSTs. All best-effort: a
 * presence failure must never disrupt the page.
 */

const CSRF_COOKIE = "kaenal_csrf";

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  for (const part of document.cookie.split(";")) {
    const [k, ...rest] = part.split("=");
    if (k?.trim() === name) return decodeURIComponent(rest.join("=").trim());
  }
  return undefined;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  const tenant = getActiveTenant();
  if (tenant !== undefined) h["x-tenant-id"] = tenant;
  const csrf = readCookie(CSRF_COOKIE);
  if (csrf !== undefined) h["x-csrf-token"] = csrf;
  return h;
}

/** Enter/heartbeat; returns the current snapshot (or null on any failure). */
export async function presenceHeartbeat(
  type: PresenceEntity,
  id: string,
  editing: boolean,
): Promise<PresenceSnapshot | null> {
  try {
    const res = await fetch(`${env.apiBaseUrl}/v1/presence/${type}/${id}/heartbeat`, {
      method: "POST",
      credentials: "include",
      headers: headers(),
      body: JSON.stringify({ editing }),
    });
    return res.ok ? ((await res.json()) as PresenceSnapshot) : null;
  } catch {
    return null;
  }
}

/** Leave now. `keepalive` lets it complete during page unload/navigation. */
export async function presenceLeave(type: PresenceEntity, id: string): Promise<void> {
  try {
    await fetch(`${env.apiBaseUrl}/v1/presence/${type}/${id}/leave`, {
      method: "POST",
      credentials: "include",
      headers: headers(),
      body: "{}",
      keepalive: true,
    });
  } catch {
    /* best-effort — the server TTL reaps a missed leave anyway */
  }
}
