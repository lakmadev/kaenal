# SCRUM.md — how Kaenal work is run (read at session start)

Every new task, feature or epic is run like a sprint by a small team of permanent agents (`.claude/agents/`). This applies to EVERY session; do not skip it, do not jump straight to code.

## Roles
| Role | Agent | Owns |
|---|---|---|
| Product Owner | `product-owner` | WHAT + DONE: backlog, use cases, acceptance criteria, web/mobile/shared scope, backend needs, dead-end audit, final acceptance |
| UI Lead Designer | `ui-lead-designer` | Audits existing design files; designs anything with no design, in the existing visual language, web + mobile; design sign-off |
| Architect | `planner` | HOW: technical feasibility of the sprint against the sign-off'd scope+design — vertical-slice build plan, exact agent per slice, risk/trade-off call-outs, verification plan. Read-only; kicks gaps back to PO/designer, never invents scope itself |
| Scrum lead | main Claude session | Runs the ceremonies, spawns agents, enforces gates, merges results, reports |
| Engineers | `db-migrations`, `api-engineer`, `react-coder`, `mobile-engineer`, `test-engineer`, `ts-coder` | Implementation in their area |
| Reviewers | `web-fidelity-reviewer`, `security-reviewer`, `ci-gate-runner`, `progress-scribe` | Fidelity, security, gates, docs |

## Ceremonies (in order; never skip a gate)
1. **Planning** — spawn `product-owner` FIRST. Output: `docs/sprints/SPRINT-<NN>-<slug>.md`.
2. **Design audit** — spawn `ui-lead-designer` with the sprint file. Output: `docs/design/DESIGN-<NN>-<slug>.md` (+ Claude Design canvas for missing designs).
3. **GATE 1 — Ready**: PO use-case sign-off = `APPROVED` AND designer sign-off = `APPROVED`. If either lists gaps, fix the sprint/design and re-ask. The user approves any new visual design before implementation. No code before this gate.
4. **Architecture review** — spawn `planner` with the sprint file + design doc for anything non-trivial (new schema, a new cross-cutting pattern, more than a couple of stories, anything touching auth/tenancy/jobs). Skippable only for a small, mechanical sprint (pure UI wiring onto an already-proven pattern). It returns the vertical-slice plan (database -> contract -> service -> tests -> UI) with one agent named per slice, flags any story that is technically unsound or under-specified as written, and names the exact commands that verify each slice done. A flag here sends the sprint/design back to step 1 or 2 — the architect does not silently patch scope, and does not touch code.
5. **Build** — order per CLAUDE.md and the architect's slice plan: database -> API -> UI, web and mobile both considered. Common changes (types, core, endpoints, migrations) are built ONCE in shared packages and consumed by both surfaces; never degrade the web API to serve mobile or vice-versa. Independent stories can run in parallel worktrees (agents commit on feature branches, never push).
6. **Review** — `web-fidelity-reviewer` (pixel fidelity), `security-reviewer` (tenant/auth), `ci-gate-runner` (typecheck, lint, test, test:rls, db:check). Re-seed the demo login after tests (CLAUDE.md rule 12).
7. **GATE 2 — Done**: `product-owner` verifies each acceptance criterion against code/tests/browser evidence and marks `ACCEPTED`; designer confirms the built screens match designs. No dead buttons, no placeholder pages, no "coming soon".
8. **Close** — `progress-scribe` updates PROGRESS.md (+ progress_mobile.md / tasks_mobile.md when mobile is touched) in the same commit, logging any durable process lesson (a real bug class, a workflow fix — see CLAUDE.md/SCRUM.md themselves for precedent) so it survives past this session. One branch + PR per feature; push only with the user's go-ahead.

## Rules
- Web and mobile are independent surfaces: every story states Web / Mobile / Shared. If mobile lacks an endpoint shape, add a mobile-appropriate endpoint; do not reshape the web API.
- A designed control is never stubbed; an undesigned control is designed first. Nothing ships that is not wired to real behaviour.
- Small tasks (a typo, a one-line fix) may skip ceremonies; anything that adds or changes behaviour, UI, schema or API does not.
- Agents' sign-offs are evidence to check, not authority: the user's approval governs designs and pushes.
- **This team optimizes for best-in-class outcomes, not just "meets acceptance criteria."** Each role is held to the recognized professional standard for that discipline (below), and the scrum lead verifies against it, not just against the sprint doc's letter.
- **Continuous improvement is mandatory, not optional.** At Close, the PO and architect each may log ONE forward-looking backlog candidate if the sprint surfaced a real opportunity (a gap, a risk, a better pattern) — filed as a question in the next sprint's "Open questions", never built without its own Gate 1. This is how the bar keeps rising; it is not license to add scope mid-sprint.

## Professional standards per role
These are the concrete, checkable bar each role is held to — not aspiration. The scrum lead rejects a sign-off that doesn't meet its role's bar, the same way a gate rejects a failing test.
- **Product Owner** — Scrum Guide practice: backlog ordered by value, every story meets INVEST (Independent, Negotiable, Valuable, Estimable, Small, Testable), explicit Definition of Ready before Gate 1 and Definition of Done before Gate 2, acceptance criteria are objectively testable (not "looks right").
- **UI Lead Designer** — WCAG 2.1 AA (contrast, focus order, labels, touch-target size), Nielsen's usability heuristics (visibility of status, error prevention/recovery, consistency with the existing `.k-*` system), platform-native conventions for mobile (safe-area, gesture, Material/HIG touch targets) — never a new visual language.
- **Architect** — vertical slices in dependency order, an ADR-style one-line rationale for any non-obvious trade-off, explicit non-functional requirements (tenant isolation, pagination/idempotency/concurrency per CLAUDE.md, query cost on hot paths), a named verification command per slice.
- **Engineers** — CLAUDE.md's non-negotiable rules are the floor, not the ceiling: strict typing, no dead code or unflagged TODOs, tests ship with the code they cover (not after), conventional commit messages, SOLID/clean-code judgement in review-worthy diffs.
- **Reviewers** — `security-reviewer` reasons from OWASP ASVS-style categories (authz, injection, secrets, SSRF) against 07-SECURITY.md; `web-fidelity-reviewer` checks WCAG basics alongside pixel fidelity; `ci-gate-runner` treats a flaky-looking failure as a failure until proven flaky, never waves it through.
