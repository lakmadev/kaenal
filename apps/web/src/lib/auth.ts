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

async function authPost<T>(
  path: string,
  body: Record<string, unknown>,
  opts: { tenant?: string | undefined } = {},
): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.tenant !== undefined && opts.tenant !== "") headers[TENANT_HEADER] = opts.tenant;
  const csrf = readCookie(CSRF_COOKIE);
  if (csrf !== undefined) headers[CSRF_HEADER] = csrf;

  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(body),
  });

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
