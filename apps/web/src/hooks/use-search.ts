"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiQueries } from "@kaenal/api-client";
import { getApiClient } from "@/lib/api";

/** Debounce a fast-changing value (the search box) so we don't fire a request
 *  per keystroke. 180ms is below the perception threshold but coalesces bursts. */
export function useDebouncedValue<T>(value: T, delayMs = 180): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Federated search (`GET /v1/search`) for the command palette. The query is
 * trimmed and gated: an empty box makes no request (the palette shows quick
 * actions instead). `keepPreviousData` holds the last hits visible while the
 * next request is in flight, so the list doesn't flash empty between keystrokes.
 */
export function useSearch(rawQuery: string) {
  const q = rawQuery.trim();
  return useQuery({
    ...apiQueries.search(getApiClient(), q),
    enabled: q.length > 0,
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}
