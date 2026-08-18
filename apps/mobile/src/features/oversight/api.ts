import type { AuditLogEntryDto, DocumentDto, MemberDto } from "@kaenal/types";

import { apiClient } from "@/lib/api";

export class OversightApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "OversightApiError";
  }
}

/** Documents awaiting a manager's approval (status `pending`). */
export async function fetchPendingDocuments(): Promise<DocumentDto[]> {
  const res = await apiClient.listDocuments({ query: { status: "pending", limit: 50 } });
  if (res.status !== 200) throw new OversightApiError(res.status, "Could not load approvals.");
  return res.body.items;
}

export async function fetchDocument(id: string): Promise<DocumentDto> {
  const res = await apiClient.getDocument({ params: { id } });
  if (res.status !== 200) throw new OversightApiError(res.status, "Could not load this document.");
  return res.body;
}

export async function fetchMembers(): Promise<MemberDto[]> {
  const res = await apiClient.listMembers({ query: { limit: 100 } });
  if (res.status !== 200) throw new OversightApiError(res.status, "Could not load the team.");
  return res.body.items;
}

/** Recent sensitive audit-log entries (the admin's audit highlights). */
export async function fetchAuditLog(): Promise<AuditLogEntryDto[]> {
  const res = await apiClient.listTenantAuditLog({ query: { limit: 50 } });
  if (res.status !== 200) throw new OversightApiError(res.status, "Could not load the audit log.");
  return res.body.items;
}
