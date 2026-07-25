"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type {
  AdvanceCapaBody,
  CapaActionDto,
  CapaDto,
  CreateCapaActionBody,
  CreateCapaBody,
  Page,
  RevertCapaBody,
  UpdateCapaActionStatusBody,
} from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/** Query filters accepted by the CAPA list endpoint (03 §5). */
export interface CapaListQuery {
  status?: CapaDto["status"];
  type?: CapaDto["type"];
  priority?: CapaDto["priority"];
  cursor?: string;
  limit?: number;
}

export function useCapas(query?: CapaListQuery) {
  return useQuery(apiQueries.capas.list(getApiClient(), query !== undefined ? { query } : undefined));
}

export function useCapa(id: string) {
  return useQuery(apiQueries.capas.detail(getApiClient(), id));
}

/** The CAPA-actions list — no query-factory ships for it yet, so it is composed
 *  here from the raw client call + the shared key (mirrors `apiQueries.*`). */
export function useCapaActions(id: string) {
  const client = getApiClient();
  return useQuery({
    queryKey: queryKeys.capas.actions(id),
    queryFn: () => client.listCapaActions({ params: { id } }).then((r) => unwrap<Page<CapaActionDto>>(r)),
  });
}

export function useCreateCapa() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCapaBody) => client.createCapa({ body }).then((r) => unwrap<CapaDto>(r)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.capas.list() }),
  });
}

export function useAdvanceCapa() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AdvanceCapaBody }) =>
      client.advanceCapa({ params: { id }, body }).then((r) => unwrap<CapaDto>(r)),
    onSuccess: (capa) => {
      void qc.invalidateQueries({ queryKey: queryKeys.capas.list() });
      void qc.invalidateQueries({ queryKey: queryKeys.capas.detail(capa.id) });
    },
  });
}

export function useRevertCapa() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: RevertCapaBody }) =>
      client.revertCapa({ params: { id }, body }).then((r) => unwrap<CapaDto>(r)),
    onSuccess: (capa) => {
      void qc.invalidateQueries({ queryKey: queryKeys.capas.list() });
      void qc.invalidateQueries({ queryKey: queryKeys.capas.detail(capa.id) });
    },
  });
}

export function useCreateCapaAction(capaId: string) {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCapaActionBody) =>
      client.createCapaAction({ params: { id: capaId }, body }).then((r) => unwrap<CapaActionDto>(r)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.capas.actions(capaId) }),
  });
}

export function useUpdateCapaActionStatus(capaId: string) {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCapaActionStatusBody }) =>
      client.updateCapaActionStatus({ params: { id }, body }).then((r) => unwrap<CapaActionDto>(r)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.capas.actions(capaId) }),
  });
}
