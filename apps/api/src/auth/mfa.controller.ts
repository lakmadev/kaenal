import { Body, Controller, Get, Inject, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { withAudit } from "@kaenal/db";
import { currentContext, currentTx } from "../context.js";
import { ApiError } from "../errors.js";
import { AllowEnrolment } from "../decorators.js";
import { AUTH_SERVICE, MFA_SERVICE } from "../tokens.js";
import type { AuthService } from "./auth.service.js";
import { requestSessionToken } from "./session.authenticator.js";
import type { MfaService, MfaStatus } from "./mfa.service.js";

/**
 * Self-service MFA management (07 §4). Authenticated but capability-free and NOT
 * `@Internal` — every user manages their own second factor, including external
 * `partner` accounts, for whom MFA is mandatory. Enable/disable are audited as
 * account settings changes in the tenant the user is acting in.
 */
const CodeBody = z.object({ code: z.string().min(1).max(64) });

function parseCode(body: unknown): string {
  const result = CodeBody.safeParse(body);
  if (!result.success) throw new ApiError("VALIDATION_FAILED", "A verification code is required");
  return result.data.code;
}

@Controller("v1/auth/mfa")
export class MfaController {
  constructor(
    @Inject(MFA_SERVICE) private readonly mfa: MfaService,
    @Inject(AUTH_SERVICE) private readonly auth: AuthService,
  ) {}

  // status / enroll / activate are reachable with an enrolment-only session (a
  // partner's first login, P11) — they are the only routes that session may use.
  @AllowEnrolment()
  @Get()
  status(): Promise<MfaStatus> {
    return this.mfa.status(this.userId());
  }

  /** Begin enrolment — returns the otpauth URI + a QR data-URI to scan. */
  @AllowEnrolment()
  @Post("enroll")
  enroll(): Promise<{ otpauthUri: string; qrDataUri: string }> {
    return this.mfa.startEnrollment(this.userId());
  }

  /** Activate a pending enrolment with a first code; returns one-time recovery codes. */
  @AllowEnrolment()
  @Post("activate")
  async activate(@Body() body: unknown, @Req() req: Request): Promise<{ recoveryCodes: string[]; sessionUpgraded: boolean }> {
    const result = await this.mfa.activate(this.userId(), parseCode(body));
    await this.audit("enabled");
    // The code just verified is what earns a full session: promote an
    // enrolment-only session in place (no-op for an ordinary one).
    const token = requestSessionToken(req);
    const sessionUpgraded =
      token !== null && (await this.auth.promoteEnrolmentSession(currentTx(), this.userId(), token));
    return { ...result, sessionUpgraded };
  }

  /** Disable MFA — requires a current code. */
  @Post("disable")
  async disable(@Body() body: unknown): Promise<{ ok: true }> {
    await this.mfa.disable(this.userId(), parseCode(body));
    await this.audit("disabled");
    return { ok: true };
  }

  /** Reissue recovery codes — requires a current code; invalidates the old set. */
  @Post("recovery-codes/regenerate")
  async regenerateRecoveryCodes(@Body() body: unknown): Promise<{ recoveryCodes: string[] }> {
    const result = await this.mfa.regenerateRecoveryCodes(this.userId(), parseCode(body));
    await this.audit("recovery_codes_regenerated");
    return result;
  }

  private userId(): string {
    const id = currentContext().userId;
    if (id === null) throw new ApiError("UNAUTHENTICATED", "Authentication required");
    return id;
  }

  private async audit(state: "enabled" | "disabled" | "recovery_codes_regenerated"): Promise<void> {
    const ctx = currentContext();
    await withAudit(
      currentTx(),
      ctx.tenantId,
      {
        actorId: ctx.userId,
        actorKind: "user",
        entityKind: "membership",
        entityId: ctx.userId ?? "",
        action: "settings_changed",
        after: { mfa: state },
      },
      async () => {
        /* The MFA state itself lives in the control plane (already written by the
           service); this records the security-relevant change in the tenant trail. */
      },
    );
  }
}
