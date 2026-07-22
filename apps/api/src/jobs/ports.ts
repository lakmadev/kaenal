import type { ScanStatus } from "@kaenal/types";

/**
 * The AV engine port (06 §1 `files`). Production wires a ClamAV container that
 * streams the object's bytes; the default here is a stub that verdicts by
 * filename marker so the pipeline (and both outcomes) are exercisable without an
 * engine. The verdict is one of the `files.scan_status` states.
 */
export interface Scanner {
  scan(input: { filename: string; key: string }): Promise<Exclude<ScanStatus, "pending">>;
}

/** Default scanner: everything is clean unless the name carries the EICAR marker. */
export class StubScanner implements Scanner {
  scan(input: { filename: string; key: string }): Promise<Exclude<ScanStatus, "pending">> {
    const marked = /eicar|infected|malware/i.test(input.filename);
    return Promise.resolve(marked ? "infected" : "clean");
  }
}

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
