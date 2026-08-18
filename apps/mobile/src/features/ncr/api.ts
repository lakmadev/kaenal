import type { NcrActionDto, NcrDto, NcrPriority, NcrStatus } from "@kaenal/types";

import { apiClient } from "@/lib/api";

export class NcrApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "NcrApiError";
  }
}

export interface NcrPage {
  items: NcrDto[];
  nextCursor: string | null;
}

export async function fetchNcrs(query: { cursor?: string; limit?: number; status?: NcrStatus; priority?: NcrPriority }): Promise<NcrPage> {
  const res = await apiClient.listNcrs({ query });
  if (res.status !== 200) throw new NcrApiError(res.status, "Could not load NCRs.");
  return res.body;
}

export async function fetchNcr(id: string): Promise<NcrDto> {
  const res = await apiClient.getNcr({ params: { id } });
  if (res.status !== 200) throw new NcrApiError(res.status, "Could not load this NCR.");
  return res.body;
}

export async function fetchNcrActions(id: string): Promise<NcrActionDto[]> {
  const res = await apiClient.listNcrActions({ params: { id } });
  if (res.status !== 200) throw new NcrApiError(res.status, "Could not load actions.");
  return res.body.items;
}
