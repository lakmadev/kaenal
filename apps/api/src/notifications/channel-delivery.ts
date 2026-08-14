import type pg from "pg";
import type { DeliveryChannels, DeliveryPayload } from "../jobs/ports.js";
import type { EmailPort } from "../providers/email/index.js";
import { renderNotification } from "../providers/email/index.js";

/**
 * The real out-of-band delivery channel (replaces `StubDelivery`). Given a
 * notification's `{channel, userId, title, body}`, it reaches the user on that
 * channel. Today only `email` is wired — through the `EmailPort`, so the actual
 * provider (SES/console) is swappable — and `push`/`sms` return `false` until
 * their ports ship. Returning `false` (rather than throwing) means the
 * deliver-notification job records only what genuinely went out in
 * `channels_sent` and a later channel can still be added without re-sending.
 *
 * Recipient contact resolution lives here, not in the adapter: the adapter's job
 * is "send this message", not "know who the user is". The address comes from
 * `control.users` (global identity), read through the control pool.
 */
export class ChannelDelivery implements DeliveryChannels {
  constructor(private readonly deps: { email: EmailPort; control: pg.Pool }) {}

  async deliver(payload: DeliveryPayload): Promise<boolean> {
    switch (payload.channel) {
      case "email":
        return this.deliverEmail(payload);
      case "push":
      case "sms":
        // No port yet — the pipeline treats this as "not delivered on this
        // channel", so nothing is recorded as sent and no retry is spent.
        return false;
    }
  }

  private async deliverEmail(payload: DeliveryPayload): Promise<boolean> {
    const { rows } = await this.deps.control.query<{ email: string; status: string }>(
      "SELECT email, status FROM control.users WHERE id = $1",
      [payload.userId],
    );
    const user = rows[0];
    // No address, or a disabled account, is not an error — just nothing to send.
    if (user === undefined || user.status !== "active") return false;

    const content = renderNotification({
      title: payload.title,
      body: payload.body,
      kind: "notification",
    });
    // A send that resolves counts as delivered; a provider failure throws, which
    // fails the job and lets BullMQ retry rather than marking a phantom send.
    await this.deps.email.send({ to: user.email, ...content });
    return true;
  }
}
