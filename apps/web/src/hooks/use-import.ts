"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type { CommitImportRunBody, CreateImportRunBody, ImportRunDto } from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/**
 * Bulk-import pipeline (`/v1/import`). Targets drive the mapping step;
 * `createRun` is the Validate + Dry-run stage (nothing written — it returns the
 * counts + row results); `commitRun` is the only write and is idempotent by
 * natural key. Admin/manager only (`import:run`) — a viewer 403s on `targets`,
 * so the wizard shows a restricted state.
 */
export function useImportTargets() {
  return useQuery(apiQueries.import.targets(getApiClient()));
}

export function useCreateImportRun() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateImportRunBody) =>
      client.createImportRun({ body }).then((r) => unwrap<ImportRunDto>(r)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.import.runs() }),
  });
}

export function useCommitImportRun() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CommitImportRunBody }) =>
      client.commitImportRun({ params: { id }, body }).then((r) => unwrap<ImportRunDto>(r)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.import.all }),
  });
}
