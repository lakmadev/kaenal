"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { apiQueries, unwrap } from "@kaenal/api-client";
import type { EntityKind, GraphExpandResult, GraphQueryId, GraphQueryResult } from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/**
 * Knowledge graph explorer (`/v1/graph/*`, `graph:view`). Reads only — the
 * screen never mutates anything. Layout/geometry is computed client-side from
 * the raw node/edge data via `@kaenal/core`'s `layoutNodes`/`edgeGeometry`
 * (the API returns data only, per P20).
 */

/** The 4 "start from a record" seed chips (jsx `SEEDS`) — real data, omitting any kind with none. */
export function useGraphSeeds() {
  return useQuery(apiQueries.graph.seeds(getApiClient()));
}

/**
 * Click-to-expand neighbour reveal. `seed` is `<kind>:<id>`. No `type`: every
 * neighbour type capped at 6. With `type` (+ optional `after` cursor): that
 * one type's next 12-item batch (cluster reveal).
 */
export function useGraphExpand(seed: string | null, type?: string, after?: string) {
  const client = getApiClient();
  return useQuery({
    ...apiQueries.graph.expand(client, seed ?? "", type, after),
    enabled: seed !== null,
  });
}

/** One of the 4 fixed named analytical queries, capped at 60 nodes. */
export function useGraphQuery(queryId: GraphQueryId | null, focus?: string) {
  const client = getApiClient();
  return useQuery({
    ...apiQueries.graph.query(client, queryId ?? "blocking", focus),
    enabled: queryId !== null,
  });
}

/**
 * Click-to-expand / cluster-reveal as an imperative action (node click, "+N
 * more" click, drawer "reveal on graph" row) rather than a render-time read —
 * `useMutation` is the correct TanStack primitive for that, same as any other
 * click-triggered call composed with `unwrap` (rules.md #3).
 */
export function useExpandGraphAction() {
  const client = getApiClient();
  return useMutation({
    mutationFn: (vars: { seed: string; type?: EntityKind; after?: string }) =>
      client
        .expandGraph({
          query: {
            seed: vars.seed,
            ...(vars.type !== undefined ? { type: vars.type } : {}),
            ...(vars.after !== undefined ? { after: vars.after } : {}),
          },
        })
        .then((r) => unwrap<GraphExpandResult>(r)),
  });
}

/** Running a named query (Ask / chip click) as an imperative action. */
export function useRunGraphQueryAction() {
  const client = getApiClient();
  return useMutation({
    mutationFn: (vars: { queryId: GraphQueryId; focus?: string }) =>
      client
        .runGraphQuery({ params: { queryId: vars.queryId }, query: vars.focus !== undefined ? { focus: vars.focus } : {} })
        .then((r) => unwrap<GraphQueryResult>(r)),
  });
}
