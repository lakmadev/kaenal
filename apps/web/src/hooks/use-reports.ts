"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type { CreateReportBody, ReportDefinitionDto, UpdateReportBody } from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/**
 * Report definitions (`/v1/reports`). The list interleaves the three built-in
 * dashboards (read-only) with the tenant's saved reports. Mutations invalidate
 * the list; an update also refreshes that report's detail cache.
 */
export function useReports() {
  return useQuery(apiQueries.reports.list(getApiClient()));
}

export function useReport(id: string | null) {
  const client = getApiClient();
  return useQuery({
    ...apiQueries.reports.detail(client, id ?? ""),
    enabled: id !== null && id !== "",
  });
}

function useReportMutation<A, R>(call: (client: ReturnType<typeof getApiClient>, arg: A) => Promise<R>) {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg: A) => call(client, arg),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.reports.all }),
  });
}

export function useCreateReport() {
  return useReportMutation<CreateReportBody, ReportDefinitionDto>((client, body) =>
    client.createReport({ body }).then((r) => unwrap<ReportDefinitionDto>(r)),
  );
}

export function useUpdateReport() {
  return useReportMutation<{ id: string; body: UpdateReportBody }, ReportDefinitionDto>((client, { id, body }) =>
    client.updateReport({ params: { id }, body }).then((r) => unwrap<ReportDefinitionDto>(r)),
  );
}

export function useDeleteReport() {
  return useReportMutation<string, ReportDefinitionDto>((client, id) =>
    client.deleteReport({ params: { id }, body: {} }).then((r) => unwrap<ReportDefinitionDto>(r)),
  );
}
