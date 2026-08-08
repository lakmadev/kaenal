"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type {
  CreateLegalHoldBody,
  LegalHoldDto,
  UpdateLegalHoldBody,
} from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/**
 * Legal-hold register (`/v1/settings/legal-holds`). List drives the register;
 * create/update/release/delete are settings:manage. Each mutation invalidates
 * the list so the register reflects the change.
 */
export function useLegalHolds() {
  return useQuery(apiQueries.settings.legalHolds(getApiClient()));
}

function useHoldMutation<A>(call: (client: ReturnType<typeof getApiClient>, arg: A) => Promise<LegalHoldDto>) {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg: A) => call(client, arg),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.settings.legalHolds() }),
  });
}

export function useCreateLegalHold() {
  return useHoldMutation<CreateLegalHoldBody>((client, body) =>
    client.createLegalHold({ body }).then((r) => unwrap<LegalHoldDto>(r)),
  );
}

export function useUpdateLegalHold() {
  return useHoldMutation<{ id: string; body: UpdateLegalHoldBody }>((client, { id, body }) =>
    client.updateLegalHold({ params: { id }, body }).then((r) => unwrap<LegalHoldDto>(r)),
  );
}

export function useReleaseLegalHold() {
  return useHoldMutation<{ id: string; version: number }>((client, { id, version }) =>
    client.releaseLegalHold({ params: { id }, body: { version } }).then((r) => unwrap<LegalHoldDto>(r)),
  );
}

export function useDeleteLegalHold() {
  return useHoldMutation<string>((client, id) =>
    client.deleteLegalHold({ params: { id }, body: {} }).then((r) => unwrap<LegalHoldDto>(r)),
  );
}
