import { describe, expect, it } from "vitest";

import { buildTasks } from "../src/features/work/tasks";

const ME = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

// Minimal shapes — buildTasks only reads these fields.
const ncr = (over: Partial<{ ownerId: string | null; status: string }>) => ({
  id: "n1",
  code: "NCR-1",
  title: "n",
  ownerId: ME,
  status: "open",
  dueAt: null,
  ...over,
});
const capa = (over: Partial<{ ownerId: string | null; status: string }>) =>
  ({ id: "c1", code: "CAPA-1", title: "c", ownerId: ME, status: "action_plan", dueAt: null, ...over }) as never;
const insp = (over: Partial<{ inspectorId: string | null; status: string }>) => ({
  id: "i1",
  code: "INS-1",
  title: "i",
  inspectorId: ME,
  status: "scheduled",
  scheduledAt: null,
  ...over,
});
const eightd = (over: Partial<{ teamLeadId: string | null; status: string }>) =>
  ({ id: "e1", code: "8D-1", title: "e", teamLeadId: ME, championId: null, memberIds: [], status: "active", currentStep: 5, targetAt: null, ...over }) as never;

describe("buildTasks (unified inbox)", () => {
  it("includes only items owned by the caller and still open", () => {
    const tasks = buildTasks(ME, [ncr({}), ncr({ ownerId: OTHER }), ncr({ status: "closed" })], [capa({})], [insp({})], [eightd({})]);
    expect(tasks.map((t) => t.kind).sort()).toEqual(["capa", "eightd", "inspection", "ncr"]);
    // foreign-owned and closed NCRs are excluded
    expect(tasks.filter((t) => t.kind === "ncr")).toHaveLength(1);
  });

  it("tags the 8D task with its current discipline and routes per kind", () => {
    const [t] = buildTasks(ME, [], [], [], [eightd({})]);
    expect(t?.code).toBe("8D-1 · D5");
    expect(t?.route).toBe("/8d/e1");
  });

  it("returns nothing without a user id", () => {
    expect(buildTasks(undefined, [ncr({})], [capa({})], [insp({})], [eightd({})])).toEqual([]);
  });

  it("excludes an 8D the caller is not on the team for", () => {
    const tasks = buildTasks(ME, [], [], [], [eightd({ teamLeadId: OTHER })]);
    expect(tasks).toHaveLength(0);
  });
});
