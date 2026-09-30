# SPRINT-07 — Plans & Entitlements + Industry-aware Onboarding

Author: Product Owner. Date: 2026-09-30. Part of the multi-sprint programme in `ROADMAP.md`, **pulled ahead of
the former Sprint 07 (Settings Workspace + Process), which becomes Sprint 08** (ROADMAP §0 decision Q10).
Governing rules: CLAUDE.md rules 0-12 and `SCRUM.md`. Design fidelity is a completion gate.
Builds on Sprints 01-06 (all merged). Migration range pre-assigned to this sprint: **0073-0076**.

**Why this sprint exists (the business case, in one paragraph).** Sprints 01-06 gave Kaenal genuinely
competitive module depth (inspections, NCR, 8D, CAPA, audits, documents, suppliers/PPAP/SCAR, FMEA, SPC, MSA,
risk, calibration, training, complaints, ECN, graph, predictive). What it cannot yet do is (a) *package* that
depth into something a customer is charged for, (b) *gate* what a customer has not bought, and (c) give a new
customer's admin a first hour that feels built for *their* industry rather than a 30-module checkbox tool.
The user decided (2026-09-30) that closing those three gaps is worth more right now than further vertical
module depth. Two scope decisions are the user's and are **not re-litigated here**: billing is
**entitlements-only, no payment provider** (ROADMAP Q6, pulled forward from the old Sprint 10), and industry is
**soft tagging that suggests and highlights but never hides or locks anything**.

**This sprint carries an APPROVAL GATE (ROADMAP §0 Q2).** Neither the entitlement model beyond 02 §2's one-line
table nor anything about onboarding has a spec-grade backend design. §3 is the backend + commercial design the
user must approve. It contains **five decisions with real commercial weight (D1-D5, §3.0)** where the jsx, the
spec and "make it possible to charge a customer" pull in different directions. **NO BUILD MAY START until the
user has explicitly approved §3 and answered §7's strategic questions marked [USER].**

**Correction to the brief this sprint was commissioned with.** The brief said there is "NO jsx anywhere" for an
onboarding wizard, a plan/entitlements screen or an industry picker. That is **not true**, verified this session
(§1a): `pricing.jsx` + `addons.jsx` are a complete, binding design for plans, add-on packs, the locked-route
upsell overlay and sidebar lock icons; `adoption.jsx` `OnboardingWizard` is a binding design for the
post-signup setup checklist; `auth.jsx` stage `request` is a binding design for a "Request a workspace" intake
form that already asks **Industry, Plant size and Compliance frameworks**; `settings.jsx` `Organization` has
Industry + Compliance-frameworks fields and `Billing` is the plan card. What genuinely has **no** jsx is the
interactive first-run questionnaire itself (step UI, module-recommendation review) and a set of states the
prototype never drew (request-pending, trial countdown, non-admin overlay, downgrade confirm, etc.). §5 names
every one. CLAUDE.md rule 9 therefore applies to most of this sprint: the existing jsx is binding, and only
the gaps go to the UI Lead Designer.

---

## 0. Research grounding — the real patterns this sprint borrows, and why

The brief asked for named, real B2B SaaS patterns rather than invented UX. Each pattern below is cited where a
story uses it, so design and engineering know the *why*, not just the *what*.

| # | Pattern | Who does it (publicly documented) | What Kaenal takes from it | Used in |
|---|---|---|---|---|
| R1 | **Framework-first tailoring.** A compliance product asks *which standards you are certified to / pursuing* and derives the initial control set from that answer, with controls cross-mapped so one piece of evidence satisfies several frameworks. | Vanta / Drata / Secureframe (SOC 2, ISO 27001, HIPAA framework selection drives the control set; cross-framework mapping) | The **compliance framework** answer (IATF 16949, ISO 9001, ISO 13485, AS9100, …) is the *strongest* signal for module suggestions — stronger than industry. Suggestions carry the **clause that motivates them** ("IATF 16949 §7.1.5.1.1 — MSA"), the QMS analogue of Vanta showing which framework requires a control. | O2, O4 |
| R2 | **Short "who are you" questionnaire that shapes, never locks.** 2-4 questions at signup (use case / team / role / company size); the answers pre-populate templates and a getting-started checklist; everything remains available. | Notion ("what will you use Notion for"), HubSpot (role / company size / industry at signup, tailored onboarding checklist), Linear (workspace + team setup) | A 4-step first-run flow: Industry → Frameworks → Size → Recommended modules. Every step skippable, every answer editable later, a sensible default when skipped. **Nothing is hidden** by any answer (user decision 2). | O4 |
| R3 | **Self-completing setup checklist.** Tasks tick themselves when the user does the real thing (not when they click "mark done"), with a progress bar and time estimate. | Stripe Dashboard setup guide, Vanta "getting started", HubSpot onboarding checklist | `OnboardingWizard`'s checklist completion is **derived server-side from real data** (first instrument registered, first inspection completed, first invite accepted), never a manual tick. | O5 |
| R4 | **Entitlements decoupled from billing.** "What a customer may use" (plans, features, entitlements) is one runtime layer; "how money is collected" (payment, invoices, tax) is a separate, swappable system. | Stigg (decoupled entitlements; provider-agnostic), LaunchDarkly-style entitlement flags | One pack catalog + one resolver in `packages/core`, read by every gate (web routes, sidebar, API writes, AI gateway). **No payment provider** (Q6) — and because the layer is decoupled, adding Stripe later is an integration, not a rewrite. | P1-P3 |
| R5 | **Sales-led "request → admin/vendor approves".** Members or admins *request* an upgrade; an approver (workspace admin, or the vendor's sales team) fulfils it; the requester is notified of the decision. Figma's March-2025 billing change moved to admin approval of seat upgrades by default, with email + in-app notification both ways, and optional provisional access while a request is pending. | Figma (seat-upgrade requests), Atlassian (request product access), Slack/Notion (request to upgrade) | Two request loops: **member → workspace admin** ("Request access" on a locked module), and **workspace admin → Kaenal sales** ("Add to plan" / "Talk to sales" / "Contact sales" / "Update subscription" in request mode). Both notify in-app; Kaenal sales by email. | P6 |
| R6 | **Feature trial / reverse trial.** Time-boxed full access to a premium feature; at expiry the customer drops back to their plan, never locked out of their own data. Term popularised by Kyle Poyar (OpenView). | Notion, Canva, Slack, Loom, Miro (reverse-trial variants); HubSpot in-app hub trials | `addons.jsx` already draws **"Start 14-day trial"**. This sprint makes it real: once per pack per tenant, auto-expiring, T-3-day warning, and at expiry the tenant's records stay readable (§3.0 D3). | P5 |
| R7 | **Frosted preview paywall.** The locked feature renders blurred behind an upsell card, so the buyer sees what they would get. | Common in PLG products; drawn in `addons.jsx` `UpgradeOverlay` and specified in 04 §5 | Built exactly as drawn (P2). The blur is a **commercial** gate, not a security boundary; the API is the boundary (P3). | P2, P3 |
| R8 | **Operator plane as scripts before consoles.** Early enterprise SaaS runs tenant/plan administration through audited internal tooling before building a staff console. | Kaenal's own precedent: `provision-tenant`, `offboard-tenant`, `migrate-tenants` (TECH_STACK: "tenant provisioning is a script, not a project") | Kaenal staff set a tenant's contracted plan through an audited CLI (`pnpm tenant-plan`), recorded as `actor_kind='support'` with a mandatory `reason` (the audit table already enforces this). A staff web console has no design, no staff-identity model and is explicitly out of scope in `phases/README.md` — flagged, not faked (§7 Q-S4). | P8 |

Sources consulted this session: [Vanta — automated compliance](https://www.vanta.com/products/automated-compliance),
[Vanta — ISO 27001 + SOC 2 together](https://www.vanta.com/resources/how-to-use-iso-27001-and-soc-2-together),
[Figma — approve or decline seat upgrade requests](https://help.figma.com/hc/en-us/articles/1500003870721-Approve-or-decline-seat-upgrade-requests),
[Figma — 2025 billing experience update](https://www.figma.com/blog/billing-experience-update-2025/),
[Stigg — billing architecture vs entitlements](https://www.stigg.io/blog-posts/billing-system-architecture),
[Stigg — feature gating](https://www.stigg.io/blog-posts/feature-gating),
[Reverse trials (SaaS Mag)](https://www.saasmag.com/reverse-trials-replacing-freemium-saas/). Notion/HubSpot/
Linear/Stripe onboarding patterns (R2, R3) are cited from general product knowledge of their public signup flows;
they illustrate the pattern, and no story depends on a detail of those products.

**One regulated-industry principle that none of the generic patterns covers, and that shapes D3:** a QMS holds
records that IATF 16949 §7.5.3.2.1 and ISO 13485 §4.2.5 require the customer to *retain* for defined periods.
A paywall that makes a customer's own quality records unreadable after a downgrade or trial expiry would be a
compliance hazard for the customer and a trust-breaker in an audit. So in Kaenal, **gates block creating and
changing records, never reading or exporting records the tenant already holds** (§3.0 D3). The pricing.jsx
"What always stays in Core" callout states the same intent in marketing language.

---

## 1. Goal and roles served

Make Kaenal **sellable, gateable and first-hour-tailored** without a payment provider:

1. **Plans & entitlements (Increment A).** A tenant has a set of active add-on packs (the 9 packs in
   `addons.jsx`), grouped into the 3 tiers in `pricing.jsx` (Core, Professional, Enterprise). Locked modules
   render the real page blurred behind the upsell card (04 §5), carry a lock in the sidebar, and are
   write-blocked server-side. Admins manage the plan on `/pricing`, can start real 14-day trials, and hand off to
   Kaenal sales through real requests; Kaenal staff set the contracted plan through an audited CLI. The
   `Billing & plan` settings section shows the plan (payment features hidden per Q6). `Download quote` produces a
   real PDF.
2. **Industry-aware onboarding (Increment B).** A prospect can request a workspace from the sign-in screen (the
   drawn `request` stage), capturing industry / plant size / frameworks. When the tenant's first admin signs in,
   a short first-run flow confirms those answers and shows a ranked, clause-referenced module recommendation
   computed by a pure function in `packages/core`. The admin lands on the drawn `OnboardingWizard` checklist,
   whose tasks complete themselves from real data and include setup tasks for the modules the admin chose to
   focus on. Every module stays reachable regardless of any answer.

The two increments are independent enough to ship in order (A then B). The only coupling is that O2/O4 show a
lock chip on a recommended module the plan does not include, which reads P1's resolver. The architect may split
them into two build waves (§7 Q-S1).

**Roles served**

| Role | What they get this sprint |
|---|---|
| **Workspace admin** (`admin`; holds `billing:manage` and `settings:manage`) | Plans & add-ons page, plan changes (self-service) or requests (request mode), trials, quote PDF, Billing & plan section, first-run flow, onboarding checklist, approving member access requests by acting on them |
| **Manager** (`settings:manage`, not `billing:manage`) | Onboarding checklist and editing the workspace profile (industry/frameworks), like every other `settings:manage` screen. Not the plan (03 §3: billing/entitlements are admin-only) |
| **Auditor / inspector / viewer** | Sidebar lock icons and the locked-module overlay; a **"Request access"** action that notifies admins (R5). Never a control that would 402 or 403 (04 §6) |
| **Partner** (supplier portal) | Portal writes are gated by the `supplier` pack like the internal supplier module. No new UI |
| **Kaenal staff (operator)** | `pnpm tenant-plan` CLI: set bundle/packs, self-service flag, contract and CSM fields, list/fulfil/decline requests, all audited as `support` with a reason. `provision-tenant --bundle` / `--from-request` |
| **Prospect (unauthenticated)** | "Request a workspace" form on the sign-in screen, with an honest confirmation state |

**Mobile.** No `m-*.jsx` draws pricing, entitlements, trials or onboarding (§1a). Every module the mobile app uses
(inspections, NCR, capture, work queue, oversight, settings) is in Core and is never gated. Mobile *is* touched in
three small, named ways (X1): the NCR AI draft already handles 402, and must keep doing so when an
`intelligence` trial expires; the oversight audit feed must categorise the new audit actions; and the
notification list must render the 4 new notification kinds, handing off to the web for `/pricing`. Mobile
onboarding is out of scope: the first-run flow is a web-admin task and **never blocks a mobile sign-in**.

## 1a. Verified current state (grepped this session, not assumed — CLAUDE.md rule 10)

| Fact | Evidence |
|---|---|
| **Binding entitlement design exists.** `addons.jsx` (282 lines, read in full): 6 packs (`intelligence`, `supplier`, `qe`, `platform`, `security`, `multiplant`) + 3 à-la-carte (`mobile`, `standards`, `support`), each with price function, includes list, `routes[]` gate map; `UpgradeOverlay` (blurred inert preview + upsell card: "Add-on · locked", "Not in your plan", price, "What unlocks", **Add to plan / Start 14-day trial / Compare plans**, "Billed to … · changes take effect immediately"); `billingSummary` estimate over an `ORG_PROFILE` of plants/suppliers/inspectors/members/standards | `project_brain/project/src/addons.jsx:13-275` |
| `pricing.jsx` (233 lines, read in full): header actions **Download quote / Contact sales**; 3 tier cards (Core $2,400/mo, Professional $4,050/mo + units "Most popular", Enterprise Custom) with **Apply bundle / Current plan / Talk to sales**; the "What always stays in Core" guardrail callout; Add-on packs grid (`AddonCard`, **Add to plan / Added to plan**); à-la-carte list (`AlacarteRow`, **Add / Remove**); sticky "Estimated monthly" summary with **Update subscription** and **Back to dashboard**. The current tier is **derived** (`tierMatches`), not stored | `project_brain/project/src/pricing.jsx:5-231` |
| Route gating wiring in the prototype: `Kaenal.html` wraps any route whose pack is inactive in `UpgradeOverlay`; `shell.jsx` shows a lock icon on locked nav items and children ("Add-on — not in your plan") | `Kaenal.html:407-488`, `shell.jsx:88,141,196` |
| **Binding onboarding design exists.** `adoption.jsx` `OnboardingWizard`: header ("Welcome to Kaenal", **Skip onboarding**, **Schedule kickoff with CSM**), gradient hero (Day N of 7, % to first inspection, done/to-go, est. time left, progress bar), "Setup checklist" (8 demo tasks: done rows show DONE BY / owner / when; pending rows show progress bar + estimate + **Start / Continue**), "Your CSM" card (**Book 30 min / Slack message / Email**), "Helpful right now" (4 links). First demo task: "Confirm company details — Name, industry, compliance frameworks" | `project_brain/project/src/adoption.jsx:7-139` |
| `settings.jsx` renders `OnboardingWizard` as the `onboarding` section of the Settings → Adoption group, so the checklist has a permanent, designed home | `settings.jsx:62,145` |
| **Binding intake design exists.** `auth.jsx` stage `request`: "Request a workspace" (Company name, Work email, **Industry** select [Automotive, Aerospace, Food & Beverage, Pharmaceutical, Other], **Plant size** select [50–200, 200–1,000, 1,000–5,000, 5,000+], **Compliance frameworks** chips [IATF 16949, ISO 9001, ISO 14001, AS9100, FDA 21 CFR Part 11, HACCP], **Request access**), reached from the workspace stage via "Don't have a workspace? **Request access →**". Copy: "We'll provision a private Kaenal tenant for your company" — i.e. a **sales-led** intake, not self-serve provisioning | `auth.jsx:117-119,190-213` |
| The built web sign-in (`sign-in-form.tsx`) has stages `workspace/login/verify/blocked/forgot/enroll` and **no** `request` stage and **no** "Request access" link: a designed element on a built screen that is currently missing | `apps/web/src/app/(auth)/sign-in/sign-in-form.tsx:39` |
| `settings.jsx` `Organization` → Identity card has **Industry** select and **Compliance frameworks** chips (IATF 16949, ISO 9001, ISO 14001, ISO 45001, AS9100, FDA 21 CFR Part 11); `Billing` → "Current plan" card (tier, limits, renewal, annual price) + Billing email + Tax ID + **Payment method** + **Invoices** table | `settings.jsx:438-500,848-898` |
| **No jsx** for: an interactive first-run questionnaire, a module-recommendation review, request-pending / trial-countdown / non-admin / downgrade-confirm states, the CreateWizard lock state | grep of `project_brain/**/*.jsx` for `industry|framework|onboarding|entitle|trial` — only the hits above |
| **Spec.** 02 §2: `entitlements(pack_id text, active bool, activated_at, unique(tenant_id, pack_id)) -- mirrors src/addons.jsx packs`. 03 §3: "Members, roles, billing, entitlements, API keys" = admin only. 04 §5: "locked module routes render the real page blurred behind the upsell card; entitlements from `GET /v1/entitlements`; toggling in pricing updates instantly." 06 §3.1: AI requires the `intelligence` pack; over budget → 402. 07 §1: entitlement changes are audited. 09 §1: integrations beyond SMTP require the `platform` pack | `implementation/02-DATABASE.md:83`, `03-API.md:27`, `04-WEB-APP.md:44`, `06-JOBS-REALTIME-AI.md:34`, `07-SECURITY-COMPLIANCE.md:6`, `09-INTEGRATIONS.md:20` |
| `phases/README.md` lists `pricing.jsx`, `adoption.jsx`, `settings*.jsx` as "not given phase docs … raise one to a phase doc only on an explicit decision to build it." **The user's 2026-09-30 reprioritisation is that explicit decision** for pricing/entitlements and the onboarding checklist | `implementation/phases/README.md:93-100` |
| **Backend already present:** `entitlements` table (0001, forced RLS, `unique(tenant_id, pack_id)`, **no** `lock_version`, no CHECK on `pack_id`); audit action `entitlement_changed` (0002); error `ENTITLEMENT_REQUIRED` → HTTP 402; the AI gateway reads `SELECT active FROM entitlements WHERE pack_id='intelligence'` and fails closed; `seed-demo.ts` grants `intelligence`; `billing:manage` capability (admin only) | `0001_core.sql:618-629`, `0002_audit_action_check.sql:31`, `apps/api/src/errors.ts:40`, `apps/api/src/ai/gateway.service.ts:218`, `apps/api/scripts/seed-demo.ts:370`, `packages/core/src/rbac.ts:67` |
| **Backend absent (gap proven):** no `GET /v1/entitlements` or any entitlement route in the ts-rest contract **or** any controller (the only controller hit is a comment in `ai.controller.ts:21`); no trial, plan-request, workspace-profile, onboarding or workspace-request storage or route | `grep -n -i entitle packages/types/src/contract.ts` → 0; `grep -rln -i entitle apps/api/src --include=*.controller.ts` → `ai.controller.ts` (comment only) |
| **A fixture uses a pack id that is not in the catalog:** `packages/db/test/fixtures.ts:237` inserts `pack_id='supplier_quality'`; the design's id is `supplier` | fixtures.ts:237 |
| **No operator / staff surface exists.** The API role only `SELECT`s `control.tenants` ("it never writes it"); tenant administration is done by migrator-role scripts (`provision-tenant`, `offboard-tenant`, `migrate-tenants`). The built "Cross-tenant analytics" settings section is current-tenant KPIs via `/v1/query/metric`, **not** an operator feature. `audit_events.actor_kind` already allows `support`, and a CHECK requires `reason` whenever it is used | `0000_foundation.sql:68-93`, `packages/db/scripts/`, `settings/sections/cross-tenant.tsx:10-14`, `0001_core.sql:707,727` |
| `provision-tenant.ts` seeds SLA config, a default plant, an example inspection template and an admin membership; it seeds **no** entitlements and **no** profile | `packages/db/scripts/provision-tenant.ts`, `scripts/lib/seed.ts` |
| Reusable substrate: `tenant_settings(tenant_id, namespace, doc jsonb, lock_version)` with a namespace CHECK widened per consumer (currently `branding`, `session`, `chargeback` — `0029_cost_centers.sql:84`); audit `action` CHECK already contains `entitlement_changed`, `settings_changed`, `created`, `status_changed` (latest widening `0061_audits_module.sql:73-81`), so this sprint needs **no** new audit action; exports pipeline (`ExportResource` enum + `run-export.ts`); outbox → `send-email` processor over the email provider port; Redis `RateLimiter` used for login; daily job pattern (`calibration-due.ts`, `training-expiry.ts`) | `0025_tenant_settings.sql`, `packages/types/src/enums.ts:322`, `apps/api/src/jobs/processors/`, `apps/api/src/http/rate-limit.ts` |
| Web: `/pricing` is a planned-module placeholder (`planned:pricing`, ledger sprint 10); settings `billing` (10) and `onboarding` (11) are ledger placeholders; `/pricing` is admin-only in role curation (`PLATFORM_ROOTS`) | `config/planned-modules.ts:28`, `config/placeholder-ledger.ts`, `config/rbac.ts:18-24` |
| Mobile never calls a module this sprint would gate (grep of `apps/mobile/src` for suppliers/ppap/scar/risk/fmea/spc/msa/ecn/graph/predictions/reports → only NCR's own `risk` field). It **does** call the AI gateway for NCR drafts and already treats 402 as "AI unavailable". Its oversight audit feed maps actions containing `entitlement`/`setting` to the settings category | `apps/mobile/src/features/ncr/ai.ts:74`, `apps/mobile/src/app/(app)/audit.tsx:13` |
| Migration head is `0072_ecn.sql`; this sprint uses **0073-0076** | `ls packages/db/migrations` |

---

## 2. Stories

Ordering is by value and dependency (Scrum/INVEST): P1 is the foundation every gate reads; P2-P3 make gating
real; P4-P9 make it sellable and administrable; O1-O5 are Increment B; X1 is the standing cross-cutting wiring.
Each story names its design source. "[D#]" marks an AC whose exact behaviour depends on a §3.0 decision; the AC
is written for the **recommended** option and changes only as that decision states.

Vocabulary used throughout: a **pack** is one of the 9 catalog entries in `addons.jsx` (6 packs + 3 à la carte).
A **tier** is one of the 3 bundles in `pricing.jsx` (`core`, `pro`, `ent`); a tenant's tier is **derived** from its
active packs exactly as `tierMatches` does, and is `null` ("Custom") when no bundle matches. A pack is
**effective** when it is `active`, or when it has an unexpired trial. A **gated module** is a module whose pack
is not effective.

### Increment A — Plans & entitlements

### P1 — Pack catalog, entitlement store and resolver (Shared foundation)

**Design:** `addons.jsx:13-199` (catalog, route gate map, estimate), `pricing.jsx:88-111` (tiers, `tierMatches`).

UC
- Happy: any service or screen asks "is module X usable for this tenant right now?" and gets one consistent
  answer from one resolver; the tier label, lock icons, overlay, API gate, AI gateway and estimate all agree.
- Edge: a trial ended one second ago → the pack is no longer effective everywhere at once, without waiting for a
  job to run (the resolver compares `trial_ends_at` to `now()`).
- Edge: a tenant whose active set matches no bundle → tier `null`, shown as "Custom" (no tier card marked current).
- Error: an unknown `pack_id` can never be stored (DB CHECK + Zod enum).
- Cross-tenant: tenant A's entitlements are invisible to tenant B (forced RLS; foreign ids → 404).

AC
1. `packages/types`: `PackId` enum = exactly the 9 ids in `addons.jsx` (`intelligence`, `supplier`, `qe`,
   `platform`, `security`, `multiplant`, `mobile`, `standards`, `support`); `TierId` = `core|pro|ent`;
   `ModuleId` enum covering every nav module (`inspections`, `ncr`, `eight_d`, `capa`, `audits`, `documents`,
   `calibration`, `training`, `complaints`, `ecn`, `risk`, `fmea`, `spc`, `msa`, `suppliers`, `ppap`, `scar`,
   `graph`, `predictive`, `reports`, `report_builder`, `ai`, `integrations`, `portal`); DTOs `EntitlementDto`,
   `EntitlementsDto`, `TrialDto` (§4).
2. `packages/core/src/entitlements/catalog.ts` holds the catalog as **data**: per pack its name, tagline, icon,
   accent, price function, includes list, value line, and `modules: ModuleId[]`, mapping `addons.jsx`'s
   `routes[]` onto module ids exactly (`intelligence` → graph, predictive, ai; `supplier` → suppliers, ppap,
   scar, portal; `qe` → fmea, spc, msa, risk, ecn; `platform` → report_builder, integrations [non-SMTP only,
   09 §1]; `security`, `multiplant`, `mobile`, `standards`, `support` → no gated module [§3.0 D2, §7 Q-C3]).
   `TIERS` holds the 3 bundles exactly as `pricing.jsx:88-107`. The Core modules (inspections, ncr, eight_d,
   capa, audits, documents, calibration, training, complaints, reports-read, and every settings screen) map to
   **no** pack and can never be gated. [D2]
3. Pure functions, unit-tested with no DB: `effectivePacks(rows, trials, now)`, `tierFor(effective)` (≡
   `tierMatches`), `isModuleGated(moduleId, effective)`, `packForModule(moduleId)`, `estimateMonthly(effective,
   orgProfile)` (≡ `billingSummary`: Core base line + one line per effective pack; `hasVariable` when a
   custom-priced or metered pack is on). Tests cover: all 3 bundles resolve to their tier; a single toggle off a
   bundle → `null`; a trial ending at `now` is not effective (boundary is exclusive); every `ModuleId` maps to at
   most one pack; no Core module maps to any pack (a guard test that fails if someone adds one).
4. Migration `0073_entitlements.sql`: `entitlements` gains `source text NOT NULL DEFAULT 'operator' CHECK
   (source IN ('operator','self_service','bundle','grandfathered'))`, `lock_version int NOT NULL DEFAULT 0` with
   the shared bump trigger, `updated_by` composite member FK (`(tenant_id, updated_by) → memberships`, nullable
   because operator writes have no member), and `CHECK (pack_id IN (<the 9 ids>))`. New table
   `entitlement_trials` (`tenant_id`, `pack_id` same CHECK, `started_at`, `ends_at`, `started_by` composite member
   FK, `created_at`; `PRIMARY KEY (tenant_id, pack_id)` — which *is* the once-per-pack rule), forced RLS,
   leading-`tenant_id` index. Trial state lives only here, so expiry never has to mutate `entitlements`.
5. **Backfill, so nothing that works today stops working:** for every tenant that exists when `0073` runs, insert
   all 9 packs `active=true, source='grandfathered'` (`ON CONFLICT (tenant_id, pack_id) DO UPDATE SET
   active=true` — this also covers the demo's existing `intelligence` row). The `supplier_quality` fixture row
   (`fixtures.ts:237`) is corrected to `supplier` in the same change. New tenants get what P8's provisioning
   default says (§3.0 D1, §7 Q-C1).
6. RLS suite covers `entitlements` (now with writes) and `entitlement_trials`; `pnpm db:check` green; mutation
   test: removing the `entitlement_trials` policy makes `test:rls` fail.

Web: none directly (consumed by P2/P4). Mobile: none; additive types only, `pnpm --filter @kaenal/mobile
typecheck` green. Shared: everything above.

Backend: migration 0073; no route (P2 adds the read route); no audit (no mutation in this story); RBAC n/a;
tenancy: both tables tenant-owned, forced RLS, composite member FKs.

### P2 — `GET /v1/entitlements` + shell gating: sidebar locks, locked-route overlay, create-surface locks

**Design:** `addons.jsx:201-275` `UpgradeOverlay`; `shell.jsx:141,164-166,196` lock icons; `Kaenal.html:485-488`
wrapping rule; 04 §5. New states (§5): non-admin overlay variant, CreateWizard/quick-create lock.

UC
- Happy (admin): `qe` not effective → sidebar shows a lock icon on Risk register, FMEA workbench, SPC charts,
  MSA / Gauge R&R, Engineering changes (tooltip "Add-on — not in your plan"); opening `/risk` renders the real
  risk page blurred and inert behind the upsell card for "Quality Engineering" with its price, "What unlocks"
  list and the three CTAs. Add to plan / Start trial behave per P4/P5/P6; Compare plans → `/pricing`.
- Happy (non-admin): same lock icons and overlay, but the CTAs are replaced by one **Request access** action (R5)
  that sends a member request to the workspace admins (P6); after sending, the card shows "Requested — your
  admin has been notified" and the action is disabled. No Add to plan / Start trial / Compare plans (they would
  403 or lead to an admin-only page; 04 §6 "never render a button that will 403").
- Happy: the pack becomes effective (any path: toggle, trial, operator CLI, request fulfilled) → the overlay
  lifts and the lock icons disappear **without a reload**: the entitlements query is invalidated by the
  mutation, and by the realtime `entity.updated {kind:'entitlements'}` event for changes made elsewhere (CLI,
  another admin).
- Create surfaces: in the CreateWizard type step, the quick-create menu and the command palette's quick actions,
  a type whose module is gated (today: `risk`, `ecn`) shows a lock chip; choosing it shows the inline upsell (§5
  D-S4) instead of proceeding to a form that would 402.
- Empty/first load: while entitlements load, nav renders without lock icons and gated routes render a skeleton,
  never a flash of the unlocked page followed by an overlay.
- Error: the entitlements fetch fails → the shell treats every gated module as locked (fail closed, same order
  as the AI gateway) and shows the inline retry card on gated routes; Core modules are unaffected.
- Offline: cached entitlements are used; overlay CTAs are disabled with the offline tooltip (S1-5).
- Permission: `GET /v1/entitlements` is readable by every authenticated internal member and by partners (the
  portal needs to know whether it is gated); the response carries no prices, contract data or counts.

AC
1. `GET /v1/entitlements` (contract + controller) → `EntitlementsDto` `{ packs: [{ id, active, effective, source,
   activatedAt, trial: { startedAt, endsAt } | null, trialAvailable }], tier: TierId | null, selfService:
   boolean, gatedModules: ModuleId[] }`, computed with P1's resolver. Not paginated (a fixed 9-row catalog,
   exempt from rule 6 like `GET /v1/me`; stated in the contract summary). Cross-tenant: reads only the caller's
   tenant (RLS).
2. Web `useEntitlements()` hook (TanStack Query, key `['entitlements']`) is the **only** client source; lock
   decisions call `packages/core` `isModuleGated`, never a UI-local list (rule 5).
3. Sidebar: lock icon on each gated root item and child, matching `shell.jsx` (12px, stroke 2, the drawn muted
   colour, title text as drawn); collapsed rail shows no lock (as drawn).
4. `LockedRoute` wrapper applied to every route of a gated module that exists today: `/graph`, `/predictive`,
   `/suppliers` (+ `/suppliers/[id]`, scorecards, risk matrix views), `/ppap`, `/ppap/[id]`, `/scars`, `/fmea`,
   `/spc`, `/msa`, `/risk`, `/ecn`, and the report-builder authoring surface. It renders the real page
   `aria-hidden`, `inert`, blurred 3.5px, saturate 0.92, opacity 0.5, scale 1.02, under a
   `color-mix(var(--bg) 64%)` scrim, with the upsell card (max-width 560, pack-accent banner, overline "Add-on ·
   locked", chip "Not in your plan", h2 pack name, tagline, price row + note chip, "What unlocks" 2-column list,
   CTAs, footer info line) — every value from `addons.jsx:209-272`. Planned-module placeholders
   (`ai-governance`, `dev-platform`, `multi-tenancy`) are **not** wrapped this sprint: they are placeholders until
   their own sprint builds them, at which point they inherit the gate from the catalog (§7 Q-C4).
5. The overlay footer line "Billed to <workspace name> · changes take effect immediately" is **true** only in
   self-service mode; in request mode it reads per §5 D-S2 (e.g. "Requests go to Kaenal sales · you'll be
   notified when it's added"). [D1]
6. Keyboard/a11y: focus moves to the upsell card's heading on route entry; the blurred content is unreachable by
   Tab and by screen readers (`inert` + `aria-hidden`); the card's buttons meet the 36-38px heights drawn and
   WCAG AA contrast on every pack accent (designer verifies the 9 accents; any failing accent gets a darker
   token, §5).
7. Create surfaces (CreateWizard type cards, quick-create menu, palette quick actions) consult the same resolver;
   Playwright proves choosing a locked type never reaches a form.
8. Realtime: P4/P5/P6/P8 mutations emit `entity.updated {kind:'entitlements'}` on the tenant channel; the web
   client invalidates `['entitlements']` on it (04 §7 targeted invalidation).

Web: hook, sidebar, `LockedRoute`, overlay (admin + non-admin variants), create-surface locks. Mobile: no screen
(nothing mobile uses is gated); the endpoint is available to it but unused this sprint. Shared: route, DTO,
resolver.

Backend: route `GET /v1/entitlements` (authenticated, no capability); realtime topic `entitlements`; no migration
beyond P1; no audit (read).

### P3 — Server-side enforcement: write gate (402), analytics read gate, AI gateway alignment

**Design:** none (API behaviour). Spec: 04 §5 (blur is presentation), 06 §3.1 (AI 402), 09 §1 (platform gate).
Principle: §0 "regulated-industry principle" and §3.0 D3.

UC
- Happy: `qe` not effective → `POST /v1/risks` returns **402 `ENTITLEMENT_REQUIRED`** with `details.packId='qe'`;
  `GET /v1/risks`, `GET /v1/risks/:id` and the board-pack export still succeed (the tenant's own records).
- Happy: `intelligence` not effective → `GET /v1/graph/*` and `GET /v1/predictions*` return 402 (derived
  analytics are the product, not the tenant's records, and carry no retention obligation); AI calls return 402
  exactly as today.
- Happy: `platform` not effective → creating/editing/connecting/testing a non-SMTP integration and creating/
  editing a report definition return 402; **disconnecting or deleting** an integration and deleting a report
  never do (reducing is always allowed); SMTP is never gated (09 §1).
- Happy: `supplier` not effective → supplier/PPAP/SCAR writes and partner `portal:respond` writes return 402;
  reads and exports succeed.
- Precedence: a caller without the capability gets 403 first (RBAC), then 402 (pack) — a viewer never learns the
  plan from a write they could not make anyway. A foreign-tenant id on a gated write returns 402 before the
  lookup, which reveals nothing about the id.
- System actors (jobs: SLA sweeps, notifications, predictive scoring for grandfathered tenants) are not gated;
  the predictive scoring job **skips** tenants without effective `intelligence` (no compute for unused output).
- Error: 402 envelope per 03 §4; web mutation hooks map 402 to a toast with "See plans" (admin) / "Request
  access" (others), never a generic error.

AC
1. A `@RequirePack(packId)` decorator evaluated **inside the lifecycle interceptor** after `@RequireCapability`,
   within the tenant-scoped transaction, reading P1's resolver once per request (memoised on the request
   context). It is the only mechanism; no service contains its own entitlement `if`.
2. Applied, per controller, to every **write** route of: `risk`, `fmea`, `spc` (measurement ingest), `msa`, `ecn`
   (qe); `suppliers`, `ppap`, `scar`, portal respond routes (supplier); `reports` POST/PUT, `integrations`
   POST/PUT/connect/webhook/test for non-SMTP kinds (platform). Applied to **read** routes of `graph` and
   `predictions` (intelligence). The architect produces the exhaustive route list from the controllers as part of
   the slice plan; a test enumerates every route of these controllers and fails if a write route lacks the
   decorator (a mutation-style guard, like the placeholder-ledger test).
3. The AI gateway's entitlement read (`gateway.service.ts:218`) is replaced by P1's resolver, so an unexpired
   `intelligence` trial passes and an expired one fails closed; existing AI tests stay green plus two new cases
   (trial active → allowed; trial expired → 402 `ENTITLEMENT_REQUIRED`, `block_reason='entitlement'`).
4. Tests per pack: 402 on a representative write, 200 on read/export of the same module, 403-before-402 for a
   role lacking the capability, 402 disappears in the same request after the pack becomes effective (no cache
   staleness across requests), and SMTP integration writes never 402.
5. Existing integration suites for gated modules (risk, msa, fmea, spc, ecn, suppliers, ppap, scar, graph,
   predictions, reports, integrations, portal) seed their tenants with the needed packs via one fixture helper
   (`grantPacks(tenantId, packs)`), so the suite measures module behaviour, not the default plan. This is
   required work, not optional: without it those suites fail the moment P3 lands.

Web: 402 handling in the shared mutation error mapper (toast + CTA per role). Mobile: the NCR AI draft already
maps 402 → "AI unavailable"; verified unchanged against an expired trial (X1). Shared: decorator, resolver use,
error details shape `{ packId }` added to the `ENTITLEMENT_REQUIRED` envelope (additive).

Backend: no migration; interceptor + decorator; no audit (a refused write writes nothing, matching RBAC 403
precedent); tenancy: resolver runs in the tenant transaction.

### P4 — Plans & add-ons page (`/pricing`) and admin plan changes

**Design:** `pricing.jsx:5-231` in full (binding), `addons.jsx` catalog values. New states (§5): request-mode
buttons and pending chips, downgrade confirm, non-self-service header note, loading/error.

UC
- Happy (self-service mode, admin): the page shows the 3 tier cards (the derived current tier outlined in accent
  with "Current plan" disabled), the guardrail callout, the 6 pack cards (active ones outlined in pack accent with
  "Active" chip and "Added to plan"), the 3 à-la-carte rows, and the sticky estimate with real org counts
  ("<workspace name> · N plants · M members"). "Add to plan" on a pack activates it immediately (04 §5 "toggling
  updates instantly"); the card, estimate, sidebar and any open overlay update together. "Apply bundle" on Core
  or Professional sets exactly that bundle's packs. "Remove" on an à-la-carte row deactivates it.
- Happy (request mode, admin): the same buttons create **plan requests** to Kaenal sales instead of changing
  entitlements (P6); the card shows a "Requested" chip and the button becomes "Requested" (disabled) with a
  "Withdraw request" link. [D1]
- Downgrade (either mode): an action that would make a currently-effective pack ineffective (Remove, or Apply
  bundle to a smaller tier) first opens a confirm dialog listing the modules that become read-only and the
  tenant's open records in them (e.g. "3 open ECNs, 2 draft MSA studies will become read-only. Your records stay
  readable and exportable."). Cancel changes nothing. (Nielsen #5 error prevention; D3.)
- "Talk to sales" (Enterprise card) → an `enterprise_inquiry` request (P6). "Contact sales" (header) → a
  `contact_sales` request with an optional note (P6). "Update subscription" → a `confirm_subscription` request
  carrying the current composition and estimate (P6). "Download quote" → P7. "Back to dashboard" → `/dashboard`.
- Empty: a tenant with no active packs → Core is the current tier, "0 active", every pack shows "Add to plan".
- Error: a toggle fails → the optimistic change reverts with an error toast (requestId); 409 `STALE_WRITE` (another
  admin changed the plan) → the S1-5 reload-and-reapply dialog.
- Permission: `/pricing` is admin-only in role curation today (`PLATFORM_ROOTS`) and stays so; the mutation
  routes require `billing:manage`; a non-admin deep link renders the existing "not available for your role"
  in-shell state (no mutation controls).
- Offline: every mutating button disabled with the offline tooltip; the page renders from cache.
- Trial interplay: a pack on trial shows the P5 trial chip and "Add to plan" (converting the trial to active in
  self-service mode; a request in request mode).

AC
1. `/pricing` replaces the `planned:pricing` placeholder; ledger entry removed; the page reproduces every element,
   size, colour and copy string of `pricing.jsx` (web-fidelity review side-by-side), with prices and includes
   read from P1's catalog, never hard-coded in the component.
2. Estimate: `GET /v1/entitlements/org-profile` (`billing:manage`) returns `{ plants, activeSuppliers,
   inspectors, members, extraStandards, workspaceName }` computed server-side (counts only, no names;
   `extraStandards` = frameworks in the O1 profile other than IATF 16949 and ISO 9001, per `addons.jsx:120`'s
   "beyond IATF 16949 & ISO 9001"). The summary lines/total come from `estimateMonthly` (P1); the "*" footnote and
   "Annual billing · taxes calculated at checkout" line render as drawn. **The estimate is labelled an estimate
   and is never an invoice or charge** (Q6).
3. `PUT /v1/entitlements/packs/:packId` `{ active: boolean, lockVersion }` (`billing:manage`, `@RequirePack`
   n/a): allowed only when `selfService` is true, else 403 `FORBIDDEN` with `details.reason='plan_managed_by_
   contract'` (the UI never offers it in that mode). Writes `source='self_service'`, `activated_at` on activation,
   and one `entitlement_changed` audit event `{before:{active}, after:{active, source}}` in the same transaction
   (rule 3). Idempotent (setting the current value is a 200 no-op with no audit event).
4. `POST /v1/entitlements/apply-bundle` `{ tier: 'core'|'pro', expectedPacks: Record<PackId, boolean> }`
   (`billing:manage`, self-service only): if the tenant's current active set ≠ `expectedPacks` → 409
   `STALE_WRITE` with the current set; else sets all 9 rows to the bundle in one transaction, one
   `entitlement_changed` event per changed row with `source='bundle'`. `ent` is rejected 422 (Enterprise is
   "Talk to sales", never self-applied).
5. The downgrade confirm's counts come from `GET /v1/entitlements/downgrade-impact?packs=qe,supplier`
   (`billing:manage`) → per module `{ moduleId, openCount }` using each module's own "open" definition (risk
   status ≠ closed, ECN stage not terminal, MSA draft, SCAR open, PPAP not approved/rejected, etc. — the
   architect lists them per module). Counts only.
6. Header note in request mode (§5 D-S2) explains that plan changes go through Kaenal sales. [D1]
7. Playwright: self-service add → overlay lifts on `/risk` without reload; remove with confirm → overlay returns;
   apply Professional → tier card flips to "Current plan"; request mode → button shows "Requested".

Web: page + dialogs + hooks. Mobile: none (no design; admin plan management is a web task). Shared: routes,
DTOs, `estimateMonthly`.

Backend: routes above; service `EntitlementsService`; audit `entitlement_changed`; RBAC `billing:manage`
(existing); tenancy: RLS, per-row `lock_version` + `expectedPacks` snapshot for bundle concurrency; realtime
event (P2 AC8).

### P5 — Real 14-day trials

**Design:** `addons.jsx:260-262` "Start 14-day trial". New states (§5): trial chip with days left on pack
cards/overlay, trial-used state, T-3 and expiry notifications.

UC
- Happy (admin): on a locked module's overlay or a pack card, "Start 14-day trial" → the pack becomes effective
  immediately for 14 days; overlay lifts; pack card shows "Trial · 14 days left"; the sidebar lock disappears.
- Happy: 3 days before expiry every admin gets an in-app + email notification "Your Quality Engineering trial
  ends on <date>" linking to `/pricing?pack=qe` (card highlighted). At expiry, the pack is no longer effective
  (resolver, no job needed); the daily job sends "Your … trial has ended — your records stay readable" and writes
  a `system` audit event.
- Convert: during a trial, "Add to plan" makes it permanently active (self-service) or requests it (request
  mode); the trial row stays as the record that the trial was used.
- Error: a second trial of the same pack → 409 `CONFLICT` "Trial already used for this pack" (button replaced by
  "Trial used" state, never offered again); a trial on an already-active pack → 422.
- Permission: admin only (`billing:manage`); non-admins see "Request access" (P2), never "Start trial".
- Offline: button disabled.
- Trials are available in **both** self-service and request mode (they are how a request-mode tenant evaluates a
  pack before asking sales; R6). [D4]

AC
1. `POST /v1/entitlements/trials` `{ packId }` (`billing:manage`, `Idempotency-Key`) inserts `entitlement_trials`
   (`ends_at = started_at + interval '14 days'`); PK violation → 409; `active=true` pack → 422; `security` and
   `support` packs are not trialable (no in-product effect; custom-priced) → 422 with the reason. Audit
   `entitlement_changed` `{after:{trial:{endsAt}}}`.
2. Daily job `entitlement-trials` (existing BullMQ cadence pattern): notifies at T-3 days (dedupe key
   `trial_ending:<tenant>:<pack>:<ends_at>`) and after expiry (`trial_ended:<…>`), and writes one `system`
   `entitlement_changed` event `{before:{effective:true}, after:{effective:false, reason:'trial_expired'}}` per
   expired trial, exactly once (idempotent on re-run). It never updates `entitlements`.
3. Notification kinds `trial_ending`, `trial_ended` added to the enum, the preferences matrix defaults (in-app +
   email on for admins), and the web notification centre click-through (`/pricing?pack=`).
4. Tests: boundary at exactly `ends_at` (not effective), job idempotence, 409/422 cases, the AI gateway honouring
   an active `intelligence` trial (P3 AC3), and `?pack=` highlight in Playwright.

Web: trial button/chips/states. Mobile: notification list renders the two kinds and hands off to web (X1).
Shared: route, job, notification kinds.

Backend: route; job processor `entitlement-trials.ts`; audit `entitlement_changed`; RBAC `billing:manage`;
tenancy: RLS on `entitlement_trials`, job runs per tenant through the existing tenant-iterating job pattern.

### P6 — Plan requests and the sales hand-off (member → admin, admin → Kaenal sales)

**Design:** `pricing.jsx:125-126` (Contact sales), `:157` (Talk to sales), `:217` (Update subscription);
`addons.jsx:256-262` in request mode. New states (§5): request dialog (optional note), pending chip + withdraw,
non-admin Request access, admin notification row, "your request was fulfilled/declined".

UC
- Happy (member → admin, R5): a viewer on a locked `/fmea` taps "Request access" → a `member_access` request for
  `qe`; every admin gets an in-app notification "Priya requested Quality Engineering (FMEA workbench)" linking to
  `/pricing?pack=qe&request=<id>`; the admin adds the pack (self-service) or forwards it (request mode:
  "Request from Kaenal" creates the sales request and links it); when the pack becomes effective, open
  `member_access` requests for it are auto-fulfilled and the requester is notified.
- Happy (admin → sales, request mode): "Add to plan"/"Remove"/"Apply bundle"/"Talk to sales"/"Contact sales"/
  "Update subscription" open a small dialog (what is being requested, optional note, Send). On Send: an
  `open` request is stored, Kaenal sales receives an email (outbox → `send-email`, to `SALES_NOTIFY_EMAIL`) with
  tenant name/slug, requester, kind, pack/tier, composition snapshot and estimate; the button shows "Requested".
- Fulfil/decline: Kaenal staff run `pnpm tenant-plan --slug acme --fulfil <id>` (applies the change and marks
  the request fulfilled) or `--decline <id> --reason "…"` (P8); the requesting admin is notified in-app + email.
- Withdraw: the requester (or any admin) withdraws an open request.
- Dedupe: one open request per (requester, kind, pack/tier); re-requesting returns the existing request (200),
  not a duplicate email.
- Error: email transport failure never loses the request (outbox retries); the UI shows "Requested" once the row
  is committed.
- Permission: `member_access` — any internal role (not partner), only for a gated pack; all other kinds —
  `billing:manage`. Listing requests — `billing:manage`.
- Offline: Send disabled.
- Self-service mode: "Talk to sales", "Contact sales" and "Update subscription" still create requests (they are
  inherently sales conversations); "Update subscription" sends the current composition for invoicing, which is
  how a self-service tenant's changes reach billing without a payment provider (true-up). [D1]

AC
1. Migration `0075`: `plan_requests` (`tenant_id`, `id`, `kind` CHECK in (`member_access`, `add_pack`,
   `remove_pack`, `apply_bundle`, `enterprise_inquiry`, `contact_sales`, `confirm_subscription`), `pack_id`
   (catalog CHECK, nullable), `tier` (nullable), `composition jsonb` (snapshot of effective packs + estimate at
   request time), `note text` (≤ 1,000 chars), `status` CHECK in (`open`, `fulfilled`, `declined`, `withdrawn`)
   DEFAULT `open`, `requested_by` composite member FK NOT NULL, `resolved_at`, `resolution_note`,
   `linked_request_id` (self composite FK, member→sales forwarding), `lock_version`, standard columns); partial
   unique index `(tenant_id, requested_by, kind, coalesce(pack_id,''), coalesce(tier,'')) WHERE status='open'`;
   forced RLS; leading-tenant index `(tenant_id, status, created_at desc)`.
2. Routes: `POST /v1/entitlements/requests` (`Idempotency-Key`; capability per kind as above; `member_access`
   for a non-gated pack → 422), `GET /v1/entitlements/requests?status=` (cursor, `billing:manage`), `POST
   /v1/entitlements/requests/:id/withdraw` (requester or `billing:manage`; non-open → 409 `INVALID_TRANSITION`).
   Audit: `created` on insert, `status_changed` on withdraw/fulfil/decline/auto-fulfil.
3. Notifications `plan_request_created` (to admins, member requests only — admin→sales requests notify the other
   admins too, excluding the requester) and `plan_request_resolved` (to the requester). Email to Kaenal sales
   via the outbox in the same transaction as the insert (never on rollback). `SALES_NOTIFY_EMAIL` added to
   `.env.example`; when unset in dev the email is written to the dev mail sink like every other email.
4. Pricing page and overlay reflect open requests (chip + withdraw) from `GET …/requests?status=open` for admins
   and from `EntitlementsDto.myOpenRequests: PackId[]` (additive field) for non-admins, so the non-admin overlay
   shows "Requested" after a reload.
5. Tests: dedupe, capability per kind, auto-fulfil on activation (via toggle, trial is **not** fulfilment, CLI),
   outbox row committed atomically, withdraw state machine, cross-tenant id → 404.

Web: dialogs, chips, notification rows. Mobile: notification list renders the two kinds, tap hands off to web
(X1). Shared: table, routes, notification kinds, outbox email template.

Backend: migration 0075 (shared with P7/P9/O1); `PlanRequestsService`; audit `created`/`status_changed`; RBAC
per kind; tenancy: RLS, composite FKs; email via existing outbox.

### P7 — Download quote (PDF)

**Design:** `pricing.jsx:125` "Download quote" (prototype toasts `kaenal-quote.pdf`).

UC
- Happy (admin): "Download quote" → an export job renders a one-page PDF quote (workspace name, date, current
  effective packs and tier, the estimate lines and total exactly as the sticky summary shows them, the
  "estimate, not an invoice; annual billing; taxes calculated at checkout" disclaimers, quote reference) and the
  browser downloads `kaenal-quote-<slug>-<yyyymmdd>.pdf` through the existing exports flow.
- Error: job failure → the exports flow's existing failure toast with retry.
- Permission: `billing:manage`. Offline: disabled.

AC
1. `ExportResource` gains `plan_quote`; `exports_resource_check` widened in `0075`; `run-export.ts` gains the
   render branch using P1's `estimateMonthly` and P4's org-profile counts (one source of numbers, so the PDF can
   never disagree with the page).
2. `ExportsService` requires `billing:manage` for `plan_quote`; audit `exported` (existing).
3. Test: the PDF's total equals `estimateMonthly` for a fixture composition; non-admin → 403.

Web: button wired to the existing export hook. Mobile: none. Shared: enum + renderer.

### P8 — Operator plane: `pnpm tenant-plan` and provisioning defaults

**Design:** none; CLI (R8). User asked for "an admin UI to view/change a tenant's plan"; §3.0 D5 explains why the
operator surface is a CLI this sprint and what a staff console would additionally need.

UC
- Happy: `pnpm tenant-plan --slug acme --show` prints the tenant's packs (active/effective/source/trial), tier,
  self-service flag, contract fields, CSM fields and open requests.
- Happy: `--bundle pro --reason "Order form #1042"` sets the Professional bundle; `--pack qe=on --pack
  supplier=off --reason "…"` sets individual packs; `--self-service on|off --reason "…"`; `--contract-renews
  2027-04-01 --contract-value 184000 --currency USD --reason "…"`; `--csm-name "Anand Patel" --csm-email …
  --csm-booking-url … --csm-chat-url …`; `--requests` lists open requests; `--fulfil <id> [--reason]` applies the
  requested change and marks it fulfilled; `--decline <id> --reason "…"`; `--history` prints entitlement audit
  events.
- Error: missing `--reason` on any write → exit 1 before touching the DB; unknown slug/pack/tier → exit 1 with a
  clear message; a request id from another tenant → "not found".
- Dedicated (Model B) tenants: tenant-owned rows are written through the same db-router/secret-resolver the
  provisioning scripts use.
- Provisioning: `pnpm provision-tenant … --bundle core|pro|ent` seeds the bundle (`source='operator'`) and the
  `control.tenant_plans` row; `--from-request <workspaceRequestId>` (O3) additionally pre-fills the O1 profile
  (industry, plant size, frameworks) and marks the request `provisioned`. Re-running stays idempotent.

AC
1. Migration `0074_control_plane_plans.sql`: `control.tenant_plans` (`tenant_id` PK FK → `control.tenants`,
   `self_service boolean NOT NULL DEFAULT false` [D1], `contract_renews_on date`, `contract_value_annual
   numeric(12,2)`, `contract_currency text DEFAULT 'USD'`, `csm_name`, `csm_email`, `csm_booking_url`,
   `csm_chat_url` (https-only CHECK on both URLs), `updated_at`, `updated_reason text`). `GRANT SELECT` to
   `kaenal_app` only (the API can read, never write — the same boundary as `control.tenants`); writes only by
   the migrator role (the CLI). Not tenant-owned → outside the RLS lint by design; its access is covered by an
   explicit test like `control-identity.test.ts` (app role cannot INSERT/UPDATE/DELETE).
2. Every tenant-owned write the CLI makes (entitlements, plan-request status) writes an `audit_events` row with
   `actor_kind='support'` and the given `reason` in the same transaction (the existing CHECK makes a missing
   reason impossible at the DB level too), and publishes the realtime `entitlements` event (via the outbox) so
   open browsers update.
3. `package.json` script `tenant-plan`; `--help` documents every flag; CLAUDE.md "Commands" gains the line.
4. Tests (script-level, against the test DB): each flag's effect, reason enforcement, idempotent re-run,
   fulfil applies exactly the requested change, dedicated-tenant routing path unit-tested with the existing
   router fake.

Web/Mobile: none. Shared: the CLI imports P1's catalog/tiers (one source of truth).

### P9 — Billing & plan settings section (plan-only, Q6)

**Design:** `settings.jsx:848-898` `Billing`. Q6/ROADMAP: "shows plan + entitlements only, and anything needing
a payment provider is hidden." New state (§5): no-contract variant.

UC
- Happy (admin): Settings → System → Billing & plan shows the "Current plan" card as drawn (gradient banner,
  award icon, tier name, the tier's blurb/feature line from the catalog, chips "Renews <date>" and "Annual
  billing" when the operator recorded a contract, and the annual value + "per year" when recorded) and the
  Billing email and Tax ID rows, editable with an explicit Save (04 §5 "no auto-save for admin-level settings").
- No contract recorded: the banner shows the tier and its catalog price line ("$4,050 /mo + units") instead of
  an annual contract value, and no renewal chip (§5 D-S6).
- Tier `null` (custom composition): banner shows "Custom plan" and the active pack names.
- Hidden per Q6: the **Payment method** row and the **Invoices** card are not rendered and are listed in
  `apps/web/src/config/excluded.md` with the reason ("requires a payment provider; ROADMAP Q6"). A "Manage plan"
  link to `/pricing` is added under the banner (§5 D-S6, the only new element).
- Error: save fails → inline error + toast; 409 → reload-and-reapply.
- Permission: section visible to `billing:manage` holders; others do not see the entry (existing settings-rail
  permission pattern).
- Offline: Save disabled.

AC
1. `settings:billing` ledger entry removed; the section renders per the design minus the two Q6-hidden elements.
2. `GET /v1/billing/plan` (`billing:manage`) → `{ tier, tierName, packs, contract: { renewsOn, annualValue,
   currency } | null }` (reads `control.tenant_plans` + resolver). `GET/PUT /v1/settings/billing` (`billing:
   manage`, `lockVersion`) over `tenant_settings` namespace `billing` (`{ billingEmail: email|null, taxId: string ≤
   32 | null }`, Zod in `packages/types`); audit `settings_changed` (changed fields only, rule 3).
3. Namespace CHECK widened in `0075` (`billing`, and O1's `profile`, `onboarding`).

Web: section. Mobile: none (no design; mobile settings has no billing). Shared: routes, schema.

### Increment B — Industry-aware onboarding

### O1 — Workspace profile: industry, frameworks, size, focus modules, onboarding state (Shared foundation)

**Design:** the fields drawn in `auth.jsx:197-209` (request form) and `settings.jsx:454-467` (Organization →
Identity): Industry select, Plant size select, Compliance-frameworks chips. `adoption.jsx:10` "Confirm company
details — Name, industry, compliance frameworks".

UC
- Happy: the admin's answers from the first-run flow (O4) are stored once per tenant and read by the suggestion
  engine (O2), the checklist (O5), the estimate's "extra standards" count (P4) and, later, Sprint 08's
  Organization section (which will render and edit the same document; no second store).
- Open-ended industry: the industry is a suggested key **or** `other` with a free-text label (≤ 80 chars); an
  unknown industry never blocks anything and simply yields framework-only suggestions (user decision 2).
- Frameworks: any subset of the catalog plus up to 5 custom labels (≤ 60 chars each), or the explicit
  "Not certified yet" option (mutually exclusive with the others).
- Edit later: changing industry/frameworks never resets checklist progress (progress is derived from real data,
  O5) and never changes entitlements.
- Error: invalid payload → 422 with Zod issues; concurrent edits → 409 `STALE_WRITE` → reload-and-reapply.
- Permission: read — every authenticated internal member (industry may inform shell copy later; it is not
  sensitive); write — `settings:manage` (admin + manager, the same capability as branding).
- Offline: writes disabled.

AC
1. `packages/types`: `IndustryKey` = `automotive | aerospace_defense | medical_devices | electronics |
   pharmaceutical | food_beverage | general_manufacturing | other` (the union of the design's list and the brief's
   list; §7 Q-S2 [USER]); `FrameworkKey` = `iatf_16949 | iso_9001 | iso_13485 | as9100 | iso_14001 | iso_45001 |
   fda_qmsr | fda_part_11 | haccp` (the design's 6 + ISO 13485 and FDA QMSR from the brief; display labels per the
   design, e.g. "FDA 21 CFR Part 11"); `PlantSizeBand` = the design's 4 bands `50-200 | 200-1000 | 1000-5000 |
   5000+` plus `unspecified`; `WorkspaceProfile` = `{ industry: { key, label? } | null, frameworks: { keys:
   FrameworkKey[], custom: string[], notCertifiedYet: boolean }, plantSize, focusModules: ModuleId[], answeredBy,
   answeredAt }`; `OnboardingState` = `{ status: not_started | in_progress | completed | dismissed, startedAt,
   completedAt, dismissedAt, ownerId }`.
2. Storage: `tenant_settings` namespaces `profile` and `onboarding` (CHECK widened in `0075`), reusing its
   `lock_version`, composite `updated_by` FK and forced RLS — no new table (0025's stated purpose).
3. Routes: `GET /v1/settings/workspace-profile` (any internal member), `PUT /v1/settings/workspace-profile`
   (`settings:manage`, `lockVersion`); audit `settings_changed` with changed fields only.
4. `0075` backfill: every existing tenant gets `onboarding.status='dismissed'` (no forced first-run for existing
   workspaces, incl. the demo — protects rule 12's sign-in landing) and an empty profile. [§7 Q-S3 USER]
   New tenants start `not_started`, or with the profile pre-filled when provisioned `--from-request` (P8/O3).

Web: consumed by O4/O5. Mobile: none (additive types). Shared: types, routes, namespace widening.

### O2 — Module-suggestion engine (`packages/core`, pure)

**Design:** none (logic). Pattern R1 (framework-first) + R2 (shape, never lock).

UC
- Happy: `suggestModules({ industry, frameworks, plantSize })` returns **every** `ModuleId` exactly once, each with
  a tier (`essential` | `recommended` | `optional`), a score, and machine-readable reasons (`framework` +
  clause, `industry`, `core_loop`, `size`). The UI renders the reasons as copy; nothing is ever omitted from the
  list (user decision 2: suggest and highlight, never hide).
- Happy: `suggestFrameworks(industry)` returns the frameworks to **pre-select** in O4 step 2 (automotive →
  IATF 16949 + ISO 9001; aerospace_defense → AS9100; medical_devices → ISO 13485 [+ FDA QMSR offered, not
  pre-selected]; pharmaceutical → FDA 21 CFR Part 11 + ISO 9001; food_beverage → HACCP + ISO 9001;
  electronics and general_manufacturing → ISO 9001; other → none). The admin can change every one.
- Skipped / nothing answered: returns the ISO 9001 core-loop baseline (the sensible default for a skipped
  questionnaire, R2).
- Plan interplay: the engine knows nothing about plans; the UI overlays P1's `isModuleGated` to show a lock chip
  on a suggested module that is not in the plan. A suggestion is never removed because it is locked.

AC
1. `packages/core/src/onboarding/suggest.ts` exports `suggestModules`, `suggestFrameworks`,
   `defaultFocusModules(suggestions)` (= essential ∪ recommended), all pure, deterministic, no I/O, no `Date`.
2. The logic is **table-driven data** in `packages/core/src/onboarding/requirements.ts`, not branching code:
   (a) `FRAMEWORK_REQUIREMENTS: Record<FrameworkKey, { moduleId, clause, note }[]>` — a module named by a
   selected framework is `essential`, with that clause as its reason; (b) `INDUSTRY_PRIORS: Record<IndustryKey,
   Partial<Record<ModuleId, number>>>` — additive boosts that can lift a module to `recommended` but never to
   `essential` (only a framework obligation makes a module essential); (c) `CORE_LOOP` (inspections, ncr, capa,
   documents) always `essential` with reason `core_loop`; (d) size: band `50-200` demotes `optional`-scored
   analytics (graph, predictive) and caps `recommended` at the framework set; bands `1000-5000`/`5000+` lift
   `reports` and `predictive` to `recommended`. Ties break by catalog order.
3. The initial requirements table (indicative; every clause string is reviewed by a QMS subject-matter expert
   before it ships as user-visible copy — DoD item, §7 Q-S5):

   | Framework | Modules marked essential (clause) |
   |---|---|
   | IATF 16949:2016 | fmea (§8.3.5.2 PFMEA as process-design output), spc (§9.1.1.1), msa (§7.1.5.1.1), calibration (§7.1.5.2.1), training (§7.2.1-7.2.2), ppap + suppliers (§8.3.4.4, §8.4.2.4), scar (§8.4.2.5 supplier development), ecn (§8.5.6.1), risk (§6.1.2.1), complaints (§10.2.6), eight_d (§10.2.3), audits (§9.2.2), ncr (§8.7.1), capa (§10.2), documents (§7.5), inspections (§8.6) |
   | ISO 9001:2015 | documents (§7.5), training (§7.2), calibration (§7.1.5.2), audits (§9.2), ncr (§8.7), capa (§10.2), risk (§6.1), complaints (§9.1.2), suppliers (§8.4), ecn (§8.5.6), inspections (§8.6) |
   | ISO 13485:2016 | documents (§4.2.4), training (§6.2), calibration (§7.6), audits (§8.2.4), ncr (§8.3), capa (§8.5.2), complaints (§8.2.2), risk (§7.1, ISO 14971), ecn (§7.3.9), suppliers (§7.4), inspections (§8.2.6) |
   | FDA QMSR (21 CFR 820, incorporating ISO 13485 by reference from 2 Feb 2026) | same as ISO 13485 (alias entry, reason text names the QMSR) |
   | AS9100D | risk (§8.1.1 operational risk), ecn (§8.1.2 configuration management), suppliers (§8.4), audits (§9.2), calibration (§7.1.5.2), training (§7.2), ncr (§8.7), capa (§10.2), documents (§7.5), inspections (§8.6) |
   | FDA 21 CFR Part 11 | documents (§11.10 controls for closed systems), training (§11.10(i)), audits (§11.10(e) audit trails) |
   | HACCP | inspections (CCP monitoring), ncr + capa (corrective actions), calibration (verification), training, documents (records) |
   | ISO 14001 / ISO 45001 | audits (§9.2), documents (§7.5), capa (§10.2), training (§7.2), inspections (§9.1) |

   Industry priors (boosts only): automotive → fmea, spc, msa, ppap, suppliers, scar, eight_d, complaints, ecn;
   aerospace_defense → risk, ecn, audits, suppliers, calibration; medical_devices → complaints, capa, documents,
   training, risk, ecn; electronics → spc, suppliers, inspections, eight_d; pharmaceutical → documents,
   training, capa, complaints, audits; food_beverage → inspections, ncr, calibration, training;
   general_manufacturing → core loop only; other → none.
4. Unit tests: golden output per industry (8) and per framework (9); **coverage** (every `ModuleId` exactly once,
   for random inputs — property test); **monotonicity** (adding a framework never demotes a module); **no hiding**
   (length always equals `ModuleId` count); determinism; baseline on empty input; the IATF row makes FMEA/SPC/
   MSA/PPAP essential (the question §3.0 D2 depends on).

Web: consumed by O4 (and O5's module tasks). Mobile: none. Shared: `packages/core` only (rule 5).

### O3 — "Request a workspace" (public intake) and provision-from-request

**Design:** `auth.jsx:117-119` link, `:190-213` form (binding). New state (§5): submitted confirmation, error
states, honeypot (invisible).

UC
- Happy: on the sign-in workspace stage, "Don't have a workspace? Request access →" opens the form (Back link,
  "Request a workspace", subtitle, Company name, Work email, Industry, Plant size, Compliance frameworks chips,
  Request access). Submit → confirmation state ("Thanks — we'll be in touch within one business day" or as
  designed), Kaenal sales receives an email, and the request is stored for provisioning.
- Provision: staff run `pnpm provision-tenant --slug … --name … --bundle … --from-request <id>`; the new tenant's
  profile is pre-filled, so its first admin **confirms** rather than re-answers (O4).
- Error: invalid email / missing company → inline field errors (no submit); server 429 (rate limit) → "Too many
  requests, try again in a few minutes"; server error → retry message. The response is always 202 with no
  indication of whether that email/company already requested (no enumeration).
- Abuse: honeypot field, per-IP rate limit (Redis `RateLimiter`, e.g. 5/hour), max field lengths, no HTML.
- Permission: public (`@Public`, no tenant, no session). Offline: submit disabled with a message.
- Mobile: `m-auth.jsx` has no request stage; the mobile sign-in is unchanged (§5 notes the gap; not built on
  mobile without a design).

AC
1. `0074` adds `control.workspace_requests` (`id`, `company_name` ≤ 120, `work_email citext` ≤ 254, `industry`
   (IndustryKey), `industry_label`, `plant_size` (band), `frameworks text[]` (FrameworkKey subset), `status`
   CHECK in (`new`, `provisioned`, `declined`, `spam`), `provisioned_tenant_id` FK nullable, `created_at`,
   `request_ip_hash` (salted hash, never the raw IP)). `GRANT INSERT` only to the API's public path role — the
   API can add a request but can never read, list or update them (enumeration-proof by grant); the migrator-role
   CLI reads them. Explicit grant test.
2. `POST /v1/public/workspace-requests` (`@Public`): Zod body from `packages/types`; honeypot non-empty → 202
   and discard; rate limit → 429 `RATE_LIMITED` with `Retry-After`; success → insert + sales email via the
   `send-email` job in one transaction → 202. No PII in logs (email redacted, per CLAUDE.md "never log PII").
3. `pnpm tenant-plan --workspace-requests` lists new requests; `provision-tenant --from-request <id>` pre-fills the
   O1 profile and marks the request `provisioned` with the tenant id (idempotent).
4. Web: the `request` stage added to `sign-in-form.tsx`'s stage machine and the link added to the workspace stage,
   pixel-matched to `auth.jsx`; the auth screens' existing sign-in flow is untouched and **sign-in is re-proved
   end to end (201)** after the change (rule 12).
5. Tests: 202 happy, honeypot, 429 after the limit, 422 on invalid body, app role cannot SELECT
   `control.workspace_requests`, no raw IP stored.

Web: sign-in stage + link + confirmation. Mobile: unaffected (no design). Shared: route, types, control table.

### O4 — First-run setup flow (NEW DESIGN required)

**Design:** **no jsx exists**; the UI Lead Designer designs it in the existing visual language (§5 D-S1), reusing
the Industry/Plant-size/Frameworks controls exactly as drawn in `auth.jsx`/`settings.jsx`. Patterns R1, R2.

UC
- Trigger: a `settings:manage` holder signs in (web) to a tenant whose onboarding status is `not_started` →
  redirected once to `/onboarding` (a full-page flow inside the authenticated app, not a modal). Members without
  `settings:manage` are never redirected. Mobile sign-in is never redirected or blocked.
- Step 1 — Industry: the suggested list (O1) as selectable cards or a select, "Other" reveals a free-text label.
  Pre-filled from the workspace request when provisioned from one.
- Step 2 — Compliance frameworks: chips, pre-selected by `suggestFrameworks(industry)` (visibly marked "suggested
  for <industry>"), editable, "+ Add another" (custom label), and "Not certified yet".
- Step 3 — Size: the design's plant-size bands (+ "Prefer not to say"). One sentence explains why it is asked
  (it tunes how lean the starting set is). [§7 Q-S2 USER — whether to ask at all]
- Step 4 — Recommended modules: `suggestModules(...)` grouped Essential / Recommended / Optional; each row has
  the module icon/name, the top reason as copy (e.g. "Required by IATF 16949 §7.1.5.1.1"), a checkbox
  pre-checked per `defaultFocusModules`, and a lock chip ("Not in your plan — try it free for 14 days from Plans &
  add-ons") when P1 says the module is gated. Unchecking never hides a module anywhere; the copy says so ("Every
  module stays available from the sidebar — this just shapes your setup checklist").
- Finish: saves the profile (O1), sets onboarding `in_progress` (`startedAt=now`, `ownerId`=the admin), lands on
  `/settings/onboarding` (O5).
- Progress & navigation: a step indicator ("Step 2 of 4"), Back/Next, "Skip for now" on every step (saves what has
  been answered so far), and "Skip setup" (whole flow) → onboarding `dismissed`, lands on `/dashboard`; defaults
  apply (O2 baseline). The flow is re-enterable any time from the checklist's "Confirm company details" task,
  pre-filled, returning to the checklist on finish.
- Error: save fails → inline error on the step with retry; answers are kept in component state (nothing typed is
  lost); 409 (another admin finished first) → "Setup was just completed by <name>" with "View checklist".
- Offline: Next/Finish disabled with the offline banner; answers kept.
- A11y: each step is a labelled `fieldset`; focus moves to the step heading on step change; chips are real
  checkboxes; the flow works at 375px width.

AC
1. `/onboarding` route with the 4 steps and states above, built to the approved D-S1 boards; every string
   i18n-keyed (ROADMAP §8 rule 4).
2. The redirect lives in the authenticated app layout, fires only when `GET /v1/onboarding` says `status =
   not_started` and the caller holds `settings:manage`, and only once per session; it never runs on `(auth)`
   routes (sign-in untouched, rule 12).
3. `POST /v1/onboarding/start` (`settings:manage`; sets `in_progress`, `startedAt`, `ownerId`; idempotent: a
   second call when already started returns the current state), `POST /v1/onboarding/dismiss`, `POST
   /v1/onboarding/resume` (dismissed → in_progress, keeps the original `startedAt` if any). Audit
   `settings_changed` (namespace `onboarding`).
4. Suggestions and pre-selections are computed by calling O2 in the browser (pure shared code), never
   duplicated in components.
5. Playwright: fresh tenant admin → redirected → completes 4 steps → lands on checklist with module tasks for the
   chosen modules; skip path → dashboard, no redirect on next sign-in; manager of the same tenant after
   completion → no redirect; viewer → never redirected.

Web: the flow. Mobile: none (web-admin task; never blocks mobile). Shared: O1/O2 + onboarding routes.

### O5 — Onboarding checklist (`OnboardingWizard`) with self-completing tasks

**Design:** `adoption.jsx:7-139` (binding) as the `onboarding` section of Settings → Adoption
(`settings.jsx:62,145`). Pattern R3. Named deviations (§5 D-S5): demo tasks for features that do not exist are
not shown; CSM and "Helpful right now" content is real data.

UC
- Happy: `/settings/onboarding` shows the header (Welcome to Kaenal, Skip onboarding, Schedule kickoff with
  CSM), the hero (Day N of 7 since `startedAt`; "You're X% of the way to first inspection"; "k tasks done · m to
  go"; EST TIME LEFT = sum of remaining task estimates; progress bar), the Setup checklist, the Your CSM card and
  the Helpful right now card.
- Tasks (catalog in `packages/core/src/onboarding/tasks.ts`, completion computed **server-side from real data**):
  base tasks for every tenant — *Confirm company details* (done when the O4 flow has been finished; Start →
  `/onboarding`), *Invite your team* (progress = accepted/total invitations; done when at least one invited member
  is active; Continue → `/settings/members`), *Set up inspection templates* (done when a member has published a
  template, not counting the seeded example; → `/inspections/templates`), *Run a pilot inspection* (done when an
  inspection is completed; → `/inspections`); plus one task per **focus module** that has a real destination
  (e.g. calibration → *Register your first instrument*, training → *Define your competency matrix*, fmea → *Start a
  PFMEA*, spc → *Start monitoring a characteristic*, msa → *Run a Gauge R&R study*, risk → *Log your first risk*,
  suppliers → *Add your suppliers*, ppap → *Open a PPAP submission*, complaints → *Log a customer complaint*,
  ecn → *Raise an engineering change*, audits → *Schedule an internal audit*, documents → *Upload your quality
  manual*). A task for a gated module shows the lock chip and its Start leads to the module (which shows the P2
  overlay) — consistent, never a dead end.
- Done rows show DONE BY / the member who did the qualifying action / relative time, derived from the first
  qualifying audit event; pending rows show the drawn progress bar where a ratio exists, the estimate, and
  Start/Continue.
- Your CSM: name, and Book 30 min (booking URL, new tab), Slack message (chat URL), Email (`mailto:`) — each button
  rendered only when the operator recorded that field (P8). No CSM recorded → the card shows the §5 D-S5 empty
  state (e.g. "Kaenal support" + Email support via `SUPPORT_EMAIL`). "Schedule kickoff with CSM" (header) is
  rendered only when a booking URL exists.
- Helpful right now: up to 4 **in-product** destinations ranked for the tenant's industry from a catalog in
  `packages/core` (e.g. automotive: PPAP submissions, FMEA workbench, Inspection templates, Members & roles) —
  no external articles or video tours until Sprint 12's knowledge base / tours exist.
- Completion: when every task is done, status → `completed` (server, on read) and the page shows the §5 completed
  state; the section stays available.
- Skip onboarding: confirm → `dismissed` → `/dashboard`; the section then shows a "Resume setup" state (§5) with
  the checklist still visible and live.
- Not started (e.g. an existing tenant or a skipped flow): the page shows the checklist with *Confirm company
  details* first and a primary "Start setup" → `/onboarding`.
- Error: fetch fails → inline retry card with requestId; Offline: Start/Continue still navigate (they are links),
  Skip/Resume disabled.
- Permission: `settings:manage`; others don't see the rail entry (existing pattern); a direct link renders the
  existing "not available for your role" state.

AC
1. `settings:onboarding` ledger entry removed; the section renders every designed element with real data;
   deviations limited to §5 D-S5.
2. `GET /v1/onboarding` (`settings:manage`) → `{ state, profileAnswered, tasks: [{ id, moduleId?, title,
   description, status: done|pending, progress?: {done,total}, estimateMinutes, href, gated, doneBy?:{id,name},
   doneAt? }], csm: {...} | null, helpful: [{ title, subtitle, href }] }`. Each task's completion query is a
   tenant-scoped `EXISTS`/count on indexed columns (no full scans; the architect confirms the index for each),
   evaluated in one request.
3. Task and helpful catalogs are data in `packages/core`, unit-tested: only tasks whose `href` is a real, built
   route are in the catalog (a test cross-checks every `href` against the web route list, failing on a dead
   link); focus-module tasks appear only for focus modules.
4. The designed demo tasks with no real feature — *Connect SSO* (deferred, ROADMAP Q5), *Connect SAP S/4HANA* (09
   says no point connectors), *IATF audit readiness scan* (no such feature), *Add plants & areas* (the Sites
   settings screen is Sprint 08) — are **not** rendered and are recorded in §6/§7, with *Add plants & areas*
   scheduled to join the catalog when Sprint 08 ships Sites.
5. Playwright: register an instrument in a tenant with calibration as a focus module → the checklist task flips
   to done with the right DONE BY on reload; skip → resume round trip.

Web: section. Mobile: none (no design; checklist is an admin web task). Shared: route, catalogs.

### X1 — Cross-cutting wiring

AC
1. **RBAC:** no new capability. `billing:manage` (admin, existing) gates plan changes, trials, requests other than
   `member_access`, org-profile, downgrade-impact, quote, billing settings; `settings:manage` gates the profile
   write and onboarding; `member_access` requests need any internal role. The web capability list from `GET
   /v1/me` drives every hidden control (04 §6).
2. **Placeholder ledger:** remove `planned:pricing`, `settings:billing`, `settings:onboarding`; renumber every
   remaining entry to the new sprint numbers from ROADMAP §3 (the ledger test keys on ids, the numbers must still
   be truthful).
3. **`excluded.md`:** add Billing → Payment method and Invoices (Q6), and the four non-existent demo onboarding
   tasks (O5 AC4).
4. **Audit log UI:** `entitlement_changed` (incl. `support` actor + reason, trials, expiry) and `plan_requests`
   events render readably in Settings → Audit log (actor "Kaenal support — <reason>" for operator changes).
5. **Mobile (small, real):** (a) `apps/mobile/src/app/(app)/audit.tsx` categorises `plan_request` entity events
   with the existing `settings` category (entitlement events already match); (b) the mobile notification list
   renders `trial_ending`, `trial_ended`, `plan_request_created`, `plan_request_resolved` with a sensible icon and
   hands off to the web `/pricing` via `lib/web-links.ts` (the existing manage-on-web pattern); (c) the NCR AI
   draft's existing 402 handling is re-verified against an expired `intelligence` trial; (d) `pnpm --filter
   @kaenal/mobile typecheck` and the mobile test suite stay green; `progress_mobile.md` gets a Sprint 07 entry.
6. **Seed:** `seed-demo.ts` gives `acme` the Enterprise bundle (every pack active, so every existing demo surface
   keeps working), a `control.tenant_plans` row with `self_service=true` and a demo CSM, onboarding `dismissed`,
   and a profile (automotive, IATF 16949 + ISO 9001). Browser verification of locks/trials/requests is done by
   toggling packs with `pnpm tenant-plan` and restoring the bundle afterwards; the demo login is re-verified
   (201) at the end (rule 12).
7. **Docs:** CLAUDE.md Commands gains `pnpm tenant-plan`; `.env.example` gains `SALES_NOTIFY_EMAIL`,
   `SUPPORT_EMAIL`; `apps/web/src/config/navigation.ts` unchanged (Plans & add-ons already exists).

---

## 3. Backend + commercial design — PROPOSED, NEEDS EXPLICIT USER SIGN-OFF

### 3.0 Five decisions with commercial weight

Each decision states the conflict, the options, the PO's recommendation and why. The stories are written for the
recommendation; any other choice changes only the ACs marked with that decision's tag.

**D1 — Who can turn a pack on: the customer's admin, or only Kaenal? (the gate's teeth)**
- *Conflict.* The jsx ("Add to plan … changes take effect immediately") and 04 §5 ("toggling in pricing updates
  instantly") let the tenant admin enable any pack instantly. 03 §3 makes entitlements an admin capability. But
  with **no payment provider** (Q6), instant self-enable means any admin can unlock every paid pack for free
  forever, so the gate would not support charging anyone — the exact problem this sprint exists to fix.
- *Options.* (a) **Self-service** everywhere, as drawn, and reconcile commercially by "true-up" (the customer's
  changes are audited and sent to sales for invoicing — the Atlassian/Microsoft-EA true-up model). (b) **Request
  mode** everywhere: the admin's Add/Remove/Apply become requests to Kaenal sales, fulfilled by staff; trials
  stay instant. (c) **Both, per tenant**: an operator-set `self_service` flag in the control plane (the tenant
  cannot change it) chooses (a) or (b) per customer.
- *Recommendation: (c), with new tenants defaulting to request mode* (`self_service=false`), and the demo tenant
  on self-service so the drawn instant behaviour is demonstrable. Why: it is the only option that is faithful to
  the design for customers Kaenal trusts (pilots, true-up contracts) *and* gives the plan real teeth for
  everyone else; it costs one boolean and one branch in the service; the request loop (R5) is how Figma,
  Atlassian and Slack run sales-assisted upgrades. **Deviation from 04 §5/jsx in request mode** (buttons create
  requests instead of toggling) — needs the user's approval.

**D2 — The pack map vs the "What always stays in Core" promise (a compliance-claim conflict inside the design)**
- *Conflict.* `pricing.jsx:168` promises: "Anything an IATF 16949 audit requires — Inspections, NCR, CAPA, 8D,
  Audits, Document control, Calibration and Training — is never gated … customers never feel a compliance
  obligation has been paywalled." But `addons.jsx` gates FMEA, SPC, MSA, Risk and ECN (Quality Engineering pack)
  and PPAP/SCAR/supplier monitoring (Supplier Network pack) — and IATF 16949 **requires** all of these (PFMEA
  §8.3.5.2, SPC §9.1.1.1, MSA §7.1.5.1.1, risk analysis §6.1.2.1, change control §8.5.6.1, PPAP §8.3.4.4,
  supplier monitoring §8.4.2.4; O2's table). An automotive customer on "Core — Everything IATF 16949 requires"
  would find the AIAG core tools locked. That is a false compliance claim, and the industry-aware onboarding would
  make it obvious in the customer's first hour (O4 marks those modules "Required by IATF 16949").
- *Options.* (a) **Keep the drawn pack map; correct the callout and Core tier copy** so they claim only what Core
  contains (e.g. "the ISO 9001 baseline"; "IATF core tools are in Quality Engineering + Supplier Network").
  (b) **Move the IATF core tools into Core** (FMEA, SPC, MSA, PPAP + the supplier record PPAP needs); the packs
  keep only depth beyond certification (e.g. risk register analytics, SCAR chargebacks, scorecards). (c) Keep
  both as drawn (not recommended: ships a false claim).
- *Recommendation: decide commercially; engineering is neutral.* The pack map is **data** in one file (P1 AC2),
  so (a) or (b) is a data edit plus copy. The PO's product view: (b) matches the design's *stated intent* and the
  primary market (IATF automotive suppliers), while (a) matches the design's *drawn mapping* and protects the QE
  pack's revenue. Either way (c) must not ship. **[USER decision required before build; §7 Q-C2]** Until
  answered, the stories assume (a) — the drawn map — with the callout text held for the user's wording.

**D3 — What a gate blocks: writes, never the customer's own records**
- *Conflict.* 04 §5 says a locked route "renders the real page blurred", which needs the page's data; a pure API
  gate would also hide records the customer is obliged to retain (IATF §7.5.3.2.1, ISO 13485 §4.2.5).
- *Recommendation.* Gated **record** modules (qe, supplier) block create/update/transition (402) but always allow
  read and export of existing records; **derived-analytics** modules (graph, predictive, AI) are gated on read
  too (they carry no retention obligation and are the pack's value); **reducing** actions (disconnect/delete an
  integration, delete a report definition, withdraw a request) are never gated; system jobs are never gated;
  downgrades warn with the count of open records that become read-only (P4). The blur is presentation, not
  security; the API is the boundary (P3). Needs the user's approval because it defines what a downgraded
  customer can still do, including that in-flight records (e.g. an open ECN) freeze until the pack returns
  (§7 Q-C5 asks whether "close-out" transitions should stay allowed).

**D4 — Trials: real, time-boxed, once per pack**
- *Conflict.* The prototype's "Start 14-day trial" just turns the pack on permanently.
- *Recommendation.* 14 days, once per pack per tenant (enforced by the table's primary key), admin-started,
  available in both modes, not offered for `security`/`support` (no in-product effect / custom-priced), T-3
  warning, auto-expiry by comparison (no job needed to lock), records readable after expiry (D3). Figma-style
  provisional access for *member* requests is **not** included (§7 Q-C6).

**D5 — The operator surface is an audited CLI this sprint, not a staff web console**
- *The brief asked for* "an admin UI to view/change a tenant's plan (likely a control-schema or cross-tenant admin
  capability)". *Verified:* no staff/operator identity, route, role or design exists in this codebase or the
  design bundle; the only cross-tenant administration is migrator-role scripts; the built "Cross-tenant
  analytics" is a current-tenant screen; `phases/README.md` puts platform-admin screens out of scope.
- *Recommendation.* `pnpm tenant-plan` (P8), in the provisioning-script tradition (R8), writing tenant rows as
  `actor_kind='support'` with a mandatory reason and control-plane rows with `updated_reason`. The customer-side
  "admin UI" is the tenant admin's `/pricing` + Billing & plan. A staff console would need a staff identity
  model outside tenant memberships, support-access auditing (07 "support-role access (with reason)"), network
  restriction and a design — its own sprint (§7 Q-S4).

### 3.1 Data model (migrations 0073-0075; 0076 reserved buffer)

| Migration | Object | Kind | Notes |
|---|---|---|---|
| 0073 | `entitlements` + `source`, `lock_version`, `updated_by` (composite member FK), `pack_id` CHECK | tenant, forced RLS (existing) | Backfill all 9 packs `grandfathered` for existing tenants (P1 AC5) |
| 0073 | `entitlement_trials` (PK `tenant_id, pack_id`) | tenant, forced RLS | Once-per-pack by PK; expiry by comparison |
| 0074 | `control.tenant_plans` | control plane | `self_service`, contract fields, CSM fields; app role SELECT only |
| 0074 | `control.workspace_requests` | control plane | Public intake; the API's public path may INSERT only (never SELECT). Which DB role serves `@Public` routes today (`kaenal_app`, or a `kaenal_public` pool per 02 §1) is confirmed by the architect; the grant is applied to that role only |
| 0075 | `plan_requests` | tenant, forced RLS | Partial unique open-request index; self composite FK for forwarding |
| 0075 | `tenant_settings` namespace CHECK + `billing`, `profile`, `onboarding` | tenant (existing) | Backfill onboarding `dismissed` for existing tenants |
| 0075 | `exports_resource_check` + `plan_quote` | tenant (existing) | Mirrors 0066/0070 widening |

No new audit action (existing `entitlement_changed`, `created`, `status_changed`, `settings_changed`, `exported`
cover every mutation). New notification kinds: `trial_ending`, `trial_ended`, `plan_request_created`,
`plan_request_resolved`.

### 3.2 Enforcement architecture

One resolver (`packages/core` `effectivePacks`) → read in the API by `@RequirePack` inside the lifecycle
interceptor (after RBAC, inside the tenant transaction), by the AI gateway, by the trials job, by the CLI; read
in the web through `GET /v1/entitlements` + `isModuleGated`. Cache: per request only (no cross-request cache, so
an unlock is visible on the very next request); the web invalidates on mutation and on the realtime
`entitlements` event. Fail-closed on resolver error everywhere (matches the AI gateway's existing order).

### 3.3 Commercial boundaries (what this sprint deliberately does not do, Q6)

No payment provider, card capture, invoices, tax calculation, dunning, proration or PCI scope. Prices are the
catalog's list prices used for an **estimate** and a **quote**; the contract value shown on Billing & plan is
whatever Kaenal staff recorded. Seat/plant limits ("Up to 500 members · 10 plants") are **not enforced** this
sprint (§7 Q-C7). All money movement stays outside the product; the product's job is to record what the customer
may use, what they asked for, and to hand that to sales.
