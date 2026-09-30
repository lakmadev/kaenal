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
  lastStepFor,
  ncrTemplateMapping,
  stepForField,
  stepsFor,
  toNcrPriority,
  wizardFieldFor,
  stepForWizardField,
  WIZARD_TYPE_ORDER,
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

  it("[risk] risk:manage adds risk as the 5th creatable type, in WIZARD_TYPE_ORDER (feeds both the New menu and the Type-step grid)", () => {
    expect(creatableTypes(["inspection:perform", "ncr:create", "ncr:manage", "document:manage", "risk:manage"])).toEqual([
      "inspection",
      "ncr",
      "8d",
      "document",
      "risk",
    ]);
    expect(creatableTypes(["risk:view"])).toEqual([]);
  });

  it("[ecn] ecn:manage adds ecn as the 6th creatable type, in WIZARD_TYPE_ORDER (SPRINT-06 E3 AC2)", () => {
    expect(WIZARD_TYPE_ORDER).toEqual(["inspection", "ncr", "8d", "document", "risk", "ecn"]);
    expect(
      creatableTypes(["inspection:perform", "ncr:create", "ncr:manage", "document:manage", "risk:manage", "ecn:manage"]),
    ).toEqual(["inspection", "ncr", "8d", "document", "risk", "ecn"]);
    expect(creatableTypes(["ecn:view"])).toEqual([]);
  });
});

describe("[regression] per-type step shape — the 4 existing types keep their full 4-step flow", () => {
  it.each(["inspection", "ncr", "8d", "document"] as const)("%s is Type→Details→Assignees→Review (4 steps)", (type) => {
    expect(stepsFor(type)).toEqual(["Type", "Details", "Assignees", "Review"]);
    expect(lastStepFor(type)).toBe(3);
  });

  it("no type chosen yet (step 0) still uses the common 4-step shape for the step indicator", () => {
    expect(stepsFor(null)).toEqual(["Type", "Details", "Assignees", "Review"]);
    expect(lastStepFor(null)).toBe(3);
  });
});

describe("[risk] risk's 3-step branch (Type→Details→Review, no shared Assignees step)", () => {
  it("has its own 3-step shape", () => {
    expect(stepsFor("risk")).toEqual(["Type", "Details", "Review"]);
    expect(lastStepFor("risk")).toBe(2);
  });
});

describe("[ecn] ecn's 3-step branch (Type→Details→Review, no shared Assignees step, SPRINT-06 E3 AC1)", () => {
  it("has its own 3-step shape, mirroring risk's exact precedent", () => {
    expect(stepsFor("ecn")).toEqual(["Type", "Details", "Review"]);
    expect(lastStepFor("ecn")).toBe(2);
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

describe("[risk] step gating — risk's 3-step flow (Type→Details→Review)", () => {
  it("step 1 (Details) needs category, title, likelihood, impact, treatment and owner — no template, no Assignees step", () => {
    const d = emptyDraft("risk");
    expect(canAdvance(0, d)).toBe(true); // type already set by emptyDraft("risk")
    expect(canAdvance(1, d)).toBe(false);
    expect(advanceBlocker(1, d)).toBe("Choose a category.");

    d.riskCategory = "process";
    expect(advanceBlocker(1, d)).toBe("A title is required.");
    d.title = "Single-source stamping supplier";
    expect(advanceBlocker(1, d)).toBe("Choose a likelihood.");
    d.riskLikelihood = 3;
    expect(advanceBlocker(1, d)).toBe("Choose an impact.");
    d.riskImpact = 4;
    expect(advanceBlocker(1, d)).toBe("Choose a treatment.");
    d.riskTreatment = "mitigate";
    expect(advanceBlocker(1, d)).toBe("Choose an owner.");
    d.riskOwner = OWNER;
    expect(canAdvance(1, d)).toBe(true);
    expect(advanceBlocker(1, d)).toBeNull();

    // Step 2 is Review for risk (there is no shared Assignees step at index 2).
    expect(canAdvance(2, d)).toBe(true);
  });

  it("isDirty sees risk-only fields", () => {
    expect(isDirty(emptyDraft("risk"))).toBe(false);
    const d = emptyDraft("risk");
    d.riskCategory = "cyber";
    expect(isDirty(d)).toBe(true);
    expect(isDirty({ ...emptyDraft("risk"), riskOwner: OWNER })).toBe(true);
    expect(isDirty({ ...emptyDraft("risk"), riskPlan: "  " })).toBe(false);
  });
});

describe("[risk] wizardFieldFor / stepForWizardField", () => {
  it("maps risk's own field names, disambiguating `category` from the template-derived one other types use", () => {
    expect(wizardFieldFor("category", "risk")).toBe("category");
    expect(wizardFieldFor("category")).toBe("template"); // unchanged for ncr/document/8d (no regression)
    expect(wizardFieldFor("likelihood", "risk")).toBe("likelihood");
    expect(wizardFieldFor("impact", "risk")).toBe("impact");
    expect(wizardFieldFor("treatment", "risk")).toBe("treatment");
    expect(wizardFieldFor("plan", "risk")).toBe("plan");
    expect(wizardFieldFor("owner", "risk")).toBe("owner");
    expect(wizardFieldFor("title", "risk")).toBe("title");
  });

  it("every risk field lands on step 1 (Details) — risk has no Assignees step to send `people` errors to", () => {
    expect(stepForWizardField("category")).toBe(1);
    expect(stepForWizardField("likelihood")).toBe(1);
    expect(stepForWizardField("impact")).toBe(1);
    expect(stepForWizardField("treatment")).toBe(1);
    expect(stepForWizardField("plan")).toBe(1);
    expect(stepForWizardField("owner")).toBe(1);
    expect(stepForWizardField("people")).toBe(2); // unchanged for the other 4 types
  });
});

describe("[ecn] step gating — ecn's 3-step flow (Type→Details→Review)", () => {
  it("step 1 (Details) needs changeType, title, changeRisk and owner — no template, no Assignees step", () => {
    const d = emptyDraft("ecn");
    expect(canAdvance(0, d)).toBe(true); // type already set by emptyDraft("ecn")
    expect(canAdvance(1, d)).toBe(false);
    expect(advanceBlocker(1, d)).toBe("Choose a change type.");

    d.ecnChangeType = "design";
    expect(advanceBlocker(1, d)).toBe("A title is required.");
    d.title = "Update weld penetration spec";
    expect(advanceBlocker(1, d)).toBe("Choose a risk level.");
    d.ecnChangeRisk = "medium";
    expect(advanceBlocker(1, d)).toBe("Choose an owner.");
    d.ecnOwner = OWNER;
    expect(canAdvance(1, d)).toBe(true);
    expect(advanceBlocker(1, d)).toBeNull();

    // Step 2 is Review for ecn (there is no shared Assignees step at index 2).
    expect(canAdvance(2, d)).toBe(true);
  });

  it("isDirty sees ecn-only fields", () => {
    expect(isDirty(emptyDraft("ecn"))).toBe(false);
    const d = emptyDraft("ecn");
    d.ecnChangeType = "material";
    expect(isDirty(d)).toBe(true);
    expect(isDirty({ ...emptyDraft("ecn"), ecnOwner: OWNER })).toBe(true);
    expect(isDirty({ ...emptyDraft("ecn"), ecnEffectiveDate: "2030-01-01" })).toBe(true);
  });
});

describe("[ecn] wizardFieldFor / stepForWizardField", () => {
  it("maps ecn's own field names, disambiguating `owner`/`description`/`title` from the other types' meanings", () => {
    expect(wizardFieldFor("changeType", "ecn")).toBe("changeType");
    expect(wizardFieldFor("changeRisk", "ecn")).toBe("changeRisk");
    expect(wizardFieldFor("effectiveDate", "ecn")).toBe("effectiveDate");
    expect(wizardFieldFor("owner", "ecn")).toBe("owner");
    expect(wizardFieldFor("description", "ecn")).toBe("description");
    expect(wizardFieldFor("title", "ecn")).toBe("title");
  });

  it("every ecn field lands on step 1 (Details) — ecn has no Assignees step to send `people` errors to", () => {
    expect(stepForWizardField("changeType")).toBe(1);
    expect(stepForWizardField("changeRisk")).toBe(1);
    expect(stepForWizardField("effectiveDate")).toBe(1);
    expect(stepForWizardField("owner")).toBe(1);
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

  it("[risk] builds a risk body with the server-side create-time defaults, no template required", () => {
    const d = emptyDraft("risk");
    expect(buildCreateBody(d)).toBeNull(); // incomplete

    d.riskCategory = "quality";
    d.title = "  Recurring solder-joint porosity on Line 2  ";
    d.riskLikelihood = 4;
    d.riskImpact = 5;
    d.riskTreatment = "mitigate";
    d.riskOwner = OWNER;
    expect(buildCreateBody(d)).toEqual({
      type: "risk",
      body: {
        category: "quality",
        title: "Recurring solder-joint porosity on Line 2",
        owner: OWNER,
        likelihood: 4,
        impact: 5,
        treatment: "mitigate",
        status: "active",
        trend: "flat",
        plan: "",
      },
    });

    d.riskPlan = "  Add SPC checkpoint after reflow  ";
    expect(buildCreateBody(d)?.body).toMatchObject({ plan: "Add SPC checkpoint after reflow" });

    d.riskOwner = null;
    expect(buildCreateBody(d)).toBeNull();
  });

  it("[ecn] builds an ECN body with a trimmed optional description and nullable effectiveDate, no template required", () => {
    const d = emptyDraft("ecn");
    expect(buildCreateBody(d)).toBeNull(); // incomplete

    d.ecnChangeType = "process";
    d.title = "  Replace MIG with TIG on bracket DTR-201 inner seam  ";
    d.ecnChangeRisk = "high";
    d.ecnOwner = OWNER;
    expect(buildCreateBody(d)).toEqual({
      type: "ecn",
      body: {
        changeType: "process",
        title: "Replace MIG with TIG on bracket DTR-201 inner seam",
        changeRisk: "high",
        effectiveDate: null,
        owner: OWNER,
      },
    });

    d.description = "  Reduces spatter and rework on the inner seam.  ";
    d.ecnEffectiveDate = "2030-06-12";
    expect(buildCreateBody(d)?.body).toMatchObject({
      description: "Reduces spatter and rework on the inner seam.",
      effectiveDate: "2030-06-12",
    });

    d.ecnOwner = null;
    expect(buildCreateBody(d)).toBeNull();
  });
});
