"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type { ExportDto, RiskCategory, RiskDto, RiskRegisterStatus, RiskTreatment, UpdateRiskBody } from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/** Query filters accepted by `GET /v1/risks` (contract `listRisks`). */
export interface RiskListQuery {
  category?: RiskCategory;
  status?: RiskRegisterStatus;
  treatment?: RiskTreatment;
  owner?: string;
  likelihood?: number;
  impact?: number;
  ids?: string;
  cursor?: string;
  limit?: number;
}

/**
 * Risk register (`/v1/risks`, SPRINT-04 R1/R2). The register itself is
 * cursor-paginated; the KPI strip/heat-map/category panel read the separate
 * unpaginated `summary` aggregate (R1 AC6) so they never need every page.
 */
export function useRisks(query?: RiskListQuery) {
  return useQuery(apiQueries.risks.list(getApiClient(), query !== undefined ? { query } : undefined));
}

export function useRisksSummary() {
  return useQuery(apiQueries.risks.summary(getApiClient()));
}

export function useRisk(id: string | null) {
  const client = getApiClient();
  return useQuery({
    ...apiQueries.risks.detail(client, id ?? ""),
    enabled: id !== null,
  });
}

function invalidateRisk(qc: ReturnType<typeof useQueryClient>, risk: RiskDto): void {
  qc.setQueryData(queryKeys.risks.detail(risk.id), risk);
  void qc.invalidateQueries({ queryKey: queryKeys.risks.list() });
  void qc.invalidateQueries({ queryKey: queryKeys.risks.summary() });
}

/**
 * Full edit surface (R1 UC "Edit / Re-score both open the same edit
 * surface"), optimistic via `lockVersion`. `controls` is an optional
 * full-array replace (R2 AC2) folded into the same PATCH. Variables are
 * shaped `{ id, body }` (body carries `lockVersion`) so the global 409
 * reconcile flow opens automatically on a stale-write race, same as
 * `useRecordMsaMeasurements`.
 */
export function useUpdateRisk() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateRiskBody }) =>
      client.updateRisk({ params: { id }, body }).then((r) => unwrap<RiskDto>(r)),
    onSuccess: (risk) => invalidateRisk(qc, risk),
  });
}

/**
 * "Board pack" export (R5): the `risk_board_pack` export resource, scoped to
 * the caller's whole visible register — same async create → poll → download
 * pipeline as `useMsaAiagReportExport` (`use-msa.ts`), no new backend route.
 */
export function useRiskBoardPackExport() {
  const client = getApiClient();
  const create = useMutation({
    mutationFn: () => client.createExport({ body: { resource: "risk_board_pack", format: "pdf" } }).then((r) => unwrap<ExportDto>(r)),
  });
  const exportId = create.data?.id;
  const poll = useQuery({
    queryKey: ["exports", "risk-board-pack", exportId],
    enabled: exportId !== undefined,
    queryFn: () => client.getExport({ params: { id: exportId ?? "" } }).then((r) => unwrap<ExportDto>(r)),
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status === "completed" || status === "failed" ? false : 1500;
    },
  });
  const status = poll.data?.status ?? create.data?.status;
  return {
    trigger: () => create.mutate(),
    status,
    downloadUrl: poll.data?.downloadUrl ?? null,
    isPreparing: create.isPending || status === "queued" || status === "processing",
    isFailed: create.isError || status === "failed" || poll.isError,
  };
}
