import { z } from "zod";
import { EntityKind } from "./enums.js";

/**
 * Knowledge graph explorer (Sprint 03 G1-G4; `graph-explorer.jsx`). The
 * explorer has exactly two bounded query primitives over `entity_links` — a
 * click-to-expand neighbour reveal, and 4 fixed named analytical queries — not
 * one generic parameterized traversal (see the sprint doc's G1 nuance). These
 * are the wire shapes for both.
 */

/** The card shape every node in the graph renders as (jsx's `ens*` builders). */
export const NodeDto = z.object({
  kind: EntityKind,
  id: z.string().uuid(),
  title: z.string(),
  status: z.string().nullable(),
  summary: z.string().nullable(),
  /** 2-4 key fields, e.g. [{label:"Plant", value:"P-2"}] — sourced from a real row read. */
  fields: z.array(z.object({ label: z.string(), value: z.string() })).max(4),
});
export type NodeDto = z.infer<typeof NodeDto>;

/** One neighbour type's bounded batch: capped items + the exact remaining count. */
export const NeighborGroupDto = z.object({
  items: z.array(NodeDto),
  total: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  /** Present when more of THIS type remain — pass back as `after` to reveal the next CLUSTER_REVEAL batch. */
  nextCursor: z.string().nullable(),
});
export type NeighborGroupDto = z.infer<typeof NeighborGroupDto>;

/**
 * `GET /v1/graph/expand?seed=<kind>:<id>` (no `type`) returns every neighbour
 * type capped at NEIGHBOR_CAP=6 each. `GET
 * /v1/graph/expand?seed=&type=<kind>&after=<cursor>` (architecture review
 * correction #2 — a per-(seed,type) cursor) returns just that one type's next
 * CLUSTER_REVEAL=12 batch. `center` is null when the seed does not resolve in
 * the caller's tenant/plant scope (rule 8 — never a leak, just empty).
 */
export const GraphExpandResult = z.object({
  center: NodeDto.nullable(),
  neighbors: z.record(EntityKind, NeighborGroupDto),
});
export type GraphExpandResult = z.infer<typeof GraphExpandResult>;

/** The 4 fixed named analytical queries (G1) — a closed enum, never a free string. */
export const GraphQueryId = z.enum(["supplier-nc-8d", "blocking", "docs-impacted", "open-capas"]);
export type GraphQueryId = z.infer<typeof GraphQueryId>;

/** `focus` anchors a query at one record (`<kind>:<id>`); omitted = query-wide default. */
export const GraphQueryQuery = z.object({
  focus: z.string().optional(),
});
export type GraphQueryQuery = z.infer<typeof GraphQueryQuery>;

/**
 * A named query's bounded result, capped at QUERY_CAP=60 nodes total. `steps`
 * is the "Why these results" narrative — plain string interpolation over the
 * query's own intermediate result (computed data, never an LLM call).
 */
export const GraphQueryResult = z.object({
  nodes: z.array(NodeDto),
  /** `"<kind>:<id>-<kind>:<id>"` pairs — which edges to highlight. */
  edgeKeys: z.array(z.string()),
  truncated: z.boolean(),
  summary: z.string(),
  steps: z.array(z.string()),
});
export type GraphQueryResult = z.infer<typeof GraphQueryResult>;
