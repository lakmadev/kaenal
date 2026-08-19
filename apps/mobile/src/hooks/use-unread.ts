import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import { useSession } from "@/stores/session";

/**
 * The unread-notification count for the bell badge (05 §3). Backed by the real
 * `GET /v1/notifications/unread-count`; the key matches the one the notifications
 * screen invalidates on read, so tapping a notification recolours the bell.
 * Returns 0 while loading or offline — the badge simply hides.
 */
export function useUnreadCount(): number {
  const tenant = useSession((s) => s.tenant);
  const status = useSession((s) => s.status);
  const { data } = useQuery({
    queryKey: ["notifications-unread", tenant],
    queryFn: async (): Promise<number> => {
      const res = await apiClient.unreadCount();
      return res.status === 200 ? res.body.count : 0;
    },
    enabled: tenant !== null && status === "authenticated",
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  return data ?? 0;
}
