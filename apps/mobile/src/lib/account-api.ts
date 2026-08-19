// Account / security API client (07 §2, §4, §7). Like `auth-api.ts`, these routes
// (`/v1/auth/change-password`, `/v1/auth/mfa/*`, `/v1/auth/sessions`) live OUTSIDE
// the ts-rest contract, so we call them with plain fetch. Unlike sign-in they need
// an authenticated session, so we attach the bearer token + tenant from the store.
// Bearer requests skip CSRF server-side (same path the ts-rest client mutations use).

import { API_BASE_URL } from "./api";
import { useSession } from "@/stores/session";

export interface AccountApiError {
  status: number;
  code: string;
  message: string;
}

function authedHeaders(): Record<string, string> {
  const { token, tenant } = useSession.getState();
  const h: Record<string, string> = { "content-type": "application/json", "x-auth-mode": "bearer" };
  if (tenant) h["x-tenant-id"] = tenant;
  if (token) h["authorization"] = `Bearer ${token}`;
  return h;
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: authedHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw { status: 0, code: "NETWORK", message: "Can't reach the server. Check your connection." } as AccountApiError;
  }
  const text = await res.text();
  const json: unknown = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string } }).error;
    throw {
      status: res.status,
      code: err?.code ?? "ERROR",
      message: err?.message ?? "Something went wrong.",
    } as AccountApiError;
  }
  return json as T;
}

// ── Change password (07 §2) ──────────────────────────────────────────────────
export function changePassword(currentPassword: string, newPassword: string): Promise<{ ok: true }> {
  return request("POST", "/v1/auth/change-password", { currentPassword, newPassword });
}

// ── MFA / two-factor (07 §4) ─────────────────────────────────────────────────
export interface MfaStatus {
  enrolled: boolean;
  pending: boolean;
  recoveryCodesRemaining: number;
  enrolledAt: string | null;
}
export function getMfaStatus(): Promise<MfaStatus> {
  return request("GET", "/v1/auth/mfa");
}
/** Begin enrolment — returns the otpauth URI + a QR data-URI to scan. */
export function enrollMfa(): Promise<{ otpauthUri: string; qrDataUri: string }> {
  return request("POST", "/v1/auth/mfa/enroll");
}
/** Activate a pending enrolment with the first code; returns one-time recovery codes. */
export function activateMfa(code: string): Promise<{ recoveryCodes: string[] }> {
  return request("POST", "/v1/auth/mfa/activate", { code });
}
/** Disable MFA — requires a current code. */
export function disableMfa(code: string): Promise<{ ok: true }> {
  return request("POST", "/v1/auth/mfa/disable", { code });
}
/** Reissue recovery codes — requires a current code; invalidates the old set. */
export function regenerateRecoveryCodes(code: string): Promise<{ recoveryCodes: string[] }> {
  return request("POST", "/v1/auth/mfa/recovery-codes/regenerate", { code });
}

// ── Active sessions (07 §7) ──────────────────────────────────────────────────
export interface SessionSummary {
  id: string;
  current: boolean;
  ip: string | null;
  userAgent: string | null;
  signedInAt: string;
  expiresAt: string;
}
export function listSessions(): Promise<{ sessions: SessionSummary[] }> {
  return request("GET", "/v1/auth/sessions");
}
export function revokeSession(id: string): Promise<{ ok: true }> {
  return request("POST", `/v1/auth/sessions/${id}/revoke`);
}
export function revokeOtherSessions(): Promise<{ revoked: number }> {
  return request("POST", "/v1/auth/sessions/revoke-others");
}
