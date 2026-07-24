import { QueryClient, defaultShouldDehydrateQuery, isServer } from "@tanstack/react-query";
import { ApiRequestError } from "@kaenal/api-client";

/**
 * TanStack Query setup (04 §1). Defaults tuned for a data-dense QMS:
 *  - `staleTime` 30s so navigating between screens doesn't refetch constantly
 *    (real-time invalidation via WS will keep data fresh — 04 §7);
 *  - never retry a 4xx (a 401/403/404/409 is a decision, not a blip); retry a
 *    5xx/network error twice.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          if (error instanceof ApiRequestError && error.status < 500) return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * One client per server request (never shared across users/requests), one
 * singleton in the browser (survives Suspense-driven re-renders) — the pattern
 * the TanStack docs prescribe for the App Router.
 */
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
