import { Injectable } from "@nestjs/common";
import type { Tx } from "@kaenal/db";
import { isPlantScoped, type Membership } from "@kaenal/core";
import {
  nodeKey,
  queryBlocking,
  queryDocsImpacted,
  queryOpenCapas,
  querySupplierNc8d,
  type QueryEdge,
  type QueryNode,
} from "@kaenal/core";
import { EntityKind, type GraphExpandResult, type GraphQueryId, type GraphQueryResult, type NeighborGroupDto, type NodeDto } from "@kaenal/types";
import { ApiError } from "../errors.js";
import { clampLimit, decodeCursor, keysetPredicate, type Cursor } from "../http/pagination.js";
import { tableFor } from "../collab/entity-ref.js";

/** Node types the graph explorer reveals per click (jsx `NEIGHBOR_CAP`). */
const NEIGHBOR_CAP = 6;
/** Nodes revealed per further "+N more" cluster click (jsx `CLUSTER_REVEAL`). */
const CLUSTER_REVEAL = 12;

/**
 * The kinds `entity_links` actually allows on either side (migration 0018 +
 * 0063) — a strict subset of `EntityKind` (no `scar`, which never got wired
 * into the linkage graph).
 */
const GRAPH_KINDS: readonly EntityKind[] = [
  "inspection",
  "ncr",
  "eight_d",
  "audit",
  "capa",
  "document",
  "supplier",
  "finding",
];

/**
 * Kinds whose visibility is bounded by the caller's plant scope, mirroring
 * `SearchService`'s per-kind plant map. `finding` has no `plant_id` column of
 * its own (architecture review correction #3) — scoped through its parent
 * inspection instead.
 */
const PLANT_SCOPED_KINDS = new Set<EntityKind>(["inspection", "ncr", "audit", "finding"]);

/** Builds the SELECT for one kind's node fields. Table names are interpolated from the closed `tableFor` map only. */
function selectSqlFor(kind: EntityKind): string {
  switch (kind) {
    case "inspection":
      return `SELECT id, code, title, status, NULL::text AS description FROM inspections`;
    case "ncr":
      return `SELECT id, code, title, status, priority AS extra1 FROM ncrs`;
    case "eight_d":
      return `SELECT id, code, title, status, current_step::text AS extra1 FROM eight_ds`;
    case "audit":
      return `SELECT id, code, title, status, type AS extra1 FROM audits`;
    case "capa":
      return `SELECT id, code, title, status, priority AS extra1 FROM capas`;
    case "document":
      return `SELECT id, code, title, status, category AS extra1 FROM documents`;
    case "supplier":
      return `SELECT id, code, name AS title, status, COALESCE(risk_tier, '—') AS extra1 FROM suppliers`;
    case "finding":
      return `SELECT f.id, f.item_ref AS code, f.item_ref AS title, f.severity AS status, f.description
                FROM findings f`;
    default:
      throw new ApiError("VALIDATION_FAILED", `'${kind}' is not a graph node kind`);
  }
}

function toNodeDto(kind: EntityKind, row: Record<string, unknown>): NodeDto {
  const id = row.id as string;
  const code = (row.code as string | undefined) ?? null;
  const title = row.title as string;
  const status = (row.status as string | null) ?? null;
  const summary = (row.description as string | null | undefined) ?? null;
  const fields: { label: string; value: string }[] = [];
  if (code !== null) fields.push({ label: "Code", value: code });
  const extra1 = row.extra1 as string | undefined;
  if (extra1 !== undefined && extra1 !== null) {
    fields.push({ label: extraLabel(kind), value: extra1 });
  }
  return { kind, id, title, status, summary, fields: fields.slice(0, 4) };
}

function extraLabel(kind: EntityKind): string {
  switch (kind) {
    case "ncr":
      return "Priority";
    case "eight_d":
      return "Step";
    case "audit":
      return "Type";
    case "capa":
      return "Priority";
    case "document":
      return "Category";
    case "supplier":
      return "Risk";
    default:
      return "Detail";
  }
}

/**
 * Knowledge graph explorer (Sprint 03 G1-G4; `graph-explorer.jsx`). Two
 * bounded query primitives over `entity_links`: click-to-expand neighbours
 * (per-(seed,type) cursor — architecture review correction #2) and the 4
 * fixed named analytical queries (`packages/core/graph-queries.ts`, pure).
 * Layout/geometry (`packages/core/graph-layout.ts`) is not called here — the
 * API returns raw node/edge data only, per P20 ("clustering/layout is a
 * client concern").
 */
@Injectable()
export class GraphService {
  async expand(
    tx: Tx,
    membership: Membership,
    seedRaw: string,
    type: EntityKind | undefined,
    after: string | undefined,
  ): Promise<GraphExpandResult> {
    const seed = parseSeed(seedRaw);
    const centerNodes = await this.fetchNodes(tx, seed.kind, [seed.id], membership);
    const center = centerNodes[0] ?? null;
    if (center === null) {
      // Cross-tenant / out-of-scope seed resolves to nothing — never a leak (rule 8).
      return { center: null, neighbors: {} };
    }

    if (type !== undefined) {
      if (!GRAPH_KINDS.includes(type)) {
        throw new ApiError("VALIDATION_FAILED", `'${type}' is not a graph node kind`);
      }
      const cursor: Cursor | null = after !== undefined ? decodeCursor(after) : null;
      const group = await this.fetchNeighborGroup(tx, seed.kind, seed.id, type, membership, cursor, CLUSTER_REVEAL);
      return { center, neighbors: { [type]: group } };
    }

    // entity_links forbids a record linking to itself (its own CHECK
    // constraint), but two different records of the same kind can still
    // link, so every kind including `seed.kind` is queried the same way.
    const neighbors: Record<string, NeighborGroupDto> = {};
    for (const kind of GRAPH_KINDS) {
      const group = await this.fetchNeighborGroup(tx, seed.kind, seed.id, kind, membership, null, NEIGHBOR_CAP);
      if (group.total > 0) neighbors[kind] = group;
    }
    return { center, neighbors };
  }

  async query(tx: Tx, membership: Membership, queryId: GraphQueryId, focus: string | undefined): Promise<GraphQueryResult> {
    // Fetch every candidate node + edge in the caller's scope once; the pure
    // functions in @kaenal/core do the bounded traversal over already-fetched
    // rows (mirrors fmea.ts/spc.ts's pattern — no Tx/SQL in core).
    const nodesByKind = await Promise.all(GRAPH_KINDS.map((kind) => this.fetchAllNodes(tx, kind, membership)));
    const nodes: QueryNode[] = nodesByKind.flat().map((n) => ({
      kind: n.kind,
      id: n.id,
      title: n.title,
      status: n.status,
    }));
    const nodeIndex = new Map(nodes.map((n) => [nodeKey(n.kind, n.id), n] as const));
    const edges = await this.fetchAllEdges(tx, nodeIndex);

    const focusKey = focus !== undefined && nodeIndex.has(focus) ? focus : undefined;
    const result = runQuery(queryId, nodes, edges, focusKey);

    const nodeDtoIndex = new Map(nodesByKind.flat().map((n) => [nodeKey(n.kind, n.id), n] as const));
    const outNodes = result.nodeKeys
      .map((k) => nodeDtoIndex.get(k))
      .filter((n): n is NodeDto => n !== undefined);

    return {
      nodes: outNodes,
      edgeKeys: result.edgeKeys,
      truncated: result.truncated,
      summary: result.summary,
      steps: result.steps,
    };
  }

  // --- internals -------------------------------------------------------

  private async fetchNodes(tx: Tx, kind: EntityKind, ids: string[], membership: Membership): Promise<NodeDto[]> {
    if (ids.length === 0) return [];
    const base = selectSqlFor(kind);
    const params: unknown[] = [ids];
    let where = kind === "finding" ? `f.id = ANY($1::uuid[]) AND f.deleted_at IS NULL` : `id = ANY($1::uuid[]) AND deleted_at IS NULL`;
    const join = kind === "finding" ? ` JOIN inspections fi ON fi.id = f.inspection_id` : "";
    if (PLANT_SCOPED_KINDS.has(kind) && isPlantScoped(membership.role) && membership.plantIds.length > 0) {
      params.push(membership.plantIds);
      const col = kind === "finding" ? "fi.plant_id" : "plant_id";
      where += ` AND ${col} = ANY($${params.length}::uuid[])`;
    }
    const sql = `${base}${join} WHERE ${where}`;
    const { rows } = await tx.query<Record<string, unknown>>(sql, params);
    const byId = new Map(rows.map((r) => [r.id as string, toNodeDto(kind, r)]));
    return ids.map((id) => byId.get(id)).filter((n): n is NodeDto => n !== undefined);
  }

  /** Every visible node of one kind — used to build the query-time candidate set. Bounded by real tenant data size (no synthetic scale, G3). */
  private async fetchAllNodes(tx: Tx, kind: EntityKind, membership: Membership): Promise<NodeDto[]> {
    const base = selectSqlFor(kind);
    const params: unknown[] = [];
    let where = kind === "finding" ? `f.deleted_at IS NULL` : `deleted_at IS NULL`;
    const join = kind === "finding" ? ` JOIN inspections fi ON fi.id = f.inspection_id` : "";
    if (PLANT_SCOPED_KINDS.has(kind) && isPlantScoped(membership.role) && membership.plantIds.length > 0) {
      params.push(membership.plantIds);
      const col = kind === "finding" ? "fi.plant_id" : "plant_id";
      where += ` AND ${col} = ANY($${params.length}::uuid[])`;
    }
    const sql = `${base}${join} WHERE ${where}`;
    const { rows } = await tx.query<Record<string, unknown>>(sql, params);
    return rows.map((r) => toNodeDto(kind, r));
  }

  /** Every entity_links edge between two nodes both present in `nodeIndex` (i.e. both visible in the caller's scope). */
  private async fetchAllEdges(tx: Tx, nodeIndex: Map<string, QueryNode>): Promise<QueryEdge[]> {
    const { rows } = await tx.query<{
      from_kind: string;
      from_id: string;
      to_kind: string;
      to_id: string;
    }>(
      `SELECT from_kind, from_id, to_kind, to_id FROM entity_links
        WHERE deleted_at IS NULL AND from_kind = ANY($1::text[]) AND to_kind = ANY($1::text[])`,
      [GRAPH_KINDS],
    );
    return rows
      .filter(
        (r) =>
          nodeIndex.has(nodeKey(r.from_kind, r.from_id)) && nodeIndex.has(nodeKey(r.to_kind, r.to_id)),
      )
      .map((r) => ({ fromKind: r.from_kind, fromId: r.from_id, toKind: r.to_kind, toId: r.to_id }));
  }

  private async fetchNeighborGroup(
    tx: Tx,
    centerKind: EntityKind,
    centerId: string,
    neighborKind: EntityKind,
    membership: Membership,
    cursor: Cursor | null,
    limit: number,
  ): Promise<NeighborGroupDto> {
    const visibleCte = this.neighborVisibleCte(neighborKind, membership);
    const countParams: unknown[] = [centerKind, centerId, neighborKind, ...visibleCte.plantParams];
    const { rows: countRows } = await tx.query<{ n: number }>(
      `WITH edges AS (
         SELECT id, created_at, to_id AS n_id FROM entity_links
          WHERE deleted_at IS NULL AND from_kind=$1 AND from_id=$2 AND to_kind=$3
         UNION ALL
         SELECT id, created_at, from_id AS n_id FROM entity_links
          WHERE deleted_at IS NULL AND to_kind=$1 AND to_id=$2 AND from_kind=$3
       ), visible AS (
         SELECT e.id, e.created_at, e.n_id FROM edges e
         ${visibleCte.join}
         WHERE ${visibleCte.where}
       )
       SELECT count(*)::int AS n FROM visible`,
      countParams,
    );
    const total = countRows[0]?.n ?? 0;

    const clampedLimit = clampLimit(limit);
    const keyset = keysetPredicate(cursor, 3 + visibleCte.plantParams.length + 1);
    const params: unknown[] = [centerKind, centerId, neighborKind, ...visibleCte.plantParams, ...keyset.params];
    const fetchLimit = clampedLimit + 1;
    params.push(fetchLimit);

    const { rows } = await tx.query<{ id: string; created_at: Date; n_id: string }>(
      `WITH edges AS (
         SELECT id, created_at, to_id AS n_id FROM entity_links
          WHERE deleted_at IS NULL AND from_kind=$1 AND from_id=$2 AND to_kind=$3
         UNION ALL
         SELECT id, created_at, from_id AS n_id FROM entity_links
          WHERE deleted_at IS NULL AND to_kind=$1 AND to_id=$2 AND from_kind=$3
       ), visible AS (
         SELECT e.id, e.created_at, e.n_id FROM edges e
         ${visibleCte.join}
         WHERE ${visibleCte.where}
       )
       SELECT id, created_at, n_id FROM visible
        WHERE true ${keyset.sql}
        ORDER BY created_at DESC, id DESC
        LIMIT $${params.length}`,
      params,
    );

    const hasMore = rows.length > clampedLimit;
    const visibleRows = hasMore ? rows.slice(0, clampedLimit) : rows;
    const last = visibleRows[visibleRows.length - 1];
    const nextCursorObj: Cursor | null =
      hasMore && last !== undefined ? { createdAt: last.created_at.toISOString(), id: last.id } : null;
    const nextCursor =
      nextCursorObj !== null
        ? Buffer.from(`${nextCursorObj.createdAt}|${nextCursorObj.id}`, "utf8").toString("base64url")
        : null;

    const ids = visibleRows.map((r) => r.n_id);
    const items = await this.fetchNodes(tx, neighborKind, ids, membership);

    // "remaining" = rows strictly beyond this page (not "total minus this
    // page's size", which would be wrong on any page after the first) —
    // exact regardless of which page the caller is on.
    const remaining =
      nextCursorObj === null
        ? 0
        : await this.countNeighborEdges(tx, centerKind, centerId, neighborKind, membership, nextCursorObj);

    return { items, total, remaining, nextCursor };
  }

  /** Exact count of neighbour edges strictly after `cursor` (or all, if null) — the same `visible` set `fetchNeighborGroup` pages through. */
  private async countNeighborEdges(
    tx: Tx,
    centerKind: EntityKind,
    centerId: string,
    neighborKind: EntityKind,
    membership: Membership,
    cursor: Cursor | null,
  ): Promise<number> {
    const visibleCte = this.neighborVisibleCte(neighborKind, membership);
    const keyset = keysetPredicate(cursor, 3 + visibleCte.plantParams.length + 1);
    const params: unknown[] = [centerKind, centerId, neighborKind, ...visibleCte.plantParams, ...keyset.params];
    const { rows } = await tx.query<{ n: number }>(
      `WITH edges AS (
         SELECT id, created_at, to_id AS n_id FROM entity_links
          WHERE deleted_at IS NULL AND from_kind=$1 AND from_id=$2 AND to_kind=$3
         UNION ALL
         SELECT id, created_at, from_id AS n_id FROM entity_links
          WHERE deleted_at IS NULL AND to_kind=$1 AND to_id=$2 AND from_kind=$3
       ), visible AS (
         SELECT e.id, e.created_at, e.n_id FROM edges e
         ${visibleCte.join}
         WHERE ${visibleCte.where}
       )
       SELECT count(*)::int AS n FROM visible WHERE true ${keyset.sql}`,
      params,
    );
    return rows[0]?.n ?? 0;
  }

  private neighborVisibleCte(
    neighborKind: EntityKind,
    membership: Membership,
  ): { join: string; where: string; plantParams: unknown[] } {
    const plantScoped = PLANT_SCOPED_KINDS.has(neighborKind) && isPlantScoped(membership.role) && membership.plantIds.length > 0;
    if (neighborKind === "finding") {
      const join = `JOIN findings t ON t.id = e.n_id AND t.deleted_at IS NULL
                     JOIN inspections fi ON fi.id = t.inspection_id`;
      return plantScoped
        ? { join, where: `fi.plant_id = ANY($4::uuid[])`, plantParams: [membership.plantIds] }
        : { join, where: "true", plantParams: [] };
    }
    const table = tableFor(neighborKind);
    const join = `JOIN ${table} t ON t.id = e.n_id AND t.deleted_at IS NULL`;
    return plantScoped
      ? { join, where: `t.plant_id = ANY($4::uuid[])`, plantParams: [membership.plantIds] }
      : { join, where: "true", plantParams: [] };
  }
}

function parseSeed(raw: string): { kind: EntityKind; id: string } {
  const sep = raw.indexOf(":");
  if (sep === -1) throw new ApiError("VALIDATION_FAILED", "seed must be '<kind>:<id>'");
  const kind = raw.slice(0, sep);
  const id = raw.slice(sep + 1);
  const parsed = EntityKind.safeParse(kind);
  if (!parsed.success || !GRAPH_KINDS.includes(parsed.data)) {
    throw new ApiError("VALIDATION_FAILED", `'${kind}' is not a graph node kind`);
  }
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
    throw new ApiError("VALIDATION_FAILED", "seed id must be a uuid");
  }
  return { kind: parsed.data, id };
}

function runQuery(
  queryId: GraphQueryId,
  nodes: QueryNode[],
  edges: QueryEdge[],
  focus: string | undefined,
): ReturnType<typeof querySupplierNc8d> {
  switch (queryId) {
    case "supplier-nc-8d":
      return querySupplierNc8d(nodes, edges, focus);
    case "blocking":
      return queryBlocking(nodes, edges, focus);
    case "docs-impacted":
      return queryDocsImpacted(nodes, edges, focus);
    case "open-capas":
      return queryOpenCapas(nodes, edges, focus);
  }
}
