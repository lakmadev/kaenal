"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@kaenal/api-client";
import type { RealtimeEvent } from "@kaenal/types";
import { env } from "@/lib/env";

/**
 * Realtime consumer (Phase R1).
 *
 * Opens the server's SSE stream (`GET /v1/events`) and turns each pointer event
 * into a TanStack `invalidateQueries` — so a change made elsewhere (a new
 * notification today; NCR/CAPA/inspection updates as R2 wires their emits)
 * refreshes the relevant views within a second, instead of on the next poll or
 * navigation. The stream carries no data; the invalidated query refetches
 * through the normal RLS-scoped API, so nothing here bypasses tenant isolation.
 *
 * Same-origin `EventSource` sends the httpOnly session cookie automatically, so
 * the stream authenticates through the ordinary request lifecycle.
 */

/** Map a topic to the query keys its signal should refresh. Only topics with a
 *  live server-side producer are wired; R2 extends this as emits are added. */
function keysForTopic(topic: RealtimeEvent["topic"]): readonly unknown[] | null {
  switch (topic) {
    case "notifications":
      return queryKeys.notifications.all;
    default:
      return null; // ncr/capa/eightd/inspection/… land in R2 with their emits
  }
}

/** @param enabled connect only for an authenticated internal session (AppShell
 *  passes false while unauthenticated / portal-only, so no 401 reconnect loop). */
export function useRealtime(enabled: boolean): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    const source = new EventSource(`${env.apiBaseUrl}/v1/events`, { withCredentials: true });

    source.onmessage = (e: MessageEvent<string>): void => {
      let event: RealtimeEvent;
      try {
        event = JSON.parse(e.data) as RealtimeEvent;
      } catch {
        return; // heartbeats are SSE comments, never delivered here; ignore noise
      }
      const key = keysForTopic(event.topic);
      if (key !== null) void qc.invalidateQueries({ queryKey: key });
    };

    // EventSource reconnects itself on a transient drop; nothing to do here.
    return () => source.close();
  }, [enabled, qc]);
}
