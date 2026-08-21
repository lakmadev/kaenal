import { RealtimeEvent } from "@kaenal/types";
import { API_BASE_URL } from "../lib/api.js";
import { useSession } from "../stores/session.js";
import { splitFrames, frameToData } from "./realtime-parse.js";
import { streamingFetch } from "./streaming-fetch.js";

/**
 * The mobile realtime connection (Phase R3).
 *
 * Holds a single reconnecting SSE stream to `GET /v1/events`, authenticated with
 * the same bearer + tenant headers the rest of the mobile API uses (a plain
 * `EventSource` can't set those, which is why this rides a streaming `fetch`).
 * Each parsed signal is handed to the caller, which turns it into a delta-pull.
 * The stream carries only pointer events — the device still pulls authoritative
 * data through its normal RLS-scoped sync endpoints.
 */

const MIN_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

let stopped = true;
let controller: AbortController | null = null;

/** Open the stream and keep it open (reconnecting with backoff), invoking
 *  `onEvent` for each signal. Idempotent — a second start while running is a
 *  no-op. */
export function startRealtime(onEvent: (event: RealtimeEvent) => void): void {
  if (!stopped) return;
  stopped = false;
  void runLoop(onEvent);
}

/** Close the stream and stop reconnecting. */
export function stopRealtime(): void {
  stopped = true;
  controller?.abort();
  controller = null;
}

async function runLoop(onEvent: (event: RealtimeEvent) => void): Promise<void> {
  let backoff = MIN_BACKOFF_MS;
  while (!stopped) {
    const { token, tenant } = useSession.getState();
    if (token === null || tenant === null) {
      await delay(MIN_BACKOFF_MS);
      continue;
    }
    controller = new AbortController();
    try {
      const res = await streamingFetch(`${API_BASE_URL}/v1/events`, {
        headers: {
          authorization: `Bearer ${token}`,
          "x-tenant-id": tenant,
          "x-auth-mode": "bearer",
          accept: "text/event-stream",
        },
        signal: controller.signal,
      });
      if (!res.ok || res.body === null) {
        backoff = await backoffAfter(backoff);
        continue;
      }
      backoff = MIN_BACKOFF_MS; // connected — reset
      await readStream(res.body, onEvent);
    } catch {
      // network drop / abort — fall through to reconnect
    }
    if (!stopped) backoff = await backoffAfter(backoff);
  }
}

async function readStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: RealtimeEvent) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (!stopped) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { frames, rest } = splitFrames(buffer);
      buffer = rest;
      for (const frame of frames) {
        const data = frameToData(frame);
        if (data === null) continue; // heartbeat / comment
        try {
          const parsed = RealtimeEvent.safeParse(JSON.parse(data));
          if (parsed.success) onEvent(parsed.data);
        } catch {
          /* non-JSON data line — ignore */
        }
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* already closed */
    }
  }
}

async function backoffAfter(current: number): Promise<number> {
  await delay(current);
  return Math.min(current * 2, MAX_BACKOFF_MS);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
