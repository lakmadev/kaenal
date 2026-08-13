import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put } from "@nestjs/common";
import { z } from "zod";
import {
  CreateFmeaBody,
  CreateFmeaItemBody,
  UpdateFmeaBody,
  UpdateFmeaItemBody,
  type FmeaDto,
  type FmeaItemDto,
  type Page,
} from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { Internal, RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import { actorIdOf, auditCtxOf } from "../ncr/handler-ctx.js";
import { FMEA_SERVICE } from "../tokens.js";
import type { FmeaService } from "./fmea.service.js";

const uuid = z.string().uuid();

/**
 * FMEA workbench routes (04 §FMEA). `@Internal`: a supplier-portal partner has no
 * FMEA capability anyway, but the guard makes the boundary explicit. Reads need
 * `fmea:view`, writes `fmea:manage`.
 */
@Internal()
@Controller()
export class FmeaController {
  constructor(@Inject(FMEA_SERVICE) private readonly fmea: FmeaService) {}

  @Get("v1/fmeas")
  @RequireCapability("fmea:view")
  async list(): Promise<Page<FmeaDto>> {
    return this.fmea.list(currentTx());
  }

  @Post("v1/fmeas")
  @RequireCapability("fmea:manage")
  async create(@Body() body: unknown): Promise<FmeaDto> {
    return this.fmea.create(currentTx(), currentContext().tenantId, actorIdOf(), parse(CreateFmeaBody, body), auditCtxOf());
  }

  @Get("v1/fmeas/:id")
  @RequireCapability("fmea:view")
  async get(@Param("id") id: string): Promise<FmeaDto> {
    return this.fmea.get(currentTx(), parse(uuid, id));
  }

  @Put("v1/fmeas/:id")
  @RequireCapability("fmea:manage")
  async update(@Param("id") id: string, @Body() body: unknown): Promise<FmeaDto> {
    return this.fmea.update(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), parse(UpdateFmeaBody, body), auditCtxOf());
  }

  @Post("v1/fmeas/:id/delete")
  @HttpCode(200)
  @RequireCapability("fmea:manage")
  async remove(@Param("id") id: string): Promise<FmeaDto> {
    return this.fmea.remove(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), auditCtxOf());
  }

  @Get("v1/fmeas/:id/items")
  @RequireCapability("fmea:view")
  async listItems(@Param("id") id: string): Promise<Page<FmeaItemDto>> {
    return this.fmea.listItems(currentTx(), parse(uuid, id));
  }

  @Post("v1/fmeas/:id/items")
  @RequireCapability("fmea:manage")
  async createItem(@Param("id") id: string, @Body() body: unknown): Promise<FmeaItemDto> {
    return this.fmea.createItem(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), parse(CreateFmeaItemBody, body), auditCtxOf());
  }

  @Put("v1/fmeas/:id/items/:itemId")
  @RequireCapability("fmea:manage")
  async updateItem(@Param("id") id: string, @Param("itemId") itemId: string, @Body() body: unknown): Promise<FmeaItemDto> {
    return this.fmea.updateItem(
      currentTx(),
      currentContext().tenantId,
      actorIdOf(),
      parse(uuid, id),
      parse(uuid, itemId),
      parse(UpdateFmeaItemBody, body),
      auditCtxOf(),
    );
  }

  @Post("v1/fmeas/:id/items/:itemId/delete")
  @HttpCode(200)
  @RequireCapability("fmea:manage")
  async removeItem(@Param("id") id: string, @Param("itemId") itemId: string): Promise<FmeaItemDto> {
    return this.fmea.removeItem(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), parse(uuid, itemId), auditCtxOf());
  }
}
