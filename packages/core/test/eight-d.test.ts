import { describe, expect, it } from "vitest";
import {
  EIGHT_D_STEPS,
  allStepsComplete,
  canCompleteStep,
  initialStepStatuses,
  prerequisitesFor,
  stepKey,
  type StepStatuses,
} from "../src/eight-d.js";

/** Build a status map where the given step numbers are complete, rest pending. */
function complete(...done: number[]): StepStatuses {
  const s: StepStatuses = {};
  for (const n of done) s[stepKey(n)] = "complete";
  return s;
}

describe("8D step prerequisites (02 §4)", () => {
  it("requires strictly the earlier steps — except D3, which may run parallel to D2", () => {
    expect(prerequisitesFor(1)).toEqual([]);
    expect(prerequisitesFor(2)).toEqual([1]);
    expect(prerequisitesFor(3)).toEqual([1]); // NOT [1,2] — D3 ∥ D2
    expect(prerequisitesFor(4)).toEqual([1, 2, 3]);
    expect(prerequisitesFor(8)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("canCompleteStep", () => {
  it("allows D1 with nothing else done", () => {
    expect(canCompleteStep(1, {}).ok).toBe(true);
  });

  it("blocks D2 until D1 is complete", () => {
    const blocked = canCompleteStep(2, {});
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.code).toBe("INVALID_TRANSITION");
      expect(blocked.details?.["blockedBy"]).toEqual(["d1"]);
    }
    expect(canCompleteStep(2, complete(1)).ok).toBe(true);
  });

  it("lets D3 complete while D2 is still open (the parallel exception)", () => {
    // D1 done, D2 only in progress — D3 may still be completed.
    const statuses: StepStatuses = { d1: "complete", d2: "in_progress" };
    expect(canCompleteStep(3, statuses).ok).toBe(true);
  });

  it("still blocks D3 if D1 is not complete", () => {
    expect(canCompleteStep(3, {}).ok).toBe(false);
    expect(canCompleteStep(3, { d2: "in_progress" }).ok).toBe(false);
  });

  it("blocks D4 until D1, D2 AND D3 are all complete", () => {
    expect(canCompleteStep(4, complete(1, 3)).ok).toBe(false); // D2 missing
    const d = canCompleteStep(4, complete(1, 3));
    if (!d.ok) expect(d.details?.["blockedBy"]).toEqual(["d2"]);
    expect(canCompleteStep(4, complete(1, 2, 3)).ok).toBe(true);
  });

  it("rejects an out-of-range step", () => {
    expect(canCompleteStep(0, {}).ok).toBe(false);
    expect(canCompleteStep(9, {}).ok).toBe(false);
  });

  it("gates the full ladder: each step needs its predecessors (bar the D2/D3 case)", () => {
    // Walk 1→8 completing in order; each is allowed exactly when its prereqs are.
    const done: number[] = [];
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(canCompleteStep(n, complete(...done)).ok).toBe(true);
      done.push(n);
    }
    expect(allStepsComplete(complete(1, 2, 3, 4, 5, 6, 7, 8))).toBe(true);
  });
});

describe("initial state", () => {
  it("starts every discipline pending and none complete", () => {
    const s = initialStepStatuses();
    expect(Object.keys(s)).toEqual([...EIGHT_D_STEPS]);
    expect(allStepsComplete(s)).toBe(false);
    expect(Object.values(s).every((v) => v === "pending")).toBe(true);
  });
});
