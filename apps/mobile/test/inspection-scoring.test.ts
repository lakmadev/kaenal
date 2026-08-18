import { describe, expect, it } from "vitest";

import { NOT_APPLICABLE, type FormSchema } from "@kaenal/types";

import { answerableItems, isVisible, progress, requiredComplete, tally } from "../src/features/inspections/scoring";

/** A small template: a header, two pass/fail (one NA-allowed), a score, and a
 *  conditional textarea that only appears when q_pf1 === "fail". */
const schema: FormSchema = {
  sections: [
    {
      id: "s1",
      title: "Checks",
      weight: 1,
      items: [
        { id: "h", type: "header", label: "Weld", required: false, weight: 0, naAllowed: false },
        { id: "q_pf1", type: "pass_fail", label: "Feed pressure ok?", required: true, weight: 1, naAllowed: false },
        { id: "q_pf2", type: "yes_no", label: "PPE worn?", required: false, weight: 1, naAllowed: true },
        { id: "q_score", type: "score", label: "Finish (1-5)", required: true, weight: 1, naAllowed: false, min: 1, max: 5 },
        {
          id: "q_reason",
          type: "textarea",
          label: "Why did it fail?",
          required: true,
          weight: 1,
          naAllowed: false,
          visibleWhen: { itemId: "q_pf1", equals: ["fail"] },
        },
      ],
    },
  ],
};

describe("inspection scoring", () => {
  it("excludes presentational items from the answerable set", () => {
    const ids = answerableItems(schema, {}).map((i) => i.id);
    expect(ids).not.toContain("h");
    // q_reason is hidden until q_pf1 === 'fail'
    expect(ids).toEqual(["q_pf1", "q_pf2", "q_score"]);
  });

  it("reveals a conditional item and counts it once its dependency matches", () => {
    expect(isVisible(schema.sections[0]!.items[4]!, { q_pf1: "fail" })).toBe(true);
    expect(isVisible(schema.sections[0]!.items[4]!, { q_pf1: "pass" })).toBe(false);
    expect(progress(schema, { q_pf1: "fail" }).total).toBe(4); // q_reason now visible
    expect(progress(schema, { q_pf1: "pass" }).total).toBe(3);
  });

  it("counts NA as answered but tallies it separately from pass/fail", () => {
    const responses = { q_pf1: "pass", q_pf2: NOT_APPLICABLE, q_score: 4 };
    expect(progress(schema, responses)).toEqual({ answered: 3, total: 3 });
    expect(tally(schema, responses)).toEqual({ pass: 1, fail: 0, na: 1 });
  });

  it("gates completion on every visible required item being answered", () => {
    expect(requiredComplete(schema, { q_pf1: "pass", q_score: 4 })).toBe(true);
    // fail reveals the required q_reason, which is now missing
    expect(requiredComplete(schema, { q_pf1: "fail", q_score: 4 })).toBe(false);
    expect(requiredComplete(schema, { q_pf1: "fail", q_score: 4, q_reason: "porosity" })).toBe(true);
    // an empty string is not an answer
    expect(requiredComplete(schema, { q_pf1: "pass", q_score: "" })).toBe(false);
  });
});
