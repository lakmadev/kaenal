import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import {
  BRANDING_DEFAULTS,
  BrandingSettings,
  type BrandingDto,
  type UpdateBrandingBody,
} from "@kaenal/types";
import { ApiError } from "../errors.js";
import type { AuditContext } from "../ncr/audit-context.js";

interface SettingsRow {
  doc: unknown;
  lock_version: number;
}

const BRANDING_NS = "branding";
// Tenant-wide settings aren't a per-record entity; audit them against the tenant
// so the change shows in the workspace-level access log under `settings_changed`.
const SETTINGS_ENTITY_KIND = "settings";

/**
 * Per-tenant settings documents (`tenant_settings`, 0025). Each namespace holds
 * one JSONB `doc` whose shape is a Zod schema in `@kaenal/types`; the table is
 * generic so future settings screens reuse it. The first namespace is
 * `branding` (white-label). Reads merge the stored doc over the schema defaults
 * so a missing or partial row still returns a complete, valid document; writes
 * are optimistic (rule 6) and audited in the same transaction (rule 3).
 */
@Injectable()
export class SettingsService {
  async getBranding(tx: Tx): Promise<BrandingDto> {
    const { rows } = await tx.query<SettingsRow>(
      `SELECT doc, lock_version FROM tenant_settings WHERE namespace = $1`,
      [BRANDING_NS],
    );
    const row = rows[0];
    const stored = (row?.doc ?? {}) as Record<string, unknown>;
    const settings = BrandingSettings.parse({ ...BRANDING_DEFAULTS, ...stored });
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

    // Optimistic concurrency: an absent row is version 0 (what the GET returns
    // when unbranded). Any mismatch is a stale write, never a silent clobber.
    const { rows } = await tx.query<SettingsRow>(
      `SELECT doc, lock_version FROM tenant_settings WHERE namespace = $1`,
      [BRANDING_NS],
    );
    const current = rows[0];
    const currentVersion = current?.lock_version ?? 0;
    if (currentVersion !== version) {
      throw new ApiError("STALE_WRITE", "Branding changed since you loaded it", {
        expected: version,
        actual: currentVersion,
      });
    }

    const before = current?.doc ?? null;
    return withAudit(
      tx,
      tenantId,
      {
        actorId,
        actorKind: "user",
        entityKind: SETTINGS_ENTITY_KIND,
        entityId: tenantId,
        action: "settings_changed",
        before: { namespace: BRANDING_NS, doc: before },
        after: { namespace: BRANDING_NS, doc: settings },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        // The first save inserts at version 1 (NOT 0): a second writer who also
        // loaded the unbranded default (version 0) then hits the ON CONFLICT
        // guard `WHERE lock_version = 0`, finds version 1, and loses cleanly —
        // without the explicit 1 that first-write race would silently clobber.
        // Subsequent saves UPDATE, and the bump_lock_version trigger (0004)
        // advances the version.
        const { rows: written } = await t.query<SettingsRow>(
          `INSERT INTO tenant_settings (tenant_id, namespace, doc, lock_version, created_by, updated_by)
             VALUES ($1, $2, $3::jsonb, 1, $4, $4)
           ON CONFLICT (tenant_id, namespace) DO UPDATE
             SET doc = EXCLUDED.doc, updated_by = EXCLUDED.updated_by
             WHERE tenant_settings.lock_version = $5
           RETURNING doc, lock_version`,
          [tenantId, BRANDING_NS, JSON.stringify(settings), actorId, version],
        );
        const row = written[0];
        if (row === undefined) {
          // The ON CONFLICT WHERE guard didn't match — someone wrote between our
          // SELECT and this statement.
          throw new ApiError("STALE_WRITE", "Branding changed since you loaded it");
        }
        const doc = BrandingSettings.parse({ ...BRANDING_DEFAULTS, ...(row.doc as object) });
        return { ...doc, lockVersion: row.lock_version };
      },
    );
  }
}
