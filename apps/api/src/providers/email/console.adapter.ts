import type { EmailMessage, EmailPort, EmailResult } from "./email.port.js";

/**
 * The default email adapter: it never sends anything, it logs a one-line record
 * of what *would* have been sent and returns a synthetic id. This is what runs
 * in dev, in tests, and in any deploy without email credentials, so every flow
 * that ends in an email (password reset, invite, notification fan-out) works end
 * to end without a provider.
 *
 * It deliberately logs only non-sensitive envelope fields — recipient, subject,
 * and tag keys — never the body, which routinely contains reset/invite links
 * that are bearer credentials (07 §4). Even in dev those should not sit in logs.
 */
export class ConsoleEmailAdapter implements EmailPort {
  constructor(private readonly log: (line: string) => void = console.info) {}

  send(message: EmailMessage): Promise<EmailResult> {
    const id = `console-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    this.log(`[email:console] to=<${message.to}> subject=${JSON.stringify(message.subject)} id=${id}`);
    return Promise.resolve({ id });
  }
}
