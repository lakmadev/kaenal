"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  mfaActivate,
  mfaDisable,
  mfaEnroll,
  mfaRegenerateRecoveryCodes,
  mfaStatus,
  type MfaStatus,
} from "@/lib/auth";

/**
 * Personal MFA state (`/v1/auth/mfa`). These auth routes live outside the ts-rest
 * contract, so the hook wraps the typed `lib/auth` fetch helpers directly rather
 * than the generated client. Enrolment, activation, disable, and recovery-code
 * regeneration all invalidate the status so the Settings panel reflects the new
 * state immediately.
 */
const MFA_STATUS_KEY = ["mfa", "status"] as const;

export function useMfaStatus() {
  return useQuery<MfaStatus>({
    queryKey: MFA_STATUS_KEY,
    queryFn: () => mfaStatus(),
    staleTime: 30_000,
  });
}

/** Begin enrolment (mint a pending secret + QR). Not cached — each call starts fresh. */
export function useMfaEnroll() {
  return useMutation({ mutationFn: () => mfaEnroll() });
}

export function useMfaActivate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => mfaActivate(code),
    onSuccess: () => void qc.invalidateQueries({ queryKey: MFA_STATUS_KEY }),
  });
}

export function useMfaDisable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => mfaDisable(code),
    onSuccess: () => void qc.invalidateQueries({ queryKey: MFA_STATUS_KEY }),
  });
}

export function useMfaRegenerate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => mfaRegenerateRecoveryCodes(code),
    onSuccess: () => void qc.invalidateQueries({ queryKey: MFA_STATUS_KEY }),
  });
}
