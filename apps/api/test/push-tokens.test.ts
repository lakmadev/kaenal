import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { PushTokensService } from "../src/auth/push-tokens.service.js";

/**
 * Device push-token registry (0036) — register/unregister and the upsert
 * reassignment rule, against the real control-plane database.
 */
let control: pg.Pool;
let userA: string;
let userB: string;

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  const mk = async (label: string): Promise<string> => {
    const { rows } = await control.query<{ id: string }>(
      "INSERT INTO control.users (email, name) VALUES ($1, $2) RETURNING id",
      [`push-${randomBytes(4).toString("hex")}@kaenal.test`, label],
    );
    return rows[0]!.id;
  };
  userA = await mk("Push A");
  userB = await mk("Push B");
});

afterAll(async () => {
  await control.query("DELETE FROM control.users WHERE id = ANY($1)", [[userA, userB]]);
  await control.end();
});

function svc(): PushTokensService {
  return new PushTokensService(control);
}

describe("PushTokensService", () => {
  it("registers a token and returns it for the user", async () => {
    const s = svc();
    const token = `ExponentPushToken[${randomBytes(6).toString("hex")}]`;
    await s.register(userA, token, "ios");
    expect(await s.tokensFor(userA)).toContain(token);
  });

  it("re-registering the same token reassigns it (device handoff), not duplicates", async () => {
    const s = svc();
    const token = `ExponentPushToken[${randomBytes(6).toString("hex")}]`;
    await s.register(userA, token, "ios");
    await s.register(userB, token, "android"); // same device, new owner

    const a = await s.tokensFor(userA);
    const b = await s.tokensFor(userB);
    expect(a).not.toContain(token); // A no longer receives push on that device
    expect(b).toContain(token);
    // Exactly one row for the token (upsert, not duplicate).
    const { rows } = await control.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM control.push_tokens WHERE token = $1",
      [token],
    );
    expect(rows[0]!.n).toBe(1);
  });

  it("unregisters a token", async () => {
    const s = svc();
    const token = `ExponentPushToken[${randomBytes(6).toString("hex")}]`;
    await s.register(userA, token, "ios");
    await s.unregister(token);
    expect(await s.tokensFor(userA)).not.toContain(token);
  });

  it("keeps users' tokens isolated", async () => {
    const s = svc();
    const ta = `ExponentPushToken[${randomBytes(6).toString("hex")}]`;
    const tb = `ExponentPushToken[${randomBytes(6).toString("hex")}]`;
    await s.register(userA, ta, "ios");
    await s.register(userB, tb, "ios");
    expect(await s.tokensFor(userA)).not.toContain(tb);
    expect(await s.tokensFor(userB)).not.toContain(ta);
  });
});
