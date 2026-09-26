import type { QueryClient } from "@tanstack/react-query";
import { ApiRequestError } from "@kaenal/api-client";
import { parseStaleWrite, valuesEqual, versionKeyOf, type Reapplied } from "@kaenal/core";
import { useStaleWriteStore, type FreshState } from "@/lib/stores/stale-write";

/**
 * Web glue for the 409 reconcile flow (S1-5). The decisions (what merges, what
 * conflicts) live in `@kaenal/core`; this file only finds the affected cached
 * record, reloads it and re-sends the mutation.
 */

type Row = Record<string, unknown>;

function isRow(v: unknown): v is Row {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Cached queries whose data is the single record with this id. */
function entityQueries(qc: QueryClient, id: string) {
  return qc.getQueryCache().findAll({
    predicate: (q) => isRow(q.state.data) && q.state.data["id"] === id && versionKeyOf(q.state.data) !== null,
  });
}

/** Called from the MutationCache on every failed mutation; opens the dialog for a 409. */
export function handleMutationError(
  qc: QueryClient,
  error: unknown,
  variables: unknown,
  run: ((v: Row) => Promise<unknown>) | undefined,
): void {
  if (!(error instanceof ApiRequestError) || run === undefined || !isRow(variables)) return;
  const info = parseStaleWrite(error.status, error.body);
  if (info === null) return;
  const entityId = typeof variables["id"] === "string" ? variables["id"] : null;
  const snapshot = entityId === null ? undefined : entityQueries(qc, entityId)[0]?.state.data;
  useStaleWriteStore.getState().open({
    info,
    variables,
    run,
    entityId,
    original: isRow(snapshot) ? snapshot : null,
    fresh: { kind: "loading" },
  });
  void reloadFresh(qc);
}

/** Refetch the affected record and publish the outcome to the store. */
export async function reloadFresh(qc: QueryClient): Promise<void> {
  const c = useStaleWriteStore.getState().current;
  if (c === null) return;
  useStaleWriteStore.getState().setFresh({ kind: "loading" });
  useStaleWriteStore.getState().setFresh(await fetchFresh(qc, c.entityId));
}

async function fetchFresh(qc: QueryClient, entityId: string | null): Promise<FreshState> {
  if (entityId === null) return { kind: "none" };
  const queries = entityQueries(qc, entityId);
  const errored = qc.getQueryCache().findAll({ predicate: (q) => q.state.status === "error" && q.queryKey.includes(entityId) });
  const targets = [...queries, ...errored];
  if (targets.length === 0) return { kind: "none" };
  await Promise.all(targets.map((q) => q.fetch().catch(() => undefined)));
  let failed = false;
  for (const q of targets) {
    if (q.state.status === "error") {
      if (q.state.error instanceof ApiRequestError && q.state.error.status === 404) return { kind: "deleted" };
      failed = true;
    } else if (isRow(q.state.data) && versionKeyOf(q.state.data) !== null) {
      // Everything else on screen catches up in the background.
      void qc.invalidateQueries({ refetchType: "active" });
      return { kind: "ok", row: q.state.data };
    }
  }
  return failed ? { kind: "failed" } : { kind: "none" };
}

/**
 * The body to re-send: edited fields per the user's choices, every other field
 * taken from the fresh row (so a full-form PATCH can't clobber someone else's
 * edit), and the fresh version.
 */
export function buildResendVariables(
  variables: Row,
  original: Row,
  fresh: Row,
  reapplied: Reapplied,
  keepCurrent: ReadonlySet<string>,
): Row | null {
  const body = variables["body"];
  if (!isRow(body)) return null;
  const versionKey = versionKeyOf(body) ?? versionKeyOf(fresh);
  if (versionKey === null) return null;
  const out: Row = {};
  for (const key of Object.keys(body)) {
    if (key === "version" || key === "lockVersion") continue;
    const mineClean = reapplied.clean.find((c) => c.field === key);
    const conflict = reapplied.conflicts.find((c) => c.field === key);
    if (mineClean !== undefined) out[key] = mineClean.mine;
    else if (conflict !== undefined) out[key] = keepCurrent.has(key) ? conflict.fresh : conflict.mine;
    else if (key in fresh && valuesEqual(body[key], original[key])) out[key] = fresh[key];
    else out[key] = body[key];
  }
  const freshVersion = fresh[versionKey] ?? fresh[versionKeyOf(fresh) ?? versionKey];
  out[versionKey] = freshVersion;
  return { ...variables, body: out };
}
