import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put } from "@nestjs/common";
import { z } from "zod";
import {
  CreateNcrValidationRuleBody,
  UpdateBrandingBody,
  UpdateNcrValidationRuleBody,
  type BrandingDto,
  type NcrValidationRuleDto,
  type Page,
} from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { Internal, RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import { actorIdOf, auditCtxOf } from "../ncr/handler-ctx.js";
import { NCR_RULES_SERVICE, SETTINGS_SERVICE } from "../tokens.js";
import type { SettingsService } from "./settings.service.js";
import type { NcrRulesService } from "./ncr-rules.service.js";

const uuid = z.string().uuid();

/**
 * Workspace settings routes. `@Internal`: a supplier-portal partner has no
 * business reading or writing workspace branding. The GET carries no capability
 * — any member's shell reads branding to render the tenant label — while the PUT
 * requires `settings:manage` (admins + managers), the same gate as SLA/templates.
 */
@Internal()
@Controller()
export class SettingsController {
  constructor(
    @Inject(SETTINGS_SERVICE) private readonly settings: SettingsService,
    @Inject(NCR_RULES_SERVICE) private readonly ncrRules: NcrRulesService,
  ) {}

  @Get("v1/settings/branding")
  async getBranding(): Promise<BrandingDto> {
    return this.settings.getBranding(currentTx());
  }

  @Put("v1/settings/branding")
  @RequireCapability("settings:manage")
  async updateBranding(@Body() body: unknown): Promise<BrandingDto> {
    const input = parse(UpdateBrandingBody, body);
    return this.settings.updateBranding(
      currentTx(),
      currentContext().tenantId,
      actorIdOf(),
      input,
      auditCtxOf(),
    );
  }

  // --- NCR validation rules ------------------------------------------------
  @Get("v1/settings/ncr-validation-rules")
  async listNcrRules(): Promise<Page<NcrValidationRuleDto>> {
    return this.ncrRules.list(currentTx());
  }

  @Post("v1/settings/ncr-validation-rules")
  @RequireCapability("settings:manage")
  async createNcrRule(@Body() body: unknown): Promise<NcrValidationRuleDto> {
    const input = parse(CreateNcrValidationRuleBody, body);
    return this.ncrRules.create(currentTx(), currentContext().tenantId, actorIdOf(), input, auditCtxOf());
  }

  @Put("v1/settings/ncr-validation-rules/:id")
  @RequireCapability("settings:manage")
  async updateNcrRule(@Param("id") id: string, @Body() body: unknown): Promise<NcrValidationRuleDto> {
    const input = parse(UpdateNcrValidationRuleBody, body);
    return this.ncrRules.update(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), input, auditCtxOf());
  }

  @Post("v1/settings/ncr-validation-rules/:id/delete")
  @HttpCode(200)
  @RequireCapability("settings:manage")
  async deleteNcrRule(@Param("id") id: string): Promise<NcrValidationRuleDto> {
    return this.ncrRules.remove(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), auditCtxOf());
  }
}
