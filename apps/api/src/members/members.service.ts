import type pg from "pg";
import type { Tx } from "@kaenal/db";
import type { MemberDto, MemberWorkloadDto, Page, Role } from "@kaenal/types";
import { clampLimit, decodeCursor, keysetPredicate, toPage, type Cursor } from "../http/pagination.js";

interface MembershipRow {
  readonly id: string;
  readonly user_id: string;
  readonly role: Role;
  readonly created_at: Date;
}

export interface MembersListOptions {
  readonly cursor?: string;
  readonly limit: number;
}

/**
 * Read-only directory of a tenant's people (id → name + role). Every tenant
 * table stores a person as a composite member FK `(tenant_id, user_id)`, so the
 * UI needs one place to turn those ids into a name and avatar — this is it.
 *
 * The join spans a trust boundary: `memberships` is a tenant table (RLS), but
 * the display `name` lives in `control.users`, which the RLS app role cannot
 * read. So the roster is read on the request `tx` (RLS-scoped to the caller's
 * tenant) and the names are fetched separately on the control pool, keyed by the
 * exact user_ids the roster returned — never the other way round, so a name is
 * only ever exposed for a person who is already a member of this tenant.
 */
export class MembersService {
  constructor(private readonly control: pg.Pool) {}

  async list(tx: Tx, opts: MembersListOptions): Promise<Page<MemberDto>> {
    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;

    const params: unknown[] = [];
    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<MembershipRow>(
      `SELECT id, user_id, role, created_at
         FROM memberships
        WHERE status = 'active' AND deleted_at IS NULL ${keyset.sql}
        ORDER BY created_at DESC, id DESC
        LIMIT $${params.length}`,
      params,
    );

    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const names = new Map<string, string>();
    if (userIds.length > 0) {
      const { rows: people } = await this.control.query<{ id: string; name: string }>(
        `SELECT id, name FROM control.users WHERE id = ANY($1::uuid[])`,
        [userIds],
      );
      for (const p of people) names.set(p.id, p.name);
    }

    return toPage(rows, limit, (r) => ({
      userId: r.user_id,
      name: names.get(r.user_id) ?? "Unknown member",
      role: r.role,
    }));
  }

  /**
   * The roster plus a live workload signal for the AssignSheet: each active
   * member's count of OPEN owned NCRs (anything not yet closed/verified/draft),
   * banded Light/Steady/Busy. The count query is RLS-scoped (ncrs is a tenant
   * table), the JOIN keys owner_id → the member; names resolve on the control
   * pool exactly as `list` does. No cursor — a roster is small and the sheet
   * searches it client-side; capped for safety.
   */
  async workload(tx: Tx): Promise<MemberWorkloadDto[]> {
    const { rows } = await tx.query<{ user_id: string; role: Role; open_ncrs: string }>(
      `SELECT m.user_id, m.role,
              COUNT(n.id) FILTER (WHERE n.status NOT IN ('closed','verified','draft')) AS open_ncrs
         FROM memberships m
         LEFT JOIN ncrs n ON n.owner_id = m.user_id AND n.deleted_at IS NULL
        WHERE m.status = 'active' AND m.deleted_at IS NULL
        GROUP BY m.user_id, m.role, m.created_at, m.id
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 200`,
    );

    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const names = new Map<string, string>();
    if (userIds.length > 0) {
      const { rows: people } = await this.control.query<{ id: string; name: string }>(
        `SELECT id, name FROM control.users WHERE id = ANY($1::uuid[])`,
        [userIds],
      );
      for (const p of people) names.set(p.id, p.name);
    }

    return rows.map((r) => {
      const open = Number(r.open_ncrs);
      return {
        userId: r.user_id,
        name: names.get(r.user_id) ?? "Unknown member",
        role: r.role,
        openNcrs: open,
        band: open <= 2 ? ("light" as const) : open <= 4 ? ("steady" as const) : ("busy" as const),
      };
    });
  }
}
