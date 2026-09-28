import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import type { WebhookTargetPolicy } from "@kaenal/types";
import type { SecretResolver } from "../tenant/secret-resolver.js";

/**
 * The real (smallest honest) store for webhook signing secrets.
 *
 * There was no secret manager behind `credentials_ref` for webhooks (only
 * `env:`/`localdb:` DB-URL pointers), so a secret typed into a form had nowhere
 * to live. Here it is envelope-encrypted with AES-256-GCM under a server key and
 * kept IN the `credentials_ref` column as an `enc:v1:` value — never plaintext,
 * never returned by any read (the DTO exposes only `hasCredentials`). A leaked DB
 * backup alone cannot sign deliveries; the key lives in the environment. A cloud
 * secret manager (`awssm:` …) can replace this behind the same resolver seam.
 *
 * Key: `WEBHOOK_ENCRYPTION_KEY` (32 bytes, base64) or an HKDF subkey of
 * `AUTH_SECRET` with a purpose-specific label (distinct from the MFA key).
 */
const ALGORITHM = "aes-256-gcm";
const HKDF_INFO = "kaenal-webhook-signing-secret-v1";
export const ENC_PREFIX = "enc:v1:";

export class WebhookSecretBox {
  private readonly key: Buffer;

  constructor(input: { authSecret: string; key?: string | undefined }) {
    if (input.key !== undefined && input.key !== "") {
      const key = Buffer.from(input.key, "base64");
      if (key.length !== 32) throw new Error("WEBHOOK_ENCRYPTION_KEY must be exactly 32 bytes, base64-encoded");
      this.key = key;
    } else {
      this.key = Buffer.from(hkdfSync("sha256", Buffer.from(input.authSecret, "utf8"), new Uint8Array(0), HKDF_INFO, 32));
    }
  }

  /** A fresh, high-entropy signing secret (shown to the admin exactly once). */
  static generateSecret(): string {
    return `whsec_${randomBytes(32).toString("base64url")}`;
  }

  /** `enc:v1:<iv>.<tag>.<ciphertext>` — safe to store in `credentials_ref`. */
  seal(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return `${ENC_PREFIX}${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${ct.toString("base64")}`;
  }

  open(ref: string): string {
    if (!ref.startsWith(ENC_PREFIX)) throw new Error("not an encrypted webhook secret");
    const parts = ref.slice(ENC_PREFIX.length).split(".");
    if (parts.length !== 3) throw new Error("malformed encrypted webhook secret");
    const [iv, tag, ct] = parts as [string, string, string];
    const d = createDecipheriv(ALGORITHM, this.key, Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8");
  }
}

/** Resolves `enc:v1:` webhook secrets locally; every other scheme goes to the base resolver. */
export class WebhookSecretResolver implements SecretResolver {
  constructor(
    private readonly box: WebhookSecretBox,
    private readonly base: SecretResolver,
  ) {}

  resolve(ref: string): Promise<string> {
    if (ref.startsWith(ENC_PREFIX)) {
      try {
        return Promise.resolve(this.box.open(ref));
      } catch {
        // Never echo ciphertext; a wrong key/tamper is an operator-facing failure.
        return Promise.reject(new Error("signing secret could not be decrypted (wrong or rotated server key)"));
      }
    }
    return this.base.resolve(ref);
  }
}

/** The SSRF policy a deployment runs with (dev/test flag; forced strict in production). */
export function webhookPolicyFromEnv(source: NodeJS.ProcessEnv = process.env): WebhookTargetPolicy {
  return {
    allowPrivateTargets: source["WEBHOOK_ALLOW_PRIVATE_TARGETS"] === "true" && source["NODE_ENV"] !== "production",
  };
}
