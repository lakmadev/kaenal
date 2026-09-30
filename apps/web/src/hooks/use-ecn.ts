"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type {
  DecideEcnApprovalBody,
  EcnApprovalStage,
  EcnChangeRisk,
  EcnChangeType,
  EcnDto,
  EcnLifecycleBody,
  EcnLinkBody,
  EcnLinkDto,
  EcnStage,
  UpdateEcnBody,
} from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/** Query filters accepted by `GET /v1/ecns` (SPRINT-06 E1 AC3). */
export interface EcnListQuery {
  changeType?: EcnChangeType;
  stage?: EcnStage;
  changeRisk?: EcnChangeRisk;
  owner?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}

export function useEcns(query?: EcnListQuery) {
  return useQuery(apiQueries.ecns.list(getApiClient(), query !== undefined ? { query } : undefined));
}

/** Kanban column counts (E2 AC2) — all 9 stage keys always present. */
export function useEcnsSummary() {
  return useQuery(apiQueries.ecns.summary(getApiClient()));
}

export function useEcn(id: string | null) {
  const client = getApiClient();
  return useQuery({
    ...apiQueries.ecns.detail(client, id ?? ""),
    enabled: id !== null && id !== "",
  });
}

/** The 5-row approval tracker for the detail view (E4 AC6). */
export function useEcnApprovals(id: string | null) {
  const client = getApiClient();
  return useQuery({
    ...apiQueries.ecns.approvals(client, id ?? ""),
    enabled: id !== null && id !== "",
  });
}

/** Affected documents/suppliers (E5 AC3). */
export function useEcnLinks(id: string | null) {
  const client = getApiClient();
  return useQuery({
    ...apiQueries.ecns.links(client, id ?? ""),
    enabled: id !== null && id !== "",
  });
}

function invalidateEcn(qc: ReturnType<typeof useQueryClient>, ecn: EcnDto): void {
  qc.setQueryData(queryKeys.ecns.detail(ecn.id), ecn);
  void qc.invalidateQueries({ queryKey: queryKeys.ecns.list() });
  void qc.invalidateQueries({ queryKey: queryKeys.ecns.summary() });
}

/** Edit (E1 AC3) — `{id, body}` variables (`body` carries `lockVersion`) so a
 *  409 opens the global stale-write reconcile dialog automatically. */
export function useUpdateEcn() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateEcnBody }) =>
      client.updateEcn({ params: { id }, body }).then((r) => unwrap<EcnDto>(r)),
    onSuccess: (ecn) => invalidateEcn(qc, ecn),
  });
}

/** `draft -> feasibility` (E4). */
export function useSubmitEcn() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: EcnLifecycleBody }) =>
      client.submitEcn({ params: { id }, body }).then((r) => unwrap<EcnDto>(r)),
    onSuccess: (ecn) => invalidateEcn(qc, ecn),
  });
}

/** `draft -> rejected` — an author cancelling their own draft (E4). */
export function useWithdrawEcn() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: EcnLifecycleBody }) =>
      client.withdrawEcn({ params: { id }, body }).then((r) => unwrap<EcnDto>(r)),
    onSuccess: (ecn) => invalidateEcn(qc, ecn),
  });
}

/** `rejected -> draft` — resets all 5 approvals to pending (E4, §0b D3). */
export function useResubmitEcn() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: EcnLifecycleBody }) =>
      client.resubmitEcn({ params: { id }, body }).then((r) => unwrap<EcnDto>(r)),
    onSuccess: (ecn) => {
      invalidateEcn(qc, ecn);
      void qc.invalidateQueries({ queryKey: queryKeys.ecns.approvals(ecn.id) });
    },
  });
}

/** `implementation -> closed` (E4). */
export function useCloseEcn() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: EcnLifecycleBody }) =>
      client.closeEcn({ params: { id }, body }).then((r) => unwrap<EcnDto>(r)),
    onSuccess: (ecn) => invalidateEcn(qc, ecn),
  });
}

/** Approve/reject the ECN's current gated stage (E4 AC2) — `pilot -> implementation`
 *  runs E5's auto-revise server-side in the same transaction, so the returned
 *  `EcnDto.autoReviseResult` is refreshed here too. */
export function useDecideEcnApproval() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage, body }: { id: string; stage: EcnApprovalStage; body: DecideEcnApprovalBody }) =>
      client.decideEcnApproval({ params: { id, stage }, body }).then((r) => unwrap<EcnDto>(r)),
    onSuccess: (ecn) => {
      invalidateEcn(qc, ecn);
      void qc.invalidateQueries({ queryKey: queryKeys.ecns.approvals(ecn.id) });
    },
  });
}

/** Link an affected document/supplier (E5 AC1). */
export function useLinkEcn() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: EcnLinkBody }) =>
      client.linkEcn({ params: { id }, body }).then((r) => unwrap<EcnLinkDto>(r)),
    onSuccess: (_link, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.ecns.links(vars.id) });
      void qc.invalidateQueries({ queryKey: queryKeys.ecns.detail(vars.id) });
      void qc.invalidateQueries({ queryKey: queryKeys.ecns.list() });
    },
  });
}

/** Unlink (E5 AC2, §0 B4) — the only way to remove an ECN's own link. */
export function useUnlinkEcn() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, linkId }: { id: string; linkId: string }) =>
      client.unlinkEcn({ params: { id, linkId }, body: {} }).then((r) => unwrap<EcnDto>(r)),
    onSuccess: (ecn) => {
      invalidateEcn(qc, ecn);
      void qc.invalidateQueries({ queryKey: queryKeys.ecns.links(ecn.id) });
    },
  });
}
