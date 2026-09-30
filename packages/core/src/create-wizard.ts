/**
 * CreateWizard rules (Sprint 01 S1-1, createwizard.jsx) — the pure logic behind
 * the full-page "New …" flow. Which types exist, their templates, when a step
 * may advance, how a wizard draft maps onto each create body, which step owns a
 * failing field. No React, no I/O (rule 5: no business logic in components).
 */

import type {
  CreateDocumentBody,
  CreateEightDBody,
  CreateEcnBody,
  CreateInspectionBody,
  CreateNcrBody,
  CreateRiskBody,
  DocumentCategory,
  DocumentTemplate,
  EcnChangeRisk,
  EcnChangeType,
  EightDTemplate,
  EntityPersonInput,
  NcrPriority,
  NcrSource,
  RiskCategory,
  RiskTreatment,
  WizardPriority,
} from "@kaenal/types";
import type { Capability } from "./rbac.js";

export type WizardType = "inspection" | "ncr" | "8d" | "document" | "risk" | "ecn";

/** Menu / step-0 order (ENTITY_TYPES in the jsx, `ecn` added as the 6th
 *  option, SPRINT-06 E3 AC2). */
export const WIZARD_TYPE_ORDER: readonly WizardType[] = ["inspection", "ncr", "8d", "document", "risk", "ecn"];

/**
 * Step labels, per flow shape. Every type shares the same 4-step
 * Type→Details→Assignees→Review flow EXCEPT `risk` (Sprint 04 R4 AC1/AC3) and
 * `ecn` (Sprint 06 E3 AC1, mirroring risk's exact precedent): both have a
 * single-select `owner` field captured inside their own Details step, not the
 * shared Assignees step's multi-role `entity_people` write shape, so both skip
 * Assignees entirely (Type→Details→Review, 3 steps).
 */
export const WIZARD_STEPS = ["Type", "Details", "Assignees", "Review"] as const;
export const RISK_WIZARD_STEPS = ["Type", "Details", "Review"] as const;
export const ECN_WIZARD_STEPS = ["Type", "Details", "Review"] as const;
export const LAST_STEP = WIZARD_STEPS.length - 1;

export interface WizardTemplateOption {
  readonly id: string;
  readonly label: string;
  readonly meta: string;
}

export interface WizardTypeDef {
  readonly label: string;
  readonly desc: string;
  /** Capability required to create this type (menu item hidden without it). */
  readonly capability: Capability;
  readonly titlePlaceholder: string;
  readonly areaPlaceholder: string;
  /** Priority + due date fields are shown for these types only. */
  readonly hasPriorityAndDue: boolean;
  /** Empty for inspections: their templates are the tenant's published ones. */
  readonly templates: readonly WizardTemplateOption[];
  /** This type's step sequence (3 for risk, 4 for everything else — R4 AC3). */
  readonly steps: readonly string[];
}

export const WIZARD_TYPES: Readonly<Record<WizardType, WizardTypeDef>> = {
  inspection: {
    label: "Inspection",
    desc: "Run a checklist against an asset, area, or process.",
    capability: "inspection:perform",
    titlePlaceholder: "e.g. Plant A — Line 3 weekly safety walk",
    areaPlaceholder: "e.g. Welding · Line 3",
    hasPriorityAndDue: true,
    templates: [],
    steps: WIZARD_STEPS,
  },
  ncr: {
    label: "Non-Conformity",
    desc: "Log a quality issue, defect, or deviation.",
    capability: "ncr:create",
    titlePlaceholder: "e.g. Bracket weld bead inconsistent on Line 2",
    areaPlaceholder: "e.g. Welding · Line 3",
    hasPriorityAndDue: true,
    templates: [
      { id: "product", label: "Product defect", meta: "Material / dimensional / functional" },
      { id: "process", label: "Process deviation", meta: "Procedure not followed" },
      { id: "supplier", label: "Supplier issue", meta: "Incoming material rejected" },
      { id: "customer", label: "Customer complaint", meta: "External feedback / return" },
      { id: "audit", label: "Audit finding", meta: "Internal or external audit" },
    ],
    steps: WIZARD_STEPS,
  },
  "8d": {
    label: "8D Report",
    desc: "Structured root-cause investigation across D1–D8.",
    capability: "ncr:manage",
    titlePlaceholder: "e.g. Recurrent porosity on aluminum housing",
    areaPlaceholder: "e.g. Welding · Line 3",
    hasPriorityAndDue: true,
    templates: [
      { id: "auto", label: "Automotive (IATF)", meta: "Customer-facing problem solving" },
      { id: "medical", label: "Medical Device (FDA)", meta: "21 CFR Part 820" },
      { id: "aero", label: "Aerospace (AS9100)", meta: "Customer-driven CAPA" },
      { id: "standard", label: "Standard 8D", meta: "General-purpose template" },
    ],
    steps: WIZARD_STEPS,
  },
  document: {
    label: "Document",
    desc: "Upload or draft a controlled document.",
    capability: "document:manage",
    titlePlaceholder: "e.g. SOP-2026-Q2-Welding-rev3",
    areaPlaceholder: "Department",
    hasPriorityAndDue: false,
    templates: [
      { id: "sop", label: "Standard Operating Procedure (SOP)", meta: "Procedure document" },
      { id: "wi", label: "Work Instruction", meta: "Step-by-step task guide" },
      { id: "form", label: "Form / Record", meta: "Template for capturing data" },
      { id: "policy", label: "Policy", meta: "Governance document" },
      { id: "manual", label: "Manual", meta: "Quality / safety manual section" },
      { id: "upload", label: "Upload existing file", meta: "PDF, DOCX, XLSX" },
    ],
    steps: WIZARD_STEPS,
  },
  risk: {
    label: "Risk",
    desc: "Log a risk to the register with likelihood, impact, and treatment.",
    capability: "risk:manage",
    titlePlaceholder: "e.g. Single-source aluminum supplier for Line 2 harnesses",
    areaPlaceholder: "e.g. Welding · Line 3",
    hasPriorityAndDue: false,
    templates: [],
    steps: RISK_WIZARD_STEPS,
  },
  ecn: {
    label: "Engineering change",
    desc: "Draft an ECN — a multi-stage approval workflow for a design, process, tooling, or material change.",
    capability: "ecn:manage",
    titlePlaceholder: "e.g. Update weld penetration spec for Volvo VBR-3041 from 5.0–7.0mm to 5.5–7.0mm",
    areaPlaceholder: "e.g. Welding · Line 3",
    hasPriorityAndDue: false,
    templates: [],
    steps: ECN_WIZARD_STEPS,
  },
};

export function isWizardType(value: string): value is WizardType {
  return (WIZARD_TYPE_ORDER as readonly string[]).includes(value);
}

/** The types this user may create — the "New" menu contents (empty = no button). */
export function creatableTypes(capabilities: readonly string[]): WizardType[] {
  return WIZARD_TYPE_ORDER.filter((t) => capabilities.includes(WIZARD_TYPES[t].capability));
}

/** This type's step labels (3 for risk, 4 otherwise). Null (no type chosen yet) uses the common 4-step shape for the step-0 chrome. */
export function stepsFor(type: WizardType | null): readonly string[] {
  return type === null ? WIZARD_STEPS : WIZARD_TYPES[type].steps;
}

/** The index of this type's last (Review) step. */
export function lastStepFor(type: WizardType | null): number {
  return stepsFor(type).length - 1;
}

export const PRIORITY_OPTIONS: readonly { id: WizardPriority; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "critical", label: "Critical" },
];

export const PERSON_ROLE_OPTIONS = [
  { id: "owner", label: "Owner" },
  { id: "reviewer", label: "Reviewer" },
  { id: "approver", label: "Approver" },
  { id: "watcher", label: "Watcher" },
] as const;

/** Risk category options (R4 AC1's "the 9 values"). */
export const RISK_CATEGORY_OPTIONS: readonly { id: RiskCategory; label: string }[] = [
  { id: "supply", label: "Supply chain" },
  { id: "process", label: "Process" },
  { id: "compliance", label: "Compliance" },
  { id: "cyber", label: "Cybersecurity" },
  { id: "people", label: "People" },
  { id: "quality", label: "Quality" },
  { id: "environmental", label: "Environmental" },
  { id: "financial", label: "Financial" },
  { id: "reputation", label: "Reputation" },
];

/** Risk treatment options (R4 AC1). */
export const RISK_TREATMENT_OPTIONS: readonly { id: RiskTreatment; label: string }[] = [
  { id: "mitigate", label: "Mitigate" },
  { id: "accept", label: "Accept" },
  { id: "transfer", label: "Transfer" },
  { id: "avoid", label: "Avoid" },
];

/** The 1-5 likelihood/impact scale (R4 AC1's segmented picker). */
export const RISK_SCALE_OPTIONS: readonly number[] = [1, 2, 3, 4, 5];

export interface WizardDraft {
  type: WizardType | null;
  /** Template id (a published inspection template's uuid for inspections). Unused by risk (no templates). */
  template: string | null;
  title: string;
  priority: WizardPriority;
  /** Plant id; "" = not chosen. */
  plantId: string;
  area: string;
  /** yyyy-mm-dd or "". */
  due: string;
  description: string;
  linkedNcr: string;
  people: EntityPersonInput[];
  /** Document "Upload existing file" — an uploaded file id. */
  fileId: string | null;
  /** Risk-only fields (R4 AC1) — captured in risk's own Details step, not shared with the other 4 types. */
  riskCategory: RiskCategory | null;
  riskLikelihood: number | null;
  riskImpact: number | null;
  riskTreatment: RiskTreatment | null;
  /** Optional at create (R4 AC1); posted as `''` when left blank. */
  riskPlan: string;
  /** The risk's single owner — a userId, captured as a single-select in Details, not via Assignees. */
  riskOwner: string | null;
  /** ECN-only fields (Sprint 06 E3 AC1) — captured in ecn's own Details step,
   *  not shared with the other 5 types. `title`/`description` reuse the
   *  common fields above. */
  ecnChangeType: EcnChangeType | null;
  ecnChangeRisk: EcnChangeRisk | null;
  /** yyyy-mm-dd or "" (optional at create). */
  ecnEffectiveDate: string;
  /** The ECN's single owner — a userId, same single-select shape as `riskOwner`. */
  ecnOwner: string | null;
}

export function emptyDraft(type: WizardType | null): WizardDraft {
  return {
    type,
    template: null,
    title: "",
    priority: "medium",
    plantId: "",
    area: "",
    due: "",
    description: "",
    linkedNcr: "",
    people: [],
    fileId: null,
    riskCategory: null,
    riskLikelihood: null,
    riskImpact: null,
    riskTreatment: null,
    riskPlan: "",
    riskOwner: null,
    ecnChangeType: null,
    ecnChangeRisk: null,
    ecnEffectiveDate: "",
    ecnOwner: null,
  };
}

/** Anything the user typed/chose beyond the type — drives the leave-confirm. */
export function isDirty(d: WizardDraft): boolean {
  return (
    d.template !== null ||
    d.title.trim() !== "" ||
    d.area.trim() !== "" ||
    d.due !== "" ||
    d.description.trim() !== "" ||
    d.linkedNcr.trim() !== "" ||
    d.people.length > 0 ||
    d.fileId !== null ||
    d.riskCategory !== null ||
    d.riskLikelihood !== null ||
    d.riskImpact !== null ||
    d.riskTreatment !== null ||
    d.riskPlan.trim() !== "" ||
    d.riskOwner !== null ||
    d.ecnChangeType !== null ||
    d.ecnChangeRisk !== null ||
    d.ecnEffectiveDate !== "" ||
    d.ecnOwner !== null
  );
}

function riskDetailsComplete(d: WizardDraft): boolean {
  return (
    d.riskCategory !== null &&
    d.title.trim() !== "" &&
    d.riskLikelihood !== null &&
    d.riskImpact !== null &&
    d.riskTreatment !== null &&
    d.riskOwner !== null
  );
}

/** ECN's own Details-step completeness (SPRINT-06 E3 AC1): `changeType`,
 *  `title`, `changeRisk`, and `owner` are required; `description`/
 *  `effectiveDate` are optional at create. */
function ecnDetailsComplete(d: WizardDraft): boolean {
  return d.ecnChangeType !== null && d.title.trim() !== "" && d.ecnChangeRisk !== null && d.ecnOwner !== null;
}

/** `canNext()` of the jsx, step by step. Risk and ecn both branch to their own
 *  3-step shape (Type→Details→Review) since they skip the shared Assignees
 *  step. */
export function canAdvance(step: number, d: WizardDraft): boolean {
  if (step === 0) return d.type !== null;
  if (d.type === "risk") {
    if (step === 1) return riskDetailsComplete(d);
    return true; // step 2 = Review for risk
  }
  if (d.type === "ecn") {
    if (step === 1) return ecnDetailsComplete(d);
    return true; // step 2 = Review for ecn
  }
  if (step === 1) return d.template !== null && d.title.trim() !== "";
  if (step === 2) return d.people.length > 0;
  return true;
}

/** Why Next is disabled, so "why can't I continue" is never silent. */
export function advanceBlocker(step: number, d: WizardDraft): string | null {
  if (canAdvance(step, d)) return null;
  if (step === 0) return "Pick a type to continue.";
  if (d.type === "risk") {
    if (d.riskCategory === null) return "Choose a category.";
    if (d.title.trim() === "") return "A title is required.";
    if (d.riskLikelihood === null) return "Choose a likelihood.";
    if (d.riskImpact === null) return "Choose an impact.";
    if (d.riskTreatment === null) return "Choose a treatment.";
    if (d.riskOwner === null) return "Choose an owner.";
    return null;
  }
  if (d.type === "ecn") {
    if (d.ecnChangeType === null) return "Choose a change type.";
    if (d.title.trim() === "") return "A title is required.";
    if (d.ecnChangeRisk === null) return "Choose a risk level.";
    if (d.ecnOwner === null) return "Choose an owner.";
    return null;
  }
  if (step === 1) return d.template === null ? "Choose a template." : "A title is required.";
  if (step === 2) return "Add at least one person — an owner.";
  return null;
}

/** Role a newly added person defaults to: first is the owner (jsx). */
export function defaultRoleFor(existing: readonly EntityPersonInput[]): EntityPersonInput["role"] {
  return existing.length === 0 ? "owner" : "reviewer";
}

/** The wizard's 4-level priority onto the NCR's 3-level severity column. */
export function toNcrPriority(p: WizardPriority): NcrPriority {
  if (p === "critical") return "critical";
  if (p === "high") return "major";
  return "minor";
}

/** NCR template → source + category (the template label is the category). */
export function ncrTemplateMapping(id: string): { source: NcrSource; category: string } {
  const tpl = WIZARD_TYPES.ncr.templates.find((t) => t.id === id);
  const category = tpl?.label ?? id;
  if (id === "customer") return { source: "complaint", category };
  if (id === "audit") return { source: "audit", category };
  return { source: "manual", category };
}

/** Document template → the category it files under (+ the exact template id). */
export function documentTemplateMapping(id: DocumentTemplate): {
  category: DocumentCategory;
  template: DocumentTemplate;
} {
  const category: Record<DocumentTemplate, DocumentCategory> = {
    sop: "sop",
    wi: "work_instruction",
    form: "form",
    policy: "manual",
    manual: "manual",
    upload: "record",
  };
  return { category: category[id], template: id };
}

function dateToIso(d: string): string | null {
  return d === "" ? null : new Date(`${d}T00:00:00Z`).toISOString();
}

function nullable(s: string): string | null {
  const t = s.trim();
  return t === "" ? null : t;
}

const DOCUMENT_TEMPLATE_IDS: readonly string[] = WIZARD_TYPES.document.templates.map((t) => t.id);
const EIGHT_D_TEMPLATE_IDS: readonly string[] = WIZARD_TYPES["8d"].templates.map((t) => t.id);

export type WizardBody =
  | { type: "inspection"; body: CreateInspectionBody }
  | { type: "ncr"; body: CreateNcrBody }
  | { type: "8d"; body: CreateEightDBody }
  | { type: "document"; body: CreateDocumentBody }
  | { type: "risk"; body: CreateRiskBody }
  | { type: "ecn"; body: CreateEcnBody };

/** A complete draft → the matching create body. Null if it isn't complete. */
export function buildCreateBody(d: WizardDraft): WizardBody | null {
  if (d.type === null) return null;
  // Risk/ecn have no templates (their `templates` arrays are both `[]`) — they
  // return early so the template null-check below only ever applies to the
  // other 4 types, which all require one.
  if (d.type === "risk") {
    const { riskCategory, riskLikelihood, riskImpact, riskTreatment, riskOwner } = d;
    if (
      riskCategory === null ||
      riskLikelihood === null ||
      riskImpact === null ||
      riskTreatment === null ||
      riskOwner === null ||
      d.title.trim() === ""
    ) {
      return null;
    }
    return {
      type: "risk",
      body: {
        category: riskCategory,
        title: d.title.trim(),
        owner: riskOwner,
        likelihood: riskLikelihood,
        impact: riskImpact,
        treatment: riskTreatment,
        // Explicit, matching R4 AC1's create-time defaults — the server
        // applies the same values if these are omitted, but CreateRiskBody's
        // output type requires them since they're zod `.default()` fields.
        status: "active",
        trend: "flat",
        plan: d.riskPlan.trim(),
      },
    };
  }
  if (d.type === "ecn") {
    const { ecnChangeType, ecnChangeRisk, ecnOwner } = d;
    if (ecnChangeType === null || ecnChangeRisk === null || ecnOwner === null || d.title.trim() === "") {
      return null;
    }
    const description = d.description.trim();
    return {
      type: "ecn",
      body: {
        changeType: ecnChangeType,
        title: d.title.trim(),
        ...(description !== "" ? { description } : {}),
        changeRisk: ecnChangeRisk,
        effectiveDate: d.ecnEffectiveDate === "" ? null : d.ecnEffectiveDate,
        owner: ecnOwner,
      },
    };
  }
  if (d.template === null) return null;
  const title = d.title.trim();
  const plantId = d.plantId === "" ? null : d.plantId;
  const areaLabel = nullable(d.area);
  const description = nullable(d.description);
  const people = d.people;

  switch (d.type) {
    case "inspection":
      return {
        type: "inspection",
        body: {
          title,
          templateId: d.template,
          plantId,
          areaLabel,
          description,
          priority: d.priority,
          scheduledAt: dateToIso(d.due),
          people,
        },
      };
    case "ncr": {
      const { source, category } = ncrTemplateMapping(d.template);
      return {
        type: "ncr",
        body: {
          title,
          priority: toNcrPriority(d.priority),
          description,
          category,
          source,
          plantId,
          areaLabel,
          dueAt: dateToIso(d.due),
          people,
        },
      };
    }
    case "8d": {
      if (!EIGHT_D_TEMPLATE_IDS.includes(d.template)) return null;
      const ncrCode = nullable(d.linkedNcr);
      return {
        type: "8d",
        body: {
          title,
          template: d.template as EightDTemplate,
          priority: d.priority,
          description,
          plantId,
          areaLabel,
          targetAt: dateToIso(d.due),
          people,
          ...(ncrCode !== null ? { ncrCode } : {}),
        },
      };
    }
    case "document": {
      if (!DOCUMENT_TEMPLATE_IDS.includes(d.template)) return null;
      const { category, template } = documentTemplateMapping(d.template as DocumentTemplate);
      return {
        type: "document",
        body: {
          title,
          category,
          template,
          description,
          plantId,
          areaLabel,
          people,
          ...(d.fileId !== null ? { fileId: d.fileId } : {}),
        },
      };
    }
  }
}

/** The wizard step that owns a body field, so a 422 lands on the right step (W7-G). */
export function stepForField(field: string): number {
  const head = field.split(".")[0] ?? field;
  return head === "people" ? 2 : 1;
}

/** Number of questions in a form template (the inspection template row's meta). */
export function templateQuestionCount(schema: { sections: readonly { items: readonly unknown[] }[] }): number {
  return schema.sections.reduce((n, s) => n + s.items.length, 0);
}

/**
 * A due date already in the past is rejected ("Due date can't be in the past").
 * The wizard sends a date at 00:00 UTC, so a 36h slack keeps every timezone's
 * "today" valid.
 */
export function isPastDue(iso: string, now: Date): boolean {
  return new Date(iso).getTime() < now.getTime() - 36 * 60 * 60 * 1000;
}

export type WizardField =
  | "template"
  | "title"
  | "priority"
  | "due"
  | "site"
  | "area"
  | "linkedNcr"
  | "description"
  | "file"
  | "people"
  | "category"
  | "likelihood"
  | "impact"
  | "treatment"
  | "plan"
  | "owner"
  | "changeType"
  | "changeRisk"
  | "effectiveDate";

/**
 * The wizard field a 422 issue path belongs to. `type` disambiguates fields
 * whose raw path collides across types — risk's own `category` (a real,
 * user-picked value) vs. the other types' `category`, which is derived from
 * their template pick and so belongs on the Template picker.
 */
export function wizardFieldFor(path: string, type?: WizardType | null): WizardField {
  const head = path.split(".")[0] ?? path;
  if (type === "risk") {
    switch (head) {
      case "category":
        return "category";
      case "likelihood":
        return "likelihood";
      case "impact":
        return "impact";
      case "treatment":
        return "treatment";
      case "plan":
        return "plan";
      case "owner":
        return "owner";
      case "title":
        return "title";
      default:
        return "title";
    }
  }
  if (type === "ecn") {
    switch (head) {
      case "changeType":
        return "changeType";
      case "changeRisk":
        return "changeRisk";
      case "effectiveDate":
        return "effectiveDate";
      case "owner":
        return "owner";
      case "description":
        return "description";
      case "title":
        return "title";
      default:
        return "title";
    }
  }
  switch (head) {
    case "templateId":
    case "template":
    case "category":
    case "source":
      return "template";
    case "priority":
      return "priority";
    case "dueAt":
    case "targetAt":
    case "scheduledAt":
      return "due";
    case "plantId":
      return "site";
    case "areaLabel":
      return "area";
    case "ncrCode":
      return "linkedNcr";
    case "description":
      return "description";
    case "fileId":
      return "file";
    case "people":
      return "people";
    default:
      return "title";
  }
}

/** Every field lands on the Details step (index 1) except `people` (Assignees,
 *  index 2 — a step risk doesn't have, since risk has no `people` field). */
export function stepForWizardField(f: WizardField): number {
  return f === "people" ? 2 : 1;
}
