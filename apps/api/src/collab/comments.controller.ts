import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import {
  CreateCommentBody,
  EntityRefQuery,
  PageQuery,
  type CommentDto,
  type Page,
} from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { Internal } from "../decorators.js";
import { parse } from "../http/validate.js";
import { actorIdOf, auditCtxOf } from "../ncr/handler-ctx.js";
import { COMMENTS_SERVICE } from "../tokens.js";
import type { CommentsService } from "./comments.service.js";

const uuid = z.string().uuid();
const ListQuery = EntityRefQuery.merge(PageQuery);

/**
 * Comment routes (FEATURES §9). No `@RequireCapability`: like notifications,
 * these are collaboration on records the caller can already see — every method
 * runs in the tenant-scoped transaction (default-deny requires a session) and
 * the service re-checks that the parent record is visible, so isolation holds
 * without a bespoke capability. `@Internal`: a `partner` records a SCAR comment
 * only through the portal's respond flow (PortalService), never this controller.
 */
@Internal()
@Controller()
export class CommentsController {
  constructor(@Inject(COMMENTS_SERVICE) private readonly comments: CommentsService) {}

  @Get("v1/comments")
  async list(@Query() query: unknown): Promise<Page<CommentDto>> {
    const q = parse(ListQuery, query);
    return this.comments.list(currentTx(), q.entityKind, q.entityId, {
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Post("v1/comments")
  async create(@Body() body: unknown): Promise<CommentDto> {
    const input = parse(CreateCommentBody, body);
    return this.comments.create(currentTx(), currentContext().tenantId, actorIdOf(), input, auditCtxOf());
  }

  @Post("v1/comments/:id/delete")
  @HttpCode(200)
  async remove(@Param("id") id: string): Promise<CommentDto> {
    return this.comments.remove(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), auditCtxOf());
  }
}
