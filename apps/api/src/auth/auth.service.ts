import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type pg from "pg";
import type { Role } from "@kaenal/types";
import { withAudit, withTenant, type Tx } from "@kaenal/db";
import {
  canRedeemToken,
  checkPasswordPolicy,
  INVITATION_TTL_MS,
  isLocked,
  mfaRequiredFor,
  PASSWORD_RESET_TTL_MS,
  registerFailure,
  registerSuccess,
  slideSessionExpiry,
} from "@kaenal/core";
import { ApiError } from "../errors.js";
import { CONTROL_POOL } from "../tokens.js";
import { generateToken, hashPassword, hashToken, verifyPassword, equalizeTiming } from "./passwords.js";

/**
 * Authentication service (03 §2).
 *
 * Sign-in happens AT a tenant: the person is global (control.users) but the
 * session is tenant-scoped, because 07 §4 lets Enterprise tenants set their
 * own session policy and a single global session could not honour two
 * different ones.
 *
 * Every failure path returns the same INVALID_CREDENTIALS shape. Distinguishing
 * "no such user" from "wrong password" from "not a member here" would turn the
 * login form into a membership oracle — and membership in a named tenant is
 * exactly the cross-tenant existence rule 8 forbids leaking.
 */

export interface SignInResult {
  readonly userId: string;
  readonly role: Role;
  readonly plantIds: readonly string[];
  readonly sessionToken: string;
  readonly expiresAt: Date;
}

interface CredentialRow {
  id: string;
  password_hash: string | null;
  mfa_secret: string | null;
  failed_login_attempts: number;
  locked_until: Date | null;
  status: string;
}

@Injectable()
export class AuthService {
  constructor(@Inject(CONTROL_POOL) private readonly control: pg.Pool) {}

  /**
   * Verifies a credential and opens a tenant-scoped session.
   *
   * `tx` is the request's tenant-scoped transaction, so the membership lookup
   * and the session insert are both under RLS and both roll back together.
   */
  async signIn(
    tx: Tx,
    tenantId: string,
    email: string,
    password: string,
    context: { ip: string | null; userAgent: string | null; requestId: string | null },
  ): Promise<SignInResult> {
    const invalid = (): ApiError =>
      new ApiError("UNAUTHENTICATED", "Email or password is incorrect");

    const { rows } = await this.control.query<CredentialRow>(
      `SELECT id, password_hash, mfa_secret, failed_login_attempts, locked_until, status
         FROM control.users WHERE email = $1`,
      [email],
    );
    const user = rows[0];

    if (user === undefined || user.password_hash === null) {
      // Spend the same time as a real verify, or the response latency itself
      // discloses whether the account exists.
      await equalizeTiming(password);
      throw invalid();
    }

    const now = new Date();
    const lockState = {
      failedAttempts: user.failed_login_attempts,
      lockedUntil: user.locked_until,
    };

    if (isLocked(lockState, now)) {
      await this.auditSignIn(tenantId, user.id, "sign_in_failed", { reason: "locked" }, context);
      // Same envelope as a wrong password: "your account is locked" confirms
      // the account exists and tells an attacker their guessing is working.
      throw invalid();
    }

    if (user.status !== "active" || !(await verifyPassword(user.password_hash, password))) {
      const next = registerFailure(lockState, now);
      await this.control.query(
        `UPDATE control.users
            SET failed_login_attempts = $2, locked_until = $3
          WHERE id = $1`,
        [user.id, next.failedAttempts, next.lockedUntil],
      );
      await this.auditSignIn(tenantId, user.id, "sign_in_failed", {}, context);
      throw invalid();
    }

    // Credential is good. Membership decides whether it means anything HERE.
    const membership = await this.activeMembership(tx, user.id);
    if (membership === null) {
      // Deliberately identical to a bad password. A valid credential that
      // reveals "you are not a member of acme" is a membership oracle.
      await this.auditSignIn(tenantId, user.id, "sign_in_failed", { reason: "no_membership" }, context);
      throw invalid();
    }

    // P11: external partners must have MFA configured (07 §4). The password has
    // already verified here, so this is not a credential oracle — it is a hard
    // stop on an under-secured external account, and it says so plainly rather
    // than reusing the generic invalid-credentials envelope.
    if (mfaRequiredFor(membership.role) && user.mfa_secret === null) {
      await this.auditSignIn(tenantId, user.id, "sign_in_failed", { reason: "mfa_required" }, context);
      throw new ApiError(
        "FORBIDDEN",
        "This account requires multi-factor authentication, which is not configured. Contact your administrator.",
      );
    }

    const reset = registerSuccess();
    await this.control.query(
      `UPDATE control.users
          SET failed_login_attempts = $2, locked_until = $3, last_login_at = now()
        WHERE id = $1`,
      [user.id, reset.failedAttempts, reset.lockedUntil],
    );

    const sessionToken = generateToken();
    // Partners get a short-lived session (P11); staff get the standard 12h.
    const expiresAt = slideSessionExpiry(now, membership.role);

    await withAudit(
      tx,
      tenantId,
      {
        actorId: user.id,
        actorKind: "user",
        entityKind: "session",
        entityId: user.id,
        action: "signed_in",
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        await t.query(
          `INSERT INTO sessions (tenant_id, user_id, refresh_token_hash, expires_at, ip, user_agent)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            tenantId,
            user.id,
            hashToken(sessionToken),
            expiresAt,
            context.ip,
            context.userAgent,
          ],
        );
      },
    );

    return {
      userId: user.id,
      role: membership.role,
      plantIds: membership.plantIds,
      sessionToken,
      expiresAt,
    };
  }

  /**
   * Every workspace the signed-in person can enter (the profile switcher). This
   * is a control-plane lookup — "which tenants may this identity enter" — so it
   * reads through the control pool, strictly filtered by the caller's own
   * user_id. It returns only the caller's memberships (never another person's),
   * so it is not a cross-tenant oracle: it discloses nothing about tenants the
   * caller is not already a member of. Only slug/name/role are returned, never
   * tenant business data (which always flows through the RLS-scoped app pool).
   */
  async listWorkspaces(
    userId: string,
    activeSlug: string,
  ): Promise<{ tenantSlug: string; tenantName: string; role: string; active: boolean }[]> {
    const { rows } = await this.control.query<{ slug: string; name: string; role: string }>(
      `SELECT t.slug, t.name, m.role
         FROM memberships m
         JOIN control.tenants t ON t.id = m.tenant_id
        WHERE m.user_id = $1 AND m.status = 'active' AND m.deleted_at IS NULL
          AND t.status = 'active'
        ORDER BY t.name`,
      [userId],
    );
    return rows.map((r) => ({
      tenantSlug: r.slug,
      tenantName: r.name,
      role: r.role,
      active: r.slug === activeSlug,
    }));
  }

  /**
   * Switch the active workspace: mint a session for a target tenant the caller
   * is ALREADY a member of. The caller is authenticated in their current
   * workspace (the request went through the normal chain), and the password is
   * global (control.users), so no re-entry of credentials is needed — but
   * membership in the target is verified before any session is issued. A target
   * the caller does not belong to is a 404 (never a 403), so this cannot probe
   * for workspaces the caller has no access to (rule 8).
   */
  async switchWorkspace(
    userId: string,
    slug: string,
    context: { ip: string | null; userAgent: string | null; requestId: string | null },
  ): Promise<{
    sessionToken: string;
    expiresAt: Date;
    workspace: { tenantSlug: string; tenantName: string; role: string; active: boolean };
  }> {
    const notFound = (): ApiError => new ApiError("NOT_FOUND", "Workspace not found");

    // Resolve the target tenant and verify active membership — both through the
    // control pool, in one query, so a non-member and an unknown slug are
    // indistinguishable (no existence leak).
    const { rows } = await this.control.query<{ tenant_id: string; name: string; role: Role }>(
      `SELECT t.id AS tenant_id, t.name, m.role
         FROM control.tenants t
         JOIN memberships m ON m.tenant_id = t.id AND m.user_id = $2
        WHERE t.slug = $1 AND t.status = 'active'
          AND m.status = 'active' AND m.deleted_at IS NULL`,
      [slug, userId],
    );
    const target = rows[0];
    if (target === undefined) throw notFound();

    const sessionToken = generateToken();
    const expiresAt = slideSessionExpiry(new Date(), target.role);

    // Mint the session INSIDE the target tenant's scoped transaction, so RLS and
    // the audit event are written against the workspace being entered.
    await withTenant(target.tenant_id, userId, async (t) => {
      await withAudit(
        t,
        target.tenant_id,
        {
          actorId: userId,
          actorKind: "user",
          entityKind: "session",
          entityId: userId,
          action: "signed_in",
          requestId: context.requestId,
          ip: context.ip,
          userAgent: context.userAgent,
        },
        async (tt) => {
          await tt.query(
            `INSERT INTO sessions (tenant_id, user_id, refresh_token_hash, expires_at, ip, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [target.tenant_id, userId, hashToken(sessionToken), expiresAt, context.ip, context.userAgent],
          );
        },
      );
    });

    return {
      sessionToken,
      expiresAt,
      workspace: { tenantSlug: slug, tenantName: target.name, role: target.role, active: true },
    };
  }

  /**
   * Resolves a session token to its member. Returns null for anything that
   * does not resolve — expired, revoked, unknown, or belonging to a membership
   * that has since been deactivated.
   */
  async resolveSession(
    tx: Tx,
    token: string,
  ): Promise<{
    userId: string;
    role: Role;
    plantIds: readonly string[];
    supplierScope: string | null;
  } | null> {
    const { rows } = await tx.query<{
      user_id: string;
      role: Role;
      plant_ids: string[];
      supplier_scope: string | null;
    }>(
      `SELECT s.user_id, m.role, m.plant_ids, m.supplier_scope
         FROM sessions s
         JOIN memberships m ON m.tenant_id = s.tenant_id AND m.user_id = s.user_id
        WHERE s.refresh_token_hash = $1
          AND s.revoked_at IS NULL
          AND s.expires_at > now()
          AND m.status = 'active'
          AND m.deleted_at IS NULL`,
      [hashToken(token)],
    );

    const row = rows[0];
    if (row === undefined) return null;

    // Role AND supplier scope are re-read from the database on every request
    // (07 §7): a role downgrade or a re-scoped partner must take effect on the
    // next request, not the next sign-in.
    return {
      userId: row.user_id,
      role: row.role,
      plantIds: row.plant_ids,
      supplierScope: row.supplier_scope,
    };
  }

  async signOut(tx: Tx, tenantId: string, token: string, userId: string): Promise<void> {
    await withAudit(
      tx,
      tenantId,
      {
        actorId: userId,
        actorKind: "user",
        entityKind: "session",
        entityId: userId,
        action: "signed_out",
      },
      async (t) => {
        await t.query(
          `UPDATE sessions SET revoked_at = now()
            WHERE refresh_token_hash = $1 AND revoked_at IS NULL`,
          [hashToken(token)],
        );
      },
    );
  }

  /**
   * Creates (or replaces) an invitation. Re-inviting the same address
   * regenerates the token and invalidates the old one (03 §2).
   */
  async invite(
    tx: Tx,
    tenantId: string,
    actorId: string,
    email: string,
    role: Role,
    plantIds: readonly string[],
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    // audit_events.entity_id is a NOT NULL uuid, and an audit event is written
    // before the row's server-generated id would be available — so the id is
    // minted here and used for both the insert and the event.
    const invitationId = randomUUID();

    await withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: "invitation",
        entityId: invitationId,
        action: "created",
        // Email is not credential-shaped, so it is safe in the trail — it is
        // the whole point of the event (who was invited).
        after: { email, role },
      },
      async (t) => {
        // Revoke first: the partial unique index allows only one outstanding
        // invitation per address, and the old link must stop working the
        // moment a new one is issued.
        await t.query(
          `UPDATE invitations SET revoked_at = now()
            WHERE email = $1 AND accepted_at IS NULL AND revoked_at IS NULL`,
          [email],
        );

        await t.query(
          `INSERT INTO invitations (id, tenant_id, email, role, plant_ids, token_hash, expires_at, invited_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [invitationId, tenantId, email, role, plantIds, hashToken(token), expiresAt, actorId],
        );
      },
    );

    return { token, expiresAt };
  }

  /**
   * Redeems an invitation: creates the person if they are new, links them to
   * this tenant, and sets their password.
   *
   * The 07 §7 case runs through here — an invite to an address that already
   * belongs to another tenant adds a membership to the EXISTING person rather
   * than creating a second account.
   */
  async acceptInvitation(
    tx: Tx,
    tenantId: string,
    token: string,
    name: string,
    password: string,
  ): Promise<{ userId: string }> {
    const { rows } = await tx.query<{
      id: string;
      email: string;
      role: Role;
      plant_ids: string[];
      expires_at: Date;
      accepted_at: Date | null;
      revoked_at: Date | null;
    }>(
      `SELECT id, email, role, plant_ids, expires_at, accepted_at, revoked_at
         FROM invitations WHERE token_hash = $1`,
      [hashToken(token)],
    );

    const invitation = rows[0];
    // An unknown token and a spent one are the same answer, deliberately.
    if (invitation === undefined) throw new ApiError("NOT_FOUND", "This link is invalid or has expired");

    const redeemable = canRedeemToken(
      {
        expiresAt: invitation.expires_at,
        usedAt: invitation.accepted_at,
        revokedAt: invitation.revoked_at,
      },
      new Date(),
    );
    if (!redeemable.ok) throw ApiError.from(redeemable);

    const policy = checkPasswordPolicy(password, invitation.email);
    if (!policy.ok) throw ApiError.from(policy);

    const passwordHash = await hashPassword(password);

    // The person may already exist (07 §7). ON CONFLICT keeps their existing
    // credential rather than letting an invitation to tenant B silently reset
    // the password they use at tenant A.
    const { rows: userRows } = await this.control.query<{ id: string }>(
      `INSERT INTO control.users (email, name, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE
         SET password_hash = COALESCE(control.users.password_hash, EXCLUDED.password_hash)
       RETURNING id`,
      [invitation.email, name, passwordHash],
    );

    const userId = userRows[0]?.id;
    if (userId === undefined) throw new ApiError("INTERNAL", "Could not create the account");

    await withAudit(
      tx,
      tenantId,
      [
        {
          actorId: userId,
          actorKind: "user",
          entityKind: "invitation",
          entityId: invitation.id,
          action: "updated",
          after: { acceptedAt: new Date().toISOString() },
        },
        {
          actorId: userId,
          actorKind: "user",
          entityKind: "membership",
          entityId: userId,
          action: "created",
          after: { role: invitation.role },
        },
      ],
      async (t) => {
        await t.query("UPDATE invitations SET accepted_at = now() WHERE id = $1", [invitation.id]);

        await t.query(
          `INSERT INTO memberships (tenant_id, user_id, role, plant_ids, status)
           VALUES ($1, $2, $3, $4, 'active')
           ON CONFLICT (tenant_id, user_id)
             DO UPDATE SET role = EXCLUDED.role, status = 'active', plant_ids = EXCLUDED.plant_ids`,
          [tenantId, userId, invitation.role, invitation.plant_ids],
        );
      },
    );

    return { userId };
  }

  /**
   * Starts a password reset. Always resolves, whether or not the address is
   * known: a different response for an unknown address is an account
   * enumeration endpoint that needs no authentication to query.
   */
  async requestPasswordReset(email: string): Promise<string | null> {
    const { rows } = await this.control.query<{ id: string }>(
      "SELECT id FROM control.users WHERE email = $1 AND status = 'active'",
      [email],
    );

    const userId = rows[0]?.id;
    if (userId === undefined) return null;

    const token = generateToken();
    await this.control.query(
      `INSERT INTO control.password_resets (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, hashToken(token), new Date(Date.now() + PASSWORD_RESET_TTL_MS)],
    );

    return token;
  }

  /** Completes a reset and revokes every session the person holds. */
  async completePasswordReset(token: string, password: string): Promise<void> {
    const invalid = new ApiError("NOT_FOUND", "This link is invalid or has expired");

    const { rows } = await this.control.query<{
      id: string;
      user_id: string;
      email: string;
      expires_at: Date;
      used_at: Date | null;
    }>(
      `SELECT r.id, r.user_id, u.email, r.expires_at, r.used_at
         FROM control.password_resets r
         JOIN control.users u ON u.id = r.user_id
        WHERE r.token_hash = $1`,
      [hashToken(token)],
    );

    const reset = rows[0];
    if (reset === undefined) throw invalid;

    const redeemable = canRedeemToken(
      { expiresAt: reset.expires_at, usedAt: reset.used_at, revokedAt: null },
      new Date(),
    );
    if (!redeemable.ok) throw ApiError.from(redeemable);

    const policy = checkPasswordPolicy(password, reset.email);
    if (!policy.ok) throw ApiError.from(policy);

    const hash = await hashPassword(password);

    await this.control.query(
      `UPDATE control.users
          SET password_hash = $2, failed_login_attempts = 0, locked_until = NULL
        WHERE id = $1`,
      [reset.user_id, hash],
    );
    await this.control.query("UPDATE control.password_resets SET used_at = now() WHERE id = $1", [
      reset.id,
    ]);

    // A reset is the remedy for a compromised account, so every existing
    // session must die with it — otherwise the attacker keeps their access
    // and only the owner is inconvenienced. Runs as the control pool because
    // sessions span every tenant this person belongs to.
    await this.control.query(
      "UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
      [reset.user_id],
    );
  }

  private async activeMembership(
    tx: Tx,
    userId: string,
  ): Promise<{ role: Role; plantIds: readonly string[]; supplierScope: string | null } | null> {
    const { rows } = await tx.query<{ role: Role; plant_ids: string[]; supplier_scope: string | null }>(
      `SELECT role, plant_ids, supplier_scope FROM memberships
        WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL`,
      [userId],
    );
    const row = rows[0];
    return row === undefined
      ? null
      : { role: row.role, plantIds: row.plant_ids, supplierScope: row.supplier_scope };
  }

  /**
   * Records a sign-in outcome in its OWN transaction.
   *
   * Deliberately NOT the request transaction: every failure path throws, and a
   * throw rolls the request transaction back — which would erase the very
   * audit event proving the attempt happened. Failed sign-ins are the events a
   * security review asks for first, so they must survive the rejection that
   * produced them.
   *
   * The same reasoning is why the lockout counter is written through the
   * control pool rather than `tx`: a counter that rolls back with the failed
   * request would never reach the threshold and lockout would silently never
   * engage.
   */
  private async auditSignIn(
    tenantId: string,
    userId: string,
    action: "sign_in_failed" | "signed_in",
    extra: Record<string, unknown>,
    context: { ip: string | null; userAgent: string | null; requestId: string | null },
  ): Promise<void> {
    // Sign-in failures are audited (07 §1) but must never record the attempted
    // password — `redact()` in withAudit covers credential-shaped keys, and
    // nothing here passes one in the first place.
    await withTenant(tenantId, null, async (auditTx) => {
      await withAudit(
        auditTx,
        tenantId,
        {
          actorId: userId,
          actorKind: "user",
          entityKind: "session",
          entityId: userId,
          action,
          after: Object.keys(extra).length === 0 ? null : extra,
          requestId: context.requestId,
          ip: context.ip,
          userAgent: context.userAgent,
        },
        // A sign-in attempt changes no business row — the event IS the record.
        () => Promise.resolve(undefined),
      );
    });
  }
}
