import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { z } from "zod";
import {
  AttachCertificateBody,
  CalibrationEventListQuery,
  CreateCalibrationEventBody,
  CreateInstrumentBody,
  InstrumentListQuery,
  RaiseNcrFromCalibrationBody,
  RetireInstrumentBody,
  UpdateInstrumentBody,
  type CalibrationEventDto,
  type InstrumentDto,
  type InstrumentSummaryDto,
  type NcrDto,
  type Page,
} from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import type { IdempotencyStore } from "../http/idempotency.js";
import { actorIdOf, auditCtxOf, membershipOf } from "../ncr/handler-ctx.js";
import { IDEMPOTENCY, INSTRUMENTS_SERVICE } from "../tokens.js";
import type { InstrumentsService } from "./instruments.service.js";

const uuid = z.string().uuid();

/**
 * Calibration instrument register + event routes (Sprint 05 C1-C6). Reads
 * need `calibration:view`, writes `calibration:manage`. `/v1/instruments/summary`
 * is registered before `/v1/instruments/:id` so the literal path is never
 * shadowed by the param route.
 */
@Controller()
export class InstrumentsController {
  constructor(
    @Inject(INSTRUMENTS_SERVICE) private readonly instruments: InstrumentsService,
    @Inject(IDEMPOTENCY) private readonly idempotency: IdempotencyStore,
  ) {}

  @Get("v1/instruments")
  @RequireCapability("calibration:view")
  async list(@Query() query: unknown): Promise<Page<InstrumentDto>> {
    const q = parse(InstrumentListQuery, query);
    return this.instruments.list(currentTx(), membershipOf(), {
      ...(q.type !== undefined ? { type: q.type } : {}),
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.dueStatus !== undefined ? { dueStatus: q.dueStatus } : {}),
      ...(q.plantId !== undefined ? { plantId: q.plantId } : {}),
      ...(q.q !== undefined ? { q: q.q } : {}),
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Get("v1/instruments/summary")
  @RequireCapability("calibration:view")
  async summary(): Promise<InstrumentSummaryDto> {
    return this.instruments.summary(currentTx(), currentContext().tenantId, membershipOf());
  }

  @Post("v1/instruments")
  @RequireCapability("calibration:manage")
  async create(
    @Body() body: unknown,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<InstrumentDto> {
    const input = parse(CreateInstrumentBody, body);
    const ctx = currentContext();
    const actorId = actorIdOf();
    const { result } = await this.idempotency.run(`${ctx.tenantId}:create-instrument`, idempotencyKey, () =>
      this.instruments.create(currentTx(), ctx.tenantId, actorId, input, auditCtxOf()),
    );
    return result;
  }

  @Get("v1/instruments/:id")
  @RequireCapability("calibration:view")
  async get(@Param("id") id: string): Promise<InstrumentDto> {
    return this.instruments.get(currentTx(), membershipOf(), actorIdOf(), parse(uuid, id));
  }

  @Patch("v1/instruments/:id")
  @RequireCapability("calibration:manage")
  async update(@Param("id") id: string, @Body() body: unknown): Promise<InstrumentDto> {
    return this.instruments.update(
      currentTx(),
      currentContext().tenantId,
      membershipOf(),
      actorIdOf(),
      parse(uuid, id),
      parse(UpdateInstrumentBody, body),
      auditCtxOf(),
    );
  }

  @Patch("v1/instruments/:id/retire")
  @RequireCapability("calibration:manage")
  async retire(@Param("id") id: string, @Body() body: unknown): Promise<InstrumentDto> {
    return this.instruments.retire(
      currentTx(),
      currentContext().tenantId,
      membershipOf(),
      actorIdOf(),
      parse(uuid, id),
      parse(RetireInstrumentBody, body),
      auditCtxOf(),
    );
  }

  @Get("v1/instruments/:id/calibration-events")
  @RequireCapability("calibration:view")
  async listCalibrationEvents(
    @Param("id") id: string,
    @Query() query: unknown,
  ): Promise<Page<CalibrationEventDto>> {
    const q = parse(CalibrationEventListQuery, query);
    return this.instruments.listCalibrationEvents(currentTx(), membershipOf(), actorIdOf(), parse(uuid, id), {
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Post("v1/instruments/:id/calibration-events")
  @RequireCapability("calibration:manage")
  async recordCalibrationEvent(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<CalibrationEventDto> {
    const input = parse(CreateCalibrationEventBody, body);
    const ctx = currentContext();
    const actorId = actorIdOf();
    const instrumentId = parse(uuid, id);
    const { result } = await this.idempotency.run(
      `${ctx.tenantId}:record-calibration-event:${instrumentId}`,
      idempotencyKey,
      () =>
        this.instruments.recordCalibrationEvent(
          currentTx(),
          ctx.tenantId,
          membershipOf(),
          actorId,
          instrumentId,
          input,
          auditCtxOf(),
        ),
    );
    return result;
  }

  @Put("v1/instruments/:instrumentId/calibration-events/:eventId/certificate")
  @RequireCapability("calibration:manage")
  async attachCertificate(
    @Param("instrumentId") instrumentId: string,
    @Param("eventId") eventId: string,
    @Body() body: unknown,
  ): Promise<CalibrationEventDto> {
    return this.instruments.attachCertificate(
      currentTx(),
      currentContext().tenantId,
      membershipOf(),
      actorIdOf(),
      parse(uuid, instrumentId),
      parse(uuid, eventId),
      parse(AttachCertificateBody, body),
      auditCtxOf(),
    );
  }

  @Post("v1/instruments/:instrumentId/calibration-events/:eventId/raise-ncr")
  @RequireCapability("calibration:manage")
  async raiseNcr(
    @Param("instrumentId") instrumentId: string,
    @Param("eventId") eventId: string,
    @Body() body: unknown,
  ): Promise<NcrDto> {
    parse(RaiseNcrFromCalibrationBody, body);
    return this.instruments.raiseNcr(
      currentTx(),
      currentContext().tenantId,
      membershipOf(),
      actorIdOf(),
      parse(uuid, instrumentId),
      parse(uuid, eventId),
      auditCtxOf(),
    );
  }
}
