"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type {
  AcknowledgeScarBody,
  AdvanceScarBody,
  CreateScarBody,
  ScarChargebackBody,
  ScarDto,
  ScarSeverity,
  ScarStatus,
  UpdateScarBody,
} from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/** Query filters accepted by the SCAR list endpoint (03 §11.3 / P10). */
export interface ScarListQuery {
  supplierId?: string;
  status?: ScarStatus;
  severity?: ScarSeverity;
  overdue?: boolean;
  q?: string;
  cursor?: string;
  limit?: number;
}

export function useScarList(query?: ScarListQuery) {
  return useQuery(apiQueries.scars.list(getApiClient(), query !== undefined ? { query } : undefined));
}

export function useScar(id: string) {
  return useQuery(apiQueries.scars.detail(getApiClient(), id));
}

export function useCreateScar() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateScarBody) => client.createScar({ body }).then((r) => unwrap<ScarDto>(r)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.scars.all }),
  });
}

/** A mutation that returns the updated SCAR (its lockVersion bumps); we write it
 *  straight into the detail cache and invalidate the list. */
function useScarMutation<B>(
  id: string,
  call: (client: ReturnType<typeof getApiClient>, body: B) => Promise<ScarDto>,
) {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: B) => call(client, body),
    onSuccess: (scar) => {
      qc.setQueryData(queryKeys.scars.detail(id), scar);
      void qc.invalidateQueries({ queryKey: queryKeys.scars.list() });
    },
  });
}

export function useUpdateScar(id: string) {
  return useScarMutation<UpdateScarBody>(id, (client, body) =>
    client.updateScar({ params: { id }, body }).then((r) => unwrap<ScarDto>(r)),
  );
}

export function useAdvanceScar(id: string) {
  return useScarMutation<AdvanceScarBody>(id, (client, body) =>
    client.advanceScar({ params: { id }, body }).then((r) => unwrap<ScarDto>(r)),
  );
}

export function useAcknowledgeScar(id: string) {
  return useScarMutation<AcknowledgeScarBody>(id, (client, body) =>
    client.acknowledgeScar({ params: { id }, body }).then((r) => unwrap<ScarDto>(r)),
  );
}

export function useChargebackScar(id: string) {
  return useScarMutation<ScarChargebackBody>(id, (client, body) =>
    client.chargebackScar({ params: { id }, body }).then((r) => unwrap<ScarDto>(r)),
  );
}
