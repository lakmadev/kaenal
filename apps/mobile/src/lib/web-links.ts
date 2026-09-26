// Hand-off to the web app (manage-web screen). Pure resolution here so it is
// unit-testable; the caller does the actual open.

/** Port the local web dev server listens on (`pnpm --filter @kaenal/web dev`). */
const DEV_WEB_PORT = 3000;
const DEV_API_PORT = "3001";

/**
 * Web app origin. EXPO_PUBLIC_WEB_URL wins (staging/production). Otherwise, in dev
 * the API origin is `<host>:3001` and the web app is the same host on :3000.
 * Returns null when neither yields a usable origin — the caller must show a
 * visible message.
 */
export function resolveWebBase(explicit: string | undefined, apiBase: string): string | null {
  if (explicit && explicit.trim()) {
    try {
      const u = new URL(explicit.trim());
      return u.protocol === "http:" || u.protocol === "https:" ? u.origin : null;
    } catch {
      return null;
    }
  }
  try {
    const api = new URL(apiBase);
    if (api.port === DEV_API_PORT) {
      api.port = String(DEV_WEB_PORT);
      return api.origin;
    }
  } catch {
    return null;
  }
  return null;
}

/** Full web URL for an app path, or null when no web origin can be determined. */
export function webUrl(path: string, explicit: string | undefined, apiBase: string): string | null {
  const base = resolveWebBase(explicit, apiBase);
  return base ? `${base}${path.startsWith("/") ? path : `/${path}`}` : null;
}
