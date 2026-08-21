import { fetch as expoFetch } from "expo/fetch";
import type { StreamingFetch } from "./realtime-parse.js";

/**
 * Native streaming fetch (Phase R3). The stock React Native `fetch` cannot stream
 * a response body; `expo/fetch` can, and — unlike an `EventSource` — lets us set
 * the `Authorization` / `X-Tenant-Id` headers the bearer-authed mobile API needs.
 * Metro swaps this for `streaming-fetch.web.ts` in the web build.
 */
export const streamingFetch = expoFetch as unknown as StreamingFetch;
