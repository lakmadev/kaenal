import type { Env } from "../../env.js";
import type { EmailPort } from "./email.port.js";
import { ConsoleEmailAdapter } from "./console.adapter.js";
import { SesEmailAdapter } from "./ses.adapter.js";

/**
 * Select the email adapter from configuration (never from code branches
 * elsewhere). `EMAIL_PROVIDER` decides; each provider's own settings are read
 * here so the adapters stay free of env-parsing. Default is `console`, so a
 * deploy that forgets to configure email degrades to logging rather than
 * throwing on the first send.
 */
export function createEmailPort(env: Env): EmailPort {
  switch (env.EMAIL_PROVIDER) {
    case "ses":
      return new SesEmailAdapter({
        from: env.MAIL_FROM,
        // SES region falls back to the S3 region so a single AWS deployment
        // needs only one region set, but can be overridden independently.
        region: env.AWS_REGION ?? env.S3_REGION,
        configurationSet: env.SES_CONFIGURATION_SET,
        // Prefer the IAM-role credential chain (no static keys). Only pass keys
        // when both are present — a half-configured pair is a config error, not
        // a silent fallback to anonymous.
        credentials:
          env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
            ? { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY }
            : undefined,
      });
    case "console":
      return new ConsoleEmailAdapter();
  }
}
