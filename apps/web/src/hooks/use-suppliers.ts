"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type {
  CreateSupplierBody,
  RiskLevel,
  SupplierDto,
  SupplierStatus,
  UpdateSupplierBody,
} from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/** Query filters accepted by the suppliers list endpoint (03 §11.1 / P08). */
export interface SupplierListQuery {
  status?: SupplierStatus;
  riskTier?: RiskLevel;
  tier?: number;
  category?: string;
  country?: string;
  flag?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}

/** Scorecard weights, as fractions the server re-ranks under (never persisted). */
export interface ScorecardWeights {
  wPpm?: number;
  wOtd?: number;
  wOqe?: number;
  wScar?: number;
}

export function useSuppliers(query?: SupplierListQuery) {
  return useQuery(apiQueries.suppliers.list(getApiClient(), query !== undefined ? { query } : undefined));
}

export function useSupplier(id: string) {
  return useQuery(apiQueries.suppliers.detail(getApiClient(), id));
}

/** Suppliers ranked by weighted score — the server recomputes under `weights`,
 *  so the weight sliders drive a real server calculation, not a client re-score. */
export function useSupplierScorecard(weights?: ScorecardWeights) {
  return useQuery(apiQueries.suppliers.scorecard(getApiClient(), weights !== undefined ? { query: weights } : undefined));
}

export function useCreateSupplier() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSupplierBody) => client.createSupplier({ body }).then((r) => unwrap<SupplierDto>(r)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.suppliers.all }),
  });
}

export function useUpdateSupplier() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateSupplierBody }) =>
      client.updateSupplier({ params: { id }, body }).then((r) => unwrap<SupplierDto>(r)),
    onSuccess: (supplier) => {
      void qc.invalidateQueries({ queryKey: queryKeys.suppliers.all });
      void qc.invalidateQueries({ queryKey: queryKeys.suppliers.detail(supplier.id) });
    },
  });
}
