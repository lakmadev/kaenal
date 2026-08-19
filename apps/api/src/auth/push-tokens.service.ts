import type pg from "pg";

/**
 * Device push-token registry (control-plane). A device belongs to a person, so
 * tokens are keyed by `control.users.id` and read back at delivery time regardless
 * of tenant. `register` upserts on the unique token — re-registering the same
 * physical device reassigns it to the current user (safe account/device handoff).
 */
export class PushTokensService {
  constructor(private readonly control: pg.Pool) {}

  async register(userId: string, token: string, platform: string | null): Promise<void> {
    await this.control.query(
      `INSERT INTO control.push_tokens (user_id, token, platform)
         VALUES ($1, $2, $3)
       ON CONFLICT (token)
         DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, last_seen_at = now()`,
      [userId, token, platform],
    );
  }

  async unregister(token: string): Promise<void> {
    await this.control.query("DELETE FROM control.push_tokens WHERE token = $1", [token]);
  }

  /** The registered Expo push tokens for a user (used by the delivery pipeline). */
  async tokensFor(userId: string): Promise<string[]> {
    const { rows } = await this.control.query<{ token: string }>(
      "SELECT token FROM control.push_tokens WHERE user_id = $1",
      [userId],
    );
    return rows.map((r) => r.token);
  }
}
