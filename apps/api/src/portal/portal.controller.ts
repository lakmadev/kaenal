import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import {
  PageQuery,
  PortalEvidencePresignBody,
  PortalPpapResubmitBody,
  PortalScarRespondBody,
  type FileDto,
  type Page,
  type PortalIdentityDto,
  type PortalPpapDto,
  type PortalScarDto,
  type PresignFileResult,
} from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import { actorIdOf, auditCtxOf } from "../ncr/handler-ctx.js";
import { PORTAL_SERVICE } from "../tokens.js";
import type { PortalService } from "./portal.service.js";

const uuid = z.string().uuid();

/**
 * External supplier-portal routes (FEATURES §17, P11). Every route is
 * `portal:view` (partner-only), and the supplier scope is taken from the
 * authenticated membership — never from the request — inside the tenant-scoped
 * transaction. Read-only in this slice; audited writes (SCAR respond, PPAP
 * re-submit) are the next slice.
 */
@Controller()
export class PortalController {
  constructor(@Inject(PORTAL_SERVICE) private readonly portal: PortalService) {}

  private scope(): string | null | undefined {
    return currentContext().membership?.supplierScope;
  }

  @Get("v1/portal/me")
  @RequireCapability("portal:view")
  async identity(): Promise<PortalIdentityDto> {
    return this.portal.identity(currentTx(), this.scope());
  }

  @Get("v1/portal/scars")
  @RequireCapability("portal:view")
  async listScars(@Query() query: unknown): Promise<Page<PortalScarDto>> {
    const q = parse(PageQuery, query);
    return this.portal.listScars(currentTx(), this.scope(), {
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Get("v1/portal/scars/:id")
  @RequireCapability("portal:view")
  async getScar(@Param("id") id: string): Promise<PortalScarDto> {
    return this.portal.getScar(currentTx(), this.scope(), parse(uuid, id));
  }

  @Get("v1/portal/ppap")
  @RequireCapability("portal:view")
  async listPpap(@Query() query: unknown): Promise<Page<PortalPpapDto>> {
    const q = parse(PageQuery, query);
    return this.portal.listPpap(currentTx(), this.scope(), {
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Get("v1/portal/ppap/:id")
  @RequireCapability("portal:view")
  async getPpap(@Param("id") id: string): Promise<PortalPpapDto> {
    return this.portal.getPpap(currentTx(), this.scope(), parse(uuid, id));
  }

  @Post("v1/portal/scars/:id/respond")
  @HttpCode(200)
  @RequireCapability("portal:respond")
  async respondScar(@Param("id") id: string, @Body() body: unknown): Promise<PortalScarDto> {
    const input = parse(PortalScarRespondBody, body);
    return this.portal.respondScar(
      currentTx(),
      currentContext().tenantId,
      this.scope(),
      actorIdOf(),
      parse(uuid, id),
      input,
      auditCtxOf(),
    );
  }

  @Post("v1/portal/ppap/:id/resubmit")
  @HttpCode(200)
  @RequireCapability("portal:respond")
  async resubmitPpap(@Param("id") id: string, @Body() body: unknown): Promise<PortalPpapDto> {
    const input = parse(PortalPpapResubmitBody, body);
    return this.portal.resubmitPpap(
      currentTx(),
      currentContext().tenantId,
      this.scope(),
      actorIdOf(),
      parse(uuid, id),
      input,
      auditCtxOf(),
    );
  }

  @Post("v1/portal/files/presign")
  @RequireCapability("portal:respond")
  async presignEvidence(@Body() body: unknown): Promise<PresignFileResult> {
    const input = parse(PortalEvidencePresignBody, body);
    return this.portal.presignEvidence(
      currentTx(),
      currentContext().tenantId,
      this.scope(),
      actorIdOf(),
      input,
      auditCtxOf(),
    );
  }

  @Post("v1/portal/files/:id/complete")
  @HttpCode(200)
  @RequireCapability("portal:respond")
  async completeEvidence(@Param("id") id: string): Promise<FileDto> {
    return this.portal.completeEvidence(
      currentTx(),
      currentContext().tenantId,
      this.scope(),
      actorIdOf(),
      parse(uuid, id),
      auditCtxOf(),
    );
  }
}
