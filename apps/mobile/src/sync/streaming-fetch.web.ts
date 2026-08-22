import type { StreamingFetch, StreamingResponse } from "./realtime-parse.js";

/**
 * Web streaming fetch (Phase R3). The browser `fetch` streams response bodies
 * natively and can set the bearer + tenant headers (the API's dev CORS allows
 * them), so the installed PWA / web preview stays live too — no `expo/fetch`
 * pulled into the web bundle. A `Response` structurally provides {ok,status,body}.
 */
export const streamingFetch: StreamingFetch = (url, init) =>
  globalThis.fetch(url, init) as unknown as Promise<StreamingResponse>;
