import type { Request } from "express";

/**
 * Read one cookie value from the raw `Cookie` header.
 *
 * Deliberately not `cookie-parser`: the API needs only a handful of names
 * (session, CSRF, tenant), and parsing every cookie on every request is more
 * attack surface than value — the same reasoning the session authenticator
 * uses for its own private parser.
 */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.header("cookie");
  if (header === undefined) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const value = part.slice(eq + 1).trim();
    return value === "" ? undefined : decodeURIComponent(value);
  }
  return undefined;
}

/**
 * The readable (non-httpOnly) workspace cookie the web app writes on sign-in and
 * workspace switch (mirror of apps/web `lib/tenant.ts` `TENANT_COOKIE`). It is
 * NOT a credential — the httpOnly session cookie is — so it may be read here to
 * resolve which tenant a same-origin request means when it cannot set the
 * `X-Tenant-Id` header (notably an SSE `EventSource`, which the browser API
 * forbids from adding headers).
 */
export const TENANT_COOKIE = "kaenal_tenant";
