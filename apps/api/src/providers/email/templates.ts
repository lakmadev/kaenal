import type { EmailMessage } from "./email.port.js";

/**
 * Transactional email content (the *what*, separate from the provider *how*).
 * Pure render functions returning a full `EmailMessage` sans recipient — the
 * caller supplies `to`. Every template ships both an HTML and a plaintext part.
 *
 * These are intentionally plain, inline-styled HTML: transactional mail must
 * render in every client (including text-only and locked-down corporate ones),
 * and no external CSS/images survive that. Per-tenant white-label branding is a
 * later layer that will thread a brand name/colour/logo through here.
 */

const APP_NAME = "Kaenal";

/** Minimal inline-styled shell shared by every template. */
function layout(heading: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:32px">
      <tr><td style="font-size:13px;font-weight:700;letter-spacing:-0.01em;color:#71717a;padding-bottom:20px">${APP_NAME}</td></tr>
      <tr><td style="font-size:20px;font-weight:700;letter-spacing:-0.02em;padding-bottom:12px">${heading}</td></tr>
      ${bodyHtml}
    </table>
    <div style="font-size:11px;color:#a1a1aa;padding-top:16px">This is an automated message from ${APP_NAME}.</div>
  </td></tr></table>
</body></html>`;
}

function button(url: string, label: string): string {
  return `<tr><td style="padding:8px 0 20px"><a href="${url}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:8px">${label}</a></td></tr>`;
}

function paragraph(text: string): string {
  return `<tr><td style="font-size:14px;line-height:1.6;color:#3f3f46;padding-bottom:12px">${text}</td></tr>`;
}

/** Password reset (07 §2). `url` embeds the single-use token. */
export function renderPasswordReset(input: { url: string; expiresMinutes: number }): Omit<EmailMessage, "to"> {
  return {
    subject: `Reset your ${APP_NAME} password`,
    html: layout(
      "Reset your password",
      paragraph(`We received a request to reset your password. This link expires in ${input.expiresMinutes} minutes and can be used once.`) +
        button(input.url, "Reset password") +
        paragraph(`If you didn't request this, you can safely ignore this email — your password won't change.`),
    ),
    text:
      `Reset your ${APP_NAME} password\n\n` +
      `We received a request to reset your password. Open this link (expires in ${input.expiresMinutes} minutes, single use):\n${input.url}\n\n` +
      `If you didn't request this, ignore this email — your password won't change.`,
    tags: { category: "password_reset" },
  };
}

/** Workspace invitation (03 §2). `url` embeds the invite token. */
export function renderInvite(input: {
  url: string;
  workspaceName: string;
  expiresHours: number;
}): Omit<EmailMessage, "to"> {
  return {
    subject: `You've been invited to ${input.workspaceName} on ${APP_NAME}`,
    html: layout(
      `Join ${input.workspaceName}`,
      paragraph(`You've been invited to the <strong>${input.workspaceName}</strong> workspace on ${APP_NAME}. Accept the invitation to set your password and get started.`) +
        button(input.url, "Accept invitation") +
        paragraph(`This invitation expires in ${input.expiresHours} hours.`),
    ),
    text:
      `You've been invited to ${input.workspaceName} on ${APP_NAME}\n\n` +
      `Accept the invitation to set your password and get started (expires in ${input.expiresHours} hours):\n${input.url}`,
    tags: { category: "invite" },
  };
}

/** Out-of-band copy of an in-app notification's title/body. */
export function renderNotification(input: {
  title: string;
  body: string | null;
  kind: string;
}): Omit<EmailMessage, "to"> {
  return {
    subject: input.title,
    html: layout(input.title, input.body ? paragraph(input.body) : paragraph("Open Kaenal to view the details.")),
    text: `${input.title}${input.body ? `\n\n${input.body}` : ""}`,
    tags: { category: "notification", kind: input.kind },
  };
}
