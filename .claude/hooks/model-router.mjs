#!/usr/bin/env node
// UserPromptSubmit hook: classify the prompt (no LLM call, ~ms) and inject a short routing
// directive. A hook cannot switch the running session's model; savings come from delegating
// to agents whose frontmatter pins a cheaper model/effort (see .claude/agents/*.md).

import { readFileSync } from "node:fs";

const TIERS = {
  plan: { model: "opus", effort: "high", agent: "planner" },
  hard: { model: "sonnet", effort: "high" },
  standard: { model: "sonnet", effort: "medium" },
  light: { model: "haiku", effort: "low" },
};

// Must mirror `model`/`effort` in each agent's frontmatter; the directive reports these.
const AGENTS = {
  planner: "opus/high",
  "db-migrations": "sonnet/high",
  "api-engineer": "sonnet/medium",
  "mobile-engineer": "sonnet/medium",
  "react-coder": "sonnet/medium",
  "test-engineer": "sonnet/medium",
  "ts-coder": "sonnet/medium",
  "ux-guardian": "sonnet/medium",
  "web-fidelity-reviewer": "sonnet/medium",
  "security-reviewer": "sonnet/high",
  "codebase-scout": "haiku/low",
  "ci-gate-runner": "haiku/low",
  "progress-scribe": "haiku/low",
  proofreader: "haiku/low",
};

// Domain rules: first match wins the specialist agent. Order = most specific first.
const DOMAINS = [
  [/\b(migration|schema|rls|row.level|drizzle|postgres|tenant_id|composite fk|packages\/db)\b/i, "db-migrations"],
  [/\b(mobile|expo|pwa|safe.area|edge.to.edge|m-[a-z-]+\.jsx|apps\/mobile)\b/i, "mobile-engineer"],
  [/\b(security|vulnerab|ssrf|xss|injection|csrf|cross.tenant|permission|rbac|secret leak)\b/i, "security-reviewer"],
  [/\b(pixel|fidelity|design match|match the (design|jsx)|screen matches)\b/i, "web-fidelity-reviewer"],
  [/\b(vitest|playwright|e2e|flaky|test suite|write tests?|add tests?|coverage)\b/i, "test-engineer"],
  [/\b(controller|endpoint|ts-rest|nestjs|contract|service|outbox|webhook|bullmq|job handler|apps\/api)\b/i, "api-engineer"],
  [/\b(component|tsx|react|next\.?js|tailwind|shadcn|screen|page|ui|apps\/web)\b/i, "react-coder"],
  [/\b(typecheck|lint|ci gate|pre-push|ci\b)/i, "ci-gate-runner"],
  [/\b(progress\.md|progress_mobile|decisions log|known issues)\b/i, "progress-scribe"],
  [/\b(proofread|wording|typo|spelling|grammar|copy edit)\b/i, "proofreader"],
  [/\b(where is|which files?|find (the|all)|who calls|references? (to|of)|locate|grep)\b/i, "codebase-scout"],
];

const PLAN_RE = /\b(plan|planning|architect(ure)?|design (the|a|an)|approach|trade-?offs?|strategy|roadmap|adr|brainstorm|how (should|do|would) we|what('s| is) the best way|phase|spec(ify)?|break (it )?down|vertical slice|scope)\b/i;
const HARD_RE = /\b(implement|build|feature|end.to.end|migration|rls|refactor|debug|root cause|failing|regression|race|deadlock|concurren|auth|security|multi.?file|integrate|integration)\b/i;
const EDIT_RE = /\b(fix|add|change|update|make|create|write|remove|delete|move|replace|adjust|tweak|convert|wire|hook up)\b/i;
const LIGHT_RE = /^(commit|push|stage|git |status|run |show |list |open |rename|format|what (is|does|are)|where|why is|explain|read|summari[sz]e|yes|no|ok|thanks|do it|go ahead|continue|proceed)\b/i;

function decide(prompt) {
  const text = prompt.trim();
  const words = text.split(/\s+/).length;
  const domain = DOMAINS.find(([re]) => re.test(text))?.[1];

  let tier;
  if (PLAN_RE.test(text) && !LIGHT_RE.test(text)) tier = "plan";
  else if (words <= 12 && LIGHT_RE.test(text)) tier = "light";
  else if (HARD_RE.test(text) || words > 120) tier = "hard";
  else if (words <= 8 && !EDIT_RE.test(text) && !domain) tier = "light";
  else tier = "standard";

  return { tier, domain, ...TIERS[tier] };
}

function directive({ tier, domain, model, effort, agent }) {
  const target = tier === "plan" ? agent : domain;
  const spec = target ? AGENTS[target] : undefined;
  const lines = [`[model-router] tier=${tier} -> ${model}/${effort}`];
  if (tier === "plan") {
    lines.push(
      "Planning task: delegate the plan to the `planner` agent (opus, read-only). Do not draft the plan yourself; relay its result, then hand implementation steps to the named specialist agents.",
    );
  } else if (tier === "light") {
    lines.push(
      `Light task: answer or act directly with minimal tokens, no extended reasoning${spec?.startsWith("haiku") ? `, or delegate to \`${target}\` (${spec})` : ""}. Do not read files you do not need.`,
    );
  } else {
    lines.push(
      target
        ? `Delegate execution to the \`${target}\` agent (${spec}); keep the main thread for coordination and summary only.`
        : `Work inline at ${effort} effort. Delegate only independent, token-heavy read-only exploration to \`codebase-scout\` (haiku).`,
    );
  }
  lines.push("Keep replies terse; never re-read files already in context.");
  return lines.join("\n");
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return;
  }
  const prompt = typeof input.prompt === "string" ? input.prompt : "";
  // Slash commands, empty input, and harness/agent-generated messages are not user tasks.
  if (!prompt.trim() || prompt.trimStart().startsWith("/")) return;
  if (/task-notification|SYSTEM NOTIFICATION|<agent-message|Subagent hand-back/i.test(prompt)) return;

  const additionalContext = directive(decide(prompt));
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext } }),
  );
}

try {
  main();
} catch {
  // Never block or fail the user's prompt because routing failed.
}
