/**
 * Knowledge graph explorer — the 4 fixed named analytical queries (Sprint 03
 * G1 AC2; `graph-explorer.jsx` `qSupplierD8`/`qBlocking`/`qDocsImpacted`/
 * `qOpenCapas`). Each is a specific, hard-coded bounded traversal over
 * `entity_links` edges, not a generic parameterized query — the service fetches
 * the candidate rows (already tenant/plant-scoped) and calls these pure
 * functions with them. `steps` is plain string interpolation over the query's
 * own intermediate result — computed data, never an LLM call.
 */

/** Cap on total nodes any one named query returns (jsx `QUERY_CAP`). */
export const QUERY_CAP = 60;

export interface QueryNode {
  readonly kind: string;
  readonly id: string;
  readonly title: string;
  readonly status: string | null;
}

export interface QueryEdge {
  readonly fromKind: string;
  readonly fromId: string;
  readonly toKind: string;
  readonly toId: string;
}

export interface GraphQueryOutput {
  /** `kind:id` keys, in discovery order — the service maps these back to full NodeDtos. */
  readonly nodeKeys: string[];
  /** `kind:id-kind:id` pairs, matching an input edge exactly (order-preserving). */
  readonly edgeKeys: string[];
  readonly truncated: boolean;
  readonly summary: string;
  readonly steps: string[];
}

export function nodeKey(kind: string, id: string): string {
  return `${kind}:${id}`;
}

function edgeKey(e: QueryEdge): string {
  return `${nodeKey(e.fromKind, e.fromId)}-${nodeKey(e.toKind, e.toId)}`;
}

/** Statuses that count as "closed" across the modules this graph touches — used to find open/blocking items. */
const CLOSED_STATUSES = new Set([
  "closed",
  "cancelled",
  "rejected",
  "completed",
  "verified",
  "approved",
  "archived",
]);

function isOpenStatus(status: string | null): boolean {
  return status !== null && !CLOSED_STATUSES.has(status);
}

/** Every edge touching `node`, paired with the node at its OTHER end (undirected for traversal purposes). */
function neighborsOf(
  node: QueryNode,
  edges: readonly QueryEdge[],
  byKey: ReadonlyMap<string, QueryNode>,
): { edge: QueryEdge; other: QueryNode }[] {
  const out: { edge: QueryEdge; other: QueryNode }[] = [];
  for (const edge of edges) {
    let otherKey: string | null = null;
    if (edge.fromKind === node.kind && edge.fromId === node.id) {
      otherKey = nodeKey(edge.toKind, edge.toId);
    } else if (edge.toKind === node.kind && edge.toId === node.id) {
      otherKey = nodeKey(edge.fromKind, edge.fromId);
    }
    if (otherKey === null) continue;
    const other = byKey.get(otherKey);
    if (other !== undefined) out.push({ edge, other });
  }
  return out;
}

function index(nodes: readonly QueryNode[]): Map<string, QueryNode> {
  return new Map(nodes.map((n) => [nodeKey(n.kind, n.id), n] as const));
}

/** Adds a node/edge to the accumulator, respecting QUERY_CAP; returns whether the cap was just hit. */
class Accumulator {
  readonly nodeKeys = new Set<string>();
  readonly edgeKeys = new Set<string>();
  full = false;

  addNode(n: QueryNode): boolean {
    if (this.nodeKeys.has(nodeKey(n.kind, n.id))) return true;
    if (this.nodeKeys.size >= QUERY_CAP) {
      this.full = true;
      return false;
    }
    this.nodeKeys.add(nodeKey(n.kind, n.id));
    return true;
  }

  addEdge(e: QueryEdge): void {
    this.edgeKeys.add(edgeKey(e));
  }
}

function focusNode(nodes: readonly QueryNode[], focus: string | undefined): QueryNode | null {
  if (focus === undefined) return null;
  return nodes.find((n) => nodeKey(n.kind, n.id) === focus) ?? null;
}

/**
 * "Supplier → NC → 8D escalation path" — starting at a supplier (the `focus`,
 * or every supplier in scope when none given), follow its linked NCRs and each
 * of those NCRs' linked 8D cases.
 */
export function querySupplierNc8d(
  nodes: readonly QueryNode[],
  edges: readonly QueryEdge[],
  focus?: string,
): GraphQueryOutput {
  const byKey = index(nodes);
  const start = focus !== undefined ? focusNode(nodes, focus) : null;
  const suppliers = start !== null ? [start] : nodes.filter((n) => n.kind === "supplier");

  const acc = new Accumulator();
  let ncrCount = 0;
  let eightDCount = 0;

  for (const supplier of suppliers) {
    if (!acc.addNode(supplier)) break;
    for (const { edge, other: ncr } of neighborsOf(supplier, edges, byKey)) {
      if (ncr.kind !== "ncr") continue;
      if (!acc.addNode(ncr)) break;
      acc.addEdge(edge);
      ncrCount++;
      for (const { edge: e2, other: eightD } of neighborsOf(ncr, edges, byKey)) {
        if (eightD.kind !== "eight_d") continue;
        if (!acc.addNode(eightD)) break;
        acc.addEdge(e2);
        eightDCount++;
      }
    }
  }

  const steps = [
    `Started from ${suppliers.length} supplier${suppliers.length === 1 ? "" : "s"}.`,
    `Found ${ncrCount} linked NC${ncrCount === 1 ? "" : "s"}.`,
    `${eightDCount} of those escalated to an 8D.`,
  ];

  return {
    nodeKeys: [...acc.nodeKeys],
    edgeKeys: [...acc.edgeKeys],
    truncated: acc.full,
    summary: `Supplier → NC → 8D escalation path (${acc.nodeKeys.size} node${acc.nodeKeys.size === 1 ? "" : "s"})`,
    steps,
  };
}

/**
 * "What's blocking a case from closing" — the `focus` record's directly
 * linked items that are still OPEN (not one of the closed-ish statuses).
 */
export function queryBlocking(
  nodes: readonly QueryNode[],
  edges: readonly QueryEdge[],
  focus?: string,
): GraphQueryOutput {
  const byKey = index(nodes);
  const start = focusNode(nodes, focus);
  const acc = new Accumulator();
  const blockers: QueryNode[] = [];

  if (start !== null) {
    acc.addNode(start);
    for (const { edge, other } of neighborsOf(start, edges, byKey)) {
      if (!isOpenStatus(other.status)) continue;
      if (!acc.addNode(other)) break;
      acc.addEdge(edge);
      blockers.push(other);
    }
  }

  const steps =
    start === null
      ? ["No focus record given — nothing to check for blockers."]
      : [
          `Checked every record linked to ${start.title}.`,
          `${blockers.length} of them ${blockers.length === 1 ? "is" : "are"} still open: ` +
            (blockers.length > 0 ? blockers.map((b) => b.title).join(", ") : "none"),
        ];

  return {
    nodeKeys: [...acc.nodeKeys],
    edgeKeys: [...acc.edgeKeys],
    truncated: acc.full,
    summary:
      start === null
        ? "No focus record given"
        : `${blockers.length} open item${blockers.length === 1 ? "" : "s"} blocking ${start.title}`,
    steps,
  };
}

/**
 * "Documents impacted downstream of an anchor" — every `document` node
 * reachable from `focus` within a bounded breadth-first search (so a document
 * two or three hops away, e.g. via an NCR's linked CAPA, still surfaces).
 */
const DOCS_IMPACTED_MAX_DEPTH = 3;

export function queryDocsImpacted(
  nodes: readonly QueryNode[],
  edges: readonly QueryEdge[],
  focus?: string,
): GraphQueryOutput {
  const byKey = index(nodes);
  const start = focusNode(nodes, focus);
  const acc = new Accumulator();
  const documents: QueryNode[] = [];

  if (start !== null) {
    acc.addNode(start);
    const visited = new Set<string>([nodeKey(start.kind, start.id)]);
    let frontier = [start];
    for (let depth = 0; depth < DOCS_IMPACTED_MAX_DEPTH && frontier.length > 0 && !acc.full; depth++) {
      const next: QueryNode[] = [];
      for (const node of frontier) {
        for (const { edge, other } of neighborsOf(node, edges, byKey)) {
          const k = nodeKey(other.kind, other.id);
          if (visited.has(k)) continue;
          visited.add(k);
          if (!acc.addNode(other)) break;
          acc.addEdge(edge);
          next.push(other);
          if (other.kind === "document") documents.push(other);
        }
      }
      frontier = next;
    }
  }

  const steps =
    start === null
      ? ["No focus record given — nothing to trace downstream."]
      : [
          `Traced up to ${DOCS_IMPACTED_MAX_DEPTH} hops downstream of ${start.title}.`,
          `${documents.length} document${documents.length === 1 ? "" : "s"} impacted.`,
        ];

  return {
    nodeKeys: [...acc.nodeKeys],
    edgeKeys: [...acc.edgeKeys],
    truncated: acc.full,
    summary:
      start === null
        ? "No focus record given"
        : `${documents.length} document${documents.length === 1 ? "" : "s"} impacted downstream of ${start.title}`,
    steps,
  };
}

/**
 * "Open CAPAs + their triggers" — every CAPA node not in a closed-ish status,
 * plus each one's directly linked trigger (the NCR/audit finding that raised
 * it), scope-wide (no focus needed).
 */
export function queryOpenCapas(
  nodes: readonly QueryNode[],
  edges: readonly QueryEdge[],
  _focus?: string,
): GraphQueryOutput {
  const byKey = index(nodes);
  const acc = new Accumulator();
  const openCapas = nodes.filter((n) => n.kind === "capa" && isOpenStatus(n.status));
  let triggerCount = 0;

  for (const capa of openCapas) {
    if (!acc.addNode(capa)) break;
    for (const { edge, other } of neighborsOf(capa, edges, byKey)) {
      if (other.kind !== "ncr" && other.kind !== "audit") continue;
      if (!acc.addNode(other)) break;
      acc.addEdge(edge);
      triggerCount++;
    }
  }

  const steps = [
    `${openCapas.length} CAPA${openCapas.length === 1 ? "" : "s"} currently open.`,
    `${triggerCount} linked trigger${triggerCount === 1 ? "" : "s"} (NCR/audit finding) found.`,
  ];

  return {
    nodeKeys: [...acc.nodeKeys],
    edgeKeys: [...acc.edgeKeys],
    truncated: acc.full,
    summary: `${openCapas.length} open CAPA${openCapas.length === 1 ? "" : "s"} and their triggers`,
    steps,
  };
}
