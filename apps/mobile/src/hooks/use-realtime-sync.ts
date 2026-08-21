import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { queryClient } from "@/lib/query-client";
import { useSession } from "@/stores/session";
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

    const onEvent = (event: { topic: string }): void => {
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
