import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import {
  BRANDING_DEFAULTS,
  BrandingSettings,
  SESSION_POLICY_DEFAULTS,
  SessionPolicy,
  type BrandingDto,
  type SessionPolicyDto,
  type UpdateBrandingBody,
  type UpdateSessionPolicyBody,
} from "@kaenal/types";
import { ApiError } from "../errors.js";
import type { AuditContext } from "../ncr/audit-context.js";

interface SettingsRow {
  // jsonb comes back from pg already parsed into a plain object.
  doc: Record<string, unknown>;
  lock_version: number;
}

const BRANDING_NS = "branding";
const SESSION_NS = "session";
// Tenant-wide settings aren't a per-record entity; audit them against the tenant
// so the change shows in the workspace-level access log under `settings_changed`.
const SETTINGS_ENTITY_KIND = "settings";

/** Read one namespace's stored doc + lock version (defaults to {} / 0). */
async function readRow(tx: Tx, namespace: string): Promise<SettingsRow | undefined> {
  const { rows } = await tx.query<SettingsRow>(
    `SELECT doc, lock_version FROM tenant_settings WHERE namespace = $1`,
    [namespace],
  );
  return rows[0];
}

/**
 * Load the tenant's session policy (namespace 'session') merged over defaults.
 * Standalone so `AuthService.signIn` can enforce it without depending on the
 * settings module. A missing/partial row still yields a complete, valid policy.
 */
export async function loadSessionPolicy(tx: Tx): Promise<SessionPolicy> {
  const row = await readRow(tx, SESSION_NS);
  const stored = row?.doc ?? {};
  return SessionPolicy.parse({ ...SESSION_POLICY_DEFAULTS, ...stored });
}

/**
 * Per-tenant settings documents (`tenant_settings`, 0025/0027). Each namespace
 * holds one JSONB `doc` whose shape is a Zod schema in `@kaenal/types`; reads
 * merge the stored doc over the schema defaults, and writes are optimistic
 * (rule 6) and audited in the same transaction (rule 3). The first save of a
 * namespace INSERTs at `lock_version = 1` (not 0) so a second writer who also
 * loaded the version-0 default loses the ON CONFLICT guard cleanly instead of
 * silently clobbering.
 */
@Injectable()
export class SettingsService {
  private async writeDoc(
    tx: Tx,
    tenantId: string,
    actorId: string,
    namespace: string,
    version: number,
    settings: Record<string, unknown>,
    context: AuditContext,
  ): Promise<SettingsRow> {
    const current = await readRow(tx, namespace);
    const currentVersion = current?.lock_version ?? 0;
    if (currentVersion !== version) {
      throw new ApiError("STALE_WRITE", "This setting changed since you loaded it", {
        expected: version,
        actual: currentVersion,
      });
    }

    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: SETTINGS_ENTITY_KIND,
        entityId: tenantId,
        action: "settings_changed",
        before: { namespace, doc: current?.doc ?? null },
        after: { namespace, doc: settings },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<SettingsRow>(
          `INSERT INTO tenant_settings (tenant_id, namespace, doc, lock_version, created_by, updated_by)
             VALUES ($1, $2, $3::jsonb, 1, $4, $4)
           ON CONFLICT (tenant_id, namespace) DO UPDATE
             SET doc = EXCLUDED.doc, updated_by = EXCLUDED.updated_by
             WHERE tenant_settings.lock_version = $5
           RETURNING doc, lock_version`,
          [tenantId, namespace, JSON.stringify(settings), actorId, version],
        );
        const row = rows[0];
        if (row === undefined) throw new ApiError("STALE_WRITE", "This setting changed since you loaded it");
        return row;
      },
    );
  }

  // --- Branding ------------------------------------------------------------
  async getBranding(tx: Tx): Promise<BrandingDto> {
    const row = await readRow(tx, BRANDING_NS);
    const settings = BrandingSettings.parse({ ...BRANDING_DEFAULTS, ...(row?.doc ?? {}) });
    return { ...settings, lockVersion: row?.lock_version ?? 0 };
  }

  async updateBranding(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: UpdateBrandingBody,
    context: AuditContext,
  ): Promise<BrandingDto> {
    const { version, ...settings } = body;
    const row = await this.writeDoc(tx, tenantId, actorId, BRANDING_NS, version, settings, context);
    const doc = BrandingSettings.parse({ ...BRANDING_DEFAULTS, ...row.doc });
    return { ...doc, lockVersion: row.lock_version };
  }

  // --- Session policy ------------------------------------------------------
  async getSessionPolicy(tx: Tx): Promise<SessionPolicyDto> {
    const row = await readRow(tx, SESSION_NS);
    const policy = SessionPolicy.parse({ ...SESSION_POLICY_DEFAULTS, ...(row?.doc ?? {}) });
    return { ...policy, lockVersion: row?.lock_version ?? 0 };
  }

  async updateSessionPolicy(
    tx: Tx,
    tenantId: string,
    actorId: string,
    body: UpdateSessionPolicyBody,
    context: AuditContext,
  ): Promise<SessionPolicyDto> {
    const { version, ...settings } = body;
    const row = await this.writeDoc(tx, tenantId, actorId, SESSION_NS, version, settings, context);
    const policy = SessionPolicy.parse({ ...SESSION_POLICY_DEFAULTS, ...row.doc });
    return { ...policy, lockVersion: row.lock_version };
  }
}
