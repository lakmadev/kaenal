import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type { CapaActionDto, CapaDto, EightDDto } from "@kaenal/types";

import { fetchInspections } from "@/features/inspections/api";
import { fetchNcrs } from "@/features/ncr/api";
import { useSession } from "@/stores/session";

import { fetchCapa, fetchCapaActions, fetchCapas, fetchEightD, fetchEightDs } from "./api";
import { buildTasks, type UnifiedTask } from "./tasks";

export type { TaskKind, UnifiedTask } from "./tasks";

export function useMyTasks(): UseQueryResult<UnifiedTask[]> {
  const tenant = useSession((s) => s.tenant);
  const userId = useSession((s) => s.me?.userId);
  return useQuery({
    queryKey: ["my-tasks", tenant, userId],
    queryFn: async () => {
      const [ncrPage, capas, inspPage, eightDs] = await Promise.all([
        fetchNcrs({ limit: 50 }),
        fetchCapas(50),
        fetchInspections({ limit: 50 }),
        fetchEightDs(50),
      ]);
      return buildTasks(userId, ncrPage.items, capas, inspPage.items, eightDs);
    },
    enabled: tenant !== null && userId !== undefined,
    staleTime: 15_000,
  });
}

export function useCapa(id: string): UseQueryResult<CapaDto> {
  const tenant = useSession((s) => s.tenant);
  return useQuery({ queryKey: ["capa", tenant, id], queryFn: () => fetchCapa(id), enabled: tenant !== null && id !== "" });
}

export function useCapaActions(id: string): UseQueryResult<CapaActionDto[]> {
  const tenant = useSession((s) => s.tenant);
  return useQuery({ queryKey: ["capa-actions", tenant, id], queryFn: () => fetchCapaActions(id), enabled: tenant !== null && id !== "" });
}

export function useEightD(id: string): UseQueryResult<EightDDto> {
  const tenant = useSession((s) => s.tenant);
  return useQuery({ queryKey: ["eightd", tenant, id], queryFn: () => fetchEightD(id), enabled: tenant !== null && id !== "" });
}
