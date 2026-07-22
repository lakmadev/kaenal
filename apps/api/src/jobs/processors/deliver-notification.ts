import { withTenant } from "@kaenal/db";
import type { DeliverNotificationJob } from "../job-types.js";
import type { DeliveryChannel, DeliveryChannels } from "../ports.js";

const CHANNELS: readonly DeliveryChannel[] = ["email", "push", "sms"];

/**
 * Out-of-band delivery of an in-app notification (06 §1 `notify`). The in-app
 * row already exists (written synchronously by `NotificationsService`); this
 * fans it to the channels the user enabled for its kind in `notification_prefs`,
 * and records what was sent in `channels_sent`. Idempotent: a channel already in
 * `channels_sent` is skipped, so a retry never re-sends. Notifications are a
 * delivery artifact (07 §1), so — like the rest of the notifications slice —
 * this does not write audit events.
 */
export async function deliverNotification(
  payload: DeliverNotificationJob,
  deps: { delivery: DeliveryChannels },
): Promise<{ channels: DeliveryChannel[] }> {
  return withTenant(payload.tenantId, null, async (tx) => {
    const { rows } = await tx.query<{
      id: string;
      user_id: string;
      kind: string;
      title: string;
      body: string | null;
      channels_sent: string[];
      matrix: Record<string, Partial<Record<DeliveryChannel, boolean>>>;
    }>(
      `SELECT n.id, n.user_id, n.kind, n.title, n.body, n.channels_sent,
              COALESCE(pr.matrix, '{}'::jsonb) AS matrix
         FROM notifications n
         LEFT JOIN notification_prefs pr ON pr.user_id = n.user_id
        WHERE n.id = $1`,
      [payload.notificationId],
    );
    const n = rows[0];
    if (n === undefined) return { channels: [] };

    const prefs = n.matrix[n.kind] ?? {};
    const sent: DeliveryChannel[] = [];

    for (const channel of CHANNELS) {
      if (prefs[channel] !== true) continue; // user opted out (default is off)
      if (n.channels_sent.includes(channel)) continue; // already delivered

      const ok = await deps.delivery.deliver({ channel, userId: n.user_id, title: n.title, body: n.body });
      if (ok) sent.push(channel);
    }

    if (sent.length > 0) {
      await tx.query("UPDATE notifications SET channels_sent = channels_sent || $2::text[] WHERE id = $1", [
        n.id,
        sent,
      ]);
    }
    return { channels: sent };
  });
}
