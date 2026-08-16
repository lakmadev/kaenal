import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type { DashboardDto } from "@kaenal/types";

import { apiClient } from "@/lib/api";
import { useSession } from "@/stores/session";

/**
 * The role-aware home dashboard (05 §M5). Keyed by tenant so a workspace switch
 * refetches; the persisted query cache (lib/persist-query) keeps the last
 * snapshot on screen offline until the next successful pull.
 */
export function useDashboard(): UseQueryResult<DashboardDto> {
  const tenant = useSession((s) => s.tenant);
  return useQuery({
    queryKey: ["dashboard", tenant],
    queryFn: async (): Promise<DashboardDto> => {
      const res = await apiClient.getDashboard();
      if (res.status !== 200) {
        throw new Error(`dashboard ${res.status}`);
      }
      return res.body;
    },
    enabled: tenant !== null,
    staleTime: 30_000,
  });
}
