"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { apiQueries, unwrap } from "@kaenal/api-client";
import type { ExportDto, PredictionSubjectKind } from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/**
 * Predictive risk (Sprint 03 Part B, P2/P3). Read-only end to end — the
 * nightly `predict-risk` job owns the data, so there is no mutation hook here
 * beyond the forecast-pack export (P4).
 */

export interface PredictionListQuery {
  subjectKind?: PredictionSubjectKind;
  horizon?: string;
  order?: "predicted_value" | "created_at";
  limit?: number;
}

export function usePredictions(query: PredictionListQuery) {
  return useQuery(apiQueries.predictions.list(getApiClient(), { query }));
}

export function usePredictionDetail(subjectKind: PredictionSubjectKind, id: string) {
  return useQuery(apiQueries.predictions.detail(getApiClient(), subjectKind, id));
}

/**
 * "Forecast pack" export (P4) — a real `predictive_forecast_pack` export
 * through the existing exports pipeline (mirrors `AiPdfAction`'s
 * create-then-poll shape), never the jsx's fire-and-forget `kToast`.
 */
export function useForecastPackExport() {
  const client = getApiClient();
  return useMutation({
    mutationFn: () =>
      client.createExport({ body: { resource: "predictive_forecast_pack", format: "pdf" } }).then((r) => unwrap<ExportDto>(r)),
  });
}
