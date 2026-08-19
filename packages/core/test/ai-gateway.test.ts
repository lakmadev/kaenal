import { describe, expect, it } from "vitest";
import {
  INTELLIGENCE_PACK,
  FEATURE_ROUTING,
  routeFeature,
  budgetRemaining,
  wouldExceedBudget,
  gateInvocation,
  redactPii,
  rehydrate,
  redactionCount,
  type AiGateInput,
} from "../src/ai-gateway.js";

/**
 * AI gateway governance logic (06 §3). These are the model-free decisions that
 * gate every call and scrub every payload — the #1 data-leak surface — so the
 * rules are pinned exactly and fail closed.
 */

describe("routeFeature", () => {
  it("routes every feature to a model + default budget", () => {
    for (const feature of Object.keys(FEATURE_ROUTING) as (keyof typeof FEATURE_ROUTING)[]) {
      const route = routeFeature(feature);
      expect(route.model).toMatch(/^(fast|strong|vision)$/);
      expect(route.defaultMaxTokens).toBeGreaterThan(0);
    }
    expect(INTELLIGENCE_PACK).toBe("intelligence");
  });
});

describe("budget math", () => {
  it("remaining never goes negative", () => {
    expect(budgetRemaining({ tokenLimit: 100, tokensUsed: 30 })).toBe(70);
    expect(budgetRemaining({ tokenLimit: 100, tokensUsed: 140 })).toBe(0);
  });

  it("exactly reaching the limit is allowed; crossing it is not", () => {
    const b = { tokenLimit: 100, tokensUsed: 90 };
    expect(wouldExceedBudget(b, 10)).toBe(false); // 100 == limit
    expect(wouldExceedBudget(b, 11)).toBe(true); // 101 > limit
  });
});

describe("gateInvocation (fail-closed order)", () => {
  const base: AiGateInput = {
    packActive: true,
    allowAi: true,
    regionLock: null,
    providerRegion: "us-east-1",
    budget: null,
    estimatedTokens: 100,
  };

  it("allows a fully-entitled, unmetered call", () => {
    expect(gateInvocation(base)).toEqual({ ok: true });
  });

  it("refuses without the intelligence pack first", () => {
    expect(gateInvocation({ ...base, packActive: false, allowAi: false })).toEqual({
      ok: false,
      reason: "entitlement",
    });
  });

  it("refuses when AI is switched off for the tenant", () => {
    expect(gateInvocation({ ...base, allowAi: false })).toEqual({ ok: false, reason: "ai_disabled" });
  });

  it("refuses when the residency lock does not match the provider region", () => {
    expect(gateInvocation({ ...base, regionLock: "eu" })).toEqual({ ok: false, reason: "region" });
    expect(gateInvocation({ ...base, regionLock: "us-east-1" })).toEqual({ ok: true });
  });

  it("refuses when the call would overrun the budget", () => {
    const budget = { tokenLimit: 1000, tokensUsed: 950 };
    expect(gateInvocation({ ...base, budget, estimatedTokens: 51 })).toEqual({ ok: false, reason: "budget" });
    expect(gateInvocation({ ...base, budget, estimatedTokens: 50 })).toEqual({ ok: true });
  });

  it("treats a null budget as unmetered", () => {
    expect(gateInvocation({ ...base, budget: null, estimatedTokens: 1_000_000 })).toEqual({ ok: true });
  });
});

describe("redactPii / rehydrate (reversible)", () => {
  it("masks emails and phone numbers with reversible tokens", () => {
    const text = "Contact ana@acme.test or +1 (555) 123-4567 for the audit.";
    const { redacted, map } = redactPii(text);
    expect(redacted).not.toContain("ana@acme.test");
    expect(redacted).not.toContain("555");
    expect(redactionCount(map)).toBe(2);
    // Round-trips exactly.
    expect(rehydrate(redacted, map)).toBe(text);
  });

  it("collapses a repeated value to a single token", () => {
    const { redacted, map } = redactPii("a@b.com then a@b.com again");
    expect(redactionCount(map)).toBe(1);
    expect(redacted.match(/\[\[PII_1\]\]/g)?.length).toBe(2);
  });

  it("masks caller-supplied terms, longest match first", () => {
    const { redacted, map } = redactPii("Jane Doe met Jane", { extraTerms: ["Jane", "Jane Doe"] });
    // "Jane Doe" is masked as one unit before the bare "Jane".
    expect(redacted).not.toContain("Jane Doe");
    expect(rehydrate(redacted, map)).toBe("Jane Doe met Jane");
  });

  it("leaves clean text and its empty map untouched", () => {
    const { redacted, map } = redactPii("no personal data here");
    expect(redacted).toBe("no personal data here");
    expect(redactionCount(map)).toBe(0);
  });
});
