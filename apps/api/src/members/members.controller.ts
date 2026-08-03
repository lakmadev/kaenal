import { Controller, Get, Inject, Query } from "@nestjs/common";
import { PageQuery, type MemberDto, type Page } from "@kaenal/types";
import { currentTx } from "../context.js";
import { RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
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
}
