import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import {
  CreateSupplierBody,
  PageQuery,
  PartnerInviteBody,
  type PartnerInviteResult,
  type PortalContactDto,
  RiskLevel,
  ScorecardWeightsQuery,
  SupplierStatus,
  UpdateSupplierBody,
  type Page,
  type SupplierDto,
} from "@kaenal/types";
import { DEFAULT_SCORE_WEIGHTS, type ScoreWeights } from "@kaenal/core";
import { currentContext, currentTx } from "../context.js";
import { RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import { actorIdOf, auditCtxOf } from "../ncr/handler-ctx.js";
import { AUTH_SERVICE, ENV, JOB_PRODUCER, SUPPLIERS_SERVICE } from "../tokens.js";
import { INVITATION_TTL_MS } from "@kaenal/core";
import type { AuthService } from "../auth/auth.service.js";
import type { Env } from "../env.js";
import type { JobProducer } from "../jobs/producer.js";
import { renderInvite } from "../providers/email/index.js";
import type { SuppliersService } from "./suppliers.service.js";

const uuid = z.string().uuid();
const ListQuery = PageQuery.extend({
  status: SupplierStatus.optional(),
  riskTier: RiskLevel.optional(),
  tier: z.coerce.number().int().optional(),
  category: z.string().optional(),
  country: z.string().optional(),
  flag: z.string().optional(),
  q: z.string().optional(),
});

/**
 * Supplier routes (FEATURES §11.1). `supplier:view` reads (everyone);
 * `supplier:manage` (admin/manager) creates and edits. Suppliers are tenant-wide
 * (not plant-scoped), so isolation is RLS alone. The scorecard route re-weights
 * the same records per request from query-param weights.
 */
@Controller()
export class SuppliersController {
  constructor(
    @Inject(SUPPLIERS_SERVICE) private readonly suppliers: SuppliersService,
    @Inject(AUTH_SERVICE) private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
    @Inject(JOB_PRODUCER) private readonly jobs: JobProducer,
  ) {}

  @Get("v1/suppliers")
  @RequireCapability("supplier:view")
  async list(@Query() query: unknown): Promise<Page<SupplierDto>> {
    const q = parse(ListQuery, query);
    return this.suppliers.list(currentTx(), {
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.riskTier !== undefined ? { riskTier: q.riskTier } : {}),
      ...(q.tier !== undefined ? { tier: q.tier } : {}),
      ...(q.category !== undefined ? { category: q.category } : {}),
      ...(q.country !== undefined ? { country: q.country } : {}),
      ...(q.flag !== undefined ? { flag: q.flag } : {}),
      ...(q.q !== undefined ? { q: q.q } : {}),
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Get("v1/supplier-scorecard")
  @RequireCapability("supplier:view")
  async scorecard(@Query() query: unknown): Promise<Page<SupplierDto>> {
    const q = parse(ScorecardWeightsQuery, query);
    const weights: ScoreWeights = {
      ppm: q.wPpm ?? DEFAULT_SCORE_WEIGHTS.ppm,
      otd: q.wOtd ?? DEFAULT_SCORE_WEIGHTS.otd,
      oqe: q.wOqe ?? DEFAULT_SCORE_WEIGHTS.oqe,
      scar: q.wScar ?? DEFAULT_SCORE_WEIGHTS.scar,
    };
    return this.suppliers.scorecard(currentTx(), weights);
  }

  @Post("v1/suppliers")
  @RequireCapability("supplier:manage")
  async create(@Body() body: unknown): Promise<SupplierDto> {
    const input = parse(CreateSupplierBody, body);
    return this.suppliers.create(currentTx(), currentContext().tenantId, actorIdOf(), input, auditCtxOf());
  }

  @Get("v1/suppliers/:id")
  @RequireCapability("supplier:view")
  async get(@Param("id") id: string): Promise<SupplierDto> {
    return this.suppliers.get(currentTx(), parse(uuid, id));
  }

  @Post("v1/suppliers/:id")
  @HttpCode(200)
  @RequireCapability("supplier:manage")
  async update(@Param("id") id: string, @Body() body: unknown): Promise<SupplierDto> {
    const input = parse(UpdateSupplierBody, body);
    return this.suppliers.update(
      currentTx(),
      currentContext().tenantId,
      actorIdOf(),
      parse(uuid, id),
      input,
      auditCtxOf(),
    );
  }

  /**
   * Invite a supplier contact to the portal (P11). Mints a `partner` invitation
   * bound to THIS supplier; an unknown or foreign-tenant supplier is a 404. Re-
   * inviting the same address revokes the previous link and issues a fresh one, so
   * a retried request is safe. The audit event is written in the invite's own
   * transaction; the email is enqueued (never sent inside the DB transaction).
   */
  @Post("v1/suppliers/:id/portal-invite")
  @RequireCapability("supplier:manage")
  async invitePortalContact(@Param("id") id: string, @Body() body: unknown): Promise<PartnerInviteResult> {
    const { email } = parse(PartnerInviteBody, body);
    const ctx = currentContext();
    const { token, expiresAt } = await this.auth.invitePartner(
      currentTx(),
      ctx.tenantId,
      actorIdOf(),
      parse(uuid, id),
      email,
    );

    await this.emailInvite(email, token, ctx.tenantSlug);
    return this.inviteResult(email, token, expiresAt);
  }

  /** The supplier's portal contacts (partners + pending invitations), cursor-paged. */
  @Get("v1/suppliers/:id/portal-contacts")
  @RequireCapability("supplier:manage")
  async listPortalContacts(@Param("id") id: string, @Query() query: unknown): Promise<Page<PortalContactDto>> {
    const q = parse(PageQuery, query);
    return this.auth.listPortalContacts(currentTx(), parse(uuid, id), {
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  /** Re-issue a pending contact's invite: old link revoked, new one emailed. */
  @Post("v1/suppliers/:id/portal-contacts/:contactId/resend")
  @RequireCapability("supplier:manage")
  async resendPortalContact(
    @Param("id") id: string,
    @Param("contactId") contactId: string,
  ): Promise<PartnerInviteResult> {
    const ctx = currentContext();
    const { email, token, expiresAt } = await this.auth.resendPortalContact(
      currentTx(),
      ctx.tenantId,
      actorIdOf(),
      parse(uuid, id),
      parse(uuid, contactId),
    );
    await this.emailInvite(email, token, ctx.tenantSlug);
    return this.inviteResult(email, token, expiresAt);
  }

  /** Revoke a contact: deactivates the membership, ends all sessions now. Idempotent. */
  @Post("v1/suppliers/:id/portal-contacts/:contactId/revoke")
  @HttpCode(200)
  @RequireCapability("supplier:manage")
  async revokePortalContact(
    @Param("id") id: string,
    @Param("contactId") contactId: string,
  ): Promise<PortalContactDto> {
    return this.auth.revokePortalContact(
      currentTx(),
      currentContext().tenantId,
      actorIdOf(),
      parse(uuid, id),
      parse(uuid, contactId),
    );
  }

  private async emailInvite(email: string, token: string, tenantSlug: string): Promise<void> {
    const url = `${this.env.APP_BASE_URL}/invite/${encodeURIComponent(token)}?workspace=${encodeURIComponent(tenantSlug)}`;
    await this.jobs.sendEmail({
      message: {
        to: email,
        ...renderInvite({
          url,
          workspaceName: tenantSlug,
          expiresHours: Math.round(INVITATION_TTL_MS / 3_600_000),
        }),
      },
    });
  }

  /** As with the staff invite: the raw token leaves the API only outside
   *  production (no mail delivery there); in production it travels by email only. */
  private inviteResult(email: string, token: string, expiresAt: Date): PartnerInviteResult {
    return this.env.NODE_ENV === "production"
      ? { email, expiresAt: expiresAt.toISOString() }
      : { email, expiresAt: expiresAt.toISOString(), token };
  }
}
