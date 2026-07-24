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

export function signIn(input: { tenant: string; email: string; password: string }): Promise<SignInResult> {
  return authPost<SignInResult>(
    "/v1/auth/sign-in",
    { email: input.email, password: input.password },
    { tenant: input.tenant },
  );
}

export function signOut(): Promise<{ ok: true }> {
  return authPost<{ ok: true }>("/v1/auth/sign-out", {}, { tenant: getActiveTenant() });
}

export function forgotPassword(email: string): Promise<{ ok: true; token?: string }> {
  return authPost<{ ok: true; token?: string }>("/v1/auth/forgot-password", { email });
}
