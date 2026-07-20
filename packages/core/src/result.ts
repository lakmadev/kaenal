/**
 * Core returns results; it never throws for domain rule violations and never
 * imports an HTTP framework. The API layer maps a `Denied` onto the error
 * envelope in 03 §4 — that mapping is the only place that knows about status
 * codes, which is what keeps this package runnable in the browser, React
 * Native and Node alike.
 */

import type { ErrorCode } from "@kaenal/types";

export interface Allowed {
  readonly ok: true;
}

export interface Denied {
  readonly ok: false;
  readonly code: ErrorCode;
  readonly message: string;
  /** Goes verbatim into the `details` field of the error envelope. */
  readonly details?: Readonly<Record<string, unknown>>;
}

export type Decision = Allowed | Denied;

export const allow = (): Allowed => ({ ok: true });

export const deny = (
  code: ErrorCode,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): Denied => (details === undefined ? { ok: false, code, message } : { ok: false, code, message, details });
