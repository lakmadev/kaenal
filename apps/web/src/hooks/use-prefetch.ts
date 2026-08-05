"use client";

import { useEffect } from "react";
import { useQueryClient, type FetchQueryOptions } from "@tanstack/react-query";

/**
 * Warm a set of queries in the background as soon as a screen mounts, so
 * switching to the tab/panel that uses them doesn't show a first-load spinner
 * (the "first-visit tab flicker"). Fire-and-forget: `staleTime` makes it a no-op
 * on revisit, and each option's own `queryFn` is only called if the cache is
 * cold. Keyed on the queries' keys so it re-runs when the underlying entity id
 * changes, not on every render.
 */
export function usePrefetchQueries(options: readonly FetchQueryOptions[]): void {
  const queryClient = useQueryClient();
  const keysHash = JSON.stringify(options.map((o) => o.queryKey));

  useEffect(() => {
    for (const option of options) void queryClient.prefetchQuery(option);
    // `options` is rebuilt each render; `keysHash` captures the identity that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, keysHash]);
}
