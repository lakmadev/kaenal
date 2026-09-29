"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type {
  CreateMsaStudyBody,
  ExportDto,
  MsaCompleteBody,
  MsaMeasurementBatchBody,
  MsaMethod,
  MsaReopenBody,
  MsaStudyDto,
  MsaStudyStatus,
} from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/** Query filters accepted by `GET /v1/msa-studies` (contract `listMsaStudies`). */
export interface MsaListQuery {
  status?: MsaStudyStatus;
  method?: MsaMethod;
  cursor?: string;
  limit?: number;
}

/**
 * MSA / Gauge R&R (`/v1/msa-studies`, SPRINT-04 M1-M5). A study's own detail
 * read IS the grid's data source (`measurements` on `MsaStudyDto`) — there is
 * no separate measurement-list route. Analysis is never stored pre-computed
 * (M1 AC3), so `useMsaAnalysis` always re-fetches from the real grid.
 */
export function useMsaStudies(query?: MsaListQuery) {
  return useQuery(apiQueries.msa.list(getApiClient(), query !== undefined ? { query } : undefined));
}

export function useMsaStudy(id: string | null) {
  const client = getApiClient();
  return useQuery({
    ...apiQueries.msa.detail(client, id ?? ""),
    enabled: id !== null,
  });
}

/** Discriminated `incomplete | complete` — always recomputed on read (M1 AC3). */
export function useMsaAnalysis(id: string | null) {
  const client = getApiClient();
  return useQuery({
    ...apiQueries.msa.analysis(client, id ?? ""),
    enabled: id !== null,
  });
}

function invalidateStudy(qc: ReturnType<typeof useQueryClient>, study: MsaStudyDto): void {
  qc.setQueryData(queryKeys.msa.detail(study.id), study);
  void qc.invalidateQueries({ queryKey: queryKeys.msa.analysis(study.id) });
  void qc.invalidateQueries({ queryKey: queryKeys.msa.list() });
}

/** Starts a new study shell (`draft`); `nAppraisers`/`nParts`/`nTrials`/
 *  `method`/`gaugeLabel`/`tolerance`/`characteristic` are immutable afterwards
 *  (M2 AC3) — this is the only place they're ever set. */
export function useCreateMsaStudy() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateMsaStudyBody) => client.createMsaStudy({ body }).then((r) => unwrap<MsaStudyDto>(r)),
    onSuccess: (study) => invalidateStudy(qc, study),
  });
}

/**
 * Bulk-upserts grid cells (M2 AC2, `[AMENDED-4]`). Variables are shaped
 * `{ id, body }` (body carries `lockVersion`) so the global 409 reconcile flow
 * (`lib/stale-write-flow.ts`, wired in `lib/query-client.ts`'s `MutationCache`)
 * opens automatically on a stale-write race — no per-screen wiring needed.
 */
export function useRecordMsaMeasurements() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: MsaMeasurementBatchBody }) =>
      client.recordMsaMeasurements({ params: { id }, body }).then((r) => unwrap<MsaStudyDto>(r)),
    onSuccess: (study) => invalidateStudy(qc, study),
  });
}

/** `draft → completed` (M2 AC3); 422 on an incomplete grid or an
 *  already-`completed` study, 409 on a stale `lockVersion`. */
export function useCompleteMsaStudy() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: MsaCompleteBody }) =>
      client.completeMsaStudy({ params: { id }, body }).then((r) => unwrap<MsaStudyDto>(r)),
    onSuccess: (study) => invalidateStudy(qc, study),
  });
}

/** `completed → draft` (M2 AC5); 422 on an already-`draft` study, 409 on a
 *  stale `lockVersion`. `completedAt` is kept, not cleared, by the reopen itself. */
export function useReopenMsaStudy() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: MsaReopenBody }) =>
      client.reopenMsaStudy({ params: { id }, body }).then((r) => unwrap<MsaStudyDto>(r)),
    onSuccess: (study) => invalidateStudy(qc, study),
  });
}

/**
 * One study's AIAG report PDF (M5): the `gauge_rr_aiag_report` export resource,
 * scoped by `studyId` — same async create → poll → download pipeline as
 * `useAuditReportExport` (`use-audits.ts`), no new backend route needed.
 */
export function useMsaAiagReportExport(studyId: string | null) {
  const client = getApiClient();
  const create = useMutation({
    mutationFn: () =>
      client
        .createExport({ body: { resource: "gauge_rr_aiag_report", format: "pdf", filters: { studyId: studyId ?? "" } } })
        .then((r) => unwrap<ExportDto>(r)),
  });
  const exportId = create.data?.id;
  const poll = useQuery({
    queryKey: ["exports", "gauge-rr-aiag-report", exportId],
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
