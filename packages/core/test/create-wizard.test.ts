import { describe, expect, it } from "vitest";
import {
  advanceBlocker,
  buildCreateBody,
  canAdvance,
  creatableTypes,
  defaultRoleFor,
  documentTemplateMapping,
  emptyDraft,
  isDirty,
  ncrTemplateMapping,
  stepForField,
  toNcrPriority,
} from "../src/create-wizard.js";

const OWNER = "11111111-1111-4111-8111-111111111111";

describe("creatableTypes (capability-gated New menu)", () => {
  it("lists only what the caller can create, in menu order", () => {
    expect(creatableTypes(["inspection:perform", "ncr:create", "ncr:manage", "document:manage"])).toEqual([
      "inspection",
      "ncr",
      "8d",
      "document",
    ]);
    expect(creatableTypes(["inspection:perform", "ncr:create"])).toEqual(["inspection", "ncr"]);
    expect(creatableTypes(["ncr:view", "document:view"])).toEqual([]);
  });
});

describe("step gating (canNext of createwizard.jsx)", () => {
  it("step 0 needs a type, step 1 a template + title, step 2 at least one person", () => {
    const d = emptyDraft(null);
    expect(canAdvance(0, d)).toBe(false);
    expect(advanceBlocker(0, d)).toBe("Pick a type to continue.");
    d.type = "ncr";
    expect(canAdvance(0, d)).toBe(true);

    expect(advanceBlocker(1, d)).toBe("Choose a template.");
    d.template = "product";
    expect(advanceBlocker(1, d)).toBe("A title is required.");
    d.title = "  ";
    expect(canAdvance(1, d)).toBe(false);
    d.title = "Bracket weld";
    expect(canAdvance(1, d)).toBe(true);

    expect(canAdvance(2, d)).toBe(false);
    d.people = [{ userId: OWNER, role: "owner" }];
    expect(canAdvance(2, d)).toBe(true);
    expect(canAdvance(3, d)).toBe(true);
  });

  it("the first person defaults to owner, the rest to reviewer", () => {
    expect(defaultRoleFor([])).toBe("owner");
    expect(defaultRoleFor([{ userId: OWNER, role: "owner" }])).toBe("reviewer");
  });

  it("isDirty ignores the bare type but sees any input", () => {
    expect(isDirty(emptyDraft("ncr"))).toBe(false);
    const d = emptyDraft("ncr");
    d.title = "x";
    expect(isDirty(d)).toBe(true);
  });
});

describe("mappings", () => {
  it("wizard priority maps onto the NCR severity column", () => {
    expect(toNcrPriority("low")).toBe("minor");
    expect(toNcrPriority("medium")).toBe("minor");
    expect(toNcrPriority("high")).toBe("major");
    expect(toNcrPriority("critical")).toBe("critical");
  });

  it("NCR templates carry a source and their label as category", () => {
    expect(ncrTemplateMapping("customer")).toEqual({ source: "complaint", category: "Customer complaint" });
    expect(ncrTemplateMapping("audit").source).toBe("audit");
    expect(ncrTemplateMapping("product").source).toBe("manual");
  });

  it("document templates file under a category and keep the exact template", () => {
    expect(documentTemplateMapping("wi")).toEqual({ category: "work_instruction", template: "wi" });
    expect(documentTemplateMapping("policy")).toEqual({ category: "manual", template: "policy" });
    expect(documentTemplateMapping("upload").category).toBe("record");
  });

  it("a 422 issue path lands on the owning step", () => {
    expect(stepForField("people.0.userId")).toBe(2);
    expect(stepForField("title")).toBe(1);
    expect(stepForField("plantId")).toBe(1);
  });
});

describe("buildCreateBody", () => {
  const base = () => {
    const d = emptyDraft("ncr");
    d.template = "customer";
    d.title = "  Bracket weld  ";
    d.priority = "high";
    d.area = "Welding · Line 3";
    d.due = "2030-01-15";
    d.people = [{ userId: OWNER, role: "owner" }];
    return d;
  };

  it("builds an NCR body", () => {
    const b = buildCreateBody(base());
    expect(b).toEqual({
      type: "ncr",
      body: {
        title: "Bracket weld",
        priority: "major",
        description: null,
        category: "Customer complaint",
        source: "complaint",
        plantId: null,
        areaLabel: "Welding · Line 3",
        dueAt: "2030-01-15T00:00:00.000Z",
        people: [{ userId: OWNER, role: "owner" }],
      },
    });
  });

  it("builds an 8D body with the linked NCR code only when given", () => {
    const d = base();
    d.type = "8d";
    d.template = "auto";
    expect(buildCreateBody(d)).toMatchObject({ type: "8d", body: { template: "auto", priority: "high" } });
    expect(buildCreateBody(d)?.body).not.toHaveProperty("ncrCode");
    d.linkedNcr = " NCR-2026-0014 ";
    expect(buildCreateBody(d)?.body).toMatchObject({ ncrCode: "NCR-2026-0014" });
  });

  it("builds inspection and document bodies; rejects an unknown template", () => {
    const i = base();
    i.type = "inspection";
    i.template = "22222222-2222-4222-8222-222222222222";
    expect(buildCreateBody(i)).toMatchObject({ type: "inspection", body: { templateId: i.template } });

    const doc = base();
    doc.type = "document";
    doc.template = "sop";
    doc.fileId = "33333333-3333-4333-8333-333333333333";
    expect(buildCreateBody(doc)).toMatchObject({ type: "document", body: { category: "sop", template: "sop", fileId: doc.fileId } });
    doc.template = "nope";
    expect(buildCreateBody(doc)).toBeNull();
    expect(buildCreateBody(emptyDraft(null))).toBeNull();
  });
});
