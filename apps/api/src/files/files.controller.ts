import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { DownloadFileQuery, PresignFileBody, type DownloadFileResult, type FileDto, type PresignFileResult } from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { Internal } from "../decorators.js";
import { parse } from "../http/validate.js";
import { actorIdOf, auditCtxOf } from "../ncr/handler-ctx.js";
import { FILES_SERVICE } from "../tokens.js";
import type { FilesService } from "./files.service.js";

const uuid = z.string().uuid();

/**
 * File routes (03 §7). These carry no `@RequireCapability`: the matrix defines
 * no file capability, and files are attachments whose access is governed by
 * tenant RLS plus the AV-scan download gate rather than by role. Every route is
 * still authenticated (default-deny — a route without `@Public` needs a
 * session), so only a tenant member reaches them.
 *
 * `@Internal` (class-level) additionally refuses an external `partner`: with no
 * capability to gate on, a partner session would otherwise reach these routes
 * and, under tenant RLS, presign against any entity or download any clean file
 * in the tenant. A partner's only sanctioned upload path is the supplier-scoped
 * `/v1/portal/files/*`.
 */
@Internal()
@Controller()
export class FilesController {
  constructor(@Inject(FILES_SERVICE) private readonly files: FilesService) {}

  @Post("v1/files/presign")
  async presign(@Body() body: unknown): Promise<PresignFileResult> {
    const input = parse(PresignFileBody, body);
    return this.files.presign(currentTx(), currentContext().tenantId, actorIdOf(), input, auditCtxOf());
  }

  @Post("v1/files/:id/complete")
  @HttpCode(200)
  async complete(@Param("id") id: string): Promise<FileDto> {
    return this.files.complete(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), auditCtxOf());
  }

  @Get("v1/files/:id")
  async get(@Param("id") id: string): Promise<FileDto> {
    return this.files.get(currentTx(), parse(uuid, id));
  }

  @Get("v1/files/:id/download")
  async download(@Param("id") id: string, @Query() query: unknown): Promise<DownloadFileResult> {
    const q = parse(DownloadFileQuery, query);
    return this.files.download(
      currentTx(),
      currentContext().tenantId,
      actorIdOf(),
      parse(uuid, id),
      auditCtxOf(),
      q.disposition,
    );
  }
}
