"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type {
  CreateDlpPolicyBody,
  DlpPolicyDto,
  UpdateDlpPolicyBody,
} from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/**
 * DLP policy register (`/v1/settings/dlp-policies`). List drives the register;
 * create/update/delete are settings:manage. Each mutation invalidates the list.
 */
export function useDlpPolicies() {
  return useQuery(apiQueries.settings.dlpPolicies(getApiClient()));
}

function usePolicyMutation<A>(call: (client: ReturnType<typeof getApiClient>, arg: A) => Promise<DlpPolicyDto>) {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg: A) => call(client, arg),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.settings.dlpPolicies() }),
  });
}

export function useCreateDlpPolicy() {
  return usePolicyMutation<CreateDlpPolicyBody>((client, body) =>
    client.createDlpPolicy({ body }).then((r) => unwrap<DlpPolicyDto>(r)),
  );
}

export function useUpdateDlpPolicy() {
  return usePolicyMutation<{ id: string; body: UpdateDlpPolicyBody }>((client, { id, body }) =>
    client.updateDlpPolicy({ params: { id }, body }).then((r) => unwrap<DlpPolicyDto>(r)),
  );
}

export function useDeleteDlpPolicy() {
  return usePolicyMutation<string>((client, id) =>
    client.deleteDlpPolicy({ params: { id }, body: {} }).then((r) => unwrap<DlpPolicyDto>(r)),
  );
}
