import { describe, expect, it } from "vitest";
import { NOT_APPLICABLE, type FormSchema } from "@kaenal/types";
import { isVisible, scoreInspection, validateResponses } from "../src/form-engine.js";

/** A small but representative template touching every behaviour under test. */
const schema: FormSchema = {
  sections: [
    {
      id: "s1",
      title: "Safety",
      weight: 1,
      items: [
        { id: "guard", type: "pass_fail", label: "Machine guard fitted", required: true, weight: 2, naAllowed: false },
        { id: "ppe", type: "yes_no", label: "PPE worn", required: true, weight: 1, naAllowed: true },
        { id: "notes", type: "textarea", label: "Notes", required: false, weight: 1, naAllowed: false },
        { id: "header", type: "header", label: "— section break —", required: true, weight: 1, naAllowed: false },
      ],
    },
    {
      id: "s2",
      title: "Quality",
      weight: 3,
      items: [
        { id: "finish", type: "score", label: "Surface finish", required: true, weight: 1, naAllowed: false, min: 0, max: 5 },
        {
          id: "rework",
          type: "text",
          label: "Rework detail",
          required: true,
          weight: 1,
          naAllowed: false,
          visibleWhen: { itemId: "finish", equals: [0, 1] },
        },
      ],
    },
  ],
};

describe("isVisible", () => {
  it("shows an unconditional item always", () => {
    expect(isVisible(schema.sections[0]!.items[0]!, {})).toBe(true);
  });

  it("hides a conditional item until its controller matches", () => {
    const rework = schema.sections[1]!.items[1]!;
    expect(isVisible(rework, { finish: 4 })).toBe(false);
    expect(isVisible(rework, { finish: 1 })).toBe(true);
  });
});

describe("validateResponses", () => {
  it("accepts a fully, correctly answered form", () => {
    const r = validateResponses(schema, { guard: "pass", ppe: "yes", finish: 4 });
    expect(r.ok).toBe(true);
  });

  it("flags a missing required item", () => {
    const r = validateResponses(schema, { ppe: "yes", finish: 4 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.details?.errors).toContainEqual({ itemId: "guard", message: "is required" });
  });

  it("does not require a hidden conditional item", () => {
    const r = validateResponses(schema, { guard: "pass", ppe: "yes", finish: 4 });
    expect(r.ok).toBe(true); // rework is hidden because finish=4
  });

  it("requires a conditional item once it becomes visible", () => {
    const r = validateResponses(schema, { guard: "pass", ppe: "yes", finish: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.details?.errors).toContainEqual({ itemId: "rework", message: "is required" });
  });

  it("rejects a wrong-typed answer", () => {
    const r = validateResponses(schema, { guard: "maybe", ppe: "yes", finish: 4 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.details?.errors).toContainEqual({ itemId: "guard", message: "must be 'pass' or 'fail'" });
  });

  it("rejects a score outside the item's range", () => {
    const r = validateResponses(schema, { guard: "pass", ppe: "yes", finish: 9 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.details?.errors).toContainEqual({ itemId: "finish", message: "must be ≤ 5" });
  });

  it("allows N/A only where the template permits it", () => {
    const ok = validateResponses(schema, { guard: "pass", ppe: NOT_APPLICABLE, finish: 4 });
    expect(ok.ok).toBe(true); // ppe is naAllowed
    const bad = validateResponses(schema, { guard: NOT_APPLICABLE, ppe: "yes", finish: 4 });
    expect(bad.ok).toBe(false); // guard is not
  });

  it("never requires a presentational item", () => {
    const r = validateResponses(schema, { guard: "pass", ppe: "yes", finish: 4 });
    expect(r.ok).toBe(true); // the required:true header is ignored
  });

  it("ignores answers to items the template does not contain", () => {
    const r = validateResponses(schema, { guard: "pass", ppe: "yes", finish: 4, ghost: "boo" });
    expect(r.ok).toBe(true);
  });
});

describe("scoreInspection", () => {
  it("weights items and sections, as a 0–100 percentage", () => {
    // s1: guard pass (w2 → 1.0), ppe yes (w1 → 1.0) ⇒ fraction 1.0, section weight 1
    // s2: finish 5/5 (w1 → 1.0) ⇒ fraction 1.0, section weight 3
    // overall = (1×1 + 3×1) / (1+3) = 1.0 → 100
    const { score, scoredItems } = scoreInspection(schema, { guard: "pass", ppe: "yes", finish: 5 });
    expect(score).toBe(100);
    expect(scoredItems).toBe(3);
  });

  it("a failed high-weight item drags its section down proportionally", () => {
    // s1: guard fail (w2 → 0), ppe yes (w1 → 1) ⇒ earned 1 / possible 3 = 0.3333
    // s2: finish 5/5 ⇒ 1.0
    // overall = (1×0.3333 + 3×1) / 4 = 0.8333 → 83.33
    const { score } = scoreInspection(schema, { guard: "fail", ppe: "yes", finish: 5 });
    expect(score).toBe(83.33);
  });

  it("excludes N/A and unanswered items from the denominator, not as zeros", () => {
    // ppe N/A drops out; s1 = guard pass only ⇒ 1.0
    const { score } = scoreInspection(schema, { guard: "pass", ppe: NOT_APPLICABLE, finish: 5 });
    expect(score).toBe(100);
  });

  it("excludes a zero-weight item entirely", () => {
    const zeroWeighted: FormSchema = {
      sections: [
        {
          id: "s",
          title: "s",
          weight: 1,
          items: [
            { id: "a", type: "pass_fail", label: "a", required: false, weight: 1, naAllowed: false },
            { id: "b", type: "pass_fail", label: "b", required: false, weight: 0, naAllowed: false },
          ],
        },
      ],
    };
    // b fails but weight 0 ⇒ ignored; a passes ⇒ 100
    const { score, scoredItems } = scoreInspection(zeroWeighted, { a: "pass", b: "fail" });
    expect(score).toBe(100);
    expect(scoredItems).toBe(1);
  });

  it("returns null when nothing was scorable", () => {
    const { score, scoredItems } = scoreInspection(schema, { notes: "all good" });
    expect(score).toBeNull();
    expect(scoredItems).toBe(0);
  });
});
