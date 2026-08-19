import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type { FormSchema, InspectionDto, TemplateDto } from "@kaenal/types";

import { useSession } from "@/stores/session";

import { fetchInspection, fetchInspections, fetchTemplate, type InspectionPage } from "./api";

/** The inspector's work queue — first page of in-scope inspections. */
export function useInspections(): UseQueryResult<InspectionPage> {
  const tenant = useSession((s) => s.tenant);
  return useQuery({
    queryKey: ["inspections", tenant],
    queryFn: () => fetchInspections({ limit: 50 }),
    enabled: tenant !== null,
    staleTime: 15_000,
  });
}

export function useInspection(id: string): UseQueryResult<InspectionDto> {
  const tenant = useSession((s) => s.tenant);
  return useQuery({
    queryKey: ["inspection", tenant, id],
    queryFn: () => fetchInspection(id),
    enabled: tenant !== null && id !== "",
  });
}

export function useTemplate(templateId: string | undefined): UseQueryResult<{ template: TemplateDto; schema: FormSchema }> {
  const tenant = useSession((s) => s.tenant);
  return useQuery({
    queryKey: ["template", tenant, templateId],
    queryFn: () => fetchTemplate(templateId as string),
    enabled: tenant !== null && templateId !== undefined,
    staleTime: 5 * 60_000, // templates are immutable once published
  });
}
