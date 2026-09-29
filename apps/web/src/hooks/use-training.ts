"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type {
  ArchiveCompetencyBody,
  CompetencyDto,
  CompetencyListQuery,
  CreateCompetencyBody,
  CreateTrainingRecordBody,
  CreateTrainingRecordResult,
  ExportDto,
  ReorderCompetenciesBody,
  ReorderCompetenciesResult,
  TrainingGapsQuery,
  TrainingMatrixQuery,
  TrainingRecordsQuery,
  UnarchiveCompetencyBody,
  UpdateCompetencyBody,
} from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/**
 * Training & competency (Sprint 05 T1-T5; `apps/web/src/features/training/`).
 * Mirrors `use-risks.ts`'s shape: list/summary/detail reads via `apiQueries`,
 * mutations invalidate the affected query families so the matrix, KPI strip
 * and catalog editor stay in sync after a write.
 */

// --- Competency catalog ------------------------------------------------------

export function useCompetencies(query?: CompetencyListQuery) {
  return useQuery(apiQueries.competencies.list(getApiClient(), query !== undefined ? { query } : undefined));
}

function invalidateCompetencies(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: queryKeys.competencies.all });
  void qc.invalidateQueries({ queryKey: queryKeys.training.all });
}

export function useCreateCompetency() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCompetencyBody) => client.createCompetency({ body }).then((r) => unwrap<CompetencyDto>(r)),
    onSuccess: () => invalidateCompetencies(qc),
  });
}

export function useUpdateCompetency() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCompetencyBody }) =>
      client.updateCompetency({ params: { id }, body }).then((r) => unwrap<CompetencyDto>(r)),
    onSuccess: () => invalidateCompetencies(qc),
  });
}

export function useArchiveCompetency() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ArchiveCompetencyBody }) =>
      client.archiveCompetency({ params: { id }, body }).then((r) => unwrap<CompetencyDto>(r)),
    onSuccess: () => invalidateCompetencies(qc),
  });
}

export function useUnarchiveCompetency() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UnarchiveCompetencyBody }) =>
      client.unarchiveCompetency({ params: { id }, body }).then((r) => unwrap<CompetencyDto>(r)),
    onSuccess: () => invalidateCompetencies(qc),
  });
}

/** `PUT /v1/competencies/order` (T5 AC3) — no `id`-keyed variables shape (a
 *  whole-catalog reorder, not a single-record edit), so this mutation is not
 *  part of the global stale-write reconcile flow; its own 409 (id-set
 *  mismatch) is handled inline by the caller re-reading the fresh list. */
export function useReorderCompetencies() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReorderCompetenciesBody) => client.reorderCompetencies({ body }).then((r) => unwrap<ReorderCompetenciesResult>(r)),
    onSuccess: () => invalidateCompetencies(qc),
  });
}

// --- Matrix / summary / gaps --------------------------------------------------

export function useTrainingMatrix(query?: TrainingMatrixQuery) {
  return useQuery(apiQueries.training.matrix(getApiClient(), query !== undefined ? { query } : undefined));
}

export function useTrainingSummary() {
  return useQuery(apiQueries.training.summary(getApiClient()));
}

export function useTrainingGaps(query?: TrainingGapsQuery) {
  return useQuery(apiQueries.training.gaps(getApiClient(), query !== undefined ? { query } : undefined));
}

// --- Records ------------------------------------------------------------------

/** A member's full training history (T1 AC9) — the member drawer's (Board 7)
 *  data source, including rows whose competency is now archived. */
export function useTrainingRecords(query: TrainingRecordsQuery | null) {
  const client = getApiClient();
  return useQuery({
    ...apiQueries.training.records(client, { query: query ?? { memberId: "" } }),
    enabled: query !== null,
  });
}

/** One record — the `?recordId=` deep-link target (X1 AC5). */
export function useTrainingRecord(id: string | null) {
  const client = getApiClient();
  return useQuery({
    ...apiQueries.training.record(client, id ?? ""),
    enabled: id !== null,
  });
}

/** Record-training batch (T2 AC1) — one all-or-nothing transaction; the
 *  response is every created row, not a single-record shape, so this is not
 *  part of the global `{id, body}` stale-write flow (there is no existing row
 *  to conflict with — this always creates new rows). */
export function useRecordTraining() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTrainingRecordBody) => client.recordTraining({ body }).then((r) => unwrap<CreateTrainingRecordResult>(r)),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: queryKeys.training.matrix() });
      void qc.invalidateQueries({ queryKey: queryKeys.training.summary() });
      void qc.invalidateQueries({ queryKey: queryKeys.training.gaps() });
      for (const row of result.items) {
        void qc.invalidateQueries({ queryKey: queryKeys.training.records({ memberId: row.memberId }) });
      }
    },
  });
}

/**
 * "Skill gap report" export (T3 AC2/AC3) — the `skill_gap_report` export
 * resource, scoped to the caller's whole visible gaps/expiring set, same
 * async create → poll → download pipeline as `useRiskBoardPackExport`.
 */
export function useSkillGapReportExport() {
  const client = getApiClient();
  const create = useMutation({
    mutationFn: () => client.createExport({ body: { resource: "skill_gap_report", format: "pdf" } }).then((r) => unwrap<ExportDto>(r)),
  });
  const exportId = create.data?.id;
  const poll = useQuery({
    queryKey: ["exports", "skill-gap-report", exportId],
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
