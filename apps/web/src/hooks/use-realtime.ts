"use client";

import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys } from "@kaenal/api-client";
import { shouldToast } from "@kaenal/core";
import type { RealtimeEvent } from "@kaenal/types";
import { env } from "@/lib/env";
import { presenceKey, usePresenceStore } from "@/stores/presence";
import { collabRoom, dispatchCollabUpdate } from "@/lib/collab-bus";
import { getApiClient } from "@/lib/api";
import { entityHref } from "@/lib/entity-routes";
import { useLiveStore } from "@/stores/live";

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

/** Map a topic to the query-key prefix its signal should invalidate. Every
 *  audited mutation now emits (Phase R2), so each QMS module refreshes live when
 *  changed by anyone in the tenant. A topic with no web surface returns null and
 *  is silently ignored (forward-compatible with server topics not yet wired). */
function keysForTopic(topic: RealtimeEvent["topic"]): readonly unknown[] | null {
  switch (topic) {
    case "notifications":
      return queryKeys.notifications.all;
    case "ncr":
      return queryKeys.ncrs.all;
    case "capa":
      return queryKeys.capas.all;
    case "eightd":
      return queryKeys.eightDs.all;
    case "inspection":
      return queryKeys.inspections.all;
    case "supplier":
      return queryKeys.suppliers.all;
    case "ppap":
      return queryKeys.ppap.all;
    case "scar":
      return queryKeys.scars.all;
    case "document":
      return queryKeys.documents.all;
    case "fmea":
      return queryKeys.fmea.all;
    case "audit":
      return queryKeys.audits.all;
    case "finding":
      return null; // no dedicated web list key yet; emitted server-side already
    default:
      return null;
  }
}

/**
 * Live mode (S1-3): a notification aimed at this user just landed. When live
 * mode is on, read it (the bus carries only its id) and toast it if someone else
 * caused it and its record has a real detail route. Off => no toast, no fetch.
 */
async function announce(qc: QueryClient, event: RealtimeEvent, userId: string): Promise<void> {
  const live = useLiveStore.getState();
  if (live.enabledByUser[userId] !== true || event.action !== "created" || event.entityId === undefined) return;
  const page = await qc.fetchQuery({
    ...apiQueries.notifications.list(getApiClient(), { query: { limit: 10 } }),
    staleTime: 0,
  });
  const n = page.items.find((i) => i.id === event.entityId);
  if (n === undefined || n.entityKind === null || n.entityId === null) return;
  if (!shouldToast(n, userId, (kind) => entityHref(kind, "x") !== null)) return;
  live.pushToast({
    id: n.id,
    title: n.title,
    body: n.body,
    entityKind: n.entityKind,
    entityId: n.entityId,
    actorId: n.actorId,
  });
}

/** @param enabled connect only for an authenticated internal session (AppShell
 *  passes false while unauthenticated / portal-only, so no 401 reconnect loop). */
export function useRealtime(enabled: boolean, userId: string | undefined): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    const source = new EventSource(`${env.apiBaseUrl}/v1/events`, { withCredentials: true });

    source.onopen = (): void => useLiveStore.getState().setConnection("open");
    source.onerror = (): void => useLiveStore.getState().setConnection("reconnecting");

    source.onmessage = (e: MessageEvent<string>): void => {
      let event: RealtimeEvent;
      try {
        event = JSON.parse(e.data) as RealtimeEvent;
      } catch {
        return; // heartbeats are SSE comments, never delivered here; ignore noise
      }
      // Presence (R4) carries a viewer snapshot, not a cache pointer — route it
      // to the presence store instead of invalidating a query.
      if (event.topic === "presence") {
        if (event.entityType !== undefined && event.entityId !== undefined) {
          usePresenceStore
            .getState()
            .set(presenceKey(event.entityType, event.entityId), event.viewers ?? []);
        }
        return;
      }
      // Collab (R5): a Yjs update for a field — hand to the room bus, which the
      // mounted collaborative editor applies to its local doc.
      if (event.topic === "collab") {
        if (
          event.entityType !== undefined &&
          event.entityId !== undefined &&
          event.field !== undefined &&
          event.update !== undefined
        ) {
          dispatchCollabUpdate(
            collabRoom(event.entityType, event.entityId, event.field),
            event.update,
          );
        }
        return;
      }
      const key = keysForTopic(event.topic);
      if (key !== null) void qc.invalidateQueries({ queryKey: key });
      if (event.topic === "notifications" && userId !== undefined) {
        // Best effort: a failed read just means no toast (the bell still updates).
        void announce(qc, event, userId).catch(() => undefined);
      }
    };

    // EventSource reconnects itself on a transient drop; nothing to do here.
    return () => source.close();
  }, [enabled, qc, userId]);
}
