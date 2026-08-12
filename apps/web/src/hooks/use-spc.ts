"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type { IngestMeasurementsBody } from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/**
 * SPC analytics (`/v1/spc`). Characteristics + the computed X̄/R chart are read
 * (`spc:view`); ingest is `measurement:manage`. The chart math runs server-side
 * in `@kaenal/core`, so the screen just plots the returned limits + violations.
 */
export function useSpcCharacteristics() {
  return useQuery(apiQueries.spc.characteristics(getApiClient()));
}

export function useSpcChart(part: string | null, characteristic: string | null) {
  const client = getApiClient();
  const ready = part !== null && characteristic !== null;
  return useQuery({
    ...apiQueries.spc.chart(client, part ?? "", characteristic ?? ""),
    enabled: ready,
  });
}

export function useIngestMeasurements() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: IngestMeasurementsBody) =>
      client.ingestMeasurements({ body }).then((r) => unwrap<{ inserted: number }>(r)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.spc.all }),
  });
}
