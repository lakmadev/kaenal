"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type {
  CreateNcrValidationRuleBody,
  NcrValidationRuleDto,
  UpdateNcrValidationRuleBody,
} from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/**
 * NCR validation rules (`/v1/settings/ncr-validation-rules`). The list drives the
 * settings editor; create/update/delete are settings:manage. Each mutation
 * invalidates the list so the table reflects the change.
 */
export function useNcrRules() {
  return useQuery(apiQueries.settings.ncrRules(getApiClient()));
}

function useRuleMutation<A>(call: (client: ReturnType<typeof getApiClient>, arg: A) => Promise<NcrValidationRuleDto>) {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg: A) => call(client, arg),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.settings.ncrRules() }),
  });
}

export function useCreateNcrRule() {
  return useRuleMutation<CreateNcrValidationRuleBody>((client, body) =>
    client.createNcrValidationRule({ body }).then((r) => unwrap<NcrValidationRuleDto>(r)),
  );
}

export function useUpdateNcrRule() {
  return useRuleMutation<{ id: string; body: UpdateNcrValidationRuleBody }>((client, { id, body }) =>
    client.updateNcrValidationRule({ params: { id }, body }).then((r) => unwrap<NcrValidationRuleDto>(r)),
  );
}

export function useDeleteNcrRule() {
  return useRuleMutation<string>((client, id) =>
    client.deleteNcrValidationRule({ params: { id }, body: {} }).then((r) => unwrap<NcrValidationRuleDto>(r)),
  );
}
