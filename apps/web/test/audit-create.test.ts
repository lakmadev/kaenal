import { describe, expect, it } from "vitest";
import { FormSchema, toIso } from "@/features/audits/audit-create-logic";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_UUID_2 = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

function base(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    title: "Q2 Internal Audit",
    type: "internal",
    scope: [],
    team: [],
    auditeeIds: [],
    ...overrides,
  };
}

/**
 * Audit-create dialog form validation (S2-3). `FormSchema` is the Zod schema
 * `useForm`'s `zodResolver` runs on submit — these pin the edge cases around
 * the optional-date refine and the repeatable scope list, which the jsx has
 * no equivalent of (this app's own primitive).
 */
describe("FormSchema — required fields", () => {
  it("accepts the minimal valid form", () => {
    expect(FormSchema.safeParse(base()).success).toBe(true);
  });

  it("rejects an empty title", () => {
    const r = FormSchema.safeParse(base({ title: "" }));
    expect(r.success).toBe(false);
  });

  it("rejects an unknown audit type", () => {
    const r = FormSchema.safeParse(base({ type: "not-a-real-type" }));
    expect(r.success).toBe(false);
  });
});

describe("FormSchema — scope list", () => {
  it("accepts up to 50 scope items", () => {
    const scope = Array.from({ length: 50 }, (_, i) => `Line ${i}`);
    expect(FormSchema.safeParse(base({ scope })).success).toBe(true);
  });

  it("rejects 51 scope items", () => {
    const scope = Array.from({ length: 51 }, (_, i) => `Line ${i}`);
    const r = FormSchema.safeParse(base({ scope }));
    expect(r.success).toBe(false);
  });

  it("rejects an empty-string scope item", () => {
    const r = FormSchema.safeParse(base({ scope: [""] }));
    expect(r.success).toBe(false);
  });
});

describe("FormSchema — date range", () => {
  it("accepts both dates omitted", () => {
    expect(FormSchema.safeParse(base()).success).toBe(true);
  });

  it("accepts only a start date", () => {
    expect(FormSchema.safeParse(base({ startAt: "2026-03-01" })).success).toBe(true);
  });

  it("accepts only an end date (no start to compare against)", () => {
    expect(FormSchema.safeParse(base({ endAt: "2026-03-01" })).success).toBe(true);
  });

  it("accepts endAt equal to startAt (a one-day audit)", () => {
    expect(FormSchema.safeParse(base({ startAt: "2026-03-01", endAt: "2026-03-01" })).success).toBe(true);
  });

  it("accepts endAt after startAt", () => {
    expect(FormSchema.safeParse(base({ startAt: "2026-03-01", endAt: "2026-03-05" })).success).toBe(true);
  });

  it("rejects endAt before startAt, flagging the endAt field", () => {
    const r = FormSchema.safeParse(base({ startAt: "2026-03-05", endAt: "2026-03-01" }));
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(["endAt"]);
      expect(r.error.issues[0]?.message).toBe("errorEndBeforeStart");
    }
  });

  it("rejects a malformed date string", () => {
    expect(FormSchema.safeParse(base({ startAt: "03/01/2026" })).success).toBe(false);
    expect(FormSchema.safeParse(base({ startAt: "2026-3-1" })).success).toBe(false);
  });
});

describe("FormSchema — optional id fields", () => {
  it("accepts an empty-string plantId/leadAuditorId (native select's blank option)", () => {
    expect(FormSchema.safeParse(base({ plantId: "", leadAuditorId: "" })).success).toBe(true);
  });

  it("accepts a valid uuid plantId/leadAuditorId", () => {
    expect(FormSchema.safeParse(base({ plantId: VALID_UUID, leadAuditorId: VALID_UUID })).success).toBe(true);
  });

  it("rejects a non-uuid plantId", () => {
    expect(FormSchema.safeParse(base({ plantId: "not-a-uuid" })).success).toBe(false);
  });

  it("rejects a non-uuid id inside team/auditeeIds", () => {
    expect(FormSchema.safeParse(base({ team: ["not-a-uuid"] })).success).toBe(false);
    expect(FormSchema.safeParse(base({ auditeeIds: ["not-a-uuid"] })).success).toBe(false);
  });

  it("accepts multiple valid uuids in team/auditeeIds", () => {
    expect(FormSchema.safeParse(base({ team: [VALID_UUID, VALID_UUID_2] })).success).toBe(true);
  });
});

describe("toIso", () => {
  it("returns null for undefined", () => {
    expect(toIso(undefined)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(toIso("")).toBeNull();
  });

  it("converts a date-only string to a UTC midnight ISO datetime", () => {
    expect(toIso("2026-03-01")).toBe("2026-03-01T00:00:00.000Z");
  });
});
