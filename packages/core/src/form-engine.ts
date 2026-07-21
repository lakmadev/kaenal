/**
 * Dynamic inspection form engine (02 §2, 08 §1.2).
 *
 * Two jobs, both server-authoritative:
 *
 *  - `validateResponses` — a completed inspection's answers are legal for its
 *    template: every required, visible item is answered, and every answer is
 *    the right shape for its item type. The client validates too, for feel, but
 *    this is the copy that decides whether a completion is accepted.
 *  - `scoreInspection` — the weighted score. The client never sends a score; a
 *    number a customer computes is a number a customer can forge. Weight 0 and
 *    "not applicable" drop an item from the denominator rather than counting as
 *    a zero, so a section full of N/A items does not tank the score.
 *
 * Both walk the schema, not the responses, so an answer to an item the template
 * does not contain is simply ignored — it can never inflate a score or satisfy
 * a requirement.
 */

import {
  NOT_APPLICABLE,
  type FormItem,
  type FormResponses,
  type FormSchema,
} from "@kaenal/types";
import { allow, deny, type Decision } from "./result.js";

/** Item types that carry no answer — they are layout, never scored/required. */
const PRESENTATIONAL = new Set(["header", "info"]);

/** Item types that contribute to the score. Everything else is informational. */
const SCORABLE = new Set(["pass_fail", "yes_no", "score"]);

export interface ResponseError {
  readonly itemId: string;
  readonly message: string;
}

/**
 * Is `item` shown, given the answers so far? An item with no `visibleWhen` is
 * always shown; otherwise it is shown only when the referenced item's answer is
 * one of the listed values. A hidden item is neither required nor scored.
 */
export function isVisible(item: FormItem, responses: FormResponses): boolean {
  if (item.visibleWhen === undefined) return true;
  const controlling = responses[item.visibleWhen.itemId];
  return item.visibleWhen.equals.some((v) => v === controlling);
}

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** Validates one answered item, returning a message or null if it is fine. */
function checkValue(item: FormItem, value: unknown): string | null {
  switch (item.type) {
    case "pass_fail":
      return value === "pass" || value === "fail" ? null : "must be 'pass' or 'fail'";
    case "yes_no":
      return value === "yes" || value === "no" ? null : "must be 'yes' or 'no'";
    case "score":
    case "number": {
      if (typeof value !== "number" || Number.isNaN(value)) return "must be a number";
      if (item.min !== undefined && value < item.min) return `must be ≥ ${item.min}`;
      if (item.max !== undefined && value > item.max) return `must be ≤ ${item.max}`;
      return null;
    }
    case "text":
    case "textarea":
      return typeof value === "string" ? null : "must be text";
    case "date":
    case "datetime":
      return typeof value === "string" && !Number.isNaN(Date.parse(value))
        ? null
        : "must be an ISO date";
    case "select": {
      const values = (item.options ?? []).map((o) => o.value);
      return typeof value === "string" && values.includes(value)
        ? null
        : "must be one of the allowed options";
    }
    case "multiselect": {
      const values = new Set((item.options ?? []).map((o) => o.value));
      if (!Array.isArray(value)) return "must be a list of options";
      return value.every((v) => typeof v === "string" && values.has(v))
        ? null
        : "contains a value that is not an allowed option";
    }
    case "photo":
      // One file id or several.
      return typeof value === "string" || Array.isArray(value) ? null : "must be a file reference";
    case "signature":
      return typeof value === "string" ? null : "must be a signature file reference";
    default:
      return null;
  }
}

export function validateResponses(schema: FormSchema, responses: FormResponses): Decision {
  const errors: ResponseError[] = [];

  for (const section of schema.sections) {
    for (const item of section.items) {
      if (PRESENTATIONAL.has(item.type)) continue;
      if (!isVisible(item, responses)) continue;

      const value = responses[item.id];

      // "Not applicable" is only legal when the template allows it for the item.
      if (value === NOT_APPLICABLE) {
        if (!item.naAllowed) errors.push({ itemId: item.id, message: "is not applicable-eligible" });
        continue;
      }

      if (isEmpty(value)) {
        if (item.required) errors.push({ itemId: item.id, message: "is required" });
        continue;
      }

      const problem = checkValue(item, value);
      if (problem !== null) errors.push({ itemId: item.id, message: problem });
    }
  }

  if (errors.length > 0) {
    return deny("VALIDATION_FAILED", "Inspection responses are invalid", { errors });
  }
  return allow();
}

/** Normalises a scorable answer to [0,1], or null if it should not be counted. */
function normalise(item: FormItem, value: unknown): number | null {
  if (value === NOT_APPLICABLE || isEmpty(value)) return null;
  switch (item.type) {
    case "pass_fail":
      return value === "pass" ? 1 : value === "fail" ? 0 : null;
    case "yes_no":
      return value === "yes" ? 1 : value === "no" ? 0 : null;
    case "score": {
      if (typeof value !== "number") return null;
      const min = item.min ?? 0;
      const max = item.max ?? 5;
      if (max <= min) return null;
      const clamped = Math.min(Math.max(value, min), max);
      return (clamped - min) / (max - min);
    }
    default:
      return null;
  }
}

export interface ScoreResult {
  /** 0–100 percentage, rounded to 2dp, or null when nothing was scorable. */
  readonly score: number | null;
  /** How many items actually counted toward the score. */
  readonly scoredItems: number;
}

export function scoreInspection(schema: FormSchema, responses: FormResponses): ScoreResult {
  let weightedSum = 0; // Σ over sections of sectionWeight × sectionFraction
  let weightTotal = 0; // Σ of the weights of sections that had anything to score
  let scoredItems = 0;

  for (const section of schema.sections) {
    if (section.weight === 0) continue;

    let earned = 0;
    let possible = 0;

    for (const item of section.items) {
      if (!SCORABLE.has(item.type)) continue;
      if (item.weight === 0) continue;
      if (!isVisible(item, responses)) continue;

      const normalised = normalise(item, responses[item.id]);
      if (normalised === null) continue; // N/A or unanswered: out of the denominator

      earned += item.weight * normalised;
      possible += item.weight;
      scoredItems += 1;
    }

    if (possible === 0) continue; // section had no applicable scorable items
    weightedSum += section.weight * (earned / possible);
    weightTotal += section.weight;
  }

  if (weightTotal === 0) return { score: null, scoredItems: 0 };

  const score = Math.round((weightedSum / weightTotal) * 100 * 100) / 100;
  return { score, scoredItems };
}
