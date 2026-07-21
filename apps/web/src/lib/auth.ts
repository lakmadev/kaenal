import { API_URL, ApiCallError } from "./api";

/**
 * Sign-in is not part of the resource contract (it precedes having a session),
 * so this calls the auth route directly. The API replies by setting an httpOnly
 * `kaenal_session` cookie on ITS domain; the BFF reads that token out of the
 * Set-Cookie header and re-homes it as its own httpOnly cookie on the web
 * domain (see session.ts). The raw token is used server-side only, as a bearer.
 */
export async function signInToApi(
  tenant: string,
  email: string,
  password: string,
): Promise<string> {
  const res = await fetch(`${API_URL}/v1/auth/sign-in`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-tenant-id": tenant },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new ApiCallError(res.status, body.error?.message ?? "Email or password is incorrect");
  }

  const setCookies = (res.headers as unknown as { getSetCookie(): string[] }).getSetCookie();
  const raw = setCookies.map((c) => /kaenal_session=([^;]+)/.exec(c)?.[1]).find((v) => v !== undefined);
  if (raw === undefined) throw new ApiCallError(500, "The API did not return a session");
  return decodeURIComponent(raw);
}

export async function signOutFromApi(tenant: string, token: string): Promise<void> {
  // Best-effort server-side revocation; the web cookie is cleared regardless.
  await fetch(`${API_URL}/v1/auth/sign-out`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenant },
    cache: "no-store",
  }).catch(() => undefined);
}
