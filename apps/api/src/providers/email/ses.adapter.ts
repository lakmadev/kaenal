import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import type { EmailMessage, EmailPort, EmailResult } from "./email.port.js";

export interface SesEmailConfig {
  /** Verified From address, e.g. `Kaenal <no-reply@mail.kaenal.app>`. */
  readonly from: string;
  readonly region: string;
  /**
   * Optional SES configuration set — the hook for bounce/complaint event
   * publishing to SNS/CloudWatch. Without it, hard bounces silently erode
   * sender reputation, so production should always set one.
   */
  readonly configurationSet?: string | undefined;
  /**
   * Optional static credentials. Omitted in production, where the task/pod runs
   * under an IAM role and the SDK's default credential chain supplies them —
   * that is the right way (no long-lived keys in env). Provided only where a
   * role isn't available.
   */
  readonly credentials?: { accessKeyId: string; secretAccessKey: string } | undefined;
}

/**
 * Amazon SES adapter (SES v2). The only file that imports the SES SDK, so the
 * rest of the app has no idea which provider is in use — swapping to Postmark or
 * Resend is a sibling adapter plus a factory case, nothing more.
 */
export class SesEmailAdapter implements EmailPort {
  private readonly client: SESv2Client;

  constructor(private readonly config: SesEmailConfig) {
    this.client = new SESv2Client({
      region: config.region,
      ...(config.credentials ? { credentials: config.credentials } : {}),
    });
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    const out = await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.config.from,
        Destination: { ToAddresses: [message.to] },
        ...(message.replyTo ? { ReplyToAddresses: [message.replyTo] } : {}),
        ...(this.config.configurationSet
          ? { ConfigurationSetName: this.config.configurationSet }
          : {}),
        ...(message.tags
          ? {
              // SES tag values are constrained to [A-Za-z0-9_-]; anything else is
              // dropped rather than risking a rejected send over a metadata tag.
              EmailTags: Object.entries(message.tags)
                .filter(([k, v]) => /^[\w-]+$/.test(k) && /^[\w-]+$/.test(v))
                .map(([Name, Value]) => ({ Name, Value })),
            }
          : {}),
        Content: {
          Simple: {
            Subject: { Data: message.subject, Charset: "UTF-8" },
            Body: {
              Html: { Data: message.html, Charset: "UTF-8" },
              Text: { Data: message.text, Charset: "UTF-8" },
            },
          },
        },
      }),
    );
    return { id: out.MessageId ?? null };
  }
}
