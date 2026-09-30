"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type {
  AcknowledgeComplaintBody,
  CloseComplaintBody,
  ComplaintChannel,
  ComplaintConvertBody,
  ComplaintConvertResult,
  ComplaintDto,
  ComplaintSeverity,
  ComplaintStatus,
  CreateComplaintBody,
  UpdateComplaintBody,
} from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/** Query filters accepted by `GET /v1/complaints` (SPRINT-06 C1 AC2). */
export interface ComplaintListQuery {
  status?: ComplaintStatus;
  severity?: ComplaintSeverity;
  channel?: ComplaintChannel;
  owner?: string;
  unlinked?: boolean;
  q?: string;
  cursor?: string;
  limit?: number;
}

export function useComplaints(query?: ComplaintListQuery) {
  return useQuery(apiQueries.complaints.list(getApiClient(), query !== undefined ? { query } : undefined));
}

export function useComplaintsSummary() {
  return useQuery(apiQueries.complaints.summary(getApiClient()));
}

export function useComplaint(id: string | null) {
  const client = getApiClient();
  return useQuery({
    ...apiQueries.complaints.detail(client, id ?? ""),
    enabled: id !== null && id !== "",
  });
}

function invalidateComplaint(qc: ReturnType<typeof useQueryClient>, complaint: ComplaintDto): void {
  qc.setQueryData(queryKeys.complaints.detail(complaint.id), complaint);
  void qc.invalidateQueries({ queryKey: queryKeys.complaints.list() });
  void qc.invalidateQueries({ queryKey: queryKeys.complaints.summary() });
}

/** Log a complaint (C2 AC1-4). `Idempotency-Key` mirrors every other sprint's
 *  create-route pattern. */
export function useCreateComplaint() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: CreateComplaintBody; idempotencyKey: string }) =>
      client.createComplaint({ body, extraHeaders: { "idempotency-key": idempotencyKey } }).then((r) => unwrap<ComplaintDto>(r)),
    onSuccess: (complaint) => invalidateComplaint(qc, complaint),
  });
}

/** Edit (C1 AC2) — `{id, body}` variables shape (`body` carries `lockVersion`)
 *  so a 409 opens the global stale-write reconcile dialog automatically. */
export function useUpdateComplaint() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateComplaintBody }) =>
      client.updateComplaint({ params: { id }, body }).then((r) => unwrap<ComplaintDto>(r)),
    onSuccess: (complaint) => invalidateComplaint(qc, complaint),
  });
}

/** Acknowledge (C3 AC1) — 422 if already acknowledged. */
export function useAcknowledgeComplaint() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AcknowledgeComplaintBody }) =>
      client.acknowledgeComplaint({ params: { id }, body }).then((r) => unwrap<ComplaintDto>(r)),
    onSuccess: (complaint) => invalidateComplaint(qc, complaint),
  });
}

/** Close (C3 AC2) — allowed from any non-closed status, with or without ever
 *  converting; 422 if already closed. */
export function useCloseComplaint() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CloseComplaintBody }) =>
      client.closeComplaint({ params: { id }, body }).then((r) => unwrap<ComplaintDto>(r)),
    onSuccess: (complaint) => invalidateComplaint(qc, complaint),
  });
}

/** Convert/link to NCR (create or link existing), 8D or CAPA (C4 AC1/2) — a
 *  discriminated union keyed on `target`. Invalidates the complaint plus the
 *  target module's own list (the new/linked record now exists there too). */
export function useConvertComplaint() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ComplaintConvertBody }) =>
      client.convertComplaint({ params: { id }, body }).then((r) => unwrap<ComplaintConvertResult>(r)),
    onSuccess: (result) => {
      invalidateComplaint(qc, result.complaint);
      if (result.target.kind === "ncr") void qc.invalidateQueries({ queryKey: queryKeys.ncrs.all });
      if (result.target.kind === "eight_d") void qc.invalidateQueries({ queryKey: queryKeys.eightDs.all });
      if (result.target.kind === "capa") void qc.invalidateQueries({ queryKey: queryKeys.capas.all });
    },
  });
}
