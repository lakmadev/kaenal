"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type {
  AdvanceAuditBody,
  AuditDto,
  AuditFindingDto,
  CapaDto,
  CreateAuditBody,
  CreateAuditFindingBody,
  NcrDto,
  RaiseCapaFromFindingBody,
  RaiseNcrFromFindingBody,
  UpdateAuditChecklistItemBody,
} from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/** Query filters accepted by the audits list endpoint (contract `listAudits`). */
export interface AuditListQuery {
  status?: AuditDto["status"] | "active" | "completed";
  type?: AuditDto["type"];
  plantId?: string;
  /** Free-text title/code filter — distinct from federated `/v1/search`. */
  q?: string;
  /** Caller is lead auditor, in `team`, or in `auditeeIds`. */
  mine?: boolean;
  /** Schedule view: audits whose [startAt, endAt] overlaps this window. */
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

export function useAudits(query?: AuditListQuery) {
  return useQuery(apiQueries.audits.list(getApiClient(), query !== undefined ? { query } : undefined));
}

export function useAudit(id: string) {
  return useQuery(apiQueries.audits.detail(getApiClient(), id));
}

export function useAuditFindings(id: string) {
  return useQuery(apiQueries.audits.findings(getApiClient(), id));
}

/** Last-6-months audit counts grouped by type (list-page frequency chart). */
export function useAuditFrequency() {
  return useQuery(apiQueries.audits.frequency(getApiClient()));
}

/** KPI strip: active / planned-next-90d / completed-YTD / open-findings. */
export function useAuditStats() {
  return useQuery(apiQueries.audits.stats(getApiClient()));
}

/** Schedule a new audit. Idempotency-safe: pass the SAME `idempotencyKey` on a
 *  retry (e.g. after a network error) and the server returns the original
 *  audit instead of creating a second one (mirrors `useWizardCreate`). */
export function useCreateAudit() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: CreateAuditBody; idempotencyKey: string }) =>
      client.createAudit({ body, extraHeaders: { "idempotency-key": idempotencyKey } }).then((r) => unwrap<AuditDto>(r)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.audits.list() });
      void qc.invalidateQueries({ queryKey: queryKeys.audits.stats() });
      void qc.invalidateQueries({ queryKey: queryKeys.audits.frequency() });
    },
  });
}

/** Advance an audit one phase forward (`planned → … → closed`); optimistic on `lockVersion`. */
export function useAdvanceAudit() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AdvanceAuditBody }) =>
      client.advanceAudit({ params: { id }, body }).then((r) => unwrap<AuditDto>(r)),
    onSuccess: (audit) => {
      qc.setQueryData(queryKeys.audits.detail(audit.id), audit);
      void qc.invalidateQueries({ queryKey: queryKeys.audits.list() });
      void qc.invalidateQueries({ queryKey: queryKeys.audits.stats() });
    },
  });
}

/** Score one checklist clause; auto-links a finding on a first NC/opportunity
 *  (server-side, same transaction). Optimistic on the audit's `lockVersion`. */
export function useUpdateAuditChecklistItem(auditId: string) {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, body }: { itemId: string; body: UpdateAuditChecklistItemBody }) =>
      client.updateAuditChecklistItem({ params: { id: auditId, itemId }, body }).then((r) => unwrap<AuditDto>(r)),
    onSuccess: (audit) => {
      qc.setQueryData(queryKeys.audits.detail(audit.id), audit);
      void qc.invalidateQueries({ queryKey: queryKeys.audits.findings(auditId) });
      void qc.invalidateQueries({ queryKey: queryKeys.audits.list() });
      void qc.invalidateQueries({ queryKey: queryKeys.audits.stats() });
    },
  });
}

export function useCreateAuditFinding(auditId: string) {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAuditFindingBody) =>
      client.createAuditFinding({ params: { id: auditId }, body }).then((r) => unwrap<AuditFindingDto>(r)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.audits.findings(auditId) });
      void qc.invalidateQueries({ queryKey: queryKeys.audits.detail(auditId) });
      void qc.invalidateQueries({ queryKey: queryKeys.audits.list() });
    },
  });
}

/** Raise an NCR from an audit finding (links `audit_findings.ncr_id`); a second
 *  raise on an already-linked finding surfaces the existing 409 as a toast. */
export function useRaiseNcrFromAuditFinding(auditId: string) {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ findingId, body }: { findingId: string; body: RaiseNcrFromFindingBody }) =>
      client.raiseNcrFromAuditFinding({ params: { id: findingId }, body }).then((r) => unwrap<NcrDto>(r)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.audits.findings(auditId) });
      void qc.invalidateQueries({ queryKey: queryKeys.audits.detail(auditId) });
      void qc.invalidateQueries({ queryKey: queryKeys.ncrs.list() });
    },
  });
}

/** Raise a CAPA from an audit finding (links `audit_findings.capa_id`); a second
 *  raise on an already-linked finding surfaces the existing 409 as a toast. */
export function useRaiseCapaFromAuditFinding(auditId: string) {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ findingId, body }: { findingId: string; body: RaiseCapaFromFindingBody }) =>
      client.raiseCapaFromAuditFinding({ params: { id: findingId }, body }).then((r) => unwrap<CapaDto>(r)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.audits.findings(auditId) });
      void qc.invalidateQueries({ queryKey: queryKeys.audits.detail(auditId) });
      void qc.invalidateQueries({ queryKey: queryKeys.capas.list() });
    },
  });
}
