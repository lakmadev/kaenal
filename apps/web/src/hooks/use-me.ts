"use client";

import { useQuery } from "@tanstack/react-query";
import { apiQueries } from "@kaenal/api-client";
import type { MeDto } from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/**
 * The current session identity + capabilities (`GET /v1/me`). This is the source
 * of truth for permission-gated UI (04 §6.6): the shell and every action consult
 * it, so a control that would 403 is never rendered.
 */
export function useMe() {
  return useQuery(apiQueries.me(getApiClient()));
}

/** Capability check with a `*` super-wildcard, matching the server's model. */
export function hasCapability(me: MeDto | undefined, capability: string): boolean {
  if (me === undefined) return false;
  return me.capabilities.includes("*") || me.capabilities.includes(capability);
}

/**
 * Reactive capability gate for action controls (RBAC): `useCan("ncr:create")`.
 * Reads the session identity and returns whether the current role holds the
 * capability, so a control that would 403 is never rendered (04 §6.6). The
 * server re-checks the same capability — this is UX, not the security boundary.
 * Returns false while `/me` is still loading (fail-closed).
 */
export function useCan(capability: string): boolean {
  const { data: me } = useMe();
  return hasCapability(me, capability);
}
