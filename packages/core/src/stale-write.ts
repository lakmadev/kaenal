/**
 * Stale-write (409) reconcile + offline banner state — pure logic shared by web
 * and mobile (S1-5). Wire shape is the API error envelope
 * `{ error: { code: "STALE_WRITE", message, details?: { expected, actual, updatedAt?, updatedBy? } } }`;
 * `expected`/`actual` are emitted today, `updatedAt`/`updatedBy` are optional
 * additions. Mobile's pusher reads the same envelope (status + body), so
 * `parseStaleWrite(status, body)` accepts the same inputs it does.
 */

export interface StaleWriteInfo {
  message: string;
  expected?: number;
  actual?: number;
  updatedAt?: string;
  /** Last actor's user id (legacy string form or `updatedBy.id`). */
  updatedBy?: string;
  /** Last actor's display name when the API resolved it. */
  updatedByName?: string;
}

function actorOf(v: unknown): { updatedBy?: string; updatedByName?: string } {
  if (typeof v === "string") return { updatedBy: v };
  if (typeof v === "object" && v !== null && !Array.isArray(v)) {
    const r = v as Record<string, unknown>;
    if (typeof r["id"] === "string") {
      return { updatedBy: r["id"], ...(typeof r["name"] === "string" ? { updatedByName: r["name"] } : {}) };
    }
  }
  return {};
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Returns the parsed 409 STALE_WRITE info, or null when the response is anything else. */
export function parseStaleWrite(status: number, body: unknown): StaleWriteInfo | null {
  if (status !== 409 || !isRecord(body)) return null;
  const e = body["error"];
  if (!isRecord(e) || e["code"] !== "STALE_WRITE") return null;
  const d = isRecord(e["details"]) ? e["details"] : {};
  return {
    message: typeof e["message"] === "string" ? e["message"] : "This record changed since you loaded it.",
    ...(typeof d["expected"] === "number" ? { expected: d["expected"] } : {}),
    ...(typeof d["actual"] === "number" ? { actual: d["actual"] } : {}),
    ...(typeof d["updatedAt"] === "string" ? { updatedAt: d["updatedAt"] } : {}),
    ...actorOf(d["updatedBy"]),
  };
}

export function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => valuesEqual(x, b[i]));
  }
  if (isRecord(a) && isRecord(b)) {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => valuesEqual(a[k], b[k]));
  }
  return false;
}

export interface FieldConflict {
  field: string;
  original: unknown;
  mine: unknown;
  fresh: unknown;
}

export interface FieldChange {
  field: string;
  mine: unknown;
}

export interface Reapplied {
  /** Fields nobody else touched: safe to send as-is. */
  clean: FieldChange[];
  /** Fields both sides changed to different values: the user picks. */
  conflicts: FieldConflict[];
}

/**
 * Re-run the user's edited fields onto the fresh row. A field the user edited
 * (mine differs from original) is clean when the server left it alone, a
 * no-op when the server already holds the same value, and a conflict otherwise.
 */
export function reapplyChange(
  original: Record<string, unknown>,
  mine: Record<string, unknown>,
  fresh: Record<string, unknown>,
): Reapplied {
  const clean: FieldChange[] = [];
  const conflicts: FieldConflict[] = [];
  for (const field of Object.keys(mine)) {
    if (valuesEqual(mine[field], original[field])) continue; // not edited by the user
    if (valuesEqual(fresh[field], mine[field])) continue; // server already has it
    if (valuesEqual(fresh[field], original[field])) clean.push({ field, mine: mine[field] });
    else conflicts.push({ field, original: original[field], mine: mine[field], fresh: fresh[field] });
  }
  return { clean, conflicts };
}

/** Body fields to send: clean changes plus, per conflict, mine (default) or the current value. */
export function mergedFields(r: Reapplied, keepCurrent: ReadonlySet<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of r.clean) out[c.field] = c.mine;
  for (const c of r.conflicts) if (!keepCurrent.has(c.field)) out[c.field] = c.mine;
  return out;
}

/** Which key carries the optimistic-concurrency version in a request body / row. */
export function versionKeyOf(o: Record<string, unknown>): "version" | "lockVersion" | null {
  if (typeof o["lockVersion"] === "number") return "lockVersion";
  if (typeof o["version"] === "number") return "version";
  return null;
}

/** Plain-text summary for "Copy my changes" (O-5). */
export function describeChanges(fields: Record<string, unknown>): string {
  return Object.entries(fields)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join("\n");
}

// --- Offline banner state machine (W1-A..D) ---------------------------------

export type ConnectivityPhase = "online" | "offline" | "checking" | "restored";
export type ConnectivityEvent = "went-offline" | "went-online" | "retry" | "retry-failed" | "dismiss";

export function nextConnectivity(phase: ConnectivityPhase, event: ConnectivityEvent): ConnectivityPhase {
  switch (event) {
    case "went-offline":
      return phase === "checking" ? "checking" : "offline";
    case "went-online":
      return phase === "online" ? "online" : "restored";
    case "retry":
      return phase === "offline" ? "checking" : phase;
    case "retry-failed":
      return phase === "checking" ? "offline" : phase;
    case "dismiss":
      return phase === "restored" ? "online" : phase;
  }
}
