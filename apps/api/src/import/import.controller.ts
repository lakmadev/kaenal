import { Body, Controller, Get, HttpCode, Inject, Param, Post } from "@nestjs/common";
import { z } from "zod";
import {
  CommitImportRunBody,
  CreateImportProfileBody,
  CreateImportRunBody,
  type ImportProfileDto,
  type ImportRunDto,
  type ImportTargetsResult,
  type Page,
} from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { Internal, RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import { actorIdOf, auditCtxOf } from "../ncr/handler-ctx.js";
import { IMPORT_SERVICE } from "../tokens.js";
import type { ImportService } from "./import.service.js";

const uuid = z.string().uuid();

/**
 * Bulk-import pipeline (09 §6; operations.jsx `BulkImport`). `@Internal`; the
 * whole surface — target schema, profiles, run create/validate/commit — needs
 * `import:run` (admin + manager, the masters-data authors). A run create is the
 * Validate + Dry-run stage (nothing written); commit is the only write path and
 * is idempotent by natural key.
 */
@Internal()
@Controller()
@RequireCapability("import:run")
export class ImportController {
  constructor(@Inject(IMPORT_SERVICE) private readonly imports: ImportService) {}

  @Get("v1/import/targets")
  targets(): ImportTargetsResult {
    return this.imports.targets();
  }

  @Get("v1/import/profiles")
  async listProfiles(): Promise<Page<ImportProfileDto>> {
    return this.imports.listProfiles(currentTx());
  }

  @Post("v1/import/profiles")
  async createProfile(@Body() body: unknown): Promise<ImportProfileDto> {
    return this.imports.createProfile(currentTx(), currentContext().tenantId, actorIdOf(), parse(CreateImportProfileBody, body), auditCtxOf());
  }

  @Post("v1/import/profiles/:id/delete")
  @HttpCode(200)
  async removeProfile(@Param("id") id: string): Promise<ImportProfileDto> {
    return this.imports.removeProfile(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), auditCtxOf());
  }

  @Get("v1/import/runs")
  async listRuns(): Promise<Page<ImportRunDto>> {
    return this.imports.listRuns(currentTx());
  }

  @Post("v1/import/runs")
  async createRun(@Body() body: unknown): Promise<ImportRunDto> {
    return this.imports.createRun(currentTx(), currentContext().tenantId, actorIdOf(), parse(CreateImportRunBody, body), auditCtxOf());
  }

  @Get("v1/import/runs/:id")
  async getRun(@Param("id") id: string): Promise<ImportRunDto> {
    return this.imports.getRun(currentTx(), parse(uuid, id));
  }

  @Post("v1/import/runs/:id/commit")
  @HttpCode(200)
  async commit(@Param("id") id: string, @Body() body: unknown): Promise<ImportRunDto> {
    return this.imports.commit(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), parse(CommitImportRunBody, body), auditCtxOf());
  }
}
