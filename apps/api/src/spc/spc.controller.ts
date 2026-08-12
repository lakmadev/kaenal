import { Body, Controller, Get, Inject, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { IngestMeasurementsBody, type SpcChartDto, type SpcCharacteristicsResult } from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { Internal, RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import { actorIdOf, auditCtxOf } from "../ncr/handler-ctx.js";
import { SPC_SERVICE } from "../tokens.js";
import type { SpcService } from "./spc.service.js";

const chartQuery = z.object({ part: z.string().min(1), characteristic: z.string().min(1) });

/**
 * SPC analytics (B5; qms-risk-spc.jsx). `@Internal`. Reads (characteristics +
 * the computed chart) need `spc:view` — every internal role sees quality
 * analytics; ingesting measurements needs `measurement:manage` (a method-level
 * override of the class capability). The chart math lives in `@kaenal/core`.
 */
@Internal()
@Controller()
@RequireCapability("spc:view")
export class SpcController {
  constructor(@Inject(SPC_SERVICE) private readonly spc: SpcService) {}

  @Get("v1/spc/characteristics")
  async characteristics(): Promise<SpcCharacteristicsResult> {
    return this.spc.characteristics(currentTx());
  }

  @Get("v1/spc/chart")
  async chart(@Query() query: unknown): Promise<SpcChartDto> {
    const { part, characteristic } = parse(chartQuery, query);
    return this.spc.chart(currentTx(), part, characteristic);
  }

  @Post("v1/spc/measurements")
  @RequireCapability("measurement:manage")
  async ingest(@Body() body: unknown): Promise<{ inserted: number }> {
    return this.spc.ingest(currentTx(), currentContext().tenantId, actorIdOf(), parse(IngestMeasurementsBody, body), auditCtxOf());
  }
}
