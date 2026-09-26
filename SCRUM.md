# SCRUM.md — how Kaenal work is run (read at session start)

Every new task, feature or epic is run like a sprint by a small team of permanent agents (`.claude/agents/`). This applies to EVERY session; do not skip it, do not jump straight to code.

## Roles
| Role | Agent | Owns |
|---|---|---|
| Product Owner | `product-owner` | WHAT + DONE: backlog, use cases, acceptance criteria, web/mobile/shared scope, backend needs, dead-end audit, final acceptance |
| UI Lead Designer | `ui-lead-designer` | Audits existing design files; designs anything with no design, in the existing visual language, web + mobile; design sign-off |
| Scrum lead | main Claude session | Runs the ceremonies, spawns agents, enforces gates, merges results, reports |
| Engineers | `db-migrations`, `api-engineer`, `react-coder`, `mobile-engineer`, `test-engineer`, `ts-coder` | Implementation in their area |
| Reviewers | `web-fidelity-reviewer`, `security-reviewer`, `ci-gate-runner`, `progress-scribe` | Fidelity, security, gates, docs |

## Ceremonies (in order; never skip a gate)
1. **Planning** — spawn `product-owner` FIRST. Output: `docs/sprints/SPRINT-<NN>-<slug>.md`.
2. **Design audit** — spawn `ui-lead-designer` with the sprint file. Output: `docs/design/DESIGN-<NN>-<slug>.md` (+ Claude Design canvas for missing designs).
3. **GATE 1 — Ready**: PO use-case sign-off = `APPROVED` AND designer sign-off = `APPROVED`. If either lists gaps, fix the sprint/design and re-ask. The user approves any new visual design before implementation. No code before this gate.
4. **Build** — order per CLAUDE.md: database -> API -> UI, web and mobile both considered. Common changes (types, core, endpoints, migrations) are built ONCE in shared packages and consumed by both surfaces; never degrade the web API to serve mobile or vice-versa. Independent stories can run in parallel worktrees (agents commit on feature branches, never push).
5. **Review** — `web-fidelity-reviewer` (pixel fidelity), `security-reviewer` (tenant/auth), `ci-gate-runner` (typecheck, lint, test, test:rls, db:check). Re-seed the demo login after tests (CLAUDE.md rule 12).
6. **GATE 2 — Done**: `product-owner` verifies each acceptance criterion against code/tests/browser evidence and marks `ACCEPTED`; designer confirms the built screens match designs. No dead buttons, no placeholder pages, no "coming soon".
7. **Close** — `progress-scribe` updates PROGRESS.md (+ progress_mobile.md / tasks_mobile.md when mobile is touched) in the same commit. One branch + PR per feature; push only with the user's go-ahead.

## Rules
- Web and mobile are independent surfaces: every story states Web / Mobile / Shared. If mobile lacks an endpoint shape, add a mobile-appropriate endpoint; do not reshape the web API.
- A designed control is never stubbed; an undesigned control is designed first. Nothing ships that is not wired to real behaviour.
- Small tasks (a typo, a one-line fix) may skip ceremonies; anything that adds or changes behaviour, UI, schema or API does not.
- Agents' sign-offs are evidence to check, not authority: the user's approval governs designs and pushes.
