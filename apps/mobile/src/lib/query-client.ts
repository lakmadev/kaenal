import { QueryClient } from "@tanstack/react-query";

// Query client tuned for a field app: data stays fresh for a while (the floor has
// spotty connectivity, and the offline mirror is the real source of truth in M3),
// and we don't hammer retries when offline. Persistence to SQLite for instant
// cold-start is layered on in M3.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
