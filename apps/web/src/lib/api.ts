import { initClient } from "@ts-rest/core";
import { contract } from "@kaenal/types";
import { requireSession, type Session } from "./session";

/**
 * The typed API client, built from the exact same ts-rest contract the server
 * validates against — so a field the API renames breaks this file at compile
 * time, not in production. One client instance per request, carrying that
 * request's session as a bearer plus the tenant header the API resolves on.
 */

export const API_URL = process.env["API_URL"] ?? "http://localhost:3001";

export function apiFor(session: Session) {
  return initClient(contract, {
    baseUrl: API_URL,
    baseHeaders: {
      authorization: `Bearer ${session.token}`,
      "x-tenant-id": session.tenant,
    },
  });
}

/** Client for the current request's session (throws if unauthenticated). */
export function api() {
  return apiFor(requireSession());
}

/** A tiny error type the pages can render without leaking internals. */
export class ApiCallError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiCallError";
  }
}

interface ErrorEnvelope {
  error?: { message?: string; code?: string };
}

/** Narrows a ts-rest response to its 2xx body, or throws a readable error. */
export function ok<T>(res: { status: number; body: unknown }): T {
  if (res.status >= 200 && res.status < 300) return res.body as T;
  const body = res.body as ErrorEnvelope;
  throw new ApiCallError(res.status, body.error?.message ?? `Request failed (${res.status})`);
}
