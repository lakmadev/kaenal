import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type { AuditLogEntryDto, DocumentDto, MemberDto } from "@kaenal/types";

import { useSession } from "@/stores/session";

import { fetchAuditLog, fetchDocument, fetchMembers, fetchPendingDocuments } from "./api";

export function usePendingApprovals(): UseQueryResult<DocumentDto[]> {
  const tenant = useSession((s) => s.tenant);
  return useQuery({ queryKey: ["approvals", tenant], queryFn: fetchPendingDocuments, enabled: tenant !== null, staleTime: 15_000 });
}

export function useDocument(id: string): UseQueryResult<DocumentDto> {
  const tenant = useSession((s) => s.tenant);
  return useQuery({ queryKey: ["document", tenant, id], queryFn: () => fetchDocument(id), enabled: tenant !== null && id !== "" });
}

export function useMembers(): UseQueryResult<MemberDto[]> {
  const tenant = useSession((s) => s.tenant);
  return useQuery({ queryKey: ["members", tenant], queryFn: fetchMembers, enabled: tenant !== null, staleTime: 60_000 });
}

export function useAuditLog(): UseQueryResult<AuditLogEntryDto[]> {
  const tenant = useSession((s) => s.tenant);
  return useQuery({ queryKey: ["audit-log", tenant], queryFn: fetchAuditLog, enabled: tenant !== null, staleTime: 30_000 });
}
