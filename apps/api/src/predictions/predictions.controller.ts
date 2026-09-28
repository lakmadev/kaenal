import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { z } from "zod";
import {
  PageQuery,
  PredictionSubjectKind,
  type Page,
  type PredictionDetailResponse,
  type RiskPredictionDto,
} from "@kaenal/types";
import { currentTx } from "../context.js";
import { RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import { PREDICTIONS_SERVICE } from "../tokens.js";
import type { PredictionsService } from "./predictions.service.js";

const ListQuery = PageQuery.extend({
  subjectKind: PredictionSubjectKind.optional(),
  horizon: z.string().min(1).max(32).optional(),
  order: z.enum(["predicted_value", "created_at"]).optional(),
});
const DetailParams = z.object({ subjectKind: PredictionSubjectKind, id: z.string().uuid() });

/**
 * Predictive risk routes (Sprint 03 Part B, §2B P2). Read-only end to end —
 * the nightly `predict-risk` job (packages/core/forecast.ts) owns the data,
 * so there is deliberately no POST/PATCH route here. `prediction:view` gates
 * both routes (admin/manager/auditor, mirrors `audit:view`).
 */
@Controller()
export class PredictionsController {
  constructor(@Inject(PREDICTIONS_SERVICE) private readonly predictions: PredictionsService) {}

  @Get("v1/predictions")
  @RequireCapability("prediction:view")
  async list(@Query() query: unknown): Promise<Page<RiskPredictionDto>> {
    const q = parse(ListQuery, query);
    return this.predictions.list(currentTx(), {
      ...(q.subjectKind !== undefined ? { subjectKind: q.subjectKind } : {}),
      ...(q.horizon !== undefined ? { horizon: q.horizon } : {}),
      ...(q.order !== undefined ? { order: q.order } : {}),
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Get("v1/predictions/:subjectKind/:id")
  @RequireCapability("prediction:view")
  async detail(@Param() params: unknown): Promise<PredictionDetailResponse> {
    const p = parse(DetailParams, params);
    return this.predictions.detail(currentTx(), p.subjectKind, p.id);
  }
}
