"use client";

import { useSyncExternalStore } from "react";
import { onlineManager, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api";

/** Live connectivity from TanStack's `onlineManager` (browser online/offline events). */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (notify) => onlineManager.subscribe(notify),
    () => onlineManager.isOnline(),
    () => true,
  );
}

/**
 * "Retry" on the offline banner (O-9): forces a real re-check against the API
 * (any HTTP response means we're reachable; a thrown network error means not),
 * updates `onlineManager`, and refetches active queries on success.
 */
export function useRetryConnection(): () => Promise<boolean> {
  const qc = useQueryClient();
  return async () => {
    let reachable = true;
    try {
      await getApiClient().getMe();
    } catch {
      reachable = false;
    }
    onlineManager.setOnline(reachable);
    if (reachable) void qc.refetchQueries({ type: "active" });
    return reachable;
  };
}
