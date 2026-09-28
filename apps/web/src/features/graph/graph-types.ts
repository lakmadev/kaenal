import type { EntityKind, NodeDto } from "@kaenal/types";

/** A visible edge on the canvas — `relation` is `""` for query-sourced edges (see graph-explorer.tsx). */
export interface VisEdge {
  readonly fromKey: string;
  readonly toKey: string;
  readonly relation: string;
}

/** A "+N more" cluster node (jsx `clusters` state) — one per (source node, neighbour kind) with more than NEIGHBOR_CAP items. */
export interface ClusterState {
  readonly key: string;
  readonly srcKey: string;
  readonly type: EntityKind;
  readonly total: number;
  readonly remaining: number;
  readonly nextCursor: string | null;
}

/** The selected node's neighbour-group totals (from its own expand response) — powers the detail drawer's "Connections" list. */
export type NeighborTotals = Partial<Record<EntityKind, { total: number; onCanvas: number }>>;

export interface WhyResult {
  readonly summary: string;
  readonly truncated: boolean;
  readonly steps: readonly string[];
  readonly interpreted: readonly string[];
}

export function parseKey(key: string): { kind: EntityKind; id: string } {
  const sep = key.indexOf(":");
  return { kind: key.slice(0, sep) as EntityKind, id: key.slice(sep + 1) };
}

export type NodeMap = ReadonlyMap<string, NodeDto>;
