import { cookies } from "next/headers";

/**
 * The web app is a BFF (backend-for-frontend): the browser holds only these two
 * httpOnly cookies, and the server exchanges them for a Bearer call to the API.
 * The API session token never reaches browser JavaScript, so an XSS on the web
 * app cannot read it — and because the API call is server-to-server with a
 * bearer, there is no cross-site cookie or CSRF dance to get wrong.
 */
export const SESSION_COOKIE = "kaenal_web_session";
export const TENANT_COOKIE = "kaenal_web_tenant";

export interface Session {
  readonly token: string;
  readonly tenant: string;
}

export function getSession(): Session | null {
  const jar = cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const tenant = jar.get(TENANT_COOKIE)?.value;
  return token !== undefined && tenant !== undefined ? { token, tenant } : null;
}

export function requireSession(): Session {
  const session = getSession();
  if (session === null) throw new Error("No session");
  return session;
}
