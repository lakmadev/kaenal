import { Controller, Get, Inject, Query } from "@nestjs/common";
import { z } from "zod";
import { PageQuery, type AreaDto, type MemberDto, type MemberWorkloadDto, type Page, type PlantDto } from "@kaenal/types";
import { currentTx } from "../context.js";
import { RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import { membershipOf } from "../ncr/handler-ctx.js";
import { MEMBERS_SERVICE } from "../tokens.js";
import type { MembersService } from "./members.service.js";

/**
 * `GET /v1/members` — the tenant's people directory (id → name + role).
 *
 * Gated on `ncr:view`, which is exactly the set of INTERNAL roles
 * (admin/manager/auditor/inspector/viewer) and excludes `partner`: a supplier
 * partner must never be able to enumerate the customer's internal staff. It is
 * a read-only rendering aid — every module that shows an owner/lead/author uses
 * it to resolve ids to names — so it needs no narrower capability of its own.
 */
@Controller()
export class MembersController {
  constructor(@Inject(MEMBERS_SERVICE) private readonly members: MembersService) {}

  @Get("v1/members")
  @RequireCapability("ncr:view")
  async list(@Query() query: unknown): Promise<Page<MemberDto>> {
    const q = parse(PageQuery, query);
    return this.members.list(currentTx(), {
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  /** Sites the caller may raise records in — the CreateWizard "Site" select.
   *  Plant-scoped roles see only their own plants (same rule the create paths
   *  enforce), so the select never offers a site that would 404. */
  @Get("v1/plants")
  @RequireCapability("ncr:view")
  async plants(): Promise<{ items: PlantDto[] }> {
    return { items: await this.members.listPlants(currentTx(), membershipOf()) };
  }

  /** Areas within the caller's visible plants (Sprint 05 C1/C6) — the
   *  instrument register's plant→area cascading select and area-name display. */
  @Get("v1/areas")
  @RequireCapability("ncr:view")
  async areas(@Query() query: unknown): Promise<{ items: AreaDto[] }> {
    const q = parse(z.object({ plantId: z.string().uuid().optional() }), query);
    return { items: await this.members.listAreas(currentTx(), membershipOf(), q.plantId) };
  }

  /** The assign sheet's roster + live workload. Gated on `ncr:manage` — the
   *  people who can actually (re)assign work are the ones who see the loads. */
  @Get("v1/members/workload")
  @RequireCapability("ncr:manage")
  async workload(): Promise<{ items: MemberWorkloadDto[] }> {
    return { items: await this.members.workload(currentTx()) };
  }
}
