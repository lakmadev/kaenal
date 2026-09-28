# ROADMAP — "Build everything missing" programme

Author: Product Owner. Date: 2026-09-26. Source of truth for ordering; each sprint gets its own `SPRINT-NN-*.md`.

**Status of detail:** SPRINT-01 is written in full. Sprints 02-12 below are OUTLINES ONLY. Before any of them starts, the Product Owner must write its `SPRINT-NN-*.md` with use cases (happy/error/empty/permission/offline), testable acceptance criteria, Web/Mobile/Shared split, backend needs, dead-end audit and DoD, and the Scrum lead must run design audit + Gate 1 (SCRUM.md). No code before Gate 1.

## 0. Decisions (user, 2026-09-26)

| # | Decision | Effect on the roadmap |
|---|---|---|
| Q1 | CreateWizard replaces the create dialogs everywhere; CAPA keeps its dialog | S01 S1-1 |
| Q2 | PROPOSED backend designs (P12, P15-P19, P21, P24 incl. predictive scoring) are NOT blanket-approved. Each wave's designs go to the user for approval when that wave starts. Sprint 01 needs none | Sprints 03, 04, 05, 06, 10 each open with an "Approval gate": the PO includes the wave's backend design in its sprint file and NO build starts until the user approves it |
| Q3 | pqe Quality Engine EXCLUDED until a spec exists | S01 S1-11 removes nav/placeholder, adds to `excluded.md`; dropped from Sprint 10 |
| Q4 | i18n English-only now (de/es deferred); mobile does not adopt i18n | S01 S1-7 |
| Q5 | External-infra features (SSO/SCIM vendor, BYOK, status page, backup/restore, warehouse sync) deferred to the LAST waves; build only vendor-free parts; never a dead nav entry: hidden or listed in `excluded.md` | Moved to new Sprint 13; entries hidden in settings rail by S1-11 |
| Q6 | Billing = entitlements only, no payment provider | Sprint 10 |
| Q7 | AI drawer "Generate PDF" uses existing exports | S01 S1-4 |
| Q8 | Tweaks panel and AI prominence are REAL persisted preferences; one vocabulary `front|normal|quiet` (shell.jsx / 04 §3), the `quiet|visible` of ai.jsx retired | S01 S1-9, S1-4 |
| Q9 | Voice quick-log transcription backend EXCLUDED; remove/hide the mobile control | S01 S1-11 (only mobile change in S01) |

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
| Mobile MFA enrolment (QR / recovery codes) missing | STALE: `apps/mobile/src/app/settings/two-factor.tsx` implements enrol (QR + secret + verify), disable, regenerate recovery codes over real `/v1/auth/mfa/*` (M16). Only re-verify in Sprint 12. |
| Mobile offline/sync status | Built (M3, M11 `sync-queue.tsx`, M12 tablet rail). M17 (permissions/capture) is still `[~]` in `progress_mobile.md`; M19.5 NCR fidelity `[~]`. |
| Audits backend done | Confirmed: `apps/api/src/audits` (list, create, detail, advance, findings, raise-NCR, raise-CAPA) + contract lines 553-614. |
| Graph backend | Partial: `entity_links` + `/v1/entity-links` exist; NO bounded graph-query endpoint (P20 says needed). |
| Predictive backend | None: P21 `risk_predictions` is PROPOSED; no controller. |
| Tier-2 modules backends | None in `apps/api/src` (no risk/msa/calibration/training/complaints/ecn dirs). |
| Settings unbuilt list | Confirmed from `settings-nav.ts`. Built: profile, notifications, security, preferences, members, sessions, legal-hold, dlp, white-label, cross-tenant, cost-centers, validation, integrations, bulk-import, audit. |
| Entitlements/billing backend | None (`/v1/entitlements` absent). |

## 3. Ordered waves

| Sprint | Wave | Theme | Backend readiness |
|---|---|---|---|
| 01 | 1 | Shell foundations: New menu + CreateWizard, palette parity + shortcuts, live mode, AI drawer, offline/409, Radix, i18n scaffold, placeholder ledger | mostly ready; AI chat endpoint new |
| 02 | 2 | Audits module (web list / my audits / schedule / detail / findings / raise NCR-CAPA); audit kind in search, notifications, entity routes | ready |
| 03 | 3 | Knowledge Graph explorer + Predictive Analytics | graph: 1 new query endpoint; predictive: new tables + scoring |
| 04 | 4 | Risk register + MSA / Gauge R&R | new (P12, P15) |
| 05 | 5 | Calibration + Training & competency | new (P16, P17) |
| 06 | 6 | Customer complaints + ECN | new (P18, P19; link into NCR/8D/CAPA/documents) |
| 07 | 7 | Settings: Workspace + Process (organization, roles, sites, categories, SLA, email / inspection / 8D templates) | partly new tables, settings substrate ready |
| 08 | 8 | Settings: Security & Identity + Compliance, vendor-free parts (trust center, network policy, service accounts, delegated admin, DSAR) | new; 07 spec exists |
| 09 | 9 | Settings: Developer + Multi-tenancy (dev-platform, API & webhooks, org hierarchy, lifecycle clone/migrate/export) | webhook delivery/config already built |
| 10 | 10 | AI Governance, PDF Templates designer (+ 8D PDF), Plans/entitlements (entitlements only, Q6) | AI gateway ready; rest new |
| 11 | 11 | Adoption: onboarding wizard, tours, knowledge base, NPS, adoption analytics, release notes | new |
| 12 | 12 | Mobile parity sweep: finish M17 / M19.5, full audit of `apps/mobile` vs every `m-*.jsx`, any mobile endpoints owed by earlier waves (SSO redirect screen only if Sprint 13 ships SSO) | after 08 |
| 13 | 13 | External-infra settings, last: SSO, SCIM, BYOK, status page, backup/restore, warehouse sync — vendor-free parts only, each entry hidden until real | needs vendor/infra decisions at wave start |

Why this order: shared foundations first so later screens inherit banner/409/i18n/create-wizard; then modules by backend readiness (audits = free win); settings grouped by domain with identity after workspace roles/sites exist (SSO/SCIM map to roles + sites); mobile parity last because it consumes the settled shared types and the SSO flow.

## 4. Dependencies and parallelism

Hard dependencies
- 02 needs 01 (S1-1 wizard for "raise finding NCR" continuity; S1-5 handler) — soft; 02 needs the S1-2 `entityHref` pattern.
- 03 graph needs 02 (audit nodes route) and the 04-06 modules for their nodes later (graph must be extensible; add each new kind to `entity-routes.ts` as modules land).
- 06 complaints needs NCR/8D (exist). ECN "auto-revises documents" needs documents (exist).
- 07 `roles` needs the RBAC matrix (`rbac.ts`, 03 §RBAC) and `sites` needs plants (exist). 08 SSO/SCIM depend on 07 roles + sites; 08 network policy depends on session policies (built).
- 09 `api` section depends on merging branch `feat/webhook-config-form` (do not re-plan it). It may be pulled forward as a one-story mini-sprint the moment that branch merges.
- 10 PDF templates feeds 8D PDF and audit/inspection reports; entitlements (10) should land before any "locked module" paywall UX is added anywhere.
- 12 SSO mobile screen depends on 08.

Parallel worktrees (each on its own feature branch, agents never push)
- Safe together: {02} || {04 backend} || {07 backend tables}; later {04, 05, 06} are mutually independent (disjoint modules) but share files, see below; {08} || {09} || {11}.
- Inside a sprint the Scrum lead splits DB -> API -> UI per CLAUDE.md, but UI for two modules may proceed in parallel worktrees once their APIs are merged.

Merge-conflict hot spots (serialize or pre-allocate)
- `packages/db/migrations/*` numbering (next free is 0042 after `0041_outbox`): pre-assign ranges per sprint (e.g. 02: none; 03: 0042-0043; 04: 0044-0046; 05: 0047-0049; 06: 0050-0052; 07: 0053-0057; ...) at Sprint kickoff to avoid renumber collisions.
- `packages/types/src/contract.ts`, `index.ts`, `apps/web/src/config/navigation.ts`, `planned-modules.ts`, `settings-nav.ts`, `entity-routes.ts`, command-palette nav list: one owner per merge; rebase before PR.
- The two existing unpushed branches (`feat/partner-invite-mfa`, `feat/webhook-config-form`) touch portal/settings/integrations; keep new work off `sections/integrations.tsx` until they merge.

## 5. Sprint outlines (2-13)

Each outline lists the items and what must be proven before writing the full sprint file.

**02 Audits.** Design `audits.jsx` (657 lines: all views/panels/states). Web: replace `/audits` placeholder; views list / `?view=mine` / `?view=schedule` per `navigation.ts` children; detail (scope, lead + team, auditees, phase/progress, dates, findings breakdown major/minor/opportunity, checklist, linked CAPAs, next activity), create audit, advance phase, add finding, raise NCR/CAPA from finding, History tab from audit events. Prove at kickoff: whether checklist, team/auditee, schedule/frequency exist in the schema (`packages/db` audits tables) — the P04 status says FE partial, backend done; gaps go into the sprint as backend work. Mobile: none designed (mobile "Audit" tab is the oversight audit trail, `apps/mobile/src/app/(app)/audit.tsx`); stays unaffected. Shared: `audit` kind in `entityHref`, search KINDS, notification click-through, graph seeds.

**03 Graph + Predictive.** APPROVAL GATE (Q2): the sprint file carries the predictive scoring method + `risk_predictions` design; user approves before build. Designs `graph-explorer.jsx` (616), `predictive.jsx` (326). Graph: bounded query endpoint over `entity_links` (open-doc / open-CAPA filters, seeds, clustering "+N more", depth/size caps, RLS + plant scope, cursor/limit); layout pure logic in `packages/core`. Predictive: `risk_predictions` (0030 proposal) + scoring job (BullMQ) — algorithm needs user sign-off (Q2); also feeds existing PPAP/SCAR prediction stubs (grep and wire — those are "prediction stubs" in PROGRESS). Mobile: none designed.

**04 Risk register + MSA.** APPROVAL GATE (Q2): P12/P15 backend designs to the user first. Designs `qms-risk-spc.jsx` `RiskRegister` (5x5 matrix, trend, treatment) and `MSAStudy` (3x10x3 GR&R, variance components, ndc; AIAG calc in `packages/core`, unit-tested vs AIAG reference example). Backend P12, P15 (`PROPOSED`). Mobile: none designed.

**05 Calibration + Training.** APPROVAL GATE (Q2): P16/P17 designs to the user first. Designs `qms-modules.jsx` `CalibrationManagement`, `TrainingMatrix`. Backend P16, P17; expiry/due-soon jobs -> notifications (existing notification substrate); certificate attachments via files pipeline. Mobile: none designed (inspector may want cal status in inspection runner — only if a jsx shows it; otherwise not added).

**06 Complaints + ECN.** APPROVAL GATE (Q2): P18/P19 designs to the user first. Designs `qms-modules.jsx` `CustomerComplaints` (+ `IntakeForm`), `ECNWorkbench`/`ECNList`/`ECNKanban`. Backend P18, P19: complaint -> NCR/8D/CAPA conversion, ECN multi-stage approval reusing the documents approval engine, "auto-revises affected documents". Portal intake channel (supplier portal) only if the jsx shows it. Mobile: none designed.

**07 Settings Workspace + Process.** Designs `settings.jsx`, `settings-extra.jsx`, `rbac.jsx`, `template-editor.jsx`, `eightd-templates.jsx`. Items: organization, roles & permissions (edit capability matrix; MUST NOT weaken the RBAC default-deny — design decision + security-reviewer), sites & areas (plants/areas exist: CRUD UI), categories, SLA configuration (feeds existing SLA/escalation jobs — prove the job reads config), email templates (12), inspection templates (web `templates-view.tsx` already exists — reconcile to avoid two UIs), 8D templates. Mobile: sites/categories consumed by mobile pickers — verify no mobile change needed; roles changes must not break `apps/mobile/src/config/rbac.ts`.

**08 Security & Identity + Compliance.** Designs `trust-center.jsx` (+ `trust-components.jsx`), `identity-advanced.jsx`, `compliance-extra.jsx`, `mfa-settings.jsx` where relevant. Items (vendor-free only, Q5): Trust Center, network policy (IP allowlists, geo-fence, VPN — enforcement in the request lifecycle interceptor; sign-in proof required, rule 12), service accounts (API keys; `api_key` actor kind already in audit), delegated admin, DSAR (07: `POST /v1/dsar`). SSO, SCIM, BYOK moved to Sprint 13. Mobile: none. All changes to `apps/api/src/auth/**` need end-to-end sign-in proof.

**09 Developer + Operations + Multi-tenancy.** Designs `dev-platform.jsx` (835), `operations.jsx` (612), `multi-tenancy.jsx` (630). Items: dev-platform hub (API reference/keys/sandbox per design), `api` = API & webhooks (mount the finished webhook config form + delivery log; endpoints + events + secret), org hierarchy, lifecycle clone/migrate/export (uses tenant registry/pool-manager; destructive-safe design), remove the "coming soon" branch from `settings-shell` when done. Sidebar `developer` and `multi-tenancy` routes resolve here.

**10 AI Governance + PDF Templates + Plans/entitlements.** Designs `ai-governance.jsx` (6 tabs: data controls, models & routing, PII redaction, AI audit trail, cost & budgets, evals & red-team), `pdf-designer.jsx` + `eightd-pdf.jsx` (P24), `pricing.jsx` + `addons.jsx` (entitlements; 04 §5 locked-route blur + upsell; `GET /v1/entitlements`), Also the sidebar add-on lock icon (D-06 from DESIGN-01). Backend: governance settings tables over existing gateway/ai_invocations; PDF template store + renderer (APPROVAL GATE Q2 for P24 and any predictive-style designs); entitlements only (`GET /v1/entitlements`, add-on toggles, locked-route upsell) — NO payment provider, no billing/invoice charging; the `billing` settings section shows plan + entitlements only, and anything needing a payment provider is hidden. pqe is excluded (Q3).

**13 External-infra settings (last).** SSO/SAML+OIDC, SCIM, BYOK, status page, backup & restore, warehouse sync. At wave start the user decides vendors/targets (Q5 remainder: WorkOS vs native, KMS target, warehouse); for each, build only the vendor-free real part or keep it excluded; entries stay hidden (excluded.md) until real. Sprint file must prove the real backend before any UI.

**11 Adoption.** Designs `adoption.jsx` (720). Items: onboarding wizard, product tours, knowledge base, NPS & satisfaction, adoption analytics, release notes. Backend: new tables; analytics from existing audit events/usage. Mobile: none designed.

**12 Mobile parity.** Audit `apps/mobile` screen by screen vs `m-auth.jsx`, `m-auth-extra.jsx`, `m-home.jsx`, `m-capture.jsx`, `m-inspections.jsx`, `m-ncr.jsx`, `m-work.jsx`, `m-oversight.jsx`, `m-system.jsx`, `m-settings-detail.jsx`, `m-tablet.jsx`. Known open: M17 remaining sub-items, M19.5 NCR pixel-for-pixel + backend, `AuthSSORedirect` (only if Sprint 13 ships SSO; otherwise hidden), voice quick-log EXCLUDED (Q9; control removed in Sprint 01), tenant-wide sync-failure telemetry tile (M5 backend gap), `AuthBiometricFail`/`SignOutGuard` verification, tablet split-views. Endpoints owed by earlier waves for mobile get added here as mobile-appropriate routes, never by reshaping web routes.

## 6. Open questions remaining (user-owned)

- U1 Approve DESIGN-01 visuals (new offline banner, 409 dialog, shortcuts dialog, palette/live/AI/wizard states, phone width) and its 7 deviations D-P1, D-W1, D-T1, D-T2, D-F1, D-R1, D-S1; the designer must also draw the Tweaks panel board (S1-9).
- U2 Keep the "View as role" demo switcher omitted (D-05)?
- U3 AI chat allowed for viewers (read-only) — confirm (S1-4 4c).
- U4 Sprint 13 vendor choices, at wave start (SSO/SCIM vendor, KMS target, warehouse).
- U5 Wave-start design approvals for Q2 (Sprints 03, 04, 05, 06, 10).
- Answered: Q1, Q3, Q4, Q6, Q7, Q8, Q9 (section 0).

## 7. Item -> story / disposition table

Legend: S = sprint; IN = in scope; UNAPPROVED = in scope, backend design awaiting Q2; EXC = excluded; N/A = inventory item stale.

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
| ai-governance | IN, S10 (also settings `ai-governance`) |
| developer | IN, S09 (dev-platform) |
| multi-tenancy | IN, S09 (org-hierarchy, lifecycle; white-label/cross-tenant/cost-centers already built) |
| pricing | IN, S10 (entitlements only, Q6) |
| pdf-templates | IN, S10 (P24, UNAPPROVED); settings `pdf-templates` same story |

### Settings sections (unbuilt)
| Item | Disposition |
|---|---|
| organization, roles, sites | IN, S07 |
| trust, network, service-accounts, delegated | IN, S08 |
| sso, scim | DEFERRED to S13 (Q5); hidden from rail by S1-11 |
| dsar | IN, S08 |
| byok | DEFERRED to S13 (Q5); hidden by S1-11 |
| org-hierarchy, lifecycle | IN, S09 |
| ai-governance | IN, S10 |
| sla, categories, email-templates, insp-templates, 8d-templates | IN, S07 |
| pdf-templates | IN, S10 |
| dev-platform, api (API & webhooks, reuse `feat/webhook-config-form`) | IN, S09 (api can be pulled forward after that branch merges) |
| status-page, backup-restore, warehouse | DEFERRED to S13 (Q5); hidden by S1-11 until real |
| onboarding, tours, knowledge, nps, adoption, release-notes | IN, S11 |
| billing | IN, S10, entitlements only (Q6); payment features hidden |

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
| Enrolment screen (QR / recovery codes) | N/A: built in `settings/two-factor.tsx`; re-verify S12 |
| Phase 3 field-inspector / offline sync status | Built (M3-M13); open sub-items M17, M19.5 -> S12 |
| Mobile parity audit vs `m-*.jsx` | IN, S12 |
| SSO redirect screen | Only if S13 ships SSO; otherwise hidden |
| Voice quick-log | EXCLUDED (Q9); control removed in S01 S1-11 |
| Mobile counterparts for S02-S11 modules | None designed in `m-*.jsx`; web-only per design. Mobile stays fully working; `manage-web.tsx` exists for oversight hand-off |

### Existing branches
| Item | Disposition |
|---|---|
| `feat/partner-invite-mfa` (incl. portal contacts tab) | DONE, not re-planned; merge is the user's call |
| `feat/webhook-config-form` | DONE, not re-planned; surfaced in settings `api` in S09 |

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
