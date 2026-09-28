/**
 * CreateWizard rules (Sprint 01 S1-1, createwizard.jsx) — the pure logic behind
 * the full-page "New …" flow. Which types exist, their templates, when a step
 * may advance, how a wizard draft maps onto each create body, which step owns a
 * failing field. No React, no I/O (rule 5: no business logic in components).
 */

import type {
  CreateDocumentBody,
  CreateEightDBody,
  CreateInspectionBody,
  CreateNcrBody,
  DocumentCategory,
  DocumentTemplate,
  EightDTemplate,
  EntityPersonInput,
  NcrPriority,
  NcrSource,
  WizardPriority,
} from "@kaenal/types";
import type { Capability } from "./rbac.js";

export type WizardType = "inspection" | "ncr" | "8d" | "document";

/** Menu / step-0 order (ENTITY_TYPES in the jsx). */
export const WIZARD_TYPE_ORDER: readonly WizardType[] = ["inspection", "ncr", "8d", "document"];

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
  },
};

export function isWizardType(value: string): value is WizardType {
  return (WIZARD_TYPE_ORDER as readonly string[]).includes(value);
}

/** The types this user may create — the "New" menu contents (empty = no button). */
export function creatableTypes(capabilities: readonly string[]): WizardType[] {
  return WIZARD_TYPE_ORDER.filter((t) => capabilities.includes(WIZARD_TYPES[t].capability));
}

export const WIZARD_STEPS = ["Type", "Details", "Assignees", "Review"] as const;
export const LAST_STEP = WIZARD_STEPS.length - 1;

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

export interface WizardDraft {
  type: WizardType | null;
  /** Template id (a published inspection template's uuid for inspections). */
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
    d.fileId !== null
  );
}

/** `canNext()` of the jsx, step by step. */
export function canAdvance(step: number, d: WizardDraft): boolean {
  if (step === 0) return d.type !== null;
  if (step === 1) return d.template !== null && d.title.trim() !== "";
  if (step === 2) return d.people.length > 0;
  return true;
}

/** Why Next is disabled, so "why can't I continue" is never silent. */
export function advanceBlocker(step: number, d: WizardDraft): string | null {
  if (canAdvance(step, d)) return null;
  if (step === 0) return "Pick a type to continue.";
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
  | { type: "document"; body: CreateDocumentBody };

/** A complete draft → the matching create body. Null if it isn't complete. */
export function buildCreateBody(d: WizardDraft): WizardBody | null {
  if (d.type === null || d.template === null) return null;
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
  | "people";

/** The wizard field a 422 issue path belongs to. */
export function wizardFieldFor(path: string): WizardField {
  const head = path.split(".")[0] ?? path;
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

export function stepForWizardField(f: WizardField): number {
  return f === "people" ? 2 : 1;
}
