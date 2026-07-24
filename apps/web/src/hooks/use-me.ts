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
