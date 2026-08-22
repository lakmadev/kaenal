import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import { useSession } from "@/stores/session";

/**
 * Resolve a userId → display name from the members directory (Phase R6). Used by
 * the presence bar so a co-viewer shows as a name/initials, never a raw id.
 * Cached; falls back to undefined while loading.
 */
export function useMemberNames(): (userId: string) => string | undefined {
  const status = useSession((s) => s.status);
  const { data } = useQuery({
    queryKey: ["members-directory"],
    queryFn: async () => {
      const res = await apiClient.listMembers({ query: { limit: 100 } });
      return res.status === 200 ? res.body.items : [];
    },
    enabled: status === "authenticated",
    staleTime: 300_000,
  });
  return (userId: string): string | undefined => data?.find((m) => m.userId === userId)?.name;
}
