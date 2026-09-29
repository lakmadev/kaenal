"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type {
  AttachCertificateBody,
  CalibrationEventDto,
  CreateCalibrationEventBody,
  CreateInstrumentBody,
  ExportDto,
  InstrumentDto,
  InstrumentDueStatus,
  InstrumentLifecycleStatus,
  InstrumentType,
  NcrDto,
  RetireInstrumentBody,
  UpdateInstrumentBody,
} from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/**
 * Calibration management (Sprint 05 C1-C6; `apps/web/src/features/calibration/`).
 * Mirrors `use-risks.ts`'s shape exactly: list/summary/detail reads via
 * `apiQueries`, mutations invalidate the affected query families so the
 * register, KPI strip and detail card stay in sync after a write.
 */

export interface InstrumentListQuery {
  type?: InstrumentType;
  status?: InstrumentLifecycleStatus;
  dueStatus?: "due_soon" | "overdue";
  plantId?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}

export function useInstruments(query?: InstrumentListQuery) {
  return useQuery(apiQueries.instruments.list(getApiClient(), query !== undefined ? { query } : undefined));
}

export function useInstrumentsSummary() {
  return useQuery(apiQueries.instruments.summary(getApiClient()));
}

/** Direct-id detail fetch (C1 AC4) — carries the owner-sees-own-instrument
 *  plant-scope exception server-side; the UI just fetches by id, including
 *  when arriving via a notification deep-link for an instrument that never
 *  appeared in a loaded list page (§3.1 item 3). */
export function useInstrument(id: string | null) {
  const client = getApiClient();
  return useQuery({
    ...apiQueries.instruments.detail(client, id ?? ""),
    enabled: id !== null,
  });
}

function invalidateInstrument(qc: ReturnType<typeof useQueryClient>, instrument: InstrumentDto): void {
  qc.setQueryData(queryKeys.instruments.detail(instrument.id), instrument);
  void qc.invalidateQueries({ queryKey: queryKeys.instruments.list() });
  void qc.invalidateQueries({ queryKey: queryKeys.instruments.summary() });
}

export function useCreateInstrument() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: CreateInstrumentBody; idempotencyKey: string }) =>
      client.createInstrument({ body, extraHeaders: { "idempotency-key": idempotencyKey } }).then((r) => unwrap<InstrumentDto>(r)),
    onSuccess: (instrument) => invalidateInstrument(qc, instrument),
  });
}

/** Edit, incl. Transfer (C4 AC2 — same route, only `plantId`/`areaId` set).
 *  `{id, body}` variables shape (`body` carries `lockVersion`) so a 409 opens
 *  the global stale-write reconcile dialog automatically. */
export function useUpdateInstrument() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateInstrumentBody }) =>
      client.updateInstrument({ params: { id }, body }).then((r) => unwrap<InstrumentDto>(r)),
    onSuccess: (instrument) => invalidateInstrument(qc, instrument),
  });
}

/** One-way active -> retired (C4 AC1), `lockVersion`-guarded. */
export function useRetireInstrument() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: RetireInstrumentBody }) =>
      client.retireInstrument({ params: { id }, body }).then((r) => unwrap<InstrumentDto>(r)),
    onSuccess: (instrument) => invalidateInstrument(qc, instrument),
  });
}

export interface CalibrationEventListQuery {
  cursor?: string;
  limit?: number;
}

/** Full calibration history (C2 AC3) — the detail card's "last 5" is this
 *  same route with `limit: 5`. Carries the same owner-exception as the
 *  parent instrument's DETAIL fetch. */
export function useCalibrationEvents(instrumentId: string | null, query?: CalibrationEventListQuery) {
  const client = getApiClient();
  const cleanQuery: CalibrationEventListQuery = {
    ...(query?.limit !== undefined ? { limit: query.limit } : {}),
    ...(query?.cursor !== undefined ? { cursor: query.cursor } : {}),
  };
  return useQuery({
    ...apiQueries.instruments.calibrationEvents(client, instrumentId ?? "", { query: cleanQuery }),
    enabled: instrumentId !== null,
  });
}

function invalidateAfterEvent(qc: ReturnType<typeof useQueryClient>, instrumentId: string): void {
  void qc.invalidateQueries({ queryKey: queryKeys.instruments.detail(instrumentId) });
  void qc.invalidateQueries({ queryKey: queryKeys.instruments.calibrationEvents(instrumentId) });
  void qc.invalidateQueries({ queryKey: queryKeys.instruments.list() });
  void qc.invalidateQueries({ queryKey: queryKeys.instruments.summary() });
}

/** Record a calibration event (C2 AC2) — `lockVersion` on the parent
 *  instrument; pass/adjusted advance the due date, fail never does (B3). */
export function useRecordCalibrationEvent() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      instrumentId,
      body,
      idempotencyKey,
    }: {
      instrumentId: string;
      body: CreateCalibrationEventBody;
      idempotencyKey: string;
    }) =>
      client
        .recordCalibrationEvent({ params: { id: instrumentId }, body, extraHeaders: { "idempotency-key": idempotencyKey } })
        .then((r) => unwrap<CalibrationEventDto>(r)),
    onSuccess: (_event, vars) => invalidateAfterEvent(qc, vars.instrumentId),
  });
}

/** Attach/replace a certificate after the fact (C2 AC5) — never touches the
 *  parent instrument's due date, so only the event's own cache entries
 *  invalidate. */
export function useAttachCalibrationCertificate() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ instrumentId, eventId, body }: { instrumentId: string; eventId: string; body: AttachCertificateBody }) =>
      client.attachCalibrationCertificate({ params: { instrumentId, eventId }, body }).then((r) => unwrap<CalibrationEventDto>(r)),
    onSuccess: (_event, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.instruments.calibrationEvents(vars.instrumentId) });
    },
  });
}

/** Raise a real NCR from an out-of-tolerance calibration event (C3 AC2) —
 *  one-time only; the event's own `ncrId` field disables/hides the action
 *  once it exists, no need to re-check here. */
export function useRaiseNcrFromCalibrationEvent() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ instrumentId, eventId }: { instrumentId: string; eventId: string }) =>
      client.raiseNcrFromCalibrationEvent({ params: { instrumentId, eventId }, body: {} }).then((r) => unwrap<NcrDto>(r)),
    onSuccess: (_ncr, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.instruments.calibrationEvents(vars.instrumentId) });
    },
  });
}

/**
 * "Audit pack" export (C5 AC2/AC3): the `calibration_audit_pack` export
 * resource, scoped to the caller's whole visible register — same async
 * create -> poll -> download pipeline as `useRiskBoardPackExport`.
 */
export function useCalibrationAuditPackExport() {
  const client = getApiClient();
  const create = useMutation({
    mutationFn: () => client.createExport({ body: { resource: "calibration_audit_pack", format: "pdf" } }).then((r) => unwrap<ExportDto>(r)),
  });
  const exportId = create.data?.id;
  const poll = useQuery({
    queryKey: ["exports", "calibration-audit-pack", exportId],
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

export type { InstrumentDueStatus };
