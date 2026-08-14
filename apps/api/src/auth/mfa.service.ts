import { randomBytes } from "node:crypto";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import type pg from "pg";
import { ApiError } from "../errors.js";
import { hashToken } from "./passwords.js";
import type { MfaCrypto } from "./mfa-crypto.js";

/**
 * Multi-factor authentication (TOTP) — the per-login second factor and its
 * lifecycle (07 §4). Enrolment is two-phase: a PENDING secret is generated and
 * shown as a QR, but only ACTIVATED — and only then does it gate login — once the
 * user proves they can produce a valid code from it. Recovery codes are
 * single-use fallbacks so a lost authenticator never means a locked-out account.
 *
 * Secrets live encrypted (MfaCrypto); recovery codes live as SHA-256 hashes of
 * high-entropy values (like every other bearer token here). Nothing readable is
 * stored, so a database leak yields neither working codes nor the seed.
 */

const ISSUER = "Kaenal";
const RECOVERY_CODE_COUNT = 10;
/** ±1 period (±30s) tolerance for clock skew between the phone and the server. */
const TOTP_WINDOW = 1;

export interface MfaStatus {
  readonly enrolled: boolean;
  readonly pending: boolean;
  readonly recoveryCodesRemaining: number;
  /** When the active factor was enrolled (ISO), or null if not enrolled. */
  readonly enrolledAt: string | null;
}

interface MfaRow {
  email: string;
  mfa_secret: string | null;
  mfa_pending_secret: string | null;
  mfa_enrolled_at: Date | null;
}

export class MfaService {
  constructor(
    private readonly control: pg.Pool,
    private readonly crypto: MfaCrypto,
  ) {}

  async status(userId: string): Promise<MfaStatus> {
    const row = await this.row(userId);
    const { rows } = await this.control.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM control.mfa_recovery_codes WHERE user_id = $1 AND used_at IS NULL",
      [userId],
    );
    return {
      enrolled: row.mfa_secret !== null,
      pending: row.mfa_pending_secret !== null,
      recoveryCodesRemaining: rows[0]?.n ?? 0,
      enrolledAt: row.mfa_enrolled_at === null ? null : row.mfa_enrolled_at.toISOString(),
    };
  }

  /**
   * Begin enrolment: mint a fresh secret, store it (encrypted) as PENDING, and
   * return the otpauth URI + a QR data-URI to scan. Not yet active — login is
   * unaffected until `activate` succeeds. Re-calling overwrites any prior pending
   * secret. Refused if MFA is already active (disable first).
   */
  async startEnrollment(userId: string): Promise<{ otpauthUri: string; qrDataUri: string }> {
    const row = await this.row(userId);
    if (row.mfa_secret !== null) {
      throw new ApiError("CONFLICT", "Multi-factor authentication is already enabled");
    }

    const secret = new OTPAuth.Secret({ size: 20 }); // 160-bit, the RFC 4226 recommendation
    const totp = this.totp(row.email, secret.base32);
    const otpauthUri = totp.toString();

    await this.control.query("UPDATE control.users SET mfa_pending_secret = $2 WHERE id = $1", [
      userId,
      this.crypto.encrypt(secret.base32),
    ]);

    const qrDataUri = await QRCode.toDataURL(otpauthUri, { margin: 1, width: 240 });
    return { otpauthUri, qrDataUri };
  }

  /**
   * Activate a pending enrolment by proving one code, then issue recovery codes.
   * The plaintext recovery codes are returned ONCE here and never again — only
   * their hashes are stored.
   */
  async activate(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const row = await this.row(userId);
    if (row.mfa_pending_secret === null) {
      throw new ApiError("CONFLICT", "Start enrolment before activating");
    }
    const secretB32 = this.crypto.decrypt(row.mfa_pending_secret);
    if (!this.verifyTotp(row.email, secretB32, code)) {
      throw new ApiError("VALIDATION_FAILED", "That code is not valid — check your authenticator and try again");
    }

    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => randomBytes(10).toString("hex"));

    // Promote pending → active and (re)issue recovery codes atomically.
    const client = await this.control.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE control.users SET mfa_secret = mfa_pending_secret, mfa_pending_secret = NULL, mfa_enrolled_at = now() WHERE id = $1",
        [userId],
      );
      await client.query("DELETE FROM control.mfa_recovery_codes WHERE user_id = $1", [userId]);
      for (const c of codes) {
        await client.query("INSERT INTO control.mfa_recovery_codes (user_id, code_hash) VALUES ($1, $2)", [
          userId,
          hashToken(c),
        ]);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    return { recoveryCodes: codes.map(formatRecoveryCode) };
  }

  /**
   * Verify a factor at login: a TOTP code first, then — if that fails — a
   * single-use recovery code. Returns whether authentication succeeded. Consumes
   * a recovery code only on a match. The caller has already verified the password.
   */
  async verifyLogin(userId: string, code: string): Promise<boolean> {
    const row = await this.row(userId);
    if (row.mfa_secret === null) return false; // not enrolled — nothing to verify

    if (this.verifyTotp(row.email, this.crypto.decrypt(row.mfa_secret), code)) return true;
    return this.redeemRecoveryCode(userId, code);
  }

  /** Disable MFA entirely — requires proving a current code first. */
  async disable(userId: string, code: string): Promise<void> {
    const ok = await this.verifyLogin(userId, code);
    if (!ok) throw new ApiError("VALIDATION_FAILED", "That code is not valid");

    const client = await this.control.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE control.users SET mfa_secret = NULL, mfa_pending_secret = NULL, mfa_enrolled_at = NULL WHERE id = $1",
        [userId],
      );
      await client.query("DELETE FROM control.mfa_recovery_codes WHERE user_id = $1", [userId]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Issue a fresh set of recovery codes, invalidating every existing one —
   * requires proving a current factor first (same gate as `disable`). Used when a
   * user is running low or believes their saved codes were exposed. Returns the
   * new plaintext codes ONCE; only their hashes are stored.
   */
  async regenerateRecoveryCodes(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const ok = await this.verifyLogin(userId, code);
    if (!ok) throw new ApiError("VALIDATION_FAILED", "That code is not valid");

    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => randomBytes(10).toString("hex"));
    const client = await this.control.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM control.mfa_recovery_codes WHERE user_id = $1", [userId]);
      for (const c of codes) {
        await client.query("INSERT INTO control.mfa_recovery_codes (user_id, code_hash) VALUES ($1, $2)", [
          userId,
          hashToken(c),
        ]);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    return { recoveryCodes: codes.map(formatRecoveryCode) };
  }

  private async redeemRecoveryCode(userId: string, input: string): Promise<boolean> {
    const hash = hashToken(normalizeRecoveryCode(input));
    // Single indexed lookup + atomic consume: the UPDATE ... RETURNING both finds
    // and marks the code, so the same code cannot be redeemed twice under a race.
    const { rows } = await this.control.query<{ id: string }>(
      "UPDATE control.mfa_recovery_codes SET used_at = now() WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL RETURNING id",
      [userId, hash],
    );
    return rows.length > 0;
  }

  private verifyTotp(email: string, secretB32: string, code: string): boolean {
    const normalized = code.replace(/\s/g, "");
    // validate returns the time-step delta on a match, or null.
    return this.totp(email, secretB32).validate({ token: normalized, window: TOTP_WINDOW }) !== null;
  }

  private totp(email: string, secretB32: string): OTPAuth.TOTP {
    return new OTPAuth.TOTP({
      issuer: ISSUER,
      label: email,
      algorithm: "SHA1", // the universally-supported authenticator default
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secretB32),
    });
  }

  private async row(userId: string): Promise<MfaRow> {
    const { rows } = await this.control.query<MfaRow>(
      "SELECT email, mfa_secret, mfa_pending_secret, mfa_enrolled_at FROM control.users WHERE id = $1",
      [userId],
    );
    const row = rows[0];
    if (row === undefined) throw new ApiError("NOT_FOUND", "User not found");
    return row;
  }
}

/** Group the 20 hex chars into `xxxxx-xxxxx-xxxxx-xxxxx` for the user to write down. */
function formatRecoveryCode(raw: string): string {
  return (raw.match(/.{1,5}/g) ?? [raw]).join("-");
}

/** Accept a recovery code however the user typed it (spaces, dashes, case). */
function normalizeRecoveryCode(input: string): string {
  return input.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}
