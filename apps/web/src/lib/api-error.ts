import { ApiRequestError } from "@kaenal/api-client";

/**
 * Reads the API's error envelope (03 §4: `{ error: { code, message, requestId,
 * details? } }`) off a thrown `ApiRequestError`. Every mutation surfaces failures
 * through this, so the UI handles a 409 stale-write, a 403, or a validation error
 * as data — not a crash.
 */
export interface ApiErrorInfo {
  status: number;
  code: string;
  message: string;
  requestId?: string;
  details?: Record<string, unknown>;
}

export function apiErrorInfo(err: unknown): ApiErrorInfo | null {
  if (!(err instanceof ApiRequestError)) return null;
  const body = err.body as { error?: { code?: string; message?: string; requestId?: string; details?: unknown } };
  const e = body?.error;
  return {
    status: err.status,
    code: e?.code ?? "REQUEST_FAILED",
    message: e?.message ?? "Something went wrong.",
    ...(e?.requestId !== undefined ? { requestId: e.requestId } : {}),
    ...(e?.details !== undefined && e.details !== null ? { details: e.details as Record<string, unknown> } : {}),
  };
}

/** A 409 optimistic-concurrency conflict — the row changed under the caller. */
export function isStaleWrite(err: unknown): boolean {
  const info = apiErrorInfo(err);
  return info?.status === 409 && info.code === "STALE_WRITE";
}

/** A short, human message for a mutation failure toast. */
export function errorMessage(err: unknown): string {
  const info = apiErrorInfo(err);
  if (info === null) return "Something went wrong. Please try again.";
  if (isStaleWrite(err)) return "This record changed since you loaded it — refresh and try again.";
  return info.message;
}
