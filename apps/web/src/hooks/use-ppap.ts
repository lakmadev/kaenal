"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type {
  CreatePpapBody,
  PpapDecisionBody,
  PpapStatus,
  PpapSubmissionDto,
  UpdatePpapElementBody,
} from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/** Query filters accepted by the PPAP list endpoint (03 §11.2 / P09). */
export interface PpapListQuery {
  supplierId?: string;
  status?: PpapStatus;
  customer?: string;
  level?: number;
  q?: string;
  cursor?: string;
  limit?: number;
}

export function usePpapList(query?: PpapListQuery) {
  return useQuery(apiQueries.ppap.list(getApiClient(), query !== undefined ? { query } : undefined));
}

export function usePpap(id: string) {
  return useQuery(apiQueries.ppap.detail(getApiClient(), id));
}

export function useCreatePpap() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePpapBody) => client.createPpap({ body }).then((r) => unwrap<PpapSubmissionDto>(r)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ppap.all }),
  });
}

/** Set one element's status / reviewer / comment. Returns the updated submission
 *  (its lockVersion bumps), which we write straight into the detail cache. */
export function useUpdatePpapElement(id: string) {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ no, body }: { no: number; body: UpdatePpapElementBody }) =>
      client.updatePpapElement({ params: { id, no }, body }).then((r) => unwrap<PpapSubmissionDto>(r)),
    onSuccess: (submission) => {
      qc.setQueryData(queryKeys.ppap.detail(id), submission);
      void qc.invalidateQueries({ queryKey: queryKeys.ppap.list() });
    },
  });
}

export function useDecidePpap(id: string) {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PpapDecisionBody) =>
      client.decidePpap({ params: { id }, body }).then((r) => unwrap<PpapSubmissionDto>(r)),
    onSuccess: (submission) => {
      qc.setQueryData(queryKeys.ppap.detail(id), submission);
      void qc.invalidateQueries({ queryKey: queryKeys.ppap.list() });
    },
  });
}
