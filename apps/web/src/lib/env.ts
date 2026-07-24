/**
 * Client-visible configuration. Only `NEXT_PUBLIC_*` vars reach the browser, so
 * this file holds nothing secret. The API base defaults to `/api`, which the
 * Next rewrite proxy (see `next.config.mjs`) forwards to the API — keeping the
 * session cookie and CSRF token same-origin in local dev.
 */
export const env = {
  /** Base URL the typed client and auth calls target. Same-origin by default. */
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? "/api",
} as const;
