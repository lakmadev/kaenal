import { Body, Controller, Get, Inject, Put } from "@nestjs/common";
import { UpdateBrandingBody, type BrandingDto } from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { Internal, RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import { actorIdOf, auditCtxOf } from "../ncr/handler-ctx.js";
import { SETTINGS_SERVICE } from "../tokens.js";
import type { SettingsService } from "./settings.service.js";

/**
 * Workspace settings routes. `@Internal`: a supplier-portal partner has no
 * business reading or writing workspace branding. The GET carries no capability
 * — any member's shell reads branding to render the tenant label — while the PUT
 * requires `settings:manage` (admins + managers), the same gate as SLA/templates.
 */
@Internal()
@Controller()
export class SettingsController {
  constructor(@Inject(SETTINGS_SERVICE) private readonly settings: SettingsService) {}

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
}
