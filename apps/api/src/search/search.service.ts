import { Injectable } from "@nestjs/common";
import type { Tx } from "@kaenal/db";
import { isPlantScoped, type Membership } from "@kaenal/core";
import type { SearchEntityKind, SearchResultDto, SearchResults } from "@kaenal/types";

/** Top N hits per entity kind (03 §1 / 04 — "top 6 per kind"). */
const LIMIT_PER_KIND = 6;

interface KindConfig {
  readonly table: string;
  readonly plantScoped: boolean;
}

/**
 * Fixed table map — the table name is interpolated into SQL, so it must never
 * come from user input. These four are the searchable records the command
 * palette federates over.
 */
const KINDS: Readonly<Record<SearchEntityKind, KindConfig>> = {
  inspection: { table: "inspections", plantScoped: true },
  ncr: { table: "ncrs", plantScoped: true },
  capa: { table: "capas", plantScoped: false },
  document: { table: "documents", plantScoped: false },
  audit: { table: "audits", plantScoped: true },
};

/**
 * `audit:view` is granted to every role, but `rbac.ts`'s ROLE_NAV never
 * surfaces `/audits` to inspector/viewer (Sprint 02 architecture review §8
 * item 1 / PO resolution §8a item 1) — a search hit they can't open would be a
 * new dead end, so those two roles never see `audit`-kind hits at all. Not a
 * capability change: `audit:view` still gates the direct `GET /v1/audits/:id`.
 */
export const AUDIT_HIDDEN_ROLES: ReadonlySet<Membership["role"]> = new Set(["inspector", "viewer"]);

interface HitRow {
  id: string;
  code: string;
  title: string;
  rank: number;
}

/**
 * Federated full-text search (03 §1, 04 command palette). One `GET /v1/search`
 * fans across the searchable records, ranking matches over each entity's
 * generated `search_vector` (code/title/description, migration 0008). Plant
 * scoping mirrors the list endpoints: an inspector/viewer bounded to plants sees
 * only inspections/NCRs in those plants (CAPAs and documents are not
 * plant-scoped). Every query runs inside the request's tenant transaction, so
 * RLS already confines it to the caller's tenant — search cannot be a
 * cross-tenant oracle (rule 8).
 */
@Injectable()
export class SearchService {
  async search(tx: Tx, membership: Membership, q: string): Promise<SearchResults> {
    const items: SearchResultDto[] = [];
    for (const kind of Object.keys(KINDS) as SearchEntityKind[]) {
      if (kind === "audit" && AUDIT_HIDDEN_ROLES.has(membership.role)) continue;
      const rows = await this.queryKind(tx, kind, membership, q);
      for (const r of rows) {
        items.push({ kind, id: r.id, code: r.code, title: r.title, rank: r.rank });
      }
    }
    return { items };
  }

  private async queryKind(
    tx: Tx,
    kind: SearchEntityKind,
    membership: Membership,
    q: string,
  ): Promise<HitRow[]> {
    const cfg = KINDS[kind];
    const params: unknown[] = [q];
    let plantFilter = "";

    if (cfg.plantScoped && isPlantScoped(membership.role) && membership.plantIds.length > 0) {
      params.push(membership.plantIds);
      plantFilter = ` AND plant_id = ANY($${params.length}::uuid[])`;
    }

    // websearch_to_tsquery tolerates arbitrary user input (no tsquery syntax
    // errors from stray punctuation), which a raw to_tsquery would throw on.
    const { rows } = await tx.query<HitRow>(
      `SELECT id, code, title, ts_rank(search_vector, query) AS rank
         FROM ${cfg.table}, websearch_to_tsquery('english', $1) query
        WHERE search_vector @@ query AND deleted_at IS NULL${plantFilter}
        ORDER BY rank DESC, created_at DESC
        LIMIT ${LIMIT_PER_KIND}`,
      params,
    );
    return rows;
  }
}
