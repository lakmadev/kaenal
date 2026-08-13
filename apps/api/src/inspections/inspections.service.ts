import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import {
  formatCode,
  counterYear,
  expandOccurrences,
  inspectionMachine,
  isPlantScoped,
  SCHEDULE_HORIZON_DAYS,
  scoreInspection,
  validateResponses,
  type Membership,
  type RecurrenceRule as CoreRecurrenceRule,
} from "@kaenal/core";
import {
  type AssignInspectionBody,
  type CreateInspectionBody,
  type FormResponses,
  type FormSchema,
  type InspectionDto,
  type InspectionStatus,
  type Page,
  type RecurrenceRule,
  type SetRecurrenceBody,
} from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import {
  clampLimit,
  decodeCursor,
  keysetPredicate,
  toPage,
  type Cursor,
} from "../http/pagination.js";

interface InspectionRow {
  id: string;
  code: string;
  title: string;
  template_id: string;
  template_name: string | null;
  template_version: number;
  inspector_id: string | null;
  plant_id: string | null;
  area_id: string | null;
  status: string;
  risk: string | null;
  scheduled_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  score: string | null;
  responses: FormResponses;
  recurrence: RecurrenceRule | null;
  series_id: string | null;
  occurrence_date: string | null;
  lock_version: number;
  created_at: Date;
  updated_at: Date;
}

// occurrence_date is a `date`; cast to text so pg hands back a clean
// 'YYYY-MM-DD' string rather than a local-midnight Date that can shift a day.
const COLUMNS = `id, code, title, template_id,
  (SELECT t.name FROM inspection_templates t WHERE t.id = template_id) AS template_name,
  template_version, inspector_id, plant_id, area_id,
  status, risk, scheduled_at, started_at, completed_at, score, responses,
  recurrence, series_id, occurrence_date::text AS occurrence_date, lock_version,
  created_at, updated_at`;

function iso(d: Date | null): string | null {
  return d === null ? null : d.toISOString();
}

function toDto(row: InspectionRow): InspectionDto {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    templateId: row.template_id,
    templateName: row.template_name,
    templateVersion: row.template_version,
    inspectorId: row.inspector_id,
    plantId: row.plant_id,
    areaId: row.area_id,
    status: row.status as InspectionStatus,
    risk: row.risk as InspectionDto["risk"],
    scheduledAt: iso(row.scheduled_at),
    startedAt: iso(row.started_at),
    completedAt: iso(row.completed_at),
    // numeric(6,2) comes back from pg as a string; a Number keeps the wire type
    // honest without dragging in a decimal library for a display value.
    score: row.score === null ? null : Number(row.score),
    responses: row.responses,
    recurrence: row.recurrence,
    seriesId: row.series_id,
    occurrenceDate: row.occurrence_date,
    lockVersion: row.lock_version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Inspections (02 §4, 08 §1.2).
 *
 * Plant scoping (03 §3): an inspector or viewer with assigned plants sees only
 * inspections in those plants, and a record outside their scope answers 404 —
 * not 403 — so they cannot learn the record exists (rule 8, one level below the
 * tenant boundary). RLS already scopes to the tenant; this is the intra-tenant
 * layer on top.
 */
@Injectable()
export class InspectionsService {
  constructor(private readonly notifications: NotificationsService = new NotificationsService()) {}

  async list(
    tx: Tx,
    membership: Membership,
    opts: { status?: string; plantId?: string; cursor?: string; limit: number },
  ): Promise<Page<InspectionDto>> {
    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;

    const params: unknown[] = [];
    let where = "WHERE deleted_at IS NULL";

    if (opts.status !== undefined) {
      params.push(opts.status);
      where += ` AND status = $${params.length}`;
    }
    if (opts.plantId !== undefined) {
      params.push(opts.plantId);
      where += ` AND plant_id = $${params.length}`;
    }

    // Plant scoping folded into the query, not applied per-row after the fact:
    // a scoped role with assigned plants never even reads rows outside them.
    const scoped = isPlantScoped(membership.role) && membership.plantIds.length > 0;
    if (scoped) {
      params.push(membership.plantIds);
      where += ` AND plant_id = ANY($${params.length}::uuid[])`;
    }

    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<InspectionRow>(
      `SELECT ${COLUMNS} FROM inspections
        ${where} ${keyset.sql}
        ORDER BY created_at DESC, id DESC
        LIMIT $${params.length}`,
      params,
    );
    return toPage(rows, limit, toDto);
  }

  async get(tx: Tx, membership: Membership, id: string): Promise<InspectionDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    this.assertInScope(membership, row.plant_id);
    return toDto(row);
  }

  async create(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: CreateInspectionBody,
    context: AuditContext,
  ): Promise<InspectionDto> {
    // Only a published template can back a new inspection: a draft's schema can
    // still change, which would leave the pinned template_version pointing at a
    // shape that no longer exists.
    const { rows: templates } = await tx.query<{ version: number; status: string; timezone: string | null }>(
      `SELECT t.version, t.status, p.timezone
         FROM inspection_templates t
         LEFT JOIN plants p ON p.id = $2
        WHERE t.id = $1 AND t.deleted_at IS NULL`,
      [body.templateId, body.plantId ?? null],
    );
    const template = templates[0];
    if (template === undefined) throw new ApiError("VALIDATION_FAILED", "Unknown template");
    if (template.status !== "published") {
      throw new ApiError("CONFLICT", "Inspections can only use a published template");
    }

    const now = new Date();
    const year = counterYear(now, template.timezone ?? "UTC");
    const id = randomUUID();

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "inspection",
        entityId: id,
        action: "created",
        after: { title: body.title, templateId: body.templateId },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        // Sequence allocation serialises on the counters row lock, so two
        // concurrent creates cannot mint the same code (02 §7).
        const { rows: counter } = await t.query<{ value: number }>(
          `INSERT INTO counters (tenant_id, kind, year, value)
           VALUES ($1, 'inspection', $2, 1)
           ON CONFLICT (tenant_id, kind, year)
             DO UPDATE SET value = counters.value + 1, updated_at = now()
           RETURNING value`,
          [tenantId, year],
        );
        const seq = counter[0]?.value;
        if (seq === undefined) throw new ApiError("INTERNAL", "Could not allocate an inspection code");
        const code = formatCode("inspection", year, seq);

        const { rows } = await t.query<InspectionRow>(
          `INSERT INTO inspections
             (id, tenant_id, code, title, template_id, template_version,
              inspector_id, plant_id, area_id, status, scheduled_at, recurrence,
              created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'scheduled', $10, $11, $12, $12)
           RETURNING ${COLUMNS}`,
          [
            id,
            tenantId,
            code,
            body.title,
            body.templateId,
            template.version,
            body.inspectorId ?? null,
            body.plantId ?? null,
            body.areaId ?? null,
            body.scheduledAt ?? null,
            body.recurrence != null ? JSON.stringify(body.recurrence) : null,
            actorId,
          ],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("INTERNAL", "Inspection was not created");
        return toDto(row);
      },
    );
  }

  /** scheduled → in_progress. */
  async start(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    actorId: string,
    id: string,
    expectedVersion: number,
    context: AuditContext,
  ): Promise<InspectionDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    this.assertInScope(membership, row.plant_id);
    this.assertVersion(row, expectedVersion);

    const transition = inspectionMachine.canTransition(row.status as InspectionStatus, "in_progress", {
      requiredItemIds: [],
      answeredItemIds: [],
    });
    if (!transition.ok) throw ApiError.from(transition);

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "inspection",
        entityId: id,
        action: "status_changed",
        before: { status: row.status },
        after: { status: "in_progress" },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => this.applyUpdate(t, id, expectedVersion, "status = 'in_progress', started_at = now()"),
    );
  }

  /** in_progress → completed, after server-side validation + scoring. */
  async complete(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    actorId: string,
    id: string,
    responses: FormResponses,
    expectedVersion: number,
    context: AuditContext,
  ): Promise<InspectionDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    this.assertInScope(membership, row.plant_id);
    this.assertVersion(row, expectedVersion);

    const schema = await this.pinnedSchema(tx, row.template_id, row.template_version);

    // Server is authoritative on both validity and score. A completion that
    // slipped past the client — an offline replay, a direct API call — is
    // validated here against the exact template version the inspection pinned.
    const valid = validateResponses(schema, responses);
    if (!valid.ok) throw ApiError.from(valid);

    const answeredItemIds = Object.keys(responses);
    const requiredItemIds = schema.sections.flatMap((s) =>
      s.items.filter((i) => i.required).map((i) => i.id),
    );
    const transition = inspectionMachine.canTransition(row.status as InspectionStatus, "completed", {
      requiredItemIds,
      answeredItemIds,
    });
    if (!transition.ok) throw ApiError.from(transition);

    const { score } = scoreInspection(schema, responses);

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "inspection",
        entityId: id,
        action: "status_changed",
        before: { status: row.status },
        after: { status: "completed", score },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) =>
        this.applyUpdate(
          t,
          id,
          expectedVersion,
          "status = 'completed', completed_at = now(), responses = $3, score = $4",
          [JSON.stringify(responses), score],
        ),
    );
  }

  /**
   * Set, change, or clear the recurrence on a series head (02 §2). Occupies the
   * normal optimistic-concurrency path; a generated occurrence cannot carry its
   * own recurrence (that would make an occurrence a series of its own).
   */
  async setRecurrence(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    actorId: string,
    id: string,
    body: SetRecurrenceBody,
    context: AuditContext,
  ): Promise<InspectionDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    this.assertInScope(membership, row.plant_id);
    this.assertVersion(row, body.version);
    if (row.series_id !== null) {
      throw new ApiError("CONFLICT", "A generated occurrence cannot carry its own recurrence");
    }

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "inspection",
        entityId: id,
        action: "updated",
        before: { recurrence: row.recurrence },
        after: { recurrence: body.recurrence },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      (t) =>
        this.applyUpdate(t, id, body.version, "recurrence = $3", [
          body.recurrence != null ? JSON.stringify(body.recurrence) : null,
        ]),
    );
  }

  /**
   * Assign, reassign, or clear the inspector (P25). Orthogonal to the
   * scheduled → in_progress → completed machine — it never touches `status`.
   * `inspectorId` is a uuid to assign or `null` to unassign; a non-null id must
   * be an active member. Optimistic-concurrency guarded and audited (`assigned`,
   * before/after) in one transaction. Plant scope is enforced first (out-of-scope
   * → 404, rule 8).
   */
  async assign(
    tx: Tx,
    tenantId: string,
    membership: Membership,
    actorId: string,
    id: string,
    body: AssignInspectionBody,
    context: AuditContext,
  ): Promise<InspectionDto> {
    const row = await this.fetch(tx, id);
    if (row === null) throw notFound();
    this.assertInScope(membership, row.plant_id);
    this.assertVersion(row, body.version);

    if (body.inspectorId !== null) await this.assertMember(tx, body.inspectorId);

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "inspection",
        entityId: id,
        action: "assigned",
        before: { inspectorId: row.inspector_id },
        after: { inspectorId: body.inspectorId },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const dto = await this.applyUpdate(t, id, body.version, "inspector_id = $3, updated_by = $4", [
          body.inspectorId,
          actorId,
        ]);
        if (body.inspectorId !== null && body.inspectorId !== actorId) {
          await this.notifications.notify(t, tenantId, {
            userId: body.inspectorId,
            actorId,
            kind: "inspection_assigned",
            title: `${dto.code} was assigned to you`,
            entityKind: "inspection",
            entityId: id,
          });
        }
        return dto;
      },
    );
  }

  /** List a series head's materialised occurrences (newest first). */
  async listOccurrences(
    tx: Tx,
    membership: Membership,
    seriesId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<Page<InspectionDto>> {
    // Visibility follows the head: if the caller can't see the series, the
    // occurrences are a 404 too (rule 8).
    const head = await this.fetch(tx, seriesId);
    if (head === null) throw notFound();
    this.assertInScope(membership, head.plant_id);

    const limit = clampLimit(opts.limit);
    const cursor: Cursor | null = opts.cursor !== undefined ? decodeCursor(opts.cursor) : null;
    const params: unknown[] = [seriesId];
    const keyset = keysetPredicate(cursor, params.length + 1);
    params.push(...keyset.params);
    params.push(limit + 1);

    const { rows } = await tx.query<InspectionRow>(
      `SELECT ${COLUMNS} FROM inspections
        WHERE series_id = $1 AND deleted_at IS NULL ${keyset.sql}
        ORDER BY created_at DESC, id DESC
        LIMIT $${params.length}`,
      params,
    );
    return toPage(rows, limit, toDto);
  }

  /**
   * The `schedule` job body (06 §1): expand every recurring series head into
   * occurrence inspections within the horizon window, idempotent on
   * `(series_id, occurrence_date)`. Runs inside a tenant transaction from the
   * worker (system actor), so RLS applies exactly as to a request. Returns how
   * many NEW occurrences were created (a re-run within the same window creates
   * none).
   */
  async materializeDueOccurrences(
    tx: Tx,
    tenantId: string,
    now: Date,
    horizonDays: number = SCHEDULE_HORIZON_DAYS,
  ): Promise<{ created: number }> {
    const to = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
    const { rows: heads } = await tx.query<InspectionRow>(
      `SELECT ${COLUMNS} FROM inspections
        WHERE recurrence IS NOT NULL AND series_id IS NULL
          AND status <> 'cancelled' AND deleted_at IS NULL`,
    );

    let created = 0;
    for (const head of heads) {
      const rule = head.recurrence;
      const anchor = head.scheduled_at;
      // A series with no start has nothing to phase occurrences against.
      if (rule == null || anchor === null) continue;
      const dates = expandOccurrences(rule as CoreRecurrenceRule, { anchor, from: now, to });
      for (const date of dates) {
        if (await this.materializeOne(tx, tenantId, head, date)) created += 1;
      }
    }
    return { created };
  }

  // --- internals ------------------------------------------------------------

  /** Create one occurrence for a series/date, or return false if it exists. */
  private async materializeOne(
    tx: Tx,
    tenantId: string,
    head: InspectionRow,
    date: string,
  ): Promise<boolean> {
    // Pre-check so the common re-run path doesn't mint (and waste) a code for a
    // day that already exists. The unique index still guards a genuine race.
    const existing = await tx.query(
      `SELECT 1 FROM inspections WHERE tenant_id = $1 AND series_id = $2 AND occurrence_date = $3`,
      [tenantId, head.id, date],
    );
    if (existing.rows.length > 0) return false;

    const id = randomUUID();
    const year = counterYear(new Date(`${date}T00:00:00Z`), "UTC");
    const scheduledAt = occurrenceTimestamp(head.scheduled_at, date);

    const { rows: counter } = await tx.query<{ value: number }>(
      `INSERT INTO counters (tenant_id, kind, year, value) VALUES ($1, 'inspection', $2, 1)
       ON CONFLICT (tenant_id, kind, year) DO UPDATE SET value = counters.value + 1, updated_at = now()
       RETURNING value`,
      [tenantId, year],
    );
    const seq = counter[0]?.value;
    if (seq === undefined) throw new ApiError("INTERNAL", "Could not allocate an inspection code");
    const code = formatCode("inspection", year, seq);

    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO inspections
         (id, tenant_id, code, title, template_id, template_version, inspector_id, plant_id, area_id,
          status, scheduled_at, series_id, occurrence_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'scheduled',$10,$11,$12)
       ON CONFLICT (tenant_id, series_id, occurrence_date) WHERE series_id IS NOT NULL DO NOTHING
       RETURNING id`,
      [
        id,
        tenantId,
        code,
        head.title,
        head.template_id,
        head.template_version,
        head.inspector_id,
        head.plant_id,
        head.area_id,
        scheduledAt,
        head.id,
        date,
      ],
    );
    if (rows.length === 0) return false; // lost the race — the day already exists

    // Audited as a system actor (no request behind it). Recorded only on a real
    // insert, so a skipped re-run writes no spurious event.
    await withAudit(
      tx,
      tenantId,
      {
        actorId: null,
        actorKind: "system",
        entityKind: "inspection",
        entityId: id,
        action: "created",
        after: { code, seriesId: head.id, occurrenceDate: date },
      },
      () => Promise.resolve(),
    );
    return true;
  }

  private async fetch(tx: Tx, id: string): Promise<InspectionRow | null> {
    const { rows } = await tx.query<InspectionRow>(
      `SELECT ${COLUMNS} FROM inspections WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] ?? null;
  }

  private async pinnedSchema(tx: Tx, templateId: string, version: number): Promise<FormSchema> {
    const { rows } = await tx.query<{ schema: FormSchema }>(
      `SELECT schema FROM inspection_templates WHERE id = $1 AND version = $2`,
      [templateId, version],
    );
    const schema = rows[0]?.schema;
    if (schema === undefined) throw new ApiError("INTERNAL", "The template version has gone missing");
    return schema;
  }

  private assertInScope(membership: Membership, plantId: string | null): void {
    if (!isPlantScoped(membership.role)) return;
    if (membership.plantIds.length === 0) return;
    if (plantId !== null && membership.plantIds.includes(plantId)) return;
    // A record outside the caller's plant scope is invisible, not forbidden.
    throw notFound();
  }

  private async assertMember(tx: Tx, userId: string): Promise<void> {
    const { rows } = await tx.query(
      "SELECT 1 FROM memberships WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL",
      [userId],
    );
    if (rows.length === 0) throw new ApiError("VALIDATION_FAILED", "That user is not an active member");
  }

  private assertVersion(row: InspectionRow, expected: number): void {
    if (row.lock_version !== expected) {
      throw new ApiError("STALE_WRITE", "The inspection changed since you loaded it", {
        expected,
        actual: row.lock_version,
      });
    }
  }

  /**
   * The compare-and-set. `WHERE lock_version = $2` is the real guard against a
   * concurrent writer — the earlier read is only for the friendly 404/409; by
   * the time we UPDATE, the version could have moved, so a zero-row result is
   * STALE_WRITE regardless of what the read saw.
   */
  private async applyUpdate(
    tx: Tx,
    id: string,
    expectedVersion: number,
    setClause: string,
    extraParams: unknown[] = [],
  ): Promise<InspectionDto> {
    const { rows } = await tx.query<InspectionRow>(
      `UPDATE inspections SET ${setClause}
        WHERE id = $1 AND lock_version = $2
        RETURNING ${COLUMNS}`,
      [id, expectedVersion, ...extraParams],
    );
    const row = rows[0];
    if (row === undefined) throw new ApiError("STALE_WRITE", "The inspection changed since you loaded it");
    return toDto(row);
  }
}

interface AuditContext {
  readonly requestId: string | null;
  readonly ip: string | null;
  readonly userAgent: string | null;
}

/**
 * An occurrence's `scheduled_at`: its calendar date carrying the series
 * anchor's UTC time-of-day, so a series anchored at 09:00 produces occurrences
 * at 09:00. Falls back to midnight UTC if the head has no time.
 */
function occurrenceTimestamp(anchor: Date | null, date: string): Date {
  const dayStart = new Date(`${date}T00:00:00Z`);
  if (anchor === null) return dayStart;
  const timeOfDayMs =
    anchor.getTime() - Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate());
  return new Date(dayStart.getTime() + timeOfDayMs);
}
