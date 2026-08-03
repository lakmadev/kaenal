"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type {
  PortalPpapDto,
  PortalPpapResubmitBody,
  PortalScarDto,
  PortalScarRespondBody,
} from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/** The partner's own supplier identity — also the portal's session guard. */
export function usePortalIdentity() {
  return useQuery(apiQueries.portal.identity(getApiClient()));
}

export function usePortalScars() {
  return useQuery(apiQueries.portal.scars(getApiClient()));
}

export function usePortalScar(id: string) {
  return useQuery(apiQueries.portal.scar(getApiClient(), id));
}

export function usePortalPpapList() {
  return useQuery(apiQueries.portal.ppapList(getApiClient()));
}

export function usePortalPpap(id: string) {
  return useQuery(apiQueries.portal.ppap(getApiClient(), id));
}

/** Respond to a SCAR (note + optional acknowledge). Writes the returned record
 *  into the detail cache and refreshes the list. */
export function useRespondScar(id: string) {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PortalScarRespondBody) =>
      client.respondPortalScar({ params: { id }, body }).then((r) => unwrap<PortalScarDto>(r)),
    onSuccess: (scar) => {
      qc.setQueryData(queryKeys.portal.scar(id), scar);
      void qc.invalidateQueries({ queryKey: queryKeys.portal.scars() });
    },
  });
}

/** Re-submit a PPAP package after changes-requested feedback. */
export function useResubmitPpap(id: string) {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PortalPpapResubmitBody) =>
      client.resubmitPortalPpap({ params: { id }, body }).then((r) => unwrap<PortalPpapDto>(r)),
    onSuccess: (ppap) => {
      qc.setQueryData(queryKeys.portal.ppap(id), ppap);
      void qc.invalidateQueries({ queryKey: queryKeys.portal.ppapList() });
    },
  });
}
