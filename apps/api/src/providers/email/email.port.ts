/**
 * Email port (Ports & Adapters). The app sends transactional email through this
 * interface only; which provider actually delivers it (SES, Postmark, a console
 * logger in dev) is chosen by `createEmailPort` from `EMAIL_PROVIDER`. Nothing
 * outside `providers/email/*.adapter.ts` imports a provider SDK, so switching
 * providers is one new adapter + one env var.
 */

/** The set of providers with an adapter. Adding one = a new adapter + a factory case. */
export type EmailProvider = "console" | "ses";

export interface EmailMessage {
  /** Recipient address. One per message — fan-out is the caller's job. */
  readonly to: string;
  readonly subject: string;
  /** Rendered HTML body. */
  readonly html: string;
  /**
   * Plaintext alternative. Required, not optional: a missing text part hurts
   * deliverability (spam filters penalise HTML-only mail) and accessibility.
   */
  readonly text: string;
  /** Optional Reply-To, e.g. a tenant support address. */
  readonly replyTo?: string;
  /**
   * Provider-agnostic key/value metadata (category, tenant, notification kind).
   * Adapters map these to their own tag mechanism, or ignore them. Never put
   * secrets or PII here — some providers surface tags in dashboards/logs.
   */
  readonly tags?: Readonly<Record<string, string>>;
}

export interface EmailResult {
  /** Provider message id when the provider returns one, else null. */
  readonly id: string | null;
}

export interface EmailPort {
  send(message: EmailMessage): Promise<EmailResult>;
}
