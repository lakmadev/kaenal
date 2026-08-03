import { randomUUID } from "node:crypto";
import { Injectable, Inject } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import type {
  Page,
  PortalIdentityDto,
  PortalPpapDto,
  PortalPpapResubmitBody,
  PortalScarDto,
  PortalScarRespondBody,
  PpapSubmissionDto,
  ScarDto,
} from "@kaenal/types";
import { ApiError, notFound } from "../errors.js";
import { PPAP_SERVICE, SCAR_SERVICE } from "../tokens.js";
import type { ScarService } from "../scar/scar.service.js";
import type { PpapService } from "../ppap/ppap.service.js";
import type { AuditContext } from "../ncr/audit-context.js";

/** SCAR lifecycle states that still invite a supplier response. */
const RESPONDABLE_SCAR = new Set(["draft", "open", "responded"]);
/** PPAP states a supplier may re-submit into review (not a decided package). */
const RESUBMITTABLE_PPAP = new Set(["pending", "in_review", "interim"]);

/**
 * Supplier portal (FEATURES §17, P11) — the external, read-only surface.
 *
 * ⚠️ This service is the ONLY code an external `partner` reaches, and every
 * method is scoped to the caller's single supplier. The scope is not a filter
 * the caller supplies — it comes from the authenticated membership
 * (`supplierScope`), so a partner cannot widen it. Internal records are reused
 * (the tested `ScarService` / `PpapService` queries) but mapped onto the narrow
 * portal DTOs before crossing the boundary: the owning member, the linked NCR,
 * the reviewer id and the AI prediction never leave the internal side.
 *
 * A record belonging to another supplier is surfaced as 404, never 403 — a 403
 * would confirm it exists (rule 8, one boundary out from the plant-scope 404).
 */
@Injectable()
export class PortalService {
  constructor(
    @Inject(SCAR_SERVICE) private readonly scars: ScarService,
    @Inject(PPAP_SERVICE) private readonly ppap: PpapService,
  ) {}

  /**
   * The supplier this partner session is bound to. Throwing FORBIDDEN here (not
   * NOT_FOUND) is deliberate: reaching the portal service already means the
   * caller passed the `portal:view` capability, so the only way to arrive
   * without a scope is an internal account (e.g. admin) with the capability but
   * no supplier binding — an authorization error, not a hidden resource.
   */
  private scopeOf(supplierScope: string | null | undefined): string {
    if (supplierScope === null || supplierScope === undefined || supplierScope === "") {
      throw new ApiError("FORBIDDEN", "Portal access requires a supplier-scoped account");
    }
    return supplierScope;
  }

  async identity(tx: Tx, supplierScope: string | null | undefined): Promise<PortalIdentityDto> {
    const supplierId = this.scopeOf(supplierScope);
    const { rows } = await tx.query<{ id: string; name: string; code: string }>(
      `SELECT id, name, code FROM suppliers WHERE id = $1 AND deleted_at IS NULL`,
      [supplierId],
    );
    const row = rows[0];
    // The scope points at a soft-deleted / missing supplier: treat as no access.
    if (row === undefined) throw notFound();
    return { supplierId: row.id, supplierName: row.name, supplierCode: row.code };
  }

  async listScars(
    tx: Tx,
    supplierScope: string | null | undefined,
    opts: { cursor?: string; limit: number },
  ): Promise<Page<PortalScarDto>> {
    const supplierId = this.scopeOf(supplierScope);
    const page = await this.scars.list(tx, {
      supplierId,
      ...(opts.cursor !== undefined ? { cursor: opts.cursor } : {}),
      limit: opts.limit,
    });
    return { items: page.items.map(toPortalScar), nextCursor: page.nextCursor };
  }

  async getScar(tx: Tx, supplierScope: string | null | undefined, id: string): Promise<PortalScarDto> {
    const supplierId = this.scopeOf(supplierScope);
    const scar = await this.scars.get(tx, id); // 404 already if not in this tenant
    // The record exists in the tenant but belongs to another supplier — invisible.
    if (scar.supplierId !== supplierId) throw notFound();
    return toPortalScar(scar);
  }

  async listPpap(
    tx: Tx,
    supplierScope: string | null | undefined,
    opts: { cursor?: string; limit: number },
  ): Promise<Page<PortalPpapDto>> {
    const supplierId = this.scopeOf(supplierScope);
    const page = await this.ppap.list(tx, {
      supplierId,
      ...(opts.cursor !== undefined ? { cursor: opts.cursor } : {}),
      limit: opts.limit,
    });
    return { items: page.items.map(toPortalPpap), nextCursor: page.nextCursor };
  }

  async getPpap(tx: Tx, supplierScope: string | null | undefined, id: string): Promise<PortalPpapDto> {
    const supplierId = this.scopeOf(supplierScope);
    const ppap = await this.ppap.get(tx, id);
    if (ppap.supplierId !== supplierId) throw notFound();
    return toPortalPpap(ppap);
  }

  /**
   * The supplier's response to a SCAR: a note (recorded as a comment on the
   * SCAR, so internal staff see it too) plus an optional acknowledgement. This
   * is a partner input into the 8D — it does NOT move the internal D-step
   * machine forward (that stays with the internal reviewer). Audited as an
   * EXTERNAL actor (`actor_kind='partner'`).
   */
  async respondScar(
    tx: Tx,
    tenantId: string,
    supplierScope: string | null | undefined,
    actorId: string,
    id: string,
    body: PortalScarRespondBody,
    context: AuditContext,
  ): Promise<PortalScarDto> {
    const supplierId = this.scopeOf(supplierScope);
    const scar = await this.scars.get(tx, id); // 404 if not in this tenant
    if (scar.supplierId !== supplierId) throw notFound(); // another supplier → invisible
    if (!RESPONDABLE_SCAR.has(scar.status)) {
      throw new ApiError("VALIDATION_FAILED", "This SCAR is closed and no longer accepts responses");
    }

    const acknowledged = body.acknowledge === true && !scar.supplierAcknowledged;
    const commentId = randomUUID();

    await withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "partner",
        entityKind: "scar",
        entityId: id,
        action: "commented",
        after: { commentId, acknowledged },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        await t.query(
          `INSERT INTO comments (id, tenant_id, entity_kind, entity_id, author_id, body, created_by, updated_by)
           VALUES ($1,$2,'scar',$3,$4,$5,$4,$4)`,
          [commentId, tenantId, id, actorId, body.note],
        );
        if (acknowledged) {
          await t.query(
            `UPDATE scars SET supplier_acknowledged = true, ack_date = CURRENT_DATE, updated_by = $2
              WHERE id = $1`,
            [id, actorId],
          );
        }
      },
    );

    return toPortalScar(await this.scars.get(tx, id));
  }

  /**
   * The supplier re-submits a PPAP package after changes-requested feedback:
   * the package goes back to `in_review` with a fresh submitted date, signalling
   * the internal reviewers to re-check. A decided package (approved/rejected)
   * cannot be re-submitted. Audited as an external actor; the note (if any) is
   * the audit reason — PPAP has no comment thread.
   */
  async resubmitPpap(
    tx: Tx,
    tenantId: string,
    supplierScope: string | null | undefined,
    actorId: string,
    id: string,
    body: PortalPpapResubmitBody,
    context: AuditContext,
  ): Promise<PortalPpapDto> {
    const supplierId = this.scopeOf(supplierScope);
    const ppap = await this.ppap.get(tx, id);
    if (ppap.supplierId !== supplierId) throw notFound();
    if (!RESUBMITTABLE_PPAP.has(ppap.status)) {
      throw new ApiError("VALIDATION_FAILED", "A decided PPAP package cannot be re-submitted");
    }

    await withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "partner",
        entityKind: "ppap_submission",
        entityId: id,
        action: "status_changed",
        before: { status: ppap.status },
        after: { status: "in_review" },
        ...(body.note != null && body.note !== "" ? { reason: body.note } : {}),
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        await t.query(
          `UPDATE ppap_submissions
              SET status = 'in_review', submitted_date = CURRENT_DATE, updated_by = $2
            WHERE id = $1`,
          [id, actorId],
        );
      },
    );

    return toPortalPpap(await this.ppap.get(tx, id));
  }
}

/** Project the internal SCAR onto the external view — dropping supplierId/Name,
 *  the owning member, and the linked NCR. */
function toPortalScar(s: ScarDto): PortalScarDto {
  return {
    id: s.id,
    code: s.code,
    title: s.title,
    severity: s.severity,
    status: s.status,
    currentD: s.currentD,
    raisedDate: s.raisedDate,
    dueDate: s.dueDate,
    supplierResponseDue: s.supplierResponseDue,
    supplierAcknowledged: s.supplierAcknowledged,
    ackDate: s.ackDate,
    affectedLots: s.affectedLots,
    chargeback: s.chargeback,
    daysOpen: s.daysOpen,
    overdue: s.overdue,
  };
}

/** Project the internal PPAP onto the external view — dropping the owner, the AI
 *  prediction, and each element's reviewer id (keeping the feedback comment). */
function toPortalPpap(p: PpapSubmissionDto): PortalPpapDto {
  return {
    id: p.id,
    code: p.code,
    partNumber: p.partNumber,
    partRev: p.partRev,
    programName: p.programName,
    level: p.level,
    customer: p.customer,
    status: p.status,
    submittedDate: p.submittedDate,
    dueDate: p.dueDate,
    approvedDate: p.approvedDate,
    elements: p.elements.map((e) => ({ id: e.id, name: e.name, status: e.status, comment: e.comment })),
    completeness: p.completeness,
    daysOpen: p.daysOpen,
  };
}
