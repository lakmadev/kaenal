"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type {
  CreateEightDBody,
  EightDDto,
  EightDStatus,
  TransitionEightDBody,
  UpdateEightDStepBody,
} from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/** Query filters accepted by the 8D list endpoint (03 §5 / P03). */
export interface EightDListQuery {
  status?: EightDStatus;
  ncrId?: string;
  cursor?: string;
  limit?: number;
}

export function useEightDs(query?: EightDListQuery) {
  return useQuery(apiQueries.eightDs.list(getApiClient(), query !== undefined ? { query } : undefined));
}

export function useEightD(id: string) {
  return useQuery(apiQueries.eightDs.detail(getApiClient(), id));
}

export function useCreateEightD() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateEightDBody) => client.createEightD({ body }).then((r) => unwrap<EightDDto>(r)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.eightDs.all }),
  });
}

/** Update one discipline (status + freeform data). Completing a step is gated by
 *  its prerequisites server-side; the returned 8D (with a bumped lockVersion)
 *  goes straight into the detail cache. */
export function useUpdateEightDStep(id: string) {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ step, body }: { step: number; body: UpdateEightDStepBody }) =>
      client.updateEightDStep({ params: { id, step }, body }).then((r) => unwrap<EightDDto>(r)),
    onSuccess: (report) => {
      qc.setQueryData(queryKeys.eightDs.detail(id), report);
      void qc.invalidateQueries({ queryKey: queryKeys.eightDs.list() });
    },
  });
}

export function useTransitionEightD(id: string) {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TransitionEightDBody) =>
      client.transitionEightD({ params: { id }, body }).then((r) => unwrap<EightDDto>(r)),
    onSuccess: (report) => {
      qc.setQueryData(queryKeys.eightDs.detail(id), report);
      void qc.invalidateQueries({ queryKey: queryKeys.eightDs.list() });
    },
  });
}
