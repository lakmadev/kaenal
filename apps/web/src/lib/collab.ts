import type { PresenceEntity } from "@kaenal/types";
import { env } from "@/lib/env";
import { getActiveTenant } from "@/lib/tenant";

/**
 * Collab relay REST call (Phase R5). Posts one opaque base64 Yjs update for a
 * field; the server broadcasts it to co-viewers over the realtime bus. Plain
 * `fetch` (not in the ts-rest contract) with cookie + tenant + CSRF, best-effort.
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

export async function postCollabUpdate(
  type: PresenceEntity,
  id: string,
  field: string,
  base64Update: string,
): Promise<void> {
  try {
    await fetch(`${env.apiBaseUrl}/v1/collab/${type}/${id}/${encodeURIComponent(field)}/update`, {
      method: "POST",
      credentials: "include",
      headers: headers(),
      body: JSON.stringify({ update: base64Update }),
    });
  } catch {
    /* best-effort — a dropped update is recovered by the next edit or reload */
  }
}
