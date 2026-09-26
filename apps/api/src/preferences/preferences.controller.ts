import { Body, Controller, Get, Inject, Patch } from "@nestjs/common";
import { UpdateUserPreferencesBody, type UserPreferencesDto } from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { Internal } from "../decorators.js";
import { parse } from "../http/validate.js";
import { actorIdOf, auditCtxOf } from "../ncr/handler-ctx.js";
import { PREFERENCES_SERVICE } from "../tokens.js";
import type { PreferencesService } from "./preferences.service.js";

/** Self-scoped: no capability; every method filters to the authenticated actor. */
@Internal()
@Controller()
export class PreferencesController {
  constructor(@Inject(PREFERENCES_SERVICE) private readonly prefs: PreferencesService) {}

  @Get("v1/me/preferences")
  async get(): Promise<UserPreferencesDto> {
    return this.prefs.get(currentTx(), actorIdOf());
  }

  @Patch("v1/me/preferences")
  async update(@Body() body: unknown): Promise<UserPreferencesDto> {
    const input = parse(UpdateUserPreferencesBody, body);
    return this.prefs.update(currentTx(), currentContext().tenantId, actorIdOf(), input, auditCtxOf());
  }
}
