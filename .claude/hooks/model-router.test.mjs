// Run: node --test .claude/hooks/model-router.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./model-router.mjs", import.meta.url));

function route(prompt) {
  const r = spawnSync("node", [script], { input: JSON.stringify({ prompt }), encoding: "utf8", env: { ...process.env, KAENAL_ROUTER_NOLOG: "1" } });
  assert.equal(r.status, 0);
  if (!r.stdout) return null;
  return JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
}

const cases = [
  ["commit and push", /tier=light/, null],
  ["where is the withAudit helper defined", /tier=light/, "codebase-scout"],
  ["plan the architecture for the CAPA module", /tier=plan/, "planner"],
  ["add a capa table migration with RLS", /tier=hard/, "db-migrations"],
  ["implement the webhook retry endpoint in the api controller", /tier=hard/, "api-engineer"],
  ["fix the padding on the settings screen component", /tier=standard/, "react-coder"],
  ["the mobile safe area is clipped on iphone, debug it", /tier=hard/, "mobile-engineer"],
  ["run typecheck and lint", /tier=light/, "ci-gate-runner"],
  ["merge the PR and check the ci job and deploy", /tier=standard/, null],
];

for (const [prompt, tier, agent] of cases) {
  test(prompt, () => {
    const out = route(prompt);
    assert.match(out, tier);
    if (agent) assert.match(out, new RegExp(`\`${agent}\``));
    else assert.doesNotMatch(out, /ci-gate-runner/);
  });
}

test("stays silent for slash commands, notifications, and bad input", () => {
  assert.equal(route("/model"), null);
  assert.equal(route("[SYSTEM NOTIFICATION] task-notification"), null);
  assert.equal(spawnSync("node", [script], { input: "garbage", encoding: "utf8" }).status, 0);
});
