/**
 * The active workspace (tenant) slug. Locally there is no `bosch.kaenal.app`
 * subdomain to resolve the tenant from, so the browser sends it as the
 * `X-Tenant-Id` header (the client wiring in `api.ts`, 01 §3.3) on every request.
 *
 * It is kept in a readable (non-httpOnly) cookie, NOT localStorage, so it is
 * sent on document requests too and a server component can read it if needed.
 * It is not a credential — the httpOnly session cookie is — so a readable cookie
 * is the right store. The workspace switcher and sign-in write it.
 */
const TENANT_COOKIE = "kaenal_tenant";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function getActiveTenant(): string | undefined {
  if (typeof document === "undefined") return undefined;
  for (const part of document.cookie.split(";")) {
    const [k, ...rest] = part.split("=");
    if (k?.trim() === TENANT_COOKIE) {
      const value = decodeURIComponent(rest.join("=").trim());
      return value === "" ? undefined : value;
    }
  }
  return undefined;
}

export function setActiveTenant(slug: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${TENANT_COOKIE}=${encodeURIComponent(slug)}; path=/; max-age=${ONE_YEAR}; SameSite=Lax`;
}

export function clearActiveTenant(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${TENANT_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
