// Auth API client (03 §2). The auth routes (`/v1/auth/*`) live outside the ts-rest
// contract — they set/clear cookies and negotiate MFA — so the mobile app calls them
// with plain fetch, opting into bearer mode via `X-Auth-Mode: bearer` so the API
// returns the session token in the body (05 §3) instead of an httpOnly cookie.

import { API_BASE_URL } from "./api";

const TENANT_HEADER = "x-tenant-id";

function headers(tenant: string, token?: string): Record<string, string> {
  const h: Record<string, string> = {
    "content-type": "application/json",
    "x-auth-mode": "bearer",
    [TENANT_HEADER]: tenant,
  };
  if (token) h["authorization"] = `Bearer ${token}`;
  return h;
}

/** Normalised auth error so callers can branch without parsing HTTP everywhere. */
export interface AuthError {
  status: number;
  code: string;
  message: string;
}

async function post<T>(path: string, tenant: string, body: unknown, token?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: headers(tenant, token),
      body: JSON.stringify(body),
    });
  } catch {
    throw { status: 0, code: "NETWORK", message: "Can't reach the server. Check your connection." } as AuthError;
  }
  const text = await res.text();
  const json: unknown = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string } }).error;
    throw { status: res.status, code: err?.code ?? "ERROR", message: err?.message ?? "Something went wrong." } as AuthError;
  }
  return json as T;
}

export type SignInResponse =
  | { mfaRequired: true }
  | { userId: string; role: string; expiresAt: string; sessionToken: string };

/** Sign in. Pass `code` on the second step (TOTP or recovery code). */
export function signInRequest(
  tenant: string,
  email: string,
  password: string,
  code?: string,
): Promise<SignInResponse> {
  return post<SignInResponse>("/v1/auth/sign-in", tenant, { email, password, ...(code ? { code } : {}) });
}

/** Server-side sign-out (revokes the session). Best-effort; the client wipes regardless. */
export function signOutRequest(tenant: string, token: string): Promise<{ ok: true }> {
  return post<{ ok: true }>("/v1/auth/sign-out", tenant, {}, token);
}

/** Accept a staff invitation — sets the name + password on the pending membership. */
export function acceptInviteRequest(
  tenant: string,
  token: string,
  name: string,
  password: string,
): Promise<{ ok: true }> {
  return post<{ ok: true }>("/v1/auth/accept-invite", tenant, { token, name, password });
}

/** Request a password-reset email (always resolves ok — never an enumeration oracle). */
export function forgotPasswordRequest(tenant: string, email: string): Promise<{ ok: true }> {
  return post<{ ok: true }>("/v1/auth/forgot-password", tenant, { email });
}
