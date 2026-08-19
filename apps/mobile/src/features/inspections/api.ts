import type { FormSchema, InspectionDto, InspectionStatus, TemplateDto } from "@kaenal/types";

import { apiClient } from "@/lib/api";

/** A typed failure carrying the HTTP status so callers can branch (404 vs offline). */
export class InspectionApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "InspectionApiError";
  }
}

function fail(status: number, fallback: string): never {
  throw new InspectionApiError(status, fallback);
}

export interface InspectionPage {
  items: InspectionDto[];
  nextCursor: string | null;
}

/** One page of inspections (cursor-paginated, plant-scoped by role server-side). */
export async function fetchInspections(query: {
  cursor?: string;
  limit?: number;
  status?: InspectionStatus;
}): Promise<InspectionPage> {
  const res = await apiClient.listInspections({ query });
  if (res.status !== 200) fail(res.status, "Could not load inspections.");
  return res.body;
}

export async function fetchInspection(id: string): Promise<InspectionDto> {
  const res = await apiClient.getInspection({ params: { id } });
  if (res.status !== 200) fail(res.status, "Could not load this inspection.");
  return res.body;
}

/** The inspection's template, whose `schema` the runner renders section-by-section. */
export async function fetchTemplate(templateId: string): Promise<{ template: TemplateDto; schema: FormSchema }> {
  const res = await apiClient.getTemplate({ params: { id: templateId } });
  if (res.status !== 200) fail(res.status, "Could not load the inspection form.");
  return { template: res.body, schema: res.body.schema };
}

/** Begin an inspection (scheduled → in_progress). Online action. */
export async function startInspection(id: string, version: number): Promise<InspectionDto> {
  const res = await apiClient.startInspection({ params: { id }, body: { version } });
  if (res.status !== 200) fail(res.status, "Could not start this inspection.");
  return res.body;
}
