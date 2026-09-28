import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type pg from "pg";
import type { Page, PortalContactDto, Role } from "@kaenal/types";
import { withAudit, withTenant, type Tx } from "@kaenal/db";
import {
  canRedeemToken,
  checkPasswordPolicy,
  ENROLMENT_SESSION_TTL_MS,
  INVITATION_TTL_MS,
  isLocked,
  mfaRequiredFor,
  PASSWORD_RESET_TTL_MS,
  registerFailure,
  registerSuccess,
  slideSessionExpiry,
} from "@kaenal/core";
import { ApiError } from "../errors.js";
import { clampLimit, decodeCursor, encodeCursor } from "../http/pagination.js";
import { loadSessionPolicy } from "../settings/settings.service.js";
import { CONTROL_POOL } from "../tokens.js";
import { generateToken, hashPassword, hashToken, verifyPassword, equalizeTiming } from "./passwords.js";
import type { MfaService } from "./mfa.service.js";

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

/**
 * Sign-in either issues a session or, when the password is correct but the
 * account has an active second factor, asks for a code without issuing anything.
 * `mfa_required` is not a failure — it means "password accepted, now the code".
 */
export type SignInOutcome =
  | { readonly kind: "session"; readonly result: SignInResult }
  | { readonly kind: "mfa_required" }
  /**
   * Password correct, but the role mandates MFA and none is enrolled: an
   * enrolment-only session was issued (usable solely on the MFA enrol routes).
   */
  | { readonly kind: "enrolment_required"; readonly result: SignInResult };

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
  constructor(
    @Inject(CONTROL_POOL) private readonly control: pg.Pool,
    private readonly mfa: MfaService,
  ) {}

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
    code: string | null,
    context: { ip: string | null; userAgent: string | null; requestId: string | null },
  ): Promise<SignInOutcome> {
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

    // P11: external partners must have MFA (07 §4). With no factor yet they get
    // an ENROLMENT-ONLY session (scope 'mfa_enrol', 15 min): the lifecycle
    // refuses it on every route except the MFA enrol/activate/status + sign-out
    // routes, and only a verified TOTP activation promotes it to a full session.
    // The password has already verified here, so this is not a credential oracle.
    const enrolmentOnly = mfaRequiredFor(membership.role) && user.mfa_secret === null;

    // Second factor: any account with an active TOTP secret must present a code —
    // a correct password alone is not enough (the "enrolled ⇒ enforced" policy).
    if (user.mfa_secret !== null) {
      if (code === null || code === "") {
        // Password was correct; ask the client for a code. Deliberately NOT a
        // failed attempt (the credential was valid) — the code step is next.
        return { kind: "mfa_required" };
      }
      if (!(await this.mfa.verifyLogin(user.id, code))) {
        // A wrong code counts toward lockout, so the 6-digit space can't be
        // brute-forced behind a known-good password.
        const next = registerFailure(lockState, now);
        await this.control.query(
          `UPDATE control.users SET failed_login_attempts = $2, locked_until = $3 WHERE id = $1`,
          [user.id, next.failedAttempts, next.lockedUntil],
        );
        await this.auditSignIn(tenantId, user.id, "sign_in_failed", { reason: "mfa_invalid" }, context);
        throw new ApiError("UNAUTHENTICATED", "That verification code is not valid");
      }
    }

    const reset = registerSuccess();
    await this.control.query(
      `UPDATE control.users
          SET failed_login_attempts = $2, locked_until = $3, last_login_at = now()
        WHERE id = $1`,
      [user.id, reset.failedAttempts, reset.lockedUntil],
    );

    const sessionToken = generateToken();
    // Session-policy enforcement (Phase C): partners keep the short-lived P11
    // session; staff sessions live for the tenant's configured absolute timeout.
    const policy = await loadSessionPolicy(tx);
    const expiresAt = enrolmentOnly
      ? new Date(now.getTime() + ENROLMENT_SESSION_TTL_MS)
      : membership.role === "partner"
        ? slideSessionExpiry(now, "partner")
        : new Date(now.getTime() + policy.webAbsoluteHours * 60 * 60 * 1000);

    await withAudit(
      tx,
      tenantId,
      {
        actorId: user.id,
        actorKind: "user",
        entityKind: "session",
        entityId: user.id,
        action: "signed_in",
        ...(enrolmentOnly ? { after: { scope: "mfa_enrol" } } : {}),
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        await t.query(
          `INSERT INTO sessions (tenant_id, user_id, refresh_token_hash, expires_at, ip, user_agent, scope)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            tenantId,
            user.id,
            hashToken(sessionToken),
            expiresAt,
            context.ip,
            context.userAgent,
            enrolmentOnly ? "mfa_enrol" : "full",
          ],
        );
      },
    );

    // Max-concurrent enforcement: keep the newest N live sessions, revoke the
    // rest (the just-minted one is newest, so it survives). 0 = unlimited.
    if (policy.maxConcurrentSessions > 0) {
      await tx.query(
        `UPDATE sessions SET revoked_at = now()
          WHERE id IN (
            SELECT id FROM sessions
             WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
             ORDER BY created_at DESC, id DESC
             OFFSET $2
          )`,
        [user.id, policy.maxConcurrentSessions],
      );
    }

    const result: SignInResult = {
      userId: user.id,
      role: membership.role,
      plantIds: membership.plantIds,
      sessionToken,
      expiresAt,
    };
    return enrolmentOnly ? { kind: "enrolment_required", result } : { kind: "session", result };
  }

  /**
   * Promotes an enrolment-only session to a full one. Called by the MFA activate
   * route AFTER a TOTP code has been verified against the pending secret — that
   * verified code is what earns the full session. A no-op for ordinary sessions
   * (the WHERE clause only matches an unrevoked, unexpired 'mfa_enrol' row owned
   * by the caller). Returns whether a promotion happened.
   */
  async promoteEnrolmentSession(tx: Tx, userId: string, token: string): Promise<boolean> {
    const expiresAt = slideSessionExpiry(new Date(), "partner");
    const { rowCount } = await tx.query(
      `UPDATE sessions SET scope = 'full', expires_at = $3
        WHERE refresh_token_hash = $1 AND user_id = $2 AND scope = 'mfa_enrol'
          AND revoked_at IS NULL AND expires_at > now()`,
      [hashToken(token), userId, expiresAt],
    );
    return (rowCount ?? 0) > 0;
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
    enrolmentOnly: boolean;
  } | null> {
    const { rows } = await tx.query<{
      user_id: string;
      role: Role;
      plant_ids: string[];
      supplier_scope: string | null;
      scope: string;
    }>(
      `SELECT s.user_id, m.role, m.plant_ids, m.supplier_scope, s.scope
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
      enrolmentOnly: row.scope === "mfa_enrol",
    };
  }

  /**
   * The caller's own live sessions in THIS tenant (07 §7 — sessions are
   * tenant-scoped). RLS on `sessions` already limits the query to the current
   * tenant; the `user_id` filter limits it to the caller, so this is never a
   * window onto anyone else's devices. The session matching the caller's own
   * token is flagged `current` so the UI can protect it from being signed out.
   */
  async listSessions(
    tx: Tx,
    userId: string,
    currentToken: string | null,
  ): Promise<
    {
      id: string;
      current: boolean;
      ip: string | null;
      userAgent: string | null;
      signedInAt: Date;
      expiresAt: Date;
    }[]
  > {
    const { rows } = await tx.query<{
      id: string;
      refresh_token_hash: string;
      ip: string | null;
      user_agent: string | null;
      created_at: Date;
      expires_at: Date;
    }>(
      `SELECT id, refresh_token_hash, ip::text AS ip, user_agent, created_at, expires_at
         FROM sessions
        WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
        ORDER BY created_at DESC`,
      [userId],
    );

    const currentHash = currentToken === null ? null : hashToken(currentToken);
    return rows.map((r) => ({
      id: r.id,
      current: currentHash !== null && r.refresh_token_hash === currentHash,
      ip: r.ip,
      userAgent: r.user_agent,
      signedInAt: r.created_at,
      expiresAt: r.expires_at,
    }));
  }

  /**
   * Revoke one of the caller's sessions by id. Scoped to the caller's own rows
   * under RLS, so a session id belonging to another user or tenant simply is not
   * found — reported as 404, never 403 (rule 8: no cross-tenant/user existence
   * leak). Idempotent: revoking an already-revoked session is a no-op 404.
   */
  async revokeSession(
    tx: Tx,
    tenantId: string,
    userId: string,
    sessionId: string,
    context: { ip: string | null; userAgent: string | null; requestId: string | null },
  ): Promise<void> {
    const { rows } = await tx.query<{ id: string }>(
      `SELECT id FROM sessions WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
      [sessionId, userId],
    );
    if (rows[0] === undefined) throw new ApiError("NOT_FOUND", "Session not found");

    await withAudit(
      tx,
      tenantId,
      {
        actorId: userId,
        actorKind: "user",
        entityKind: "session",
        entityId: sessionId,
        action: "signed_out",
        after: { revoked: "device" },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        await t.query(
          `UPDATE sessions SET revoked_at = now(), updated_by = $2 WHERE id = $1 AND revoked_at IS NULL`,
          [sessionId, userId],
        );
      },
    );
  }

  /**
   * "Sign out everywhere else": revoke every live session the caller holds in
   * this tenant EXCEPT the one they are calling from. A null current token would
   * mean "revoke all" — refused, so a bearer client that can't identify its own
   * session cannot accidentally lock itself out. Returns how many were revoked.
   */
  async revokeOtherSessions(
    tx: Tx,
    tenantId: string,
    userId: string,
    currentToken: string | null,
    context: { ip: string | null; userAgent: string | null; requestId: string | null },
  ): Promise<number> {
    if (currentToken === null) {
      throw new ApiError("VALIDATION_FAILED", "Cannot identify the current session");
    }
    let revoked = 0;
    await withAudit(
      tx,
      tenantId,
      {
        actorId: userId,
        actorKind: "user",
        entityKind: "session",
        entityId: userId,
        action: "signed_out",
        after: { revoked: "others" },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const res = await t.query(
          `UPDATE sessions SET revoked_at = now(), updated_by = $1
            WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
              AND refresh_token_hash <> $2`,
          [userId, hashToken(currentToken)],
        );
        revoked = res.rowCount ?? 0;
      },
    );
    return revoked;
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
    supplierScope: string | null = null,
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
        after: supplierScope === null ? { email, role } : { email, role, supplierId: supplierScope },
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
          `INSERT INTO invitations (id, tenant_id, email, role, plant_ids, token_hash, expires_at, invited_by, supplier_scope)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [invitationId, tenantId, email, role, plantIds, hashToken(token), expiresAt, actorId, supplierScope],
        );
      },
    );

    return { token, expiresAt };
  }

  /**
   * Invites a supplier contact to the portal: a `partner` invitation bound to ONE
   * supplier (the DB coupling CHECK makes partner ⇔ supplier_scope). The supplier
   * is read under RLS, so an unknown OR foreign-tenant id is a 404 (rule 8). An
   * address that already belongs to an internal member here is refused — accepting
   * would silently convert a staff account into an external one.
   */
  async invitePartner(
    tx: Tx,
    tenantId: string,
    actorId: string,
    supplierId: string,
    email: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const { rows: supplier } = await tx.query<{ id: string }>(
      "SELECT id FROM suppliers WHERE id = $1 AND deleted_at IS NULL",
      [supplierId],
    );
    if (supplier[0] === undefined) throw new ApiError("NOT_FOUND", "Supplier not found");

    const { rows: person } = await this.control.query<{ id: string }>(
      "SELECT id FROM control.users WHERE email = $1",
      [email],
    );
    const personId = person[0]?.id;
    const { rows: existing } =
      personId === undefined
        ? { rows: [] as { role: Role }[] }
        : await tx.query<{ role: Role }>(
            "SELECT role FROM memberships WHERE user_id = $1 AND deleted_at IS NULL",
            [personId],
          );
    if (existing.some((r) => r.role !== "partner")) {
      throw new ApiError("CONFLICT", "That address already belongs to an internal member of this workspace");
    }

    return this.invite(tx, tenantId, actorId, email, "partner", [], supplierId);
  }

  // --- Supplier-portal contacts (P11) ---------------------------------------
  // Only ever `partner` memberships / partner invitations scoped to the given
  // supplier — internal members are never listed or touched here.

  private async requireSupplier(tx: Tx, supplierId: string): Promise<void> {
    const { rows } = await tx.query("SELECT 1 FROM suppliers WHERE id = $1 AND deleted_at IS NULL", [supplierId]);
    if (rows.length === 0) throw new ApiError("NOT_FOUND", "Supplier not found");
  }

  /** All contacts of a supplier, newest first, keyset-paged on (invitedAt, id). */
  async listPortalContacts(
    tx: Tx,
    supplierId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<Page<PortalContactDto>> {
    await this.requireSupplier(tx, supplierId);
    const all = await this.loadContacts(tx, supplierId);
    all.sort((a, b) => (a.invitedAt === b.invitedAt ? (a.id < b.id ? 1 : -1) : a.invitedAt < b.invitedAt ? 1 : -1));
    const limit = clampLimit(opts.limit);
    let start = 0;
    if (opts.cursor !== undefined) {
      const c = decodeCursor(opts.cursor);
      const at = new Date(c.createdAt).toISOString();
      start = all.findIndex((r) => r.invitedAt < at || (r.invitedAt === at && r.id < c.id));
      if (start === -1) start = all.length;
    }
    const slice = all.slice(start, start + limit);
    const last = slice[slice.length - 1];
    const nextCursor =
      start + limit < all.length && last !== undefined ? encodeCursor({ createdAt: last.invitedAt, id: last.id }) : null;
    return { items: slice, nextCursor };
  }

  private async loadContacts(tx: Tx, supplierId: string): Promise<PortalContactDto[]> {
    interface UserRow {
      id: string;
      email: string;
      name: string;
      mfa: boolean;
      last_login_at: Date | null;
    }
    const { rows: members } = await tx.query<{ user_id: string; status: string; created_at: Date }>(
      `SELECT user_id, status, created_at FROM memberships
        WHERE role = 'partner' AND supplier_scope = $1 AND deleted_at IS NULL`,
      [supplierId],
    );
    const { rows: invites } = await tx.query<{ id: string; email: string; created_at: Date; expires_at: Date }>(
      `SELECT id, email::text AS email, created_at, expires_at FROM invitations
        WHERE role = 'partner' AND supplier_scope = $1 AND accepted_at IS NULL AND revoked_at IS NULL`,
      [supplierId],
    );
    const ids = members.map((m) => m.user_id);
    const users: UserRow[] =
      ids.length === 0
        ? []
        : (
            await this.control.query<UserRow>(
              "SELECT id, email::text AS email, name, mfa_secret IS NOT NULL AS mfa, last_login_at FROM control.users WHERE id = ANY($1)",
              [ids],
            )
          ).rows;
    const byId = new Map(users.map((u) => [u.id, u]));
    const out: PortalContactDto[] = [];
    const memberEmails = new Set<string>();
    for (const m of members) {
      const u = byId.get(m.user_id);
      if (u === undefined) continue;
      memberEmails.add(u.email.toLowerCase());
      out.push({
        id: m.user_id,
        email: u.email,
        name: u.name,
        status: m.status !== "active" ? "revoked" : u.mfa ? "active" : "enrolment_pending",
        mfaEnrolled: u.mfa,
        lastSignInAt: u.last_login_at === null ? null : u.last_login_at.toISOString(),
        invitedAt: m.created_at.toISOString(),
        expiresAt: null,
      });
    }
    for (const i of invites) {
      if (memberEmails.has(i.email.toLowerCase())) continue; // a re-issued link for an existing contact
      out.push({
        id: i.id,
        email: i.email,
        name: null,
        status: "invited",
        mfaEnrolled: false,
        lastSignInAt: null,
        invitedAt: i.created_at.toISOString(),
        expiresAt: i.expires_at.toISOString(),
      });
    }
    return out;
  }

  private async findContact(tx: Tx, supplierId: string, contactId: string): Promise<PortalContactDto> {
    await this.requireSupplier(tx, supplierId);
    const found = (await this.loadContacts(tx, supplierId)).find((c) => c.id === contactId);
    if (found === undefined) throw new ApiError("NOT_FOUND", "Contact not found");
    return found;
  }

  /** Re-issues the invite (old link revoked, new one returned to be emailed). */
  async resendPortalContact(
    tx: Tx,
    tenantId: string,
    actorId: string,
    supplierId: string,
    contactId: string,
  ): Promise<{ email: string; token: string; expiresAt: Date }> {
    const contact = await this.findContact(tx, supplierId, contactId);
    if (contact.status !== "invited" && contact.status !== "enrolment_pending") {
      throw new ApiError("CONFLICT", "Only pending contacts can be re-invited");
    }
    const { token, expiresAt } = await this.invitePartner(tx, tenantId, actorId, supplierId, contact.email);
    return { email: contact.email, token, expiresAt };
  }

  /**
   * Revokes a contact: membership deactivated, every session revoked NOW, any
   * pending invitation revoked. Idempotent — revoking a revoked contact is a no-op.
   */
  async revokePortalContact(
    tx: Tx,
    tenantId: string,
    actorId: string,
    supplierId: string,
    contactId: string,
  ): Promise<PortalContactDto> {
    const contact = await this.findContact(tx, supplierId, contactId);
    if (contact.status === "revoked") return contact;
    const isInvite = contact.status === "invited";

    await withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: isInvite ? "invitation" : "membership",
        entityId: contactId,
        action: "updated",
        after: { revoked: true, email: contact.email, supplierId },
      },
      async (t) => {
        await t.query(
          `UPDATE invitations SET revoked_at = now()
            WHERE email = $1 AND role = 'partner' AND supplier_scope = $2
              AND accepted_at IS NULL AND revoked_at IS NULL`,
          [contact.email, supplierId],
        );
        if (!isInvite) {
          await t.query(
            `UPDATE memberships SET status = 'deactivated'
              WHERE user_id = $1 AND role = 'partner' AND supplier_scope = $2`,
            [contactId, supplierId],
          );
          await t.query("UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [contactId]);
        }
      },
    );
    return { ...contact, status: "revoked" };
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
      supplier_scope: string | null;
      expires_at: Date;
      accepted_at: Date | null;
      revoked_at: Date | null;
    }>(
      `SELECT id, email, role, plant_ids, supplier_scope, expires_at, accepted_at, revoked_at
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
          after:
            invitation.supplier_scope === null
              ? { role: invitation.role }
              : { role: invitation.role, supplierId: invitation.supplier_scope },
        },
      ],
      async (t) => {
        await t.query("UPDATE invitations SET accepted_at = now() WHERE id = $1", [invitation.id]);

        await t.query(
          `INSERT INTO memberships (tenant_id, user_id, role, plant_ids, status, supplier_scope)
           VALUES ($1, $2, $3, $4, 'active', $5)
           ON CONFLICT (tenant_id, user_id)
             DO UPDATE SET role = EXCLUDED.role, status = 'active', plant_ids = EXCLUDED.plant_ids,
                           supplier_scope = EXCLUDED.supplier_scope`,
          [tenantId, userId, invitation.role, invitation.plant_ids, invitation.supplier_scope],
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

  /**
   * Self-service password change for a signed-in user. Requires the current
   * password (the user is proving it is really them, so naming a wrong current
   * password plainly is correct — this is not an enumeration surface). The new
   * password must satisfy the same policy as a reset and differ from the old one.
   *
   * Like a reset, changing the password signs the account out of every OTHER
   * session (across all workspaces) — a changed password is the remedy for a
   * suspected compromise — while keeping the session the change was made from.
   */
  async changePassword(
    tx: Tx,
    tenantId: string,
    userId: string,
    currentPassword: string,
    newPassword: string,
    keepToken: string | null,
    context: { ip: string | null; userAgent: string | null; requestId: string | null },
  ): Promise<void> {
    const { rows } = await this.control.query<{ password_hash: string | null; email: string }>(
      "SELECT password_hash, email FROM control.users WHERE id = $1",
      [userId],
    );
    const user = rows[0];
    if (user === undefined || user.password_hash === null) {
      throw new ApiError("UNAUTHENTICATED", "Authentication required");
    }

    if (!(await verifyPassword(user.password_hash, currentPassword))) {
      throw new ApiError("VALIDATION_FAILED", "Your current password is incorrect");
    }

    const policy = checkPasswordPolicy(newPassword, user.email);
    if (!policy.ok) throw ApiError.from(policy);

    if (await verifyPassword(user.password_hash, newPassword)) {
      throw new ApiError("VALIDATION_FAILED", "Choose a password different from your current one");
    }

    const hash = await hashPassword(newPassword);
    await this.control.query(
      "UPDATE control.users SET password_hash = $2, failed_login_attempts = 0, locked_until = NULL WHERE id = $1",
      [userId, hash],
    );

    // Revoke every other live session (all tenants) — keep only the one this
    // change was made from. Runs on the control pool because a person's sessions
    // span every workspace they belong to.
    if (keepToken === null) {
      await this.control.query(
        "UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
        [userId],
      );
    } else {
      await this.control.query(
        "UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL AND refresh_token_hash <> $2",
        [userId, hashToken(keepToken)],
      );
    }

    // Record the security-relevant change in the tenant trail (the credential
    // itself lives in the control plane and is never logged).
    await withAudit(
      tx,
      tenantId,
      {
        actorId: userId,
        actorKind: "user",
        entityKind: "membership",
        entityId: userId,
        action: "settings_changed",
        after: { password: "changed" },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      () => Promise.resolve(undefined),
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
