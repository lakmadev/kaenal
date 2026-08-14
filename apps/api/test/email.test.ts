import { describe, expect, it, vi } from "vitest";
import type pg from "pg";
import { loadEnv } from "../src/env.js";
import { createEmailPort } from "../src/providers/email/factory.js";
import { ConsoleEmailAdapter } from "../src/providers/email/console.adapter.js";
import { SesEmailAdapter } from "../src/providers/email/ses.adapter.js";
import { renderPasswordReset, renderInvite, renderNotification } from "../src/providers/email/templates.js";
import type { EmailMessage, EmailPort, EmailResult } from "../src/providers/email/email.port.js";
import { ChannelDelivery } from "../src/notifications/channel-delivery.js";

/**
 * Email provider layer (providers/email). Pure unit tests — no DB, no network —
 * exercising the Ports & Adapters seam: the factory selects an adapter from
 * config, the console adapter is send-safe, templates render both parts, and the
 * notification channel resolves a recipient and hands the message to the port.
 */

const BASE_ENV: NodeJS.ProcessEnv = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  DATABASE_APP_URL: "postgres://u:p@localhost:5432/db",
  DATABASE_PUBLIC_URL: "postgres://u:p@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  AUTH_SECRET: "0123456789abcdef0123456789abcdef",
  APP_BASE_URL: "http://localhost:3000",
};

/** An EmailPort that records what it was asked to send. */
class FakeEmailPort implements EmailPort {
  readonly sent: EmailMessage[] = [];
  send(message: EmailMessage): Promise<EmailResult> {
    this.sent.push(message);
    return Promise.resolve({ id: "fake-1" });
  }
}

/** A pg.Pool stub whose query() returns a fixed rows array. */
function fakeControl(rows: unknown[]): pg.Pool {
  return { query: vi.fn().mockResolvedValue({ rows }) } as unknown as pg.Pool;
}

describe("createEmailPort — config selects the adapter", () => {
  it("returns the console adapter by default", () => {
    const port = createEmailPort(loadEnv(BASE_ENV));
    expect(port).toBeInstanceOf(ConsoleEmailAdapter);
  });

  it("returns the SES adapter when EMAIL_PROVIDER=ses", () => {
    const port = createEmailPort(
      loadEnv({ ...BASE_ENV, EMAIL_PROVIDER: "ses", MAIL_FROM: "Kaenal <no-reply@x.test>", AWS_REGION: "eu-west-1" }),
    );
    expect(port).toBeInstanceOf(SesEmailAdapter);
  });
});

describe("ConsoleEmailAdapter", () => {
  it("resolves with an id and logs only the envelope, never the body", async () => {
    const lines: string[] = [];
    const adapter = new ConsoleEmailAdapter((l) => lines.push(l));

    const result = await adapter.send({
      to: "person@acme.test",
      subject: "Reset your password",
      html: "<a href='http://x/reset?token=SECRET'>reset</a>",
      text: "http://x/reset?token=SECRET",
    });

    expect(result.id).toMatch(/^console-/);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("person@acme.test");
    expect(lines[0]).toContain("Reset your password");
    // The body carries the bearer token — it must not reach the log.
    expect(lines[0]).not.toContain("SECRET");
  });
});

describe("templates render both an HTML and a text part with the link", () => {
  it("password reset embeds the url in both parts", () => {
    const url = "http://localhost:3000/reset-password?token=abc";
    const msg = renderPasswordReset({ url, expiresMinutes: 30 });
    expect(msg.subject).toMatch(/reset/i);
    expect(msg.html).toContain(url);
    expect(msg.text).toContain(url);
    expect(msg.text).toContain("30 minutes");
    expect(msg.tags?.category).toBe("password_reset");
  });

  it("invite embeds the url and workspace name", () => {
    const url = "http://localhost:3000/invite/tok?workspace=acme";
    const msg = renderInvite({ url, workspaceName: "acme", expiresHours: 168 });
    expect(msg.subject).toContain("acme");
    expect(msg.html).toContain(url);
    expect(msg.text).toContain(url);
  });

  it("notification carries the title and body", () => {
    const msg = renderNotification({ title: "NCR assigned", body: "NCR-2026-0001", kind: "ncr_assigned" });
    expect(msg.subject).toBe("NCR assigned");
    expect(msg.text).toContain("NCR-2026-0001");
    expect(msg.tags?.kind).toBe("ncr_assigned");
  });
});

describe("ChannelDelivery — resolves the recipient and delegates to the port", () => {
  it("emails an active user at their address and reports delivered", async () => {
    const email = new FakeEmailPort();
    const control = fakeControl([{ email: "worker@acme.test", status: "active" }]);
    const delivery = new ChannelDelivery({ email, control });

    const ok = await delivery.deliver({
      channel: "email",
      userId: "u-1",
      title: "NCR assigned to you",
      body: "Weld porosity",
    });

    expect(ok).toBe(true);
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]?.to).toBe("worker@acme.test");
    expect(email.sent[0]?.subject).toBe("NCR assigned to you");
  });

  it("does not send to a missing or disabled user, and reports not-delivered", async () => {
    const email = new FakeEmailPort();
    const disabled = new ChannelDelivery({ email, control: fakeControl([{ email: "x@acme.test", status: "disabled" }]) });
    const missing = new ChannelDelivery({ email, control: fakeControl([]) });

    expect(await disabled.deliver({ channel: "email", userId: "u", title: "t", body: null })).toBe(false);
    expect(await missing.deliver({ channel: "email", userId: "u", title: "t", body: null })).toBe(false);
    expect(email.sent).toHaveLength(0);
  });

  it("reports not-delivered for channels without a port yet (push/sms)", async () => {
    const email = new FakeEmailPort();
    const delivery = new ChannelDelivery({ email, control: fakeControl([]) });

    expect(await delivery.deliver({ channel: "push", userId: "u", title: "t", body: null })).toBe(false);
    expect(await delivery.deliver({ channel: "sms", userId: "u", title: "t", body: null })).toBe(false);
    expect(email.sent).toHaveLength(0);
  });
});
