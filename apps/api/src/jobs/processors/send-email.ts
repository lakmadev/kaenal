import type { SendEmailJob } from "../job-types.js";
import type { EmailPort } from "../../providers/email/index.js";

/**
 * Sends one fully-rendered transactional email (password reset, invite) through
 * the EmailPort. Off the request path so a slow or briefly-down provider can't
 * add latency to sign-in/invite, and BullMQ retries a transient send failure.
 *
 * The message is already complete (subject/html/text/to), so this processor
 * holds no template or tenant logic — it is a thin, provider-agnostic hand-off.
 */
export async function sendEmail(payload: SendEmailJob, deps: { email: EmailPort }): Promise<void> {
  await deps.email.send(payload.message);
}
