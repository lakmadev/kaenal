"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type {
  AssignCostCenterBody,
  ChargebackReportDto,
  ChargebackSettingsDto,
  CostCenterAssignmentDto,
  CostCenterDto,
  CreateCostCenterBody,
  UpdateChargebackSettingsBody,
  UpdateCostCenterBody,
} from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/**
 * Cost centers + chargeback (`/v1/settings/cost-centers`, `/chargeback`). Cost-
 * center + assignment mutations invalidate the tree, the roster AND the report
 * (seats drive it); chargeback-settings mutations invalidate the report too.
 */
export function useCostCenters() {
  return useQuery(apiQueries.settings.costCenters(getApiClient()));
}

export function useCostCenterAssignments() {
  return useQuery(apiQueries.settings.costCenterAssignments(getApiClient()));
}

export function useChargebackSettings() {
  return useQuery(apiQueries.settings.chargebackSettings(getApiClient()));
}

export function useChargebackReport() {
  return useQuery(apiQueries.settings.chargebackReport(getApiClient()));
}

function useCcMutation<A, R>(call: (client: ReturnType<typeof getApiClient>, arg: A) => Promise<R>) {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg: A) => call(client, arg),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.settings.costCenters() });
      void qc.invalidateQueries({ queryKey: queryKeys.settings.costCenterAssignments() });
      void qc.invalidateQueries({ queryKey: queryKeys.settings.chargebackReport() });
    },
  });
}

export function useCreateCostCenter() {
  return useCcMutation<CreateCostCenterBody, CostCenterDto>((client, body) =>
    client.createCostCenter({ body }).then((r) => unwrap<CostCenterDto>(r)),
  );
}

export function useUpdateCostCenter() {
  return useCcMutation<{ id: string; body: UpdateCostCenterBody }, CostCenterDto>((client, { id, body }) =>
    client.updateCostCenter({ params: { id }, body }).then((r) => unwrap<CostCenterDto>(r)),
  );
}

export function useDeleteCostCenter() {
  return useCcMutation<string, CostCenterDto>((client, id) =>
    client.deleteCostCenter({ params: { id }, body: {} }).then((r) => unwrap<CostCenterDto>(r)),
  );
}

export function useAssignCostCenter() {
  return useCcMutation<AssignCostCenterBody, CostCenterAssignmentDto>((client, body) =>
    client.assignCostCenter({ body }).then((r) => unwrap<CostCenterAssignmentDto>(r)),
  );
}

export function useUpdateChargebackSettings() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateChargebackSettingsBody) =>
      client.updateChargebackSettings({ body }).then((r) => unwrap<ChargebackSettingsDto>(r)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.settings.chargebackSettings() });
      void qc.invalidateQueries({ queryKey: queryKeys.settings.chargebackReport() });
    },
  });
}

export type { ChargebackReportDto, ChargebackSettingsDto, CostCenterDto, CostCenterAssignmentDto };
