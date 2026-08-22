import type { PresenceEntity, PresenceSnapshot } from "@kaenal/types";
import { API_BASE_URL, authHeaders } from "./realtime-http";

/**
 * Mobile presence REST (Phase R6) — bearer-authed heartbeat/leave against the
 * same endpoints the web uses. Best-effort: a failure never disrupts the screen,
 * and the server's TTL reaps a missed leave.
 */

export async function presenceHeartbeat(
  type: PresenceEntity,
  id: string,
  editing: boolean,
): Promise<PresenceSnapshot | null> {
  const headers = authHeaders();
  if (headers === null) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/v1/presence/${type}/${id}/heartbeat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ editing }),
    });
    return res.ok ? ((await res.json()) as PresenceSnapshot) : null;
  } catch {
    return null;
  }
}

export async function presenceLeave(type: PresenceEntity, id: string): Promise<void> {
  const headers = authHeaders();
  if (headers === null) return;
  try {
    await fetch(`${API_BASE_URL}/v1/presence/${type}/${id}/leave`, {
      method: "POST",
      headers,
      body: "{}",
    });
  } catch {
    /* best-effort */
  }
}
