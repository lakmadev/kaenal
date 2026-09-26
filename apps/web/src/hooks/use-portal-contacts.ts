"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invitePortalContact, listPortalContacts, resendPortalContact, revokePortalContact } from "@/lib/auth";

/**
 * Supplier-portal contacts (P11). These routes are plain REST outside the ts-rest
 * contract (like the other auth-adjacent calls), so the hooks wrap the typed
 * `lib/auth` fetchers. Every mutation invalidates the contact list.
 */
const key = (supplierId: string) => ["portal-contacts", supplierId] as const;

/** Cursor-paged contact list; `enabled` lets the caller skip it without `supplier:manage`. */
export function usePortalContacts(supplierId: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: key(supplierId),
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listPortalContacts(supplierId, pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useInvitePortalContact(supplierId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => invitePortalContact(supplierId, email),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key(supplierId) }),
  });
}

export function useResendPortalContact(supplierId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) => resendPortalContact(supplierId, contactId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key(supplierId) }),
  });
}

export function useRevokePortalContact(supplierId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) => revokePortalContact(supplierId, contactId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key(supplierId) }),
  });
}
