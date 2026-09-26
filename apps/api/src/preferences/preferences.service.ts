import { Injectable } from "@nestjs/common";
import { withAudit, type Tx } from "@kaenal/db";
import {
  USER_PREFERENCES_DEFAULTS,
  UserPreferencesSettings,
  type UpdateUserPreferencesBody,
  type UserPreferencesDto,
} from "@kaenal/types";
import { staleWriteError } from "../stale-write.js";
import type { AuditContext } from "../ncr/audit-context.js";

interface PrefRow {
  ai_prominence: string;
  accent: string;
  density: string;
  keyboard_shortcuts: boolean;
  show_keyboard_hints: boolean;
  locale: string;
  lock_version: number;
}

const COLUMNS =
  "ai_prominence, accent, density, keyboard_shortcuts, show_keyboard_hints, locale, lock_version";

function toDto(row: PrefRow): UserPreferencesDto {
  const settings = UserPreferencesSettings.parse({
    aiProminence: row.ai_prominence,
    accent: row.accent,
    density: row.density,
    keyboardShortcuts: row.keyboard_shortcuts,
    showKeyboardHints: row.show_keyboard_hints,
    locale: row.locale,
  });
  return { ...settings, lockVersion: row.lock_version };
}

const STALE = "Your preferences changed since you loaded them";

/**
 * Self-scoped user preferences (S1-9, S1-7). Every query filters `user_id =
 * actor` on top of tenant RLS, so a member reads/writes only their own row.
 * First save INSERTs at lock_version 1; later saves are compare-and-set on the
 * `version` the client read (rule 6) and audited in the same tx (rule 3).
 */
@Injectable()
export class PreferencesService {
  async get(tx: Tx, userId: string): Promise<UserPreferencesDto> {
    const { rows } = await tx.query<PrefRow>(`SELECT ${COLUMNS} FROM user_preferences WHERE user_id = $1`, [userId]);
    const row = rows[0];
    return row === undefined ? { ...USER_PREFERENCES_DEFAULTS, lockVersion: 0 } : toDto(row);
  }

  async update(
    tx: Tx,
    tenantId: string,
    userId: string,
    body: UpdateUserPreferencesBody,
    context: AuditContext,
  ): Promise<UserPreferencesDto> {
    const { version, ...patch } = body;
    const current = await this.get(tx, userId);
    if (current.lockVersion !== version) {
      throw await staleWriteError(tx, { table: "user_preferences", key: userId, message: STALE, expected: version, actual: current.lockVersion });
    }
    const { lockVersion: _lockVersion, ...before } = current;
    const merged = UserPreferencesSettings.parse({ ...before, ...patch });

    return withAudit(
      tx,
      tenantId,
      {
        actorId: userId,
        actorKind: "user",
        entityKind: "user_preferences",
        entityId: userId,
        action: "updated",
        before: { event: "preferences.update", ...before },
        after: { event: "preferences.update", ...merged },
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
      },
      async (t) => {
        const { rows } = await t.query<PrefRow>(
          `INSERT INTO user_preferences
             (tenant_id, user_id, ai_prominence, accent, density, keyboard_shortcuts, show_keyboard_hints, locale, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$2,$2)
           ON CONFLICT (tenant_id, user_id) DO UPDATE
             SET ai_prominence = EXCLUDED.ai_prominence, accent = EXCLUDED.accent, density = EXCLUDED.density,
                 keyboard_shortcuts = EXCLUDED.keyboard_shortcuts, show_keyboard_hints = EXCLUDED.show_keyboard_hints,
                 locale = EXCLUDED.locale, updated_by = EXCLUDED.updated_by
             WHERE user_preferences.lock_version = $9
           RETURNING ${COLUMNS}`,
          [
            tenantId,
            userId,
            merged.aiProminence,
            merged.accent,
            merged.density,
            merged.keyboardShortcuts,
            merged.showKeyboardHints,
            merged.locale,
            version,
          ],
        );
        const row = rows[0];
        if (row === undefined) throw await staleWriteError(t, { table: "user_preferences", key: userId, message: STALE });
        return toDto(row);
      },
    );
  }
}
