/**
 * Knowledge graph explorer — layout geometry (Sprint 03 G1 AC5).
 *
 * The API returns raw `{nodes, edges}` only ("clustering/layout is a client
 * concern", P20) — but the layout math itself is written once here, pure and
 * unit-tested, so it isn't duplicated if mobile or a report ever needs the
 * same geometry the web canvas renders.
 *
 * The algorithm: the seed/center node sits at the origin; its neighbours are
 * grouped into columns by entity kind (one column per type, ordered
 * alphabetically for a stable layout across renders) and, within a column,
 * ordered by degree (most-connected first) so hub nodes settle near the
 * center row — a simple, deterministic stand-in for barycenter ordering that
 * needs no iterative relaxation to stay pure and fast.
 */

export interface LayoutNode {
  readonly id: string;
  readonly kind: string;
}

export interface LayoutEdge {
  readonly from: string;
  readonly to: string;
}

export interface NodePosition {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

const LAYER_SPACING_X = 220;
const NODE_SPACING_Y = 80;

/** Number of edges (either direction) touching a node — used for ordering within a column. */
function degreeOf(id: string, edges: readonly LayoutEdge[]): number {
  let n = 0;
  for (const e of edges) {
    if (e.from === id || e.to === id) n++;
  }
  return n;
}

/**
 * Places `centerId` at the origin and arranges every other node into columns
 * by kind, ordered by degree then id for a stable, deterministic layout.
 * Nodes not reachable from `centerId` and not the center itself are simply
 * additional columns — this function trusts the caller to have already
 * bounded the node set (the service applies the caps, not this function).
 */
export function layoutNodes(
  centerId: string,
  nodes: readonly LayoutNode[],
  edges: readonly LayoutEdge[],
): NodePosition[] {
  const others = nodes.filter((n) => n.id !== centerId);
  const kinds = [...new Set(others.map((n) => n.kind))].sort();

  const positions: NodePosition[] = [];
  if (nodes.some((n) => n.id === centerId)) {
    positions.push({ id: centerId, x: 0, y: 0 });
  }

  kinds.forEach((kind, columnIndex) => {
    const group = others
      .filter((n) => n.kind === kind)
      .sort((a, b) => degreeOf(b.id, edges) - degreeOf(a.id, edges) || a.id.localeCompare(b.id));
    const n = group.length;
    group.forEach((node, i) => {
      const y = (i - (n - 1) / 2) * NODE_SPACING_Y;
      positions.push({ id: node.id, x: (columnIndex + 1) * LAYER_SPACING_X, y });
    });
  });

  return positions;
}

export interface EdgeGeometry {
  readonly from: string;
  readonly to: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  /** 0 for a straight line; a growing +/- offset for parallel edges sharing the same two columns. */
  readonly curve: number;
}

/**
 * Resolves each edge's endpoints to real coordinates from `layoutNodes`'s
 * output, and gives parallel edges between the same pair of columns a growing
 * alternating curve offset so they don't render as one indistinguishable
 * line. Edges referencing a node with no position (outside the bounded result
 * set) are dropped rather than drawn to (0,0).
 */
export function edgeGeometry(
  positions: readonly NodePosition[],
  edges: readonly LayoutEdge[],
): EdgeGeometry[] {
  const byId = new Map(positions.map((p) => [p.id, p] as const));
  const parallelCount = new Map<string, number>();
  const result: EdgeGeometry[] = [];

  for (const e of edges) {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (a === undefined || b === undefined) continue;

    const key = [a.x, b.x].sort((p, q) => p - q).join(":");
    const seen = parallelCount.get(key) ?? 0;
    parallelCount.set(key, seen + 1);
    const curve = seen === 0 ? 0 : seen % 2 === 1 ? Math.ceil(seen / 2) * 12 : -Math.ceil(seen / 2) * 12;

    result.push({ from: e.from, to: e.to, x1: a.x, y1: a.y, x2: b.x, y2: b.y, curve });
  }

  return result;
}
