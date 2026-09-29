import { Body, Controller, Get, Headers, Inject, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import {
  CreateTrainingRecordBody,
  TrainingGapsQuery,
  TrainingMatrixQuery,
  TrainingRecordsQuery,
  type CreateTrainingRecordResult,
  type Page,
  type TrainingGapDto,
  type TrainingMatrixRowDto,
  type TrainingRecordDto,
  type TrainingSummaryDto,
} from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import type { IdempotencyStore } from "../http/idempotency.js";
import { actorIdOf, auditCtxOf, membershipOf } from "../ncr/handler-ctx.js";
import { IDEMPOTENCY, TRAINING_SERVICE } from "../tokens.js";
import type { TrainingService } from "./training.service.js";

const uuid = z.string().uuid();

/**
 * Training matrix + records routes (Sprint 05 T1-T4). Reads need
 * `training:view`, writes `training:manage`. `/v1/training/summary`,
 * `/v1/training/gaps`, and `/v1/training/records` are all literal siblings of
 * the matrix route, not param routes, so there is no shadowing concern.
 */
@Controller()
export class TrainingController {
  constructor(
    @Inject(TRAINING_SERVICE) private readonly training: TrainingService,
    @Inject(IDEMPOTENCY) private readonly idempotency: IdempotencyStore,
  ) {}

  @Get("v1/training/matrix")
  @RequireCapability("training:view")
  async matrix(@Query() query: unknown): Promise<Page<TrainingMatrixRowDto>> {
    const q = parse(TrainingMatrixQuery, query);
    return this.training.matrix(currentTx(), currentContext().tenantId, membershipOf(), {
      ...(q.mandatoryOnly !== undefined ? { mandatoryOnly: q.mandatoryOnly } : {}),
      ...(q.gapsOnly !== undefined ? { gapsOnly: q.gapsOnly } : {}),
      ...(q.q !== undefined ? { q: q.q } : {}),
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Get("v1/training/summary")
  @RequireCapability("training:view")
  async summary(): Promise<TrainingSummaryDto> {
    return this.training.summary(currentTx(), currentContext().tenantId, membershipOf());
  }

  @Get("v1/training/gaps")
  @RequireCapability("training:view")
  async gaps(@Query() query: unknown): Promise<Page<TrainingGapDto>> {
    const q = parse(TrainingGapsQuery, query);
    return this.training.gaps(currentTx(), currentContext().tenantId, membershipOf(), {
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Post("v1/training/records")
  @RequireCapability("training:manage")
  async recordTraining(
    @Body() body: unknown,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<CreateTrainingRecordResult> {
    const input = parse(CreateTrainingRecordBody, body);
    const ctx = currentContext();
    const actorId = actorIdOf();
    const { result } = await this.idempotency.run(`${ctx.tenantId}:record-training`, idempotencyKey, () =>
      this.training.recordTraining(currentTx(), ctx.tenantId, actorId, input, auditCtxOf()),
    );
    return result;
  }

  @Get("v1/training/records")
  @RequireCapability("training:view")
  async listRecords(@Query() query: unknown): Promise<Page<TrainingRecordDto>> {
    const q = parse(TrainingRecordsQuery, query);
    return this.training.listRecords(currentTx(), membershipOf(), actorIdOf(), {
      memberId: q.memberId,
      ...(q.competencyId !== undefined ? { competencyId: q.competencyId } : {}),
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Get("v1/training/records/:id")
  @RequireCapability("training:view")
  async getRecord(@Param("id") id: string): Promise<TrainingRecordDto> {
    return this.training.getRecord(currentTx(), membershipOf(), actorIdOf(), parse(uuid, id));
  }
}
