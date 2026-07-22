import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import {
  CreateDocumentBody,
  DocumentCategory,
  DocumentStatus,
  NewDocumentVersionBody,
  PageQuery,
  ReviewDocumentBody,
  TransitionDocumentBody,
  type DocumentDto,
  type DocumentVersionDto,
  type Page,
} from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import { actorIdOf, auditCtxOf, membershipOf } from "../ncr/handler-ctx.js";
import { DOCUMENTS_SERVICE } from "../tokens.js";
import type { DocumentsService } from "./documents.service.js";

const uuid = z.string().uuid();
const ListQuery = PageQuery.extend({
  status: DocumentStatus.optional(),
  category: DocumentCategory.optional(),
});

/**
 * Document routes (03 §1, §3). Viewing needs `document:view` (every role);
 * authoring the lifecycle (create/submit/revise/archive/new-version) needs
 * `document:manage`; approving or rejecting has its own `document:approve` — the
 * split lets the four-eyes rule land on a different person than the author, and
 * keeps approval reachable by exactly the roles the matrix allows.
 */
@Controller()
export class DocumentsController {
  constructor(@Inject(DOCUMENTS_SERVICE) private readonly documents: DocumentsService) {}

  @Get("v1/documents")
  @RequireCapability("document:view")
  async list(@Query() query: unknown): Promise<Page<DocumentDto>> {
    const q = parse(ListQuery, query);
    return this.documents.list(currentTx(), {
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.category !== undefined ? { category: q.category } : {}),
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Post("v1/documents")
  @RequireCapability("document:manage")
  async create(@Body() body: unknown): Promise<DocumentDto> {
    const input = parse(CreateDocumentBody, body);
    return this.documents.create(currentTx(), currentContext().tenantId, actorIdOf(), input, auditCtxOf());
  }

  @Get("v1/documents/:id")
  @RequireCapability("document:view")
  async get(@Param("id") id: string): Promise<DocumentDto> {
    return this.documents.get(currentTx(), parse(uuid, id));
  }

  @Post("v1/documents/:id/transition")
  @HttpCode(200)
  @RequireCapability("document:manage")
  async transition(@Param("id") id: string, @Body() body: unknown): Promise<DocumentDto> {
    const input = parse(TransitionDocumentBody, body);
    return this.documents.transition(
      currentTx(),
      currentContext().tenantId,
      membershipOf(),
      actorIdOf(),
      parse(uuid, id),
      input,
      auditCtxOf(),
    );
  }

  @Post("v1/documents/:id/review")
  @HttpCode(200)
  @RequireCapability("document:approve")
  async review(@Param("id") id: string, @Body() body: unknown): Promise<DocumentDto> {
    const input = parse(ReviewDocumentBody, body);
    return this.documents.review(
      currentTx(),
      currentContext().tenantId,
      membershipOf(),
      actorIdOf(),
      parse(uuid, id),
      input,
      auditCtxOf(),
    );
  }

  @Get("v1/documents/:id/versions")
  @RequireCapability("document:view")
  async listVersions(@Param("id") id: string, @Query() query: unknown): Promise<Page<DocumentVersionDto>> {
    const q = parse(PageQuery, query);
    return this.documents.listVersions(currentTx(), parse(uuid, id), {
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Post("v1/documents/:id/versions")
  @RequireCapability("document:manage")
  async newVersion(@Param("id") id: string, @Body() body: unknown): Promise<DocumentDto> {
    const input = parse(NewDocumentVersionBody, body);
    return this.documents.newVersion(
      currentTx(),
      currentContext().tenantId,
      actorIdOf(),
      parse(uuid, id),
      input,
      auditCtxOf(),
    );
  }
}
