import { CSRF_COOKIE, CSRF_HEADER, TENANT_HEADER } from "@kaenal/api-client";
import { env } from "@/lib/env";
import { getActiveTenant } from "@/lib/tenant";

/**
 * Authentication calls (04 §4). Sign-in / accept-invite / password reset live
 * OUTSIDE the ts-rest contract — they run before a session exists, set the
 * httpOnly cookie server-side, and are tenant-resolved but not session-guarded
 * (`@AllowAnonymous`/`@Public` in the API). So they are plain typed `fetch`
 * wrappers here, not client methods, but they reuse the SAME tenant + CSRF
 * header contract as every other request.
 */

export interface SignInResult {
  userId: string;
  role: string;
  expiresAt: string;
}

/** Thrown on a non-2xx auth response, carrying the API error envelope. */
export class AuthError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  for (const part of document.cookie.split(";")) {
    const [k, ...rest] = part.split("=");
    if (k?.trim() === name) return decodeURIComponent(rest.join("=").trim());
  }
  return undefined;
}

function authHeaders(tenant?: string): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (tenant !== undefined && tenant !== "") headers[TENANT_HEADER] = tenant;
  const csrf = readCookie(CSRF_COOKIE);
  if (csrf !== undefined) headers[CSRF_HEADER] = csrf;
  return headers;
}

async function readOrThrow<T>(res: Response): Promise<T> {
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const envelope =
      typeof data === "object" && data !== null && "error" in data
        ? (data as { error?: { code?: string; message?: string } }).error
        : undefined;
    throw new AuthError(res.status, envelope?.code ?? "REQUEST_FAILED", envelope?.message ?? "Sign-in failed");
  }
  return data as T;
}

async function authPost<T>(
  path: string,
  body: Record<string, unknown>,
  opts: { tenant?: string | undefined } = {},
): Promise<T> {
  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders(opts.tenant),
    body: JSON.stringify(body),
  });
  return readOrThrow<T>(res);
}

async function authGet<T>(path: string, opts: { tenant?: string | undefined } = {}): Promise<T> {
  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    method: "GET",
    credentials: "include",
    headers: authHeaders(opts.tenant),
  });
  return readOrThrow<T>(res);
}

/** Sign-in returns a session, or asks for a second factor when MFA is active. */
export type SignInResponse = SignInResult | { mfaRequired: true };

export function isMfaRequired(res: SignInResponse): res is { mfaRequired: true } {
  return "mfaRequired" in res;
}

export function signIn(input: {
  tenant: string;
  email: string;
  password: string;
  code?: string;
}): Promise<SignInResponse> {
  return authPost<SignInResponse>(
    "/v1/auth/sign-in",
    {
      email: input.email,
      password: input.password,
      // Only sent on the second step of an MFA sign-in.
      ...(input.code !== undefined && input.code !== "" ? { code: input.code } : {}),
    },
    { tenant: input.tenant },
  );
}

export function signOut(): Promise<{ ok: true }> {
  return authPost<{ ok: true }>("/v1/auth/sign-out", {}, { tenant: getActiveTenant() });
}

export function forgotPassword(email: string): Promise<{ ok: true; token?: string }> {
  return authPost<{ ok: true; token?: string }>("/v1/auth/forgot-password", { email });
}

/** Complete a password reset (07 §2). `@Public` — no tenant needed. */
export function resetPassword(input: { token: string; password: string }): Promise<{ ok: true }> {
  return authPost<{ ok: true }>("/v1/auth/reset-password", input);
}

/**
 * Accept a tenant invitation: set the person's name + password and activate the
 * membership. Tenant-scoped (`@AllowAnonymous`) — the invite belongs to one
 * workspace, sent as `X-Tenant-Id`.
 */
export function acceptInvite(input: {
  tenant: string;
  token: string;
  name: string;
  password: string;
}): Promise<{ ok: true }> {
  return authPost<{ ok: true }>(
    "/v1/auth/accept-invite",
    { token: input.token, name: input.name, password: input.password },
    { tenant: input.tenant },
  );
}

/**
 * Self-service MFA management (07 §4). These routes are AUTHENTICATED — a session
 * already exists — but live outside ts-rest like the other auth calls, so they
 * are typed fetch wrappers here. Every user manages their own second factor
 * (including external partners, for whom it is mandatory). Sent with the active
 * tenant + CSRF header, same as every mutation.
 */
export interface MfaStatus {
  enrolled: boolean;
  pending: boolean;
  recoveryCodesRemaining: number;
  enrolledAt: string | null;
}

export function mfaStatus(): Promise<MfaStatus> {
  return authGet<MfaStatus>("/v1/auth/mfa", { tenant: getActiveTenant() });
}

/** Begin enrolment: returns the otpauth URI + a ready-to-`<img>` QR data-URI. */
export function mfaEnroll(): Promise<{ otpauthUri: string; qrDataUri: string }> {
  return authPost<{ otpauthUri: string; qrDataUri: string }>("/v1/auth/mfa/enroll", {}, { tenant: getActiveTenant() });
}

/** Activate a pending enrolment with a first code; returns the one-time recovery codes. */
export function mfaActivate(code: string): Promise<{ recoveryCodes: string[] }> {
  return authPost<{ recoveryCodes: string[] }>("/v1/auth/mfa/activate", { code }, { tenant: getActiveTenant() });
}

/** Turn MFA off — requires a current TOTP or recovery code. */
export function mfaDisable(code: string): Promise<{ ok: true }> {
  return authPost<{ ok: true }>("/v1/auth/mfa/disable", { code }, { tenant: getActiveTenant() });
}

/** Reissue recovery codes (invalidates the old set) — requires a current code. */
export function mfaRegenerateRecoveryCodes(code: string): Promise<{ recoveryCodes: string[] }> {
  return authPost<{ recoveryCodes: string[] }>(
    "/v1/auth/mfa/recovery-codes/regenerate",
    { code },
    { tenant: getActiveTenant() },
  );
}

/**
 * A partner (or any account the workspace mandates MFA for) that has no factor
 * configured is hard-stopped at sign-in with a 403 — the password already
 * verified, so this is not a credential oracle. The sign-in form shows the
 * "two-factor required" blocked screen for it.
 */
export function isMfaBlocked(error: unknown): boolean {
  return error instanceof AuthError && error.status === 403;
}

/**
 * Active-session management (07 §7). Authenticated, self-service — a user sees
 * and signs out their own devices in the current workspace. Sessions are
 * tenant-scoped, so the list reflects this workspace only; the session the
 * request comes from is flagged `current` and is never offered for sign-out.
 */
export interface SessionSummary {
  id: string;
  current: boolean;
  ip: string | null;
  userAgent: string | null;
  signedInAt: string;
  expiresAt: string;
}

export function listSessions(): Promise<{ sessions: SessionSummary[] }> {
  return authGet<{ sessions: SessionSummary[] }>("/v1/auth/sessions", { tenant: getActiveTenant() });
}

/** Sign out one other device. */
export function revokeSession(id: string): Promise<{ ok: true }> {
  return authPost<{ ok: true }>(`/v1/auth/sessions/${encodeURIComponent(id)}/revoke`, {}, { tenant: getActiveTenant() });
}

/** Sign out every other device, keeping the current one. */
export function revokeOtherSessions(): Promise<{ revoked: number }> {
  return authPost<{ revoked: number }>("/v1/auth/sessions/revoke-others", {}, { tenant: getActiveTenant() });
}
