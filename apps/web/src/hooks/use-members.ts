"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiQueries } from "@kaenal/api-client";
import type { MemberDto } from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/**
 * The tenant's people directory. Every module that shows an owner / lead /
 * author / assignee holds a `user_id` (the composite member FK) and needs a
 * name + avatar for it — this is the single fetch that resolves them. One page
 * at the max limit covers a normal tenant; the shape is a map for O(1) lookup.
 */
export function useMembers() {
  return useQuery(apiQueries.members.list(getApiClient(), { query: { limit: 100 } }));
}

export interface MemberLookup {
  readonly byId: ReadonlyMap<string, MemberDto>;
  /** Display name for a user id, or a short fallback if not in the directory. */
  nameOf: (userId: string | null | undefined) => string;
  memberOf: (userId: string | null | undefined) => MemberDto | undefined;
  isLoading: boolean;
}

export function useMemberLookup(): MemberLookup {
  const { data, isLoading } = useMembers();
  return useMemo(() => {
    const byId = new Map<string, MemberDto>((data?.items ?? []).map((m) => [m.userId, m]));
    return {
      byId,
      isLoading,
      memberOf: (userId) => (userId != null ? byId.get(userId) : undefined),
      nameOf: (userId) => {
        if (userId == null) return "Unassigned";
        return byId.get(userId)?.name ?? `${userId.slice(0, 8)}…`;
      },
    };
  }, [data, isLoading]);
}
