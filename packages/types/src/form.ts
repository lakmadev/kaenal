import { z } from "zod";
import { FormItemType } from "./enums.js";

/**
 * The dynamic inspection form schema (02 §2, stored in
 * `inspection_templates.schema`).
 *
 * A template is a list of sections, each a list of items. The same schema is
 * consumed in three places and so lives in `packages/types`: the API validates
 * a template's shape on create, `packages/core` validates responses and scores
 * a completed inspection against it, and the web/mobile clients render it. The
 * one thing none of them may do is invent fields — the schema here is the whole
 * vocabulary.
 */

/** One choice for a `select` / `multiselect` item. */
export const FormOption = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});
export type FormOption = z.infer<typeof FormOption>;

/**
 * Conditional visibility: the item is shown (and only then answerable /
 * required) when another item's response equals one of these values. Kept
 * deliberately simple — one dependency, equality only — because the scoring
 * engine has to evaluate it deterministically server-side, not just the UI.
 */
export const VisibleWhen = z.object({
  itemId: z.string().min(1),
  equals: z.array(z.union([z.string(), z.number(), z.boolean()])).min(1),
});
export type VisibleWhen = z.infer<typeof VisibleWhen>;

export const FormItem = z.object({
  id: z.string().min(1),
  type: FormItemType,
  label: z.string().min(1),
  /** Presentational-only items (`header`, `info`) are never required/scored. */
  required: z.boolean().default(false),
  /** Scoring weight; 0 excludes the item from the score entirely (08 §1.2). */
  weight: z.number().min(0).default(1),
  /** Whether "not applicable" is a legal answer that drops the item from scoring. */
  naAllowed: z.boolean().default(false),
  options: z.array(FormOption).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  visibleWhen: VisibleWhen.optional(),
});
export type FormItem = z.infer<typeof FormItem>;

export const FormSection = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  /** 0 excludes the whole section from scoring; otherwise weights the section. */
  weight: z.number().min(0).default(1),
  items: z.array(FormItem),
});
export type FormSection = z.infer<typeof FormSection>;

export const FormSchema = z.object({
  sections: z.array(FormSection),
});
export type FormSchema = z.infer<typeof FormSchema>;

/** Sentinel a response uses to mark an `naAllowed` item as not applicable. */
export const NOT_APPLICABLE = "__na__";

/** A map of item id → the inspector's answer. */
export const FormResponses = z.record(z.unknown());
export type FormResponses = z.infer<typeof FormResponses>;
