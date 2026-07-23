import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import { withTenant } from "@kaenal/db";
import { AiGatewayService } from "../src/ai/gateway.service.js";
import { StubAiProvider, type AiProvider } from "../src/ai/provider.js";
import { generateDocumentSummary } from "../src/jobs/processors/generate-summary.js";

/**
 * AI gateway (06 §3), driven directly against real Postgres. The gateway is the
 * one chokepoint: it gates (entitlement / kill switch / budget), redacts PII,
 * calls the provider, and records exactly one `ai_invocations` row per call.
 * Every path is exercised through a stub provider — plus a throwing one for the
 * graceful-failure path — and the `doc_summary` processor persists the result.
 */

const ACME = "acme";
const gateway = new AiGatewayService(new StubAiProvider("us-east-1"));

class ThrowingProvider implements AiProvider {
  readonly region = "us-east-1";
  complete(): Promise<never> {
    return Promise.reject(new Error("provider exploded"));
  }
}
const failingGateway = new AiGatewayService(new ThrowingProvider());

let control: pg.Pool;
let acmeId = "";
let userId = "";

async function tid(slug: string): Promise<string> {
  const { rows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [slug]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`${slug} not provisioned`);
  return id;
}

async function setPack(active: boolean): Promise<void> {
  await withTenant(acmeId, null, (tx) =>
    tx.query(
      `INSERT INTO entitlements (tenant_id, pack_id, active) VALUES ($1,'intelligence',$2)
       ON CONFLICT (tenant_id, pack_id) DO UPDATE SET active = EXCLUDED.active`,
      [acmeId, active],
    ),
  );
}

async function setSettings(opts: { allowAi?: boolean; piiRedaction?: boolean; regionLock?: string | null } = {}): Promise<void> {
  await withTenant(acmeId, null, (tx) =>
    tx.query(
      `INSERT INTO ai_settings (tenant_id, allow_ai, pii_redaction, region_lock) VALUES ($1,$2,$3,$4)
       ON CONFLICT (tenant_id) DO UPDATE
         SET allow_ai = EXCLUDED.allow_ai, pii_redaction = EXCLUDED.pii_redaction, region_lock = EXCLUDED.region_lock`,
      [acmeId, opts.allowAi ?? true, opts.piiRedaction ?? true, opts.regionLock ?? null],
    ),
  );
}

/** Set (or clear) the current-period budget. */
async function setBudget(limit: number, used: number): Promise<void> {
  await withTenant(acmeId, null, (tx) =>
    tx.query(
      `INSERT INTO ai_budgets (tenant_id, period, token_limit, tokens_used)
       VALUES ($1, date_trunc('month', now())::date, $2, $3)
       ON CONFLICT (tenant_id, period) DO UPDATE
         SET token_limit = EXCLUDED.token_limit, tokens_used = EXCLUDED.tokens_used`,
      [acmeId, limit, used],
    ),
  );
}

async function clearBudget(): Promise<void> {
  await withTenant(acmeId, null, (tx) =>
    tx.query("DELETE FROM ai_budgets WHERE tenant_id = $1", [acmeId]),
  );
}

async function invocation(id: string): Promise<{ status: string; block_reason: string | null; input_tokens: number; output_tokens: number; redactions_applied: number; error: string | null }> {
  return withTenant(acmeId, null, async (tx) => {
    const { rows } = await tx.query("SELECT status, block_reason, input_tokens, output_tokens, redactions_applied, error FROM ai_invocations WHERE id = $1", [id]);
    return rows[0] as never;
  });
}

async function budgetUsed(): Promise<number> {
  return withTenant(acmeId, null, async (tx) => {
    const { rows } = await tx.query<{ tokens_used: string }>(
      "SELECT tokens_used FROM ai_budgets WHERE tenant_id = $1 AND period = date_trunc('month', now())::date",
      [acmeId],
    );
    return Number(rows[0]!.tokens_used);
  });
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  const { rows } = await control.query<{ id: string }>(
    `INSERT INTO control.users (email, name) VALUES ('ai-user@acme.test','AI User')
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
  );
  userId = rows[0]!.id;
  await withTenant(acmeId, null, (tx) =>
    tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, status) VALUES ($1,$2,'manager','active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET status = 'active'`,
      [acmeId, userId],
    ),
  );
});

afterAll(async () => {
  await withTenant(acmeId, null, async (tx) => {
    await tx.query("DELETE FROM ai_invocations WHERE tenant_id = $1", [acmeId]);
    await tx.query("DELETE FROM documents WHERE title LIKE 'AITEST%'");
    await tx.query("DELETE FROM ai_budgets WHERE tenant_id = $1", [acmeId]);
    await tx.query("DELETE FROM ai_settings WHERE tenant_id = $1", [acmeId]);
    await tx.query("DELETE FROM entitlements WHERE tenant_id = $1 AND pack_id = 'intelligence'", [acmeId]);
    await tx.query("DELETE FROM memberships WHERE user_id = $1", [userId]);
  });
  await control.query("DELETE FROM control.users WHERE email = 'ai-user@acme.test'");
  await control.end();
});

// Default happy governance state; individual tests override what they probe.
beforeEach(async () => {
  await setPack(true);
  await setSettings({ allowAi: true, piiRedaction: true, regionLock: null });
  await clearBudget();
});

describe("AI gateway gating", () => {
  it("blocks when the intelligence pack is inactive", async () => {
    await setPack(false);
    const r = await gateway.run({ tenantId: acmeId, userId, feature: "doc_summary", input: "hello world" });
    expect(r.status).toBe("blocked");
    if (r.status !== "blocked") throw new Error("unreachable");
    expect(r.reason).toBe("entitlement");
    expect((await invocation(r.invocationId)).block_reason).toBe("entitlement");
  });

  it("blocks when AI is switched off for the tenant", async () => {
    await setSettings({ allowAi: false });
    const r = await gateway.run({ tenantId: acmeId, userId, feature: "doc_summary", input: "hello world" });
    expect(r.status === "blocked" && r.reason).toBe("ai_disabled");
  });

  it("blocks when the call would overrun the period budget", async () => {
    await setBudget(100, 100); // no headroom
    const r = await gateway.run({ tenantId: acmeId, userId, feature: "doc_summary", input: "hello world" });
    expect(r.status === "blocked" && r.reason).toBe("budget");
    // A blocked call spends nothing.
    expect(await budgetUsed()).toBe(100);
  });
});

describe("AI gateway invocation", () => {
  it("succeeds: redacts PII, returns a draft, and charges the budget", async () => {
    await setBudget(1_000_000, 0);
    const r = await gateway.run({
      tenantId: acmeId,
      userId,
      feature: "doc_summary",
      input: "Email ana@acme.test about the weld cell audit findings and next steps.",
      entityRefs: [{ kind: "document", id: randomUUID() }],
    });
    expect(r.status).toBe("succeeded");
    if (r.status !== "succeeded") throw new Error("unreachable");

    // The email survived the redact → provider → rehydrate round-trip.
    expect(r.draft.value).toContain("ana@acme.test");
    expect(r.draft.sources).toHaveLength(1);

    const inv = await invocation(r.invocationId);
    expect(inv.status).toBe("succeeded");
    expect(inv.redactions_applied).toBe(1);
    // The budget was charged exactly the tokens the invocation recorded.
    expect(await budgetUsed()).toBe(inv.input_tokens + inv.output_tokens);
  });

  it("records a graceful failure when the provider throws", async () => {
    const r = await failingGateway.run({ tenantId: acmeId, userId, feature: "doc_summary", input: "hello world" });
    expect(r.status).toBe("failed");
    if (r.status !== "failed") throw new Error("unreachable");
    const inv = await invocation(r.invocationId);
    expect(inv.status).toBe("failed");
    expect(inv.error).toContain("exploded");
  });
});

describe("doc_summary processor", () => {
  it("writes ai_summary with a system audit event, idempotently", async () => {
    await setBudget(1_000_000, 0);
    const docId = randomUUID();
    await withTenant(acmeId, null, (tx) =>
      tx.query(
        `INSERT INTO documents (id, tenant_id, code, title, category, status, version, owner_id, created_by, updated_by)
         VALUES ($1,$2,$3,'AITEST doc','sop','approved','1.0',$4,$4,$4)`,
        [docId, acmeId, `AITEST-${docId.slice(0, 8)}`, userId],
      ),
    );

    const first = await generateDocumentSummary({ tenantId: acmeId, userId, documentId: docId }, { gateway });
    expect(first.status).toBe("succeeded");

    const summary = await withTenant(acmeId, null, async (tx) => {
      const { rows } = await tx.query<{ ai_summary: string | null }>("SELECT ai_summary FROM documents WHERE id = $1", [docId]);
      return rows[0]!.ai_summary;
    });
    expect(summary).toContain("Summary:");

    const auditCount = async (): Promise<number> =>
      withTenant(acmeId, null, async (tx) => {
        const { rows } = await tx.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM audit_events WHERE entity_id = $1 AND action = 'updated' AND actor_kind = 'system'",
          [docId],
        );
        return rows[0]!.n;
      });
    expect(await auditCount()).toBe(1);

    // Re-run: the stub yields the same summary → no write, no new event.
    const second = await generateDocumentSummary({ tenantId: acmeId, userId, documentId: docId }, { gateway });
    expect(second.status).toBe("succeeded");
    expect(await auditCount()).toBe(1);
  });

  it("skips a missing document", async () => {
    const r = await generateDocumentSummary({ tenantId: acmeId, userId, documentId: randomUUID() }, { gateway });
    expect(r.status).toBe("skipped");
  });
});
