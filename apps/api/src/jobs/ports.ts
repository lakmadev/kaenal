/**
 * The AV engine port now lives in `providers/av` (Ports & Adapters). Re-exported
 * here so existing importers keep working while the migration settles.
 */
export type { Scanner, ScanInput } from "../providers/av/index.js";
export { StubScanner } from "../providers/av/index.js";

export type DeliveryChannel = "email" | "push" | "sms";

export interface DeliveryPayload {
  readonly channel: DeliveryChannel;
  readonly userId: string;
  readonly title: string;
  readonly body: string | null;
}

/**
 * The out-of-band delivery port (06 §1 `notify`). Production fans to
 * Resend/SES (email), Expo (push), Twilio (SMS); the stub records nothing and
 * reports success, so the pipeline runs end to end without provider credentials.
 * The in-app row itself is written synchronously by `NotificationsService`; this
 * port is only the extra channels.
 */
export interface DeliveryChannels {
  deliver(payload: DeliveryPayload): Promise<boolean>;
}

export class StubDelivery implements DeliveryChannels {
  deliver(_payload: DeliveryPayload): Promise<boolean> {
    return Promise.resolve(true);
  }
}
