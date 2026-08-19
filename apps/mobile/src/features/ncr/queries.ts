import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type { AuditEventDto, NcrActionDto, NcrDto } from "@kaenal/types";

import { useSession } from "@/stores/session";

import { fetchNcr, fetchNcrActions, fetchNcrActivity, fetchNcrs, type NcrPage } from "./api";

export function useNcrs(): UseQueryResult<NcrPage> {
  const tenant = useSession((s) => s.tenant);
  return useQuery({
    queryKey: ["ncrs", tenant],
    queryFn: () => fetchNcrs({ limit: 50 }),
    enabled: tenant !== null,
    staleTime: 15_000,
  });
}

export function useNcr(id: string): UseQueryResult<NcrDto> {
  const tenant = useSession((s) => s.tenant);
  return useQuery({
    queryKey: ["ncr", tenant, id],
    queryFn: () => fetchNcr(id),
    enabled: tenant !== null && id !== "",
  });
}

export function useNcrActions(id: string): UseQueryResult<NcrActionDto[]> {
  const tenant = useSession((s) => s.tenant);
  return useQuery({
    queryKey: ["ncr-actions", tenant, id],
    queryFn: () => fetchNcrActions(id),
    enabled: tenant !== null && id !== "",
  });
}

export function useNcrActivity(id: string): UseQueryResult<AuditEventDto[]> {
  const tenant = useSession((s) => s.tenant);
  return useQuery({
    queryKey: ["ncr-activity", tenant, id],
    queryFn: () => fetchNcrActivity(id),
    enabled: tenant !== null && id !== "",
    staleTime: 15_000,
  });
}
