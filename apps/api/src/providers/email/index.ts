export type { EmailPort, EmailMessage, EmailResult, EmailProvider } from "./email.port.js";
export { createEmailPort } from "./factory.js";
export { ConsoleEmailAdapter } from "./console.adapter.js";
export { SesEmailAdapter, type SesEmailConfig } from "./ses.adapter.js";
export { renderPasswordReset, renderInvite, renderNotification } from "./templates.js";
