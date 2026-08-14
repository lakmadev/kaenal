import { createCipheriv, createDecipheriv, randomBytes, hkdfSync } from "node:crypto";

/**
 * Encryption at rest for the TOTP shared secret (07 §4). The secret is a bearer
 * credential: anyone holding it can mint valid codes forever, so it must not sit
 * in the database in plaintext — a leaked backup would be a silent, permanent
 * 2FA bypass for every enrolled user. AES-256-GCM gives confidentiality plus an
 * authentication tag, so a tampered ciphertext fails to decrypt rather than
 * yielding attacker-chosen bytes.
 *
 * The key is either an explicit `MFA_ENCRYPTION_KEY` (32 bytes, base64 — the
 * right choice in production, so it can be rotated independently) or, absent
 * that, an HKDF-derived subkey of `AUTH_SECRET`. Deriving keeps a distinct key
 * for this purpose (never the raw session-signing secret) while needing no extra
 * configuration to work out of the box.
 */
const ALGORITHM = "aes-256-gcm";
const HKDF_INFO = "kaenal-mfa-totp-secret-v1";

function deriveKey(input: { authSecret: string; mfaKey?: string | undefined }): Buffer {
  if (input.mfaKey !== undefined && input.mfaKey !== "") {
    const key = Buffer.from(input.mfaKey, "base64");
    if (key.length !== 32) {
      throw new Error("MFA_ENCRYPTION_KEY must be exactly 32 bytes, base64-encoded");
    }
    return key;
  }
  // HKDF-SHA256 over AUTH_SECRET with a purpose-specific info label, so this key
  // is cryptographically separated from anything else derived from the secret.
  return Buffer.from(hkdfSync("sha256", Buffer.from(input.authSecret, "utf8"), new Uint8Array(0), HKDF_INFO, 32));
}

export class MfaCrypto {
  private readonly key: Buffer;

  constructor(input: { authSecret: string; mfaKey?: string | undefined }) {
    this.key = deriveKey(input);
  }

  /** Returns `iv.tag.ciphertext`, all base64. */
  encrypt(plaintext: string): string {
    const iv = randomBytes(12); // 96-bit nonce, the GCM standard
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64")}.${tag.toString("base64")}.${ciphertext.toString("base64")}`;
  }

  /** Inverse of `encrypt`; throws if the blob was tampered with or wrong-keyed. */
  decrypt(blob: string): string {
    const parts = blob.split(".");
    if (parts.length !== 3) throw new Error("malformed encrypted MFA secret");
    const [ivB64, tagB64, ctB64] = parts as [string, string, string];
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
  }
}
