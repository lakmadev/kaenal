import type { PresenceEntity } from "@kaenal/types";
import { API_BASE_URL, authHeaders } from "./realtime-http";

/**
 * Mobile collab relay REST (Phase R6.2) — bearer-authed, mirroring the web.
 * `postCollabUpdate` relays one opaque base64 Yjs update; `getCollabState` pulls
 * the room's live server state (R7) so a late joiner converges. Best-effort.
 */

export async function postCollabUpdate(
  type: PresenceEntity,
  id: string,
  field: string,
  base64Update: string,
): Promise<void> {
  const headers = authHeaders();
  if (headers === null) return;
  try {
    await fetch(`${API_BASE_URL}/v1/collab/${type}/${id}/${encodeURIComponent(field)}/update`, {
      method: "POST",
      headers,
      body: JSON.stringify({ update: base64Update }),
    });
  } catch {
    /* best-effort */
  }
}

export async function getCollabState(
  type: PresenceEntity,
  id: string,
  field: string,
): Promise<string | null> {
  const headers = authHeaders();
  if (headers === null) return null;
  try {
    const res = await fetch(
      `${API_BASE_URL}/v1/collab/${type}/${id}/${encodeURIComponent(field)}/state`,
      { headers },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { state: string | null };
    return body.state;
  } catch {
    return null;
  }
}
