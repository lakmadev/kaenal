import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import {
  CreateSupplierBody,
  PageQuery,
  RiskLevel,
  ScorecardWeightsQuery,
  SupplierStatus,
  UpdateSupplierBody,
  type Page,
  type SupplierDto,
} from "@kaenal/types";
import { DEFAULT_SCORE_WEIGHTS, type ScoreWeights } from "@kaenal/core";
import { currentContext, currentTx } from "../context.js";
import { RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import { actorIdOf, auditCtxOf } from "../ncr/handler-ctx.js";
import { SUPPLIERS_SERVICE } from "../tokens.js";
import type { SuppliersService } from "./suppliers.service.js";

const uuid = z.string().uuid();
const ListQuery = PageQuery.extend({
  status: SupplierStatus.optional(),
  riskTier: RiskLevel.optional(),
  tier: z.coerce.number().int().optional(),
  category: z.string().optional(),
  country: z.string().optional(),
  flag: z.string().optional(),
  q: z.string().optional(),
});

/**
 * Supplier routes (FEATURES §11.1). `supplier:view` reads (everyone);
 * `supplier:manage` (admin/manager) creates and edits. Suppliers are tenant-wide
 * (not plant-scoped), so isolation is RLS alone. The scorecard route re-weights
 * the same records per request from query-param weights.
 */
@Controller()
export class SuppliersController {
  constructor(@Inject(SUPPLIERS_SERVICE) private readonly suppliers: SuppliersService) {}

  @Get("v1/suppliers")
  @RequireCapability("supplier:view")
  async list(@Query() query: unknown): Promise<Page<SupplierDto>> {
    const q = parse(ListQuery, query);
    return this.suppliers.list(currentTx(), {
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.riskTier !== undefined ? { riskTier: q.riskTier } : {}),
      ...(q.tier !== undefined ? { tier: q.tier } : {}),
      ...(q.category !== undefined ? { category: q.category } : {}),
      ...(q.country !== undefined ? { country: q.country } : {}),
      ...(q.flag !== undefined ? { flag: q.flag } : {}),
      ...(q.q !== undefined ? { q: q.q } : {}),
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Get("v1/supplier-scorecard")
  @RequireCapability("supplier:view")
  async scorecard(@Query() query: unknown): Promise<Page<SupplierDto>> {
    const q = parse(ScorecardWeightsQuery, query);
    const weights: ScoreWeights = {
      ppm: q.wPpm ?? DEFAULT_SCORE_WEIGHTS.ppm,
      otd: q.wOtd ?? DEFAULT_SCORE_WEIGHTS.otd,
      oqe: q.wOqe ?? DEFAULT_SCORE_WEIGHTS.oqe,
      scar: q.wScar ?? DEFAULT_SCORE_WEIGHTS.scar,
    };
    return this.suppliers.scorecard(currentTx(), weights);
  }

  @Post("v1/suppliers")
  @RequireCapability("supplier:manage")
  async create(@Body() body: unknown): Promise<SupplierDto> {
    const input = parse(CreateSupplierBody, body);
    return this.suppliers.create(currentTx(), currentContext().tenantId, actorIdOf(), input, auditCtxOf());
  }

  @Get("v1/suppliers/:id")
  @RequireCapability("supplier:view")
  async get(@Param("id") id: string): Promise<SupplierDto> {
    return this.suppliers.get(currentTx(), parse(uuid, id));
  }

  @Post("v1/suppliers/:id")
  @HttpCode(200)
  @RequireCapability("supplier:manage")
  async update(@Param("id") id: string, @Body() body: unknown): Promise<SupplierDto> {
    const input = parse(UpdateSupplierBody, body);
    return this.suppliers.update(
      currentTx(),
      currentContext().tenantId,
      actorIdOf(),
      parse(uuid, id),
      input,
      auditCtxOf(),
    );
  }
}
