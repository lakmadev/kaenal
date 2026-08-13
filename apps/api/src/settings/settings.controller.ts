import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put } from "@nestjs/common";
import { z } from "zod";
import {
  AssignCostCenterBody,
  CreateCostCenterBody,
  CreateDlpPolicyBody,
  CreateLegalHoldBody,
  CreateNcrValidationRuleBody,
  UpdateBrandingBody,
  UpdateChargebackSettingsBody,
  UpdateCostCenterBody,
  UpdateDlpPolicyBody,
  UpdateLegalHoldBody,
  UpdateNcrValidationRuleBody,
  UpdateSessionPolicyBody,
  type BrandingDto,
  type ChargebackReportDto,
  type ChargebackSettingsDto,
  type CostCenterAssignmentDto,
  type CostCenterDto,
  type DlpPolicyDto,
  type LegalHoldDto,
  type NcrValidationRuleDto,
  type Page,
  type SessionPolicyDto,
} from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { Internal, RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import { actorIdOf, auditCtxOf } from "../ncr/handler-ctx.js";
import {
  COST_CENTERS_SERVICE,
  DLP_POLICIES_SERVICE,
  LEGAL_HOLDS_SERVICE,
  NCR_RULES_SERVICE,
  SETTINGS_SERVICE,
} from "../tokens.js";
import type { SettingsService } from "./settings.service.js";
import type { NcrRulesService } from "./ncr-rules.service.js";
import type { LegalHoldsService } from "./legal-holds.service.js";
import type { DlpPoliciesService } from "./dlp-policies.service.js";
import type { CostCentersService } from "./cost-centers.service.js";

const uuid = z.string().uuid();
const versionBody = z.object({ version: z.number().int().nonnegative() });

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
    @Inject(LEGAL_HOLDS_SERVICE) private readonly legalHolds: LegalHoldsService,
    @Inject(DLP_POLICIES_SERVICE) private readonly dlpPolicies: DlpPoliciesService,
    @Inject(COST_CENTERS_SERVICE) private readonly costCenters: CostCentersService,
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

  // --- Session policy ------------------------------------------------------
  @Get("v1/settings/session-policy")
  async getSessionPolicy(): Promise<SessionPolicyDto> {
    return this.settings.getSessionPolicy(currentTx());
  }

  @Put("v1/settings/session-policy")
  @RequireCapability("settings:manage")
  async updateSessionPolicy(@Body() body: unknown): Promise<SessionPolicyDto> {
    const input = parse(UpdateSessionPolicyBody, body);
    return this.settings.updateSessionPolicy(
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

  // --- Legal holds ---------------------------------------------------------
  @Get("v1/settings/legal-holds")
  @RequireCapability("settings:manage")
  async listLegalHolds(): Promise<Page<LegalHoldDto>> {
    return this.legalHolds.list(currentTx());
  }

  @Post("v1/settings/legal-holds")
  @RequireCapability("settings:manage")
  async createLegalHold(@Body() body: unknown): Promise<LegalHoldDto> {
    const input = parse(CreateLegalHoldBody, body);
    return this.legalHolds.create(currentTx(), currentContext().tenantId, actorIdOf(), input, auditCtxOf());
  }

  @Put("v1/settings/legal-holds/:id")
  @RequireCapability("settings:manage")
  async updateLegalHold(@Param("id") id: string, @Body() body: unknown): Promise<LegalHoldDto> {
    const input = parse(UpdateLegalHoldBody, body);
    return this.legalHolds.update(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), input, auditCtxOf());
  }

  @Post("v1/settings/legal-holds/:id/release")
  @HttpCode(200)
  @RequireCapability("settings:manage")
  async releaseLegalHold(@Param("id") id: string, @Body() body: unknown): Promise<LegalHoldDto> {
    const { version } = parse(versionBody, body);
    return this.legalHolds.release(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), version, auditCtxOf());
  }

  @Post("v1/settings/legal-holds/:id/delete")
  @HttpCode(200)
  @RequireCapability("settings:manage")
  async deleteLegalHold(@Param("id") id: string): Promise<LegalHoldDto> {
    return this.legalHolds.remove(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), auditCtxOf());
  }

  // --- DLP policies --------------------------------------------------------
  @Get("v1/settings/dlp-policies")
  @RequireCapability("settings:manage")
  async listDlpPolicies(): Promise<Page<DlpPolicyDto>> {
    return this.dlpPolicies.list(currentTx());
  }

  @Post("v1/settings/dlp-policies")
  @RequireCapability("settings:manage")
  async createDlpPolicy(@Body() body: unknown): Promise<DlpPolicyDto> {
    const input = parse(CreateDlpPolicyBody, body);
    return this.dlpPolicies.create(currentTx(), currentContext().tenantId, actorIdOf(), input, auditCtxOf());
  }

  @Put("v1/settings/dlp-policies/:id")
  @RequireCapability("settings:manage")
  async updateDlpPolicy(@Param("id") id: string, @Body() body: unknown): Promise<DlpPolicyDto> {
    const input = parse(UpdateDlpPolicyBody, body);
    return this.dlpPolicies.update(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), input, auditCtxOf());
  }

  @Post("v1/settings/dlp-policies/:id/delete")
  @HttpCode(200)
  @RequireCapability("settings:manage")
  async deleteDlpPolicy(@Param("id") id: string): Promise<DlpPolicyDto> {
    return this.dlpPolicies.remove(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), auditCtxOf());
  }

  // --- Cost centers --------------------------------------------------------
  @Get("v1/settings/cost-centers")
  @RequireCapability("settings:manage")
  async listCostCenters(): Promise<Page<CostCenterDto>> {
    return this.costCenters.list(currentTx());
  }

  @Post("v1/settings/cost-centers")
  @RequireCapability("settings:manage")
  async createCostCenter(@Body() body: unknown): Promise<CostCenterDto> {
    const input = parse(CreateCostCenterBody, body);
    return this.costCenters.create(currentTx(), currentContext().tenantId, actorIdOf(), input, auditCtxOf());
  }

  @Get("v1/settings/cost-centers/assignments")
  @RequireCapability("settings:manage")
  async listCostCenterAssignments(): Promise<Page<CostCenterAssignmentDto>> {
    return this.costCenters.listAssignments(currentTx());
  }

  @Post("v1/settings/cost-centers/assign")
  @HttpCode(200)
  @RequireCapability("settings:manage")
  async assignCostCenter(@Body() body: unknown): Promise<CostCenterAssignmentDto> {
    const input = parse(AssignCostCenterBody, body);
    return this.costCenters.assign(currentTx(), currentContext().tenantId, actorIdOf(), input, auditCtxOf());
  }

  @Put("v1/settings/cost-centers/:id")
  @RequireCapability("settings:manage")
  async updateCostCenter(@Param("id") id: string, @Body() body: unknown): Promise<CostCenterDto> {
    const input = parse(UpdateCostCenterBody, body);
    return this.costCenters.update(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), input, auditCtxOf());
  }

  @Post("v1/settings/cost-centers/:id/delete")
  @HttpCode(200)
  @RequireCapability("settings:manage")
  async deleteCostCenter(@Param("id") id: string): Promise<CostCenterDto> {
    return this.costCenters.remove(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), auditCtxOf());
  }

  // --- Chargeback ----------------------------------------------------------
  @Get("v1/settings/chargeback")
  @RequireCapability("settings:manage")
  async getChargebackSettings(): Promise<ChargebackSettingsDto> {
    return this.settings.getChargebackSettings(currentTx());
  }

  @Put("v1/settings/chargeback")
  @RequireCapability("settings:manage")
  async updateChargebackSettings(@Body() body: unknown): Promise<ChargebackSettingsDto> {
    const input = parse(UpdateChargebackSettingsBody, body);
    return this.settings.updateChargebackSettings(currentTx(), currentContext().tenantId, actorIdOf(), input, auditCtxOf());
  }

  @Get("v1/settings/chargeback/report")
  @RequireCapability("settings:manage")
  async getChargebackReport(): Promise<ChargebackReportDto> {
    return this.costCenters.report(currentTx());
  }
}
