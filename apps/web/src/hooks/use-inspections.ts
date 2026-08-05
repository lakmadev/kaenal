"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type {
  AssignInspectionBody,
  CompleteInspectionBody,
  CreateFindingBody,
  CreateInspectionBody,
  CreateTemplateBody,
  FindingDto,
  InspectionDto,
  Page,
  StartInspectionBody,
  TemplateDto,
} from "@kaenal/types";
import { getApiClient } from "@/lib/api";

export interface InspectionListQuery {
  status?: InspectionDto["status"];
  cursor?: string;
  limit?: number;
}

export function useInspections(query?: InspectionListQuery) {
  return useQuery(apiQueries.inspections.list(getApiClient(), query !== undefined ? { query } : undefined));
}

export function useInspection(id: string) {
  return useQuery(apiQueries.inspections.detail(getApiClient(), id));
}

/** A template + its immutable form schema (needed to render an inspection). */
export function useTemplate(id: string | undefined) {
  const client = getApiClient();
  return useQuery({
    queryKey: ["templates", "detail", id],
    queryFn: () => client.getTemplate({ params: { id: id! } }).then((r) => unwrap<TemplateDto>(r)),
    enabled: id !== undefined,
  });
}

/** All inspection templates (draft + published) for the Templates screen. */
export function useTemplates() {
  const client = getApiClient();
  return useQuery({
    queryKey: ["templates", "list", "all"],
    queryFn: () => client.listTemplates({}).then((r) => unwrap<Page<TemplateDto>>(r)),
  });
}

/** Published templates only — the pool an inspection can be scheduled from. */
export function usePublishedTemplates() {
  const client = getApiClient();
  return useQuery({
    queryKey: ["templates", "list", "published"],
    queryFn: () =>
      client.listTemplates({ query: { status: "published" } }).then((r) => unwrap<Page<TemplateDto>>(r)),
  });
}

/** Create a draft template, then publish it (its schema becomes immutable). */
export function usePublishTemplate() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateTemplateBody): Promise<TemplateDto> => {
      const draft = await client.createTemplate({ body }).then((r) => unwrap<TemplateDto>(r));
      return client
        .publishTemplate({ params: { id: draft.id }, body: { version: draft.lockVersion } })
        .then((r) => unwrap<TemplateDto>(r));
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}

export function useInspectionFindings(id: string) {
  const client = getApiClient();
  return useQuery({
    queryKey: queryKeys.inspections.findings(id),
    queryFn: () => client.listFindings({ params: { id } }).then((r) => unwrap<Page<FindingDto>>(r)),
  });
}

export function useCreateInspection() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateInspectionBody) => client.createInspection({ body }).then((r) => unwrap<InspectionDto>(r)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.inspections.list() }),
  });
}

export function useStartInspection() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: StartInspectionBody }) =>
      client.startInspection({ params: { id }, body }).then((r) => unwrap<InspectionDto>(r)),
    onSuccess: (i) => {
      void qc.invalidateQueries({ queryKey: queryKeys.inspections.list() });
      void qc.invalidateQueries({ queryKey: queryKeys.inspections.detail(i.id) });
    },
  });
}

export function useCompleteInspection() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CompleteInspectionBody }) =>
      client.completeInspection({ params: { id }, body }).then((r) => unwrap<InspectionDto>(r)),
    onSuccess: (i) => {
      void qc.invalidateQueries({ queryKey: queryKeys.inspections.list() });
      void qc.invalidateQueries({ queryKey: queryKeys.inspections.detail(i.id) });
    },
  });
}

/** Assign / reassign / clear an inspection's inspector (P25). Orthogonal to the
 *  scheduled → in_progress → completed machine — it never moves status. */
export function useAssignInspection() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AssignInspectionBody }) =>
      client.assignInspection({ params: { id }, body }).then((r) => unwrap<InspectionDto>(r)),
    onSuccess: (i) => {
      qc.setQueryData(queryKeys.inspections.detail(i.id), i);
      void qc.invalidateQueries({ queryKey: queryKeys.inspections.list() });
    },
  });
}

export function useCreateFinding(inspectionId: string) {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateFindingBody) =>
      client.createFinding({ params: { id: inspectionId }, body }).then((r) => unwrap<FindingDto>(r)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.inspections.findings(inspectionId) }),
  });
}
