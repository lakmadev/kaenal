import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import type { RealtimeEvent } from "@kaenal/types";

import { queryClient } from "@/lib/query-client";
import { useSession } from "@/stores/session";
import { presenceKey, usePresenceStore } from "@/stores/presence";
import { collabRoom, dispatchCollabUpdate } from "@/features/collab/bus";
import { engine } from "@/sync";
import { reactionFor } from "@/sync/realtime-parse";
import { startRealtime, stopRealtime } from "@/sync/realtime";

const SYNC_DEBOUNCE_MS = 300;

/**
 * Mobile live sync (Phase R3).
 *
 * While signed in and foregrounded, the device holds the realtime stream and
 * turns each signal into a (debounced) delta-pull, so a field device reflects
 * head-office changes near-instantly instead of only on a manual refresh. Two
 * independent triggers feed the SAME `engine.sync()`:
 *   1. AppState → active: pull on every return to foreground (previously the app
 *      only pulled once, at sign-in).
 *   2. A realtime signal for a mirrored entity (ncr / inspection): pull now.
 * A `notifications` signal refreshes the bell instead of syncing the mirror.
 *
 * The stream is dropped on background (battery) and reopened on foreground; if
 * streaming is unavailable for any reason, the foreground pull still keeps the
 * device fresh — this only ever adds freshness, never blocks the offline flow.
 */
export function useRealtimeSync(): void {
  const status = useSession((s) => s.status);

  useEffect(() => {
    if (status !== "authenticated") return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const debouncedSync = (): void => {
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        void engine.sync();
      }, SYNC_DEBOUNCE_MS);
    };

    const onEvent = (event: RealtimeEvent): void => {
      // Presence (R6): a viewer snapshot — route to the presence store so the
      // PresenceBar updates, rather than triggering a delta-pull.
      if (event.topic === "presence") {
        if (event.entityType !== undefined && event.entityId !== undefined) {
          usePresenceStore
            .getState()
            .set(presenceKey(event.entityType, event.entityId), event.viewers ?? []);
        }
        return;
      }
      // Collab (R6.2): a Yjs update for a field — hand to the room bus, which the
      // mounted CollabText applies to its local doc.
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
      const reaction = reactionFor(event.topic);
      if (reaction === "sync") debouncedSync();
      else if (reaction === "notifications") {
        void queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
      }
    };

    const connect = (): void => {
      startRealtime(onEvent);
      void engine.sync(); // catch up immediately on (re)connect
    };

    const onAppState = (next: AppStateStatus): void => {
      if (next === "active") connect();
      else stopRealtime();
    };

    connect(); // mounted while active
    const sub = AppState.addEventListener("change", onAppState);

    return () => {
      sub.remove();
      stopRealtime();
      if (timer !== null) clearTimeout(timer);
    };
  }, [status]);
}
