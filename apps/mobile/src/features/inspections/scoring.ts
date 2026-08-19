import { NOT_APPLICABLE, type FormItem, type FormResponses, type FormSchema } from "@kaenal/types";

/**
 * Pure inspection helpers (05 §M6) — progress, answered-state, visibility and the
 * pass/fail/N-A tally the review screen shows. Kept free of React/RN so the rules
 * are unit-tested and identical to what the server will re-validate on complete
 * (the client NEVER computes the official score — that is the server's job).
 */

/** Items that never take an answer (presentational). */
const PRESENTATIONAL = new Set(["header", "info"]);

/** True when `item` is currently visible given the other responses (visibleWhen). */
export function isVisible(item: FormItem, responses: FormResponses): boolean {
  const cond = item.visibleWhen;
  if (cond === undefined) return true;
  const dep = responses[cond.itemId];
  return cond.equals.some((v) => v === dep);
}

/** True when a value counts as a real answer (non-empty; NA counts as answered). */
export function isAnswered(item: FormItem, responses: FormResponses): boolean {
  if (PRESENTATIONAL.has(item.type)) return true;
  const v = responses[item.id];
  if (v === undefined || v === null || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/** The answerable items across all sections, in order, that are currently visible. */
export function answerableItems(schema: FormSchema, responses: FormResponses): FormItem[] {
  return schema.sections
    .flatMap((s) => s.items)
    .filter((i) => !PRESENTATIONAL.has(i.type) && isVisible(i, responses));
}

/** answered / total over the currently-visible answerable items. */
export function progress(schema: FormSchema, responses: FormResponses): { answered: number; total: number } {
  const items = answerableItems(schema, responses);
  const answered = items.filter((i) => isAnswered(i, responses)).length;
  return { answered, total: items.length };
}

/** Every required, visible item has an answer → the inspection may be completed. */
export function requiredComplete(schema: FormSchema, responses: FormResponses): boolean {
  return answerableItems(schema, responses)
    .filter((i) => i.required)
    .every((i) => isAnswered(i, responses));
}

/** Pass / Fail / N-A tally over pass_fail + yes_no items (the review summary). */
export function tally(schema: FormSchema, responses: FormResponses): { pass: number; fail: number; na: number } {
  let pass = 0;
  let fail = 0;
  let na = 0;
  for (const item of answerableItems(schema, responses)) {
    if (item.type !== "pass_fail" && item.type !== "yes_no") continue;
    const v = responses[item.id];
    if (v === NOT_APPLICABLE) na += 1;
    else if (v === "pass" || v === "yes") pass += 1;
    else if (v === "fail" || v === "no") fail += 1;
  }
  return { pass, fail, na };
}
