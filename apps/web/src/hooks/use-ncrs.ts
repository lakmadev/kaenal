"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type {
  AssignNcrBody,
  CreateNcrActionBody,
  CreateNcrBody,
  NcrActionDto,
  NcrDto,
  TransitionNcrBody,
  UpdateNcrActionStatusBody,
  VerifyNcrBody,
} from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/** Query filters accepted by the NCR list endpoint (03 §5). */
export interface NcrListQuery {
  status?: NcrDto["status"];
  priority?: NcrDto["priority"];
  cursor?: string;
  limit?: number;
}

export function useNcrs(query?: NcrListQuery) {
  return useQuery(apiQueries.ncrs.list(getApiClient(), query !== undefined ? { query } : undefined));
}

export function useNcr(id: string) {
  return useQuery(apiQueries.ncrs.detail(getApiClient(), id));
}

export function useNcrActions(id: string) {
  return useQuery(apiQueries.ncrs.actions(getApiClient(), id));
}

export function useCreateNcr() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateNcrBody) => client.createNcr({ body }).then((r) => unwrap<NcrDto>(r)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ncrs.list() }),
  });
}

export function useTransitionNcr() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: TransitionNcrBody }) =>
      client.transitionNcr({ params: { id }, body }).then((r) => unwrap<NcrDto>(r)),
    onSuccess: (ncr) => {
      void qc.invalidateQueries({ queryKey: queryKeys.ncrs.list() });
      void qc.invalidateQueries({ queryKey: queryKeys.ncrs.detail(ncr.id) });
    },
  });
}

export function useVerifyNcr() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: VerifyNcrBody }) =>
      client.verifyNcr({ params: { id }, body }).then((r) => unwrap<NcrDto>(r)),
    onSuccess: (ncr) => {
      void qc.invalidateQueries({ queryKey: queryKeys.ncrs.list() });
      void qc.invalidateQueries({ queryKey: queryKeys.ncrs.detail(ncr.id) });
    },
  });
}

/** Assign / reassign / clear an NCR's owner (P25). Orthogonal to the lifecycle
 *  machine — it never moves status. Seeds the detail cache with the fresh row so
 *  a rapid second reassign uses the current lockVersion. */
export function useAssignNcr() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AssignNcrBody }) =>
      client.assignNcr({ params: { id }, body }).then((r) => unwrap<NcrDto>(r)),
    onSuccess: (ncr) => {
      qc.setQueryData(queryKeys.ncrs.detail(ncr.id), ncr);
      void qc.invalidateQueries({ queryKey: queryKeys.ncrs.list() });
    },
  });
}

export function useCreateNcrAction(ncrId: string) {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateNcrActionBody) =>
      client.createNcrAction({ params: { id: ncrId }, body }).then((r) => unwrap<NcrActionDto>(r)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ncrs.actions(ncrId) }),
  });
}

export function useUpdateNcrActionStatus(ncrId: string) {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateNcrActionStatusBody }) =>
      client.updateNcrActionStatus({ params: { id }, body }).then((r) => unwrap<NcrActionDto>(r)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ncrs.actions(ncrId) }),
  });
}
