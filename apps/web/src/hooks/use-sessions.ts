"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listSessions, revokeOtherSessions, revokeSession, type SessionSummary } from "@/lib/auth";

/**
 * Active sessions (`/v1/auth/sessions`). Outside the ts-rest contract like the
 * other auth routes, so this wraps the typed `lib/auth` fetch helpers. Revoking a
 * device (or all other devices) invalidates the list so the card reflects it.
 */
const SESSIONS_KEY = ["auth", "sessions"] as const;

export function useSessions() {
  return useQuery<{ sessions: SessionSummary[] }>({
    queryKey: SESSIONS_KEY,
    queryFn: () => listSessions(),
    staleTime: 15_000,
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revokeSession(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });
}

export function useRevokeOtherSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => revokeOtherSessions(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });
}
