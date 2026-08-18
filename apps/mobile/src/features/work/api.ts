import type { CapaActionDto, CapaDto, EightDDto } from "@kaenal/types";

import { apiClient } from "@/lib/api";

export class WorkApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "WorkApiError";
  }
}

export async function fetchCapas(limit = 50): Promise<CapaDto[]> {
  const res = await apiClient.listCapas({ query: { limit } });
  if (res.status !== 200) throw new WorkApiError(res.status, "Could not load CAPAs.");
  return res.body.items;
}

export async function fetchCapa(id: string): Promise<CapaDto> {
  const res = await apiClient.getCapa({ params: { id } });
  if (res.status !== 200) throw new WorkApiError(res.status, "Could not load this CAPA.");
  return res.body;
}

export async function fetchCapaActions(id: string): Promise<CapaActionDto[]> {
  const res = await apiClient.listCapaActions({ params: { id } });
  if (res.status !== 200) throw new WorkApiError(res.status, "Could not load actions.");
  return res.body.items;
}

export async function fetchEightDs(limit = 50): Promise<EightDDto[]> {
  const res = await apiClient.listEightDs({ query: { limit } });
  if (res.status !== 200) throw new WorkApiError(res.status, "Could not load 8D investigations.");
  return res.body.items;
}

export async function fetchEightD(id: string): Promise<EightDDto> {
  const res = await apiClient.getEightD({ params: { id } });
  if (res.status !== 200) throw new WorkApiError(res.status, "Could not load this 8D.");
  return res.body;
}
