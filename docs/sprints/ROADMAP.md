# ROADMAP — "Build everything missing" programme

Author: Product Owner. Date: 2026-09-26. Source of truth for ordering; each sprint gets its own `SPRINT-NN-*.md`.

**Revision 2026-09-30 (Q10):** a new Sprint 07 "Plans & entitlements + industry-aware onboarding" was pulled ahead
of the former Sprint 07; every later sprint moved down one number (old 07-13 are now 08-14). The old Sprint 10's
entitlements scope and the old Sprint 11's onboarding-wizard item now live in Sprint 07. Sprint files 01-06 keep
their numbers.

**Revision 2026-09-30 (Q11, same day):** the user answered Sprint 07's open decisions (D1 confirmed; D2 redesigned as
framework-conditional inclusions; price book staff-editable; industry/framework lists extensible; **staff web
console built now**). The PO split Sprint 07 into two sprint files of the **same release**:
`SPRINT-07-entitlements-onboarding.md` (Increments A + B, amended) and `SPRINT-07C-staff-console.md` (Increment C).
No later sprint is renumbered; Sprint 08's migration range moves to start at 0082.

**Status of detail:** Sprints 01-07 have full sprint files (`SPRINT-07-entitlements-onboarding.md` and
`SPRINT-07C-staff-console.md` for Sprint 07). Sprints 08-14 below are OUTLINES ONLY. Before any of them starts, the Product Owner must write its `SPRINT-NN-*.md` with use cases (happy/error/empty/permission/offline), testable acceptance criteria, Web/Mobile/Shared split, backend needs, dead-end audit and DoD, and the Scrum lead must run design audit + Gate 1 (SCRUM.md). No code before Gate 1.

## 0. Decisions (user, 2026-09-26)

| # | Decision | Effect on the roadmap |
|---|---|---|
| Q1 | CreateWizard replaces the create dialogs everywhere; CAPA keeps its dialog | S01 S1-1 |
| Q2 | PROPOSED backend designs (P12, P15-P19, P21, P24 incl. predictive scoring) are NOT blanket-approved. Each wave's designs go to the user for approval when that wave starts. Sprint 01 needs none | Sprints 03, 04, 05, 06, 07, 11 each open with an "Approval gate": the PO includes the wave's backend design in its sprint file and NO build starts until the user approves it |
| Q3 | pqe Quality Engine EXCLUDED until a spec exists | S01 S1-11 removes nav/placeholder, adds to `excluded.md`; dropped from Sprint 10 (now Sprint 11) |
| Q4 | i18n English-only now (de/es deferred); mobile does not adopt i18n | S01 S1-7 |
| Q5 | External-infra features (SSO/SCIM vendor, BYOK, status page, backup/restore, warehouse sync) deferred to the LAST waves; build only vendor-free parts; never a dead nav entry: hidden or listed in `excluded.md` | Moved to the last sprint (now Sprint 14 after Q10); entries hidden in settings rail by S1-11 |
| Q6 | Billing = entitlements only, no payment provider | Was Sprint 10; **moved to Sprint 07 by Q10** |
| Q7 | AI drawer "Generate PDF" uses existing exports | S01 S1-4 |
| Q8 | Tweaks panel and AI prominence are REAL persisted preferences; one vocabulary `front|normal|quiet` (shell.jsx / 04 §3), the `quiet|visible` of ai.jsx retired | S01 S1-9, S1-4 |
| Q9 | Voice quick-log transcription backend EXCLUDED; remove/hide the mobile control | S01 S1-11 (only mobile change in S01) |
| Q11 | **Sprint 07 decisions (user, 2026-09-30).** (1) D1 confirmed: per-tenant `self_service` flag, new tenants default to request mode. (2) D2: both proposed options rejected — "Design the pack depending on the industry and not as a single source. Because one guy needs 4 modules but others need 8 modules." What is free in Core now varies by the tenant's **declared compliance frameworks** (e.g. IATF 16949 includes FMEA/SPC/MSA/PPAP), held as admin-editable data. (3) Price book stays placeholder but is staff-editable data, not a config file. (4) The 8 industries / 9 frameworks are approved and must be extensible without a migration. (5) Build the real **staff web console** now, not the audited-CLI interim | Sprint 07 amended (Amendment 1: catalog + versioned price book as control-plane data, framework-aware resolver, tenant-aware `/pricing`, `tenant-plan` CLI removed). New **Sprint 07C — Staff console** (same release; staff identity, staff sessions, support grants per 07 §7, least-privilege support DB role, `apps/staff`). Sprint 08 cannot open until 07C closes |
| Q10 | **Reprioritisation (user, 2026-09-30): monetisation and enterprise-onboarding readiness before further module depth.** Asked "could this product make money in the current market with existing features?", the honest answer was that Sprints 01-06 already give competitive module coverage (inspections, NCR, 8D, CAPA, audits, documents, suppliers/PPAP/SCAR, FMEA, SPC, MSA, risk, calibration, training, complaints, ECN, graph, predictive), but nothing exists to *charge* a customer (no plan or gate), *onboard* one well, or make the product feel built for the buyer's industry. The user judged that closing those gaps is worth more now than the next vertical sprint. Two scope decisions were made with it and are not re-litigated: (1) billing stays **entitlements-only, no payment provider** (Q6, unchanged, pulled forward); (2) industry is **soft tagging** — it suggests, pre-selects and highlights modules during onboarding but never hides or locks anything; every module stays selectable | New **Sprint 07 — Plans & entitlements + industry-aware onboarding** inserted before the former Sprint 07; former 07-13 renumbered 08-14. The old Sprint 10 keeps AI Governance + PDF templates (+ pricing-page polish only if Sprint 07 leaves any) as Sprint 11, and **loses the core entitlements build**. The old Sprint 11 (Adoption) keeps tours, knowledge base, NPS, adoption analytics and release notes as Sprint 12, and **loses the onboarding wizard**, which Sprint 07 builds. Sprint 07 carries a Q2 approval gate (its §3, decisions D1-D5) |

## 1. Scope decisions and basis

Canonical spec: `project_brain/project/implementation/` (README phases, 00-FRONTEND-FIDELITY, 04, 05, 07, 09, `phases/P01..P25`), `reference/FEATURES.md`, `apps/web/src/config/excluded.md`. Design truth: `project_brain/project/src/*.jsx`, `project_brain/mobile/src/m-*.jsx`.

- IN scope: has a jsx AND appears in FEATURES.md / a phase file / 04 / 07 / 09.
- IN scope but SPEC-UNAPPROVED: backend marked `PROPOSED ... needs sign-off` (P12, P15-P19, P21, P24). Per Q2 each wave brings its design to the user at wave start; nothing is blanket-approved.
- EXCLUDED: `excluded.md` items (Quick-Log `/quicklog`, Mobile App `/mobile` web pages) — mobile lives in `apps/mobile`.
- DEFERRED-by-spec: none outright; en-only i18n (de/es catalogs) is deferred by 04 §8.
- EXCLUDED by decision Q3: `pqe` Quality Engine (no spec) and mobile voice quick-log transcription (Q9).

## 2. Verified corrections to the gap inventory

| Inventory claim | Verified |
|---|---|
| `spc` planned-module placeholder | STALE: `/spc` + `features/spc` + `apps/api/src/spc` + migration 0034 exist. Remove stale entry (S1-8). |
| Command palette missing | Exists over `/v1/search`; gaps: Quick-actions group, shortcuts, audit hits (S1-2, Sprint 02). |
| Dashboard widget grid missing | STALE: built (`features/dashboard/dashboard-view.tsx`: edit mode, presets, drag/drop, catalog). |
| Mobile MFA enrolment (QR / recovery codes) missing | STALE: `apps/mobile/src/app/settings/two-factor.tsx` implements enrol (QR + secret + verify), disable, regenerate recovery codes over real `/v1/auth/mfa/*` (M16). Only re-verify in Sprint 13 (was 12). |
| Mobile offline/sync status | Built (M3, M11 `sync-queue.tsx`, M12 tablet rail). M17 (permissions/capture) is still `[~]` in `progress_mobile.md`; M19.5 NCR fidelity `[~]`. |
| Audits backend done | Confirmed: `apps/api/src/audits` (list, create, detail, advance, findings, raise-NCR, raise-CAPA) + contract lines 553-614. |
| Graph backend | Partial: `entity_links` + `/v1/entity-links` exist; NO bounded graph-query endpoint (P20 says needed). |
| Predictive backend | None: P21 `risk_predictions` is PROPOSED; no controller. |
| Tier-2 modules backends | None in `apps/api/src` (no risk/msa/calibration/training/complaints/ecn dirs). |
| Settings unbuilt list | Confirmed from `settings-nav.ts`. Built: profile, notifications, security, preferences, members, sessions, legal-hold, dlp, white-label, cross-tenant, cost-centers, validation, integrations, bulk-import, audit. |
| Entitlements/billing backend | None (`/v1/entitlements` absent). Re-verified 2026-09-30 for Sprint 07: the `entitlements` table (0001), `entitlement_changed` audit action, 402 `ENTITLEMENT_REQUIRED` and the AI gateway's `intelligence` check exist; no route, trial, request or operator surface exists. |

## 3. Ordered waves

| Sprint | Wave | Theme | Backend readiness |
|---|---|---|---|
| 01 | 1 | Shell foundations: New menu + CreateWizard, palette parity + shortcuts, live mode, AI drawer, offline/409, Radix, i18n scaffold, placeholder ledger | mostly ready; AI chat endpoint new |
| 02 | 2 | Audits module (web list / my audits / schedule / detail / findings / raise NCR-CAPA); audit kind in search, notifications, entity routes | ready |
| 03 | 3 | Knowledge Graph explorer + Predictive Analytics | graph: 1 new query endpoint; predictive: new tables + scoring |
| 04 | 4 | Risk register + MSA / Gauge R&R | new (P12, P15) |
| 05 | 5 | Calibration + Training & competency | new (P16, P17) |
| 06 | 6 | Customer complaints + ECN | new (P18, P19; link into NCR/8D/CAPA/documents) |
| 07 | 7 | **Plans & entitlements + industry-aware onboarding (Q10, amended by Q11):** control-plane catalog (packs, pack→module map, tiers, framework rules, extensible industry/framework lookups) + versioned price book as data, framework-aware resolver (declared frameworks include their required modules free), `GET /v1/entitlements`, locked-route overlay + sidebar locks + module-level server write gate, tenant-aware `/pricing`, real trials, plan requests / sales hand-off, quote PDF, `provision-tenant --bundle/--from-request`, Billing & plan (plan-only, Q6); Request-a-workspace intake, workspace profile (industry/frameworks/size), module-suggestion engine in `packages/core`, first-run setup flow (new design), onboarding checklist | `entitlements` table + AI gate exist; rest new (0073-0077) |
| 07C | 7 | **Staff console (Q11), same release as 07:** staff identity (outside tenant memberships) + mandatory TOTP, staff sessions via a non-tenant branch of the one lifecycle interceptor, staff RBAC (support/sales/admin), 4 h support grants with reason (07 §7), least-privilege `kaenal_support` DB role (01 §3.2), platform audit log, `apps/staff` (tenant directory/detail, plan administration, sales inbox, workspace-request triage, catalog and price-book editors) | nothing exists; all new (0078-0081); needs security review |
| 08 | 8 | Settings: Workspace + Process (organization, roles, sites, categories, SLA, email / inspection / 8D templates) — was 07 | partly new tables, settings substrate ready |
| 09 | 9 | Settings: Security & Identity + Compliance, vendor-free parts (trust center, network policy, service accounts, delegated admin, DSAR) — was 08 | new; 07 spec exists |
| 10 | 10 | Settings: Developer + Multi-tenancy (dev-platform, API & webhooks, org hierarchy, lifecycle clone/migrate/export) — was 09 | webhook delivery/config already built |
| 11 | 11 | AI Governance, PDF Templates designer (+ 8D PDF) — was 10; **entitlements removed (built in 07)**; only pricing-page polish that Sprint 07 explicitly leaves open | AI gateway ready; rest new |
| 12 | 12 | Adoption: tours, knowledge base, NPS, adoption analytics, release notes — was 11; **onboarding wizard removed (built in 07)** | new |
| 13 | 13 | Mobile parity sweep: finish M17 / M19.5, full audit of `apps/mobile` vs every `m-*.jsx`, any mobile endpoints owed by earlier waves (SSO redirect screen only if Sprint 14 ships SSO) — was 12 | after 09 |
| 14 | 14 | External-infra settings, last: SSO, SCIM, BYOK, status page, backup/restore, warehouse sync — vendor-free parts only, each entry hidden until real — was 13 | needs vendor/infra decisions at wave start |

Why this order: shared foundations first so later screens inherit banner/409/i18n/create-wizard; then modules by backend readiness (audits = free win); then (Q10) the commercial layer — plans, gates and onboarding — once module coverage is strong enough to sell, and before any further screen is added that would need a "locked" state; settings grouped by domain with identity after workspace roles/sites exist (SSO/SCIM map to roles + sites); mobile parity last because it consumes the settled shared types and the SSO flow.

## 4. Dependencies and parallelism

Hard dependencies
- 02 needs 01 (S1-1 wizard for "raise finding NCR" continuity; S1-5 handler) — soft; 02 needs the S1-2 `entityHref` pattern.
- 03 graph needs 02 (audit nodes route) and the 04-06 modules for their nodes later (graph must be extensible; add each new kind to `entity-routes.ts` as modules land).
- 06 complaints needs NCR/8D (exist). ECN "auto-revises documents" needs documents (exist).
- 07 (entitlements) must land before any later sprint adds a module or screen that belongs to a pack: from Sprint 08 on, every new module adds its `ModuleId` (code) and, in its own migration, its `control.catalog_pack_modules` row (and any `framework_module_rules` rows) — the catalog is **data** since Q11, not `catalog.ts` — and inherits the lock/overlay/`@RequireModule` 402 gate.
- 07C (staff console) needs 07's Increment A merged (it edits A's catalog, price book, plans and requests). **Sprint 07 (A+B+C) releases as one**; request-mode tenants' requests can only be fulfilled once 07C is live. **Sprint 08 cannot open until 07C closes.** 07C changes the lifecycle interceptor, so it carries a mandatory security review and a tenant sign-in re-proof (rule 12). 07's workspace profile (industry/frameworks) is the store Sprint 08's Organization section reads and edits (no second store). 07's onboarding checklist gains an "Add plants & areas" task when Sprint 08 ships Sites.
- 08 `roles` needs the RBAC matrix (`rbac.ts`, 03 §RBAC) and `sites` needs plants (exist). 14 SSO/SCIM depend on 08 roles + sites; 09 network policy depends on session policies (built).
- 10 `api` section depends on merging branch `feat/webhook-config-form` (do not re-plan it). It may be pulled forward as a one-story mini-sprint the moment that branch merges.
- 11 PDF templates feeds 8D PDF and audit/inspection reports.
- 12 Adoption builds on 07's onboarding checklist (tours and knowledge-base articles later replace its in-product "Helpful right now" links).
- 13 SSO mobile screen depends on 14 shipping SSO.

Parallel worktrees (each on its own feature branch, agents never push)
- Safe together: {02} || {04 backend} || {08 backend tables}; later {04, 05, 06} are mutually independent (disjoint modules) but share files, see below; inside 07 the two increments (A entitlements, B onboarding) can run in parallel worktrees once P0 + P1 (+ O1's types/storage) have merged; 07C starts once 07 A's migrations and services have merged and may then run in parallel with 07 B; {09} || {10} || {12}.
- Inside a sprint the Scrum lead splits DB -> API -> UI per CLAUDE.md, but UI for two modules may proceed in parallel worktrees once their APIs are merged.

Merge-conflict hot spots (serialize or pre-allocate)
- `packages/db/migrations/*` numbering (next free is 0042 after `0041_outbox`): pre-assign ranges per sprint at Sprint kickoff to avoid renumber collisions. Actual use so far: Sprints 01-06 ended at `0072_ecn.sql`; **Sprint 07 owns 0073-0077** (0077 buffer); **Sprint 07C owns 0078-0081** (0081 buffer); Sprint 08 starts at **0082**.
- `packages/types/src/contract.ts`, `index.ts`, `apps/web/src/config/navigation.ts`, `planned-modules.ts`, `settings-nav.ts`, `entity-routes.ts`, command-palette nav list: one owner per merge; rebase before PR.
- The two existing unpushed branches (`feat/partner-invite-mfa`, `feat/webhook-config-form`) touch portal/settings/integrations; keep new work off `sections/integrations.tsx` until they merge.

## 5. Sprint outlines (2-14)

Outlines 02-06 are historical (those sprints are done; their sprint files are the record). Sprint 07's full files are `SPRINT-07-entitlements-onboarding.md` and `SPRINT-07C-staff-console.md`; the outlines below are summaries.

Each outline lists the items and what must be proven before writing the full sprint file.

**02 Audits.** Design `audits.jsx` (657 lines: all views/panels/states). Web: replace `/audits` placeholder; views list / `?view=mine` / `?view=schedule` per `navigation.ts` children; detail (scope, lead + team, auditees, phase/progress, dates, findings breakdown major/minor/opportunity, checklist, linked CAPAs, next activity), create audit, advance phase, add finding, raise NCR/CAPA from finding, History tab from audit events. Prove at kickoff: whether checklist, team/auditee, schedule/frequency exist in the schema (`packages/db` audits tables) — the P04 status says FE partial, backend done; gaps go into the sprint as backend work. Mobile: none designed (mobile "Audit" tab is the oversight audit trail, `apps/mobile/src/app/(app)/audit.tsx`); stays unaffected. Shared: `audit` kind in `entityHref`, search KINDS, notification click-through, graph seeds.

**03 Graph + Predictive.** APPROVAL GATE (Q2): the sprint file carries the predictive scoring method + `risk_predictions` design; user approves before build. Designs `graph-explorer.jsx` (616), `predictive.jsx` (326). Graph: bounded query endpoint over `entity_links` (open-doc / open-CAPA filters, seeds, clustering "+N more", depth/size caps, RLS + plant scope, cursor/limit); layout pure logic in `packages/core`. Predictive: `risk_predictions` (0030 proposal) + scoring job (BullMQ) — algorithm needs user sign-off (Q2); also feeds existing PPAP/SCAR prediction stubs (grep and wire — those are "prediction stubs" in PROGRESS). Mobile: none designed.

**04 Risk register + MSA.** APPROVAL GATE (Q2): P12/P15 backend designs to the user first. Designs `qms-risk-spc.jsx` `RiskRegister` (5x5 matrix, trend, treatment) and `MSAStudy` (3x10x3 GR&R, variance components, ndc; AIAG calc in `packages/core`, unit-tested vs AIAG reference example). Backend P12, P15 (`PROPOSED`). Mobile: none designed.

**05 Calibration + Training.** APPROVAL GATE (Q2): P16/P17 designs to the user first. Designs `qms-modules.jsx` `CalibrationManagement`, `TrainingMatrix`. Backend P16, P17; expiry/due-soon jobs -> notifications (existing notification substrate); certificate attachments via files pipeline. Mobile: none designed (inspector may want cal status in inspection runner — only if a jsx shows it; otherwise not added).

**06 Complaints + ECN.** APPROVAL GATE (Q2): P18/P19 designs to the user first. Designs `qms-modules.jsx` `CustomerComplaints` (+ `IntakeForm`), `ECNWorkbench`/`ECNList`/`ECNKanban`. Backend P18, P19: complaint -> NCR/8D/CAPA conversion, ECN multi-stage approval reusing the documents approval engine, "auto-revises affected documents". Portal intake channel (supplier portal) only if the jsx shows it. Mobile: none designed.

**07 Plans & entitlements + industry-aware onboarding (Q10; amended by Q11).** APPROVAL GATE (Q2): §3 decisions D1-D5. **Decided 2026-09-30:** D1 (per-tenant self-service flag, request mode default), D2 (framework-conditional inclusions as data — what is free in Core depends on the tenant's declared compliance frameworks), D5 (staff console now → 07C), price book (placeholder, staff-editable, versioned), industry/framework lists (approved, extensible lookups). **Still open:** D3 (gates block writes, never reading/exporting the tenant's own records), D4 (real 14-day trials), the framework-inclusion seed (Q-C11), false-declaration remedy (Q-C12), framework-aware pack pricing (Q-C13), size question, existing-tenant prompting. Designs `pricing.jsx`, `addons.jsx` (binding: tiers, pack cards, UpgradeOverlay, sidebar locks — plus new tenant-aware inclusion states), `adoption.jsx` `OnboardingWizard` (binding checklist), `auth.jsx` stage `request` (binding intake, now catalog-driven), `settings.jsx` `Billing` (plan-only); the first-run questionnaire has NO jsx and is designed by the UI Lead Designer. Stories P0 (control-plane catalog + versioned price book, seeded), P1-P9 (framework-aware resolver, `GET /v1/entitlements`, overlay/locks/create-surface locks, `@RequireModule` 402 write gate + AI gateway alignment, tenant-aware `/pricing`, trials, plan requests + sales hand-off, quote PDF, `provision-tenant --bundle/--from-request`, Billing & plan) and O1-O5 (workspace profile with catalog-validated keys and admin-only frameworks, catalog-driven suggestion engine with the essential ⇔ included property, Request-a-workspace intake, first-run flow, self-completing checklist) + X1 (incl. a `globex` request-mode demo workspace). No payment provider, invoices or tax (Q6). Mobile: no designs; small X1 items only (notification kinds, audit categorisation, AI 402 re-verify).

**07C Staff console (Q11; same release as 07).** APPROVAL GATE (Q2) + mandatory security review: §3 SD1-SD8 (separate `apps/staff` on its own host with one API process and a separate staff contract; staff identity outside `control.users`; mandatory TOTP; idle 30 min / absolute 8 h host-only staff sessions; a `@Staff` branch of the one lifecycle interceptor with no tenant scope; 4 h support grants with reason written to the tenant's audit log (07 §7); least-privilege `kaenal_staff` and `kaenal_support` DB roles, RLS never bypassed (01 §3.2); two audit trails with a fixed ordering rule). No jsx exists for any staff screen — the UI Lead Designer designs D-C1…D-C10. Stories C1 (staff identity + `staff-user` bootstrap CLI), C2 (staff auth/sessions/lifecycle branch), C3 (staff RBAC, support grants, support DB role, platform audit), C4 (`apps/staff` shell, tenant directory, tenant detail), C5 (tenant plan administration incl. Enterprise and self-service flag), C6 (cross-tenant sales inbox + workspace-request triage), C7 (catalog editor with impact preview), C8 (price-book draft/publish), C9 (platform audit log), CX (isolation, deployment headers, seeds, docs). Out of scope: impersonation, reading tenant QMS content, provisioning from the console. Mobile: unaffected.

**08 Settings Workspace + Process (was 07).** Designs `settings.jsx`, `settings-extra.jsx`, `rbac.jsx`, `template-editor.jsx`, `eightd-templates.jsx`. Items: organization, roles & permissions (edit capability matrix; MUST NOT weaken the RBAC default-deny — design decision + security-reviewer), sites & areas (plants/areas exist: CRUD UI), categories, SLA configuration (feeds existing SLA/escalation jobs — prove the job reads config), email templates (12), inspection templates (web `templates-view.tsx` already exists — reconcile to avoid two UIs), 8D templates. Mobile: sites/categories consumed by mobile pickers — verify no mobile change needed; roles changes must not break `apps/mobile/src/config/rbac.ts`. The Organization section's Industry + Compliance-frameworks rows read and write Sprint 07's workspace profile (no second store); its "Plan & usage" card shows limits only if the user decides limits exist (Sprint 07 Q-C7). When Sites ships, add the "Add plants & areas" task to Sprint 07's onboarding checklist catalog.

**09 Security & Identity + Compliance (was 08).** Designs `trust-center.jsx` (+ `trust-components.jsx`), `identity-advanced.jsx`, `compliance-extra.jsx`, `mfa-settings.jsx` where relevant. Items (vendor-free only, Q5): Trust Center, network policy (IP allowlists, geo-fence, VPN — enforcement in the request lifecycle interceptor; sign-in proof required, rule 12), service accounts (API keys; `api_key` actor kind already in audit), delegated admin, DSAR (07: `POST /v1/dsar`). SSO, SCIM, BYOK moved to Sprint 14. Mobile: none. All changes to `apps/api/src/auth/**` need end-to-end sign-in proof.

**10 Developer + Operations + Multi-tenancy (was 09).** Designs `dev-platform.jsx` (835), `operations.jsx` (612), `multi-tenancy.jsx` (630). Items: dev-platform hub (API reference/keys/sandbox per design), `api` = API & webhooks (mount the finished webhook config form + delivery log; endpoints + events + secret), org hierarchy, lifecycle clone/migrate/export (uses tenant registry/pool-manager; destructive-safe design), remove the "coming soon" branch from `settings-shell` when done. Sidebar `developer` and `multi-tenancy` routes resolve here, and inherit the `platform` / `multiplant` pack gates from Sprint 07's catalog.

**11 AI Governance + PDF Templates (was 10; entitlements moved to 07 by Q10).** Designs `ai-governance.jsx` (6 tabs: data controls, models & routing, PII redaction, AI audit trail, cost & budgets, evals & red-team), `pdf-designer.jsx` + `eightd-pdf.jsx` (P24). Backend: governance settings tables over existing gateway/ai_invocations; PDF template store + renderer (APPROVAL GATE Q2 for P24). **Retired from this sprint:** `pricing.jsx` + `addons.jsx`, `GET /v1/entitlements`, add-on toggles, locked-route upsell, the sidebar add-on lock icon (D-06 from DESIGN-01) and the plan-only `billing` settings section — all built in Sprint 07. What remains here is only pricing-page polish Sprint 07 explicitly leaves open (e.g. a user-approved price-book change, Sprint 07 Q-C9), and wiring the AI Governance route into the `intelligence` pack gate that Sprint 07's catalog already maps. pqe is excluded (Q3).

**12 Adoption (was 11).** Designs `adoption.jsx` (720). Items: product tours, knowledge base, NPS & satisfaction, adoption analytics, release notes. The onboarding wizard (`OnboardingWizard`) is **retired from this sprint** — built in Sprint 07; this sprint only replaces its in-product "Helpful right now" links with real articles/tours once they exist. Backend: new tables; analytics from existing audit events/usage. Mobile: none designed.

**13 Mobile parity (was 12).** Audit `apps/mobile` screen by screen vs `m-auth.jsx`, `m-auth-extra.jsx`, `m-home.jsx`, `m-capture.jsx`, `m-inspections.jsx`, `m-ncr.jsx`, `m-work.jsx`, `m-oversight.jsx`, `m-system.jsx`, `m-settings-detail.jsx`, `m-tablet.jsx`. Known open: M17 remaining sub-items, M19.5 NCR pixel-for-pixel + backend, `AuthSSORedirect` (only if Sprint 14 ships SSO; otherwise hidden), voice quick-log EXCLUDED (Q9; control removed in Sprint 01), tenant-wide sync-failure telemetry tile (M5 backend gap), `AuthBiometricFail`/`SignOutGuard` verification, tablet split-views. Endpoints owed by earlier waves for mobile get added here as mobile-appropriate routes, never by reshaping web routes.

**14 External-infra settings (last; was 13).** SSO/SAML+OIDC, SCIM, BYOK, status page, backup & restore, warehouse sync. At wave start the user decides vendors/targets (Q5 remainder: WorkOS vs native, KMS target, warehouse); for each, build only the vendor-free real part or keep it excluded; entries stay hidden (excluded.md) until real. Sprint file must prove the real backend before any UI.

## 6. Open questions remaining (user-owned)

- U1 Approve DESIGN-01 visuals (new offline banner, 409 dialog, shortcuts dialog, palette/live/AI/wizard states, phone width) and its 7 deviations D-P1, D-W1, D-T1, D-T2, D-F1, D-R1, D-S1; the designer must also draw the Tweaks panel board (S1-9).
- U2 Keep the "View as role" demo switcher omitted (D-05)?
- U3 AI chat allowed for viewers (read-only) — confirm (S1-4 4c).
- U4 Sprint 14 vendor choices, at wave start (SSO/SCIM vendor, KMS target, warehouse).
- U5 Wave-start design approvals for Q2 (Sprints 03, 04, 05, 06, 07, 11).
- U6 Sprint 07 strategic questions — **partly answered 2026-09-30 (Q11)**. Still open (its §7 [USER] items): approve D3 and D4, the framework-inclusion seed (Q-C11), false-declaration remedy (Q-C12), framework-aware pack pricing (Q-C13), keep the size question (Q-S2b), prompting existing tenants (Q-S3), ongoing nav emphasis (Q-S6); confirm that the D2 redesign matches the user's intent.
- U7 Sprint 07C: approve SD1-SD8 and answer its §7 [USER] items (staff management in console vs CLI, tenant-content support access / impersonation, provisioning from the console, WebAuthn, trial reset, audit CSV export; production network restriction is an ops decision).
- Answered: Q1, Q3, Q4, Q6, Q7, Q8, Q9 (section 0).

## 7. Item -> story / disposition table

Legend (sprint numbers after the Q10 renumbering): S = sprint; IN = in scope; UNAPPROVED = in scope, backend design awaiting Q2; EXC = excluded; N/A = inventory item stale.

### Web placeholders
| Item | Disposition |
|---|---|
| `/audits` | IN, S02 |
| `/predictive` | IN, S03 (UNAPPROVED backend, Q2) |
| `/graph` | IN, S03 |

### Planned modules (`planned-modules.ts`)
| Item | Disposition |
|---|---|
| pqe | EXCLUDED (Q3), S01 S1-11 removes nav/placeholder, listed in excluded.md |
| training | IN, S05 (UNAPPROVED) |
| calibration | IN, S05 (UNAPPROVED) |
| complaints | IN, S06 (UNAPPROVED) |
| ecn | IN, S06 (UNAPPROVED) |
| risk | IN, S04 (UNAPPROVED) |
| spc | N/A: already built; stale entry removed in S01 (S1-8) |
| msa | IN, S04 (UNAPPROVED) |
| ai-governance | IN, S11 (also settings `ai-governance`); gated by `intelligence` pack (S07 catalog) |
| developer | IN, S10 (dev-platform) |
| multi-tenancy | IN, S10 (org-hierarchy, lifecycle; white-label/cross-tenant/cost-centers already built) |
| pricing | IN, **S07** (entitlements only, Q6; moved by Q10; tenant-aware per Q11) |
| pdf-templates | IN, S11 (P24, UNAPPROVED); settings `pdf-templates` same story |

### Settings sections (unbuilt)
| Item | Disposition |
|---|---|
| organization, roles, sites | IN, S08 (organization's Industry/Frameworks use S07's workspace profile) |
| trust, network, service-accounts, delegated | IN, S09 |
| sso, scim | DEFERRED to S14 (Q5); hidden from rail by S1-11 |
| dsar | IN, S09 |
| byok | DEFERRED to S14 (Q5); hidden by S1-11 |
| org-hierarchy, lifecycle | IN, S10 |
| ai-governance | IN, S11 |
| sla, categories, email-templates, insp-templates, 8d-templates | IN, S08 |
| pdf-templates | IN, S11 |
| dev-platform, api (API & webhooks, reuse `feat/webhook-config-form`) | IN, S10 (api can be pulled forward after that branch merges) |
| status-page, backup-restore, warehouse | DEFERRED to S14 (Q5); hidden by S1-11 until real |
| onboarding | IN, **S07** (moved by Q10) |
| tours, knowledge, nps, adoption, release-notes | IN, S12 |
| billing | IN, **S07**, plan-only (Q6; moved by Q10); Payment method + Invoices hidden, listed in `excluded.md` |

### Cross-cutting
| Item | Disposition |
|---|---|
| Command palette | N/A mostly built; parity gaps IN S01 (S1-2); audit hits S02 |
| Top-bar quick-create | IN, S01 (S1-1) |
| Top-bar live-mode | IN, S01 (S1-3) |
| Top-bar AI button + drawer | IN, S01 (S1-4); prominence/Tweaks S1-9 |
| i18n | IN (en only, web), S01 (S1-7); de/es DEFERRED; mobile does not adopt (Q4) |
| Radix menus | IN, S01 (S1-6) |
| Offline banner + 409 reconcile | IN, S01 (S1-5) |
| Dashboard widget grid | N/A: already built |

### Mobile
| Item | Disposition |
|---|---|
| Enrolment screen (QR / recovery codes) | N/A: built in `settings/two-factor.tsx`; re-verify S13 |
| Phase 3 field-inspector / offline sync status | Built (M3-M13); open sub-items M17, M19.5 -> S13 |
| Mobile parity audit vs `m-*.jsx` | IN, S13 |
| SSO redirect screen | Only if S14 ships SSO; otherwise hidden |
| Voice quick-log | EXCLUDED (Q9); control removed in S01 S1-11 |
| Mobile counterparts for S02-S12 modules | None designed in `m-*.jsx`; web-only per design. Mobile stays fully working; `manage-web.tsx` exists for oversight hand-off |

### Operator plane (no design, decided by the user, Q11)
| Item | Disposition |
|---|---|
| Staff console (tenants, plans, requests, catalog, price book, industry/framework catalogs) | IN, **S07C** (same release as S07) |
| `pnpm tenant-plan` operator CLI | RETIRED by Q11 (replaced by S07C); provisioning stays `provision-tenant` |

### Existing branches
| Item | Disposition |
|---|---|
| `feat/partner-invite-mfa` (incl. portal contacts tab) | DONE, not re-planned; merge is the user's call |
| `feat/webhook-config-form` | DONE, not re-planned; surfaced in settings `api` in S10 |

### Excluded
| Item | Disposition |
|---|---|
| Quick-Log `/quicklog`, Mobile App `/mobile` (web pages) | EXC per `apps/web/src/config/excluded.md` |
| pqe, mobile voice quick-log | EXC (Q3, Q9) |
| Tweaks panel | NOT excluded: REAL (Q8), S01 S1-9 |

## 8. Standing rules for every sprint in this programme

1. Each sprint retires its placeholders: the S1-8 ledger (`placeholder-ledger.ts`) shrinks; a sprint is not closed while any of its routes still renders `ModulePlaceholder`.
2. Every new module adds itself to: `navigation.ts` (already present), `rbac.ts`, palette nav list, `entity-routes.ts` (if it has a detail page), search KINDS (if searchable), realtime topics, notifications, audit events, and the graph node kinds.
3. Web and mobile both considered in every sprint file; where mobile has no jsx, the file says so and mobile is proven unaffected (shared type changes additive, `pnpm --filter @kaenal/mobile typecheck` green).
4. New strings are i18n-keyed from S01 on.
5. After any suite run, re-seed the demo login (rule 12) and prove sign-in.
