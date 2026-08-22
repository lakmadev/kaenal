import type { RealtimeEvent } from "@kaenal/types";

/**
 * Pure helpers for the mobile realtime stream (Phase R3), kept free of any native
 * (`expo/fetch`) import so they're unit-testable in plain Node. The connection
 * manager in `./realtime` uses these; the platform-split `./streaming-fetch`
 * supplies the header-capable fetch.
 */

/** A header-capable streaming fetch (bearer + tenant headers an EventSource can't
 *  set). Satisfied by `expo/fetch` on native and the browser `fetch` on web. */
export type StreamingFetch = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<StreamingResponse>;

export interface StreamingResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly body: ReadableStream<Uint8Array> | null;
}

/**
 * Split an accumulating buffer into complete SSE frames (separated by a blank
 * line), returning the leftover partial frame to carry into the next chunk.
 * Tolerates CRLF. Pure.
 */
export function splitFrames(buffer: string): { frames: string[]; rest: string } {
  const frames: string[] = [];
  let rest = buffer.replace(/\r\n/g, "\n");
  let idx = rest.indexOf("\n\n");
  while (idx !== -1) {
    frames.push(rest.slice(0, idx));
    rest = rest.slice(idx + 2);
    idx = rest.indexOf("\n\n");
  }
  return { frames, rest };
}

/**
 * The joined `data:` payload of one SSE frame, or null for a comment/heartbeat
 * (`: ping`), a `retry:` line, or a frame carrying no data. Pure.
 */
export function frameToData(frame: string): string | null {
  const parts: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("data:")) parts.push(line.slice(5).replace(/^ /, ""));
  }
  return parts.length === 0 ? null : parts.join("\n");
}

export type SignalReaction = "sync" | "notifications" | "ignore";

/** Entity topics the device mirrors in local SQLite — a signal for one warrants a
 *  delta-pull. Others aren't mirrored (or aren't shown), so they're ignored. */
const MIRRORED_TOPICS: ReadonlySet<string> = new Set<RealtimeEvent["topic"]>(["ncr", "inspection"]);

/** What a signal for `topic` should trigger on the device. Pure. */
export function reactionFor(topic: string): SignalReaction {
  if (MIRRORED_TOPICS.has(topic)) return "sync";
  if (topic === "notifications") return "notifications";
  return "ignore";
}
