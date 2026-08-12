import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put } from "@nestjs/common";
import { z } from "zod";
import {
  CreateReportBody,
  UpdateReportBody,
  type Page,
  type ReportDefinitionDto,
} from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { Internal, RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import { actorIdOf, auditCtxOf } from "../ncr/handler-ctx.js";
import { REPORTS_SERVICE } from "../tokens.js";
import type { ReportsService } from "./reports.service.js";

// A report id is either a uuid (a saved report) or a `builtin-*` key.
const reportId = z.string().min(1).max(64);

/**
 * Saved reports & built-in dashboards (Data Platform B3). `@Internal`; reads
 * need `report:view`, authoring needs `report:manage` (B6 + the A3 gap — a
 * viewer can read a report but cannot reach the builder).
 */
@Internal()
@Controller()
export class ReportsController {
  constructor(@Inject(REPORTS_SERVICE) private readonly reports: ReportsService) {}

  @Get("v1/reports")
  @RequireCapability("report:view")
  async list(): Promise<Page<ReportDefinitionDto>> {
    return this.reports.list(currentTx());
  }

  @Post("v1/reports")
  @RequireCapability("report:manage")
  async create(@Body() body: unknown): Promise<ReportDefinitionDto> {
    return this.reports.create(currentTx(), currentContext().tenantId, actorIdOf(), parse(CreateReportBody, body), auditCtxOf());
  }

  @Get("v1/reports/:id")
  @RequireCapability("report:view")
  async get(@Param("id") id: string): Promise<ReportDefinitionDto> {
    return this.reports.get(currentTx(), parse(reportId, id));
  }

  @Put("v1/reports/:id")
  @RequireCapability("report:manage")
  async update(@Param("id") id: string, @Body() body: unknown): Promise<ReportDefinitionDto> {
    return this.reports.update(currentTx(), currentContext().tenantId, actorIdOf(), parse(reportId, id), parse(UpdateReportBody, body), auditCtxOf());
  }

  @Post("v1/reports/:id/delete")
  @HttpCode(200)
  @RequireCapability("report:manage")
  async remove(@Param("id") id: string): Promise<ReportDefinitionDto> {
    return this.reports.remove(currentTx(), currentContext().tenantId, actorIdOf(), parse(reportId, id), auditCtxOf());
  }
}
