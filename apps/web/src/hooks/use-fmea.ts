"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type {
  CreateFmeaBody,
  CreateFmeaItemBody,
  FmeaDto,
  FmeaItemDto,
  UpdateFmeaBody,
  UpdateFmeaItemBody,
} from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/**
 * FMEA workbench (`/v1/fmeas`). The FMEA list drives the part selector; the
 * item list is the worksheet. Item mutations invalidate that FMEA's items AND
 * the FMEA list (item counts); FMEA mutations invalidate the list.
 */
export function useFmeas() {
  return useQuery(apiQueries.fmea.list(getApiClient()));
}

export function useFmeaItems(fmeaId: string | null) {
  const client = getApiClient();
  return useQuery({
    ...apiQueries.fmea.items(client, fmeaId ?? ""),
    enabled: fmeaId !== null,
  });
}

function useFmeaMutation<A, R>(call: (client: ReturnType<typeof getApiClient>, arg: A) => Promise<R>) {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg: A) => call(client, arg),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.fmea.list() }),
  });
}

export function useCreateFmea() {
  return useFmeaMutation<CreateFmeaBody, FmeaDto>((client, body) =>
    client.createFmea({ body }).then((r) => unwrap<FmeaDto>(r)),
  );
}

export function useDeleteFmea() {
  return useFmeaMutation<string, FmeaDto>((client, id) =>
    client.deleteFmea({ params: { id }, body: {} }).then((r) => unwrap<FmeaDto>(r)),
  );
}

/** Item mutations invalidate both the worksheet (this FMEA's items) and the list. */
function useItemMutation<A, R>(fmeaId: string, call: (client: ReturnType<typeof getApiClient>, arg: A) => Promise<R>) {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg: A) => call(client, arg),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.fmea.items(fmeaId) });
      void qc.invalidateQueries({ queryKey: queryKeys.fmea.list() });
    },
  });
}

export function useCreateFmeaItem(fmeaId: string) {
  return useItemMutation<CreateFmeaItemBody, FmeaItemDto>(fmeaId, (client, body) =>
    client.createFmeaItem({ params: { id: fmeaId }, body }).then((r) => unwrap<FmeaItemDto>(r)),
  );
}

export function useUpdateFmeaItem(fmeaId: string) {
  return useItemMutation<{ itemId: string; body: UpdateFmeaItemBody }, FmeaItemDto>(fmeaId, (client, { itemId, body }) =>
    client.updateFmeaItem({ params: { id: fmeaId, itemId }, body }).then((r) => unwrap<FmeaItemDto>(r)),
  );
}

export function useDeleteFmeaItem(fmeaId: string) {
  return useItemMutation<string, FmeaItemDto>(fmeaId, (client, itemId) =>
    client.deleteFmeaItem({ params: { id: fmeaId, itemId }, body: {} }).then((r) => unwrap<FmeaItemDto>(r)),
  );
}

export type { FmeaDto, FmeaItemDto, CreateFmeaBody, UpdateFmeaBody, CreateFmeaItemBody, UpdateFmeaItemBody };
