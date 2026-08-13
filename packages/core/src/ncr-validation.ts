import type { NcrRuleField, NcrRuleOperator, NcrRuleAction } from "@kaenal/types";

/**
 * NCR validation-rule evaluation (04 §Settings > Process). Pure business logic
 * (CLAUDE.md rule 5): the service loads the rules + facts from the DB and does
 * the throwing, but WHETHER a rule fires lives here so it is unit-testable
 * without a database. A rule fires when `field <operator> value` holds.
 */

export interface NcrRule {
  readonly field: NcrRuleField;
  readonly operator: NcrRuleOperator;
  readonly value: string;
  readonly action: NcrRuleAction;
  readonly message: string;
  readonly enabled: boolean;
}

/** The subset of an NCR-create payload a rule can test, normalised to strings. */
export interface NcrFacts {
  readonly priority: string;
  readonly source: string;
  readonly title: string;
  readonly description: string | null;
  readonly plant: string | null;
  readonly area: string | null;
}

function factFor(field: NcrRuleField, facts: NcrFacts): string | null {
  switch (field) {
    case "priority":
      return facts.priority;
    case "source":
      return facts.source;
    case "title":
      return facts.title;
    case "description":
      return facts.description;
    case "plant":
      return facts.plant;
    case "area":
      return facts.area;
  }
}

const isEmpty = (v: string | null): boolean => v === null || v.trim() === "";

/** True when the rule's condition holds for these facts. */
export function ruleFires(rule: NcrRule, facts: NcrFacts): boolean {
  const actual = factFor(rule.field, facts);
  switch (rule.operator) {
    case "is_empty":
      return isEmpty(actual);
    case "is_not_empty":
      return !isEmpty(actual);
    case "equals":
      return actual !== null && actual === rule.value.trim();
    case "in":
      return (
        actual !== null &&
        rule.value
          .split(",")
          .map((v) => v.trim())
          .filter((v) => v.length > 0)
          .includes(actual)
      );
  }
}

/**
 * The enabled `block` rules that fire for these facts — NCR creation must be
 * rejected if this is non-empty. `warn`/`escalate` rules are intentionally not
 * returned (they do not block; their runtime effect is a later slice).
 */
export function firingBlockRules(rules: readonly NcrRule[], facts: NcrFacts): NcrRule[] {
  return rules.filter((r) => r.enabled && r.action === "block" && ruleFires(r, facts));
}
