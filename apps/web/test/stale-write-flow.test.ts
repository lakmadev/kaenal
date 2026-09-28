import { describe, expect, it } from "vitest";
import { reapplyChange } from "@kaenal/core";
import { buildResendVariables } from "@/lib/stale-write-flow";

describe("buildResendVariables", () => {
  const original = { id: "n1", title: "a", severity: "major", lockVersion: 3 };
  const fresh = { id: "n1", title: "a", severity: "minor", description: "theirs", lockVersion: 5 };

  it("keeps my edit, takes fresh values for untouched fields, sends the fresh version", () => {
    const variables = { id: "n1", body: { title: "b", severity: "major", lockVersion: 3 } };
    const r = reapplyChange(original, { title: "b", severity: "major" }, fresh);
    const out = buildResendVariables(variables, original, fresh, r, new Set());
    // severity untouched by me -> fresh value wins; title is my clean edit.
    expect(out).toEqual({ id: "n1", body: { title: "b", severity: "minor", lockVersion: 5 } });
  });

  it("honours keep-current on a conflict", () => {
    const variables = { id: "n1", body: { severity: "critical", lockVersion: 3 } };
    const r = reapplyChange(original, { severity: "critical" }, fresh);
    expect(r.conflicts).toHaveLength(1);
    expect(buildResendVariables(variables, original, fresh, r, new Set(["severity"]))?.["body"]).toEqual({
      severity: "minor",
      lockVersion: 5,
    });
  });

  it("returns null when the mutation has no body", () => {
    expect(buildResendVariables({ id: "n1" }, original, fresh, { clean: [], conflicts: [] }, new Set())).toBeNull();
  });
});
