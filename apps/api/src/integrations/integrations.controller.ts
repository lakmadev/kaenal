import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put } from "@nestjs/common";
import { z } from "zod";
import {
  ConnectIntegrationBody,
  CreateIntegrationBody,
  UpdateIntegrationBody,
  type ConnectorSchemaResult,
  type IntegrationDto,
  type IntegrationEventDto,
  type Page,
} from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { Internal, RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import { actorIdOf, auditCtxOf } from "../ncr/handler-ctx.js";
import { INTEGRATIONS_SERVICE } from "../tokens.js";
import type { IntegrationsService } from "./integrations.service.js";

const uuid = z.string().uuid();

/**
 * The connector registry (09 §1). `@Internal`; reads AND writes require
 * `integration:manage` (admin only — wiring the workspace to external systems is
 * a platform-tier action, and the event log can reveal delivery detail). The
 * single substrate behind report sources, warehouse sync, bulk import, and the
 * Integrations settings screen.
 */
@Internal()
@Controller()
@RequireCapability("integration:manage")
export class IntegrationsController {
  constructor(@Inject(INTEGRATIONS_SERVICE) private readonly integrations: IntegrationsService) {}

  @Get("v1/integrations")
  async list(): Promise<Page<IntegrationDto>> {
    return this.integrations.list(currentTx());
  }

  @Post("v1/integrations")
  async create(@Body() body: unknown): Promise<IntegrationDto> {
    return this.integrations.create(currentTx(), currentContext().tenantId, actorIdOf(), parse(CreateIntegrationBody, body), auditCtxOf());
  }

  @Get("v1/integrations/:id")
  async get(@Param("id") id: string): Promise<IntegrationDto> {
    return this.integrations.get(currentTx(), parse(uuid, id));
  }

  @Get("v1/integrations/:id/schema")
  async schema(@Param("id") id: string): Promise<ConnectorSchemaResult> {
    return this.integrations.schema(parse(uuid, id), currentTx());
  }

  @Get("v1/integrations/:id/events")
  async events(@Param("id") id: string): Promise<Page<IntegrationEventDto>> {
    return this.integrations.events(currentTx(), parse(uuid, id));
  }

  @Put("v1/integrations/:id")
  async update(@Param("id") id: string, @Body() body: unknown): Promise<IntegrationDto> {
    return this.integrations.update(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), parse(UpdateIntegrationBody, body), auditCtxOf());
  }

  @Post("v1/integrations/:id/connect")
  @HttpCode(200)
  async connect(@Param("id") id: string, @Body() body: unknown): Promise<IntegrationDto> {
    return this.integrations.connect(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), parse(ConnectIntegrationBody, body), auditCtxOf());
  }

  @Post("v1/integrations/:id/disconnect")
  @HttpCode(200)
  async disconnect(@Param("id") id: string): Promise<IntegrationDto> {
    return this.integrations.disconnect(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), auditCtxOf());
  }

  @Post("v1/integrations/:id/delete")
  @HttpCode(200)
  async remove(@Param("id") id: string): Promise<IntegrationDto> {
    return this.integrations.remove(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), auditCtxOf());
  }
}
