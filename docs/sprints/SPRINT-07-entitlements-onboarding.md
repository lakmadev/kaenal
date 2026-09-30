# SPRINT-07 — Plans & Entitlements + Industry-aware Onboarding

Author: Product Owner. Date: 2026-09-30. Part of the multi-sprint programme in `ROADMAP.md`, **pulled ahead of
the former Sprint 07 (Settings Workspace + Process), which becomes Sprint 08** (ROADMAP §0 decision Q10).
Governing rules: CLAUDE.md rules 0-12 and `SCRUM.md`. Design fidelity is a completion gate.
Builds on Sprints 01-06 (all merged). Migration range pre-assigned to this sprint: **0073-0077** ([AM1]: 0073 catalog,
0074 entitlements + trials, 0075 control plans + workspace requests, 0076 plan requests + settings namespaces +
exports, 0077 buffer). `SPRINT-07C-staff-console.md` owns **0078-0081**; Sprint 08 starts at **0082**.

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

**Amendment 1 — user decisions of 2026-09-30 (recorded by the PO the same day).** The user answered five of the
open items. They are recorded as **DECIDED** in §3.0 and every affected story, table and gate below is rewritten
to match (amended text is tagged **[AM1]**):

| # | User decision (2026-09-30) | Where it lands |
|---|---|---|
| U-D1 | **D1 confirmed as recommended**: hybrid self-service / request mode, operator-set `self_service` flag per tenant, new tenants default to request mode | §3.0 D1 (DECIDED); P4, P6, P8 |
| U-D2 | **D2: both proposed options rejected.** "Design the pack depending on the industry and not as a single source. Because one guy needs 4 modules but others need 8 modules." What is included free in Core now **varies by the compliance frameworks the tenant declares**; the free set is admin-editable **data** | §3.0 D2 (DECIDED, redesigned); new P0; P1-P4, O1-O4 |
| U-D3 | **Price book stays placeholder, but staff-editable** through the staff console, in the same data store as the pack catalog — never a file an engineer edits and redeploys | §3.0 D2/§3.1 (versioned price book); P0, P4, P7; console editor in 07C |
| U-D4 | **Industry (8) / framework (9) lists approved, but must be extensible** without a migration: admin-editable lookup tables, Zod validates "an active catalog value or a free-text fallback" | P0, O1-O3; console editor in 07C |
| U-D5 | **Build the real staff web console now**, not the audited-CLI-only interim plan | §3.0 D5 (DECIDED); **new sprint file `SPRINT-07C-staff-console.md`** (Increment C) |

**PO scope call: this sprint is split into two sprint files (Amendment 1).** With U-D5 the work grows from two
increments to three, and the third is a whole new authenticated surface (a staff identity outside tenant
memberships, a non-tenant-scoped session path through the lifecycle interceptor, a least-privilege support
database role, a new app). That increment has a different risk profile (auth and cross-tenant access), a
different reviewer set (security review is mandatory) and its own design gate. Folding it into this file would
produce one sprint no one can review or sign off in one pass. So:

- **This file (`SPRINT-07`) = Increments A (plans & entitlements) and B (industry-aware onboarding)**, amended
  for U-D1…U-D4. It owns the catalog **data model and seed**, which the console later edits.
- **`SPRINT-07C-staff-console.md` = Increment C (the staff console)**, sequenced after A (it edits A's catalog,
  price book, plans and requests). It is **not deferred**: it is part of the same Sprint 07 release and **Sprint
  08 cannot open until 07C closes** (ROADMAP §4). The operator write path that used to be the `pnpm tenant-plan`
  CLI (old P8) moves there, so there is exactly **one** operator write path, never a CLI and a console that can
  drift apart.
- Release coupling, stated so nobody ships half of it: a request-mode tenant (the default for new tenants, U-D1)
  can raise requests after A, but those requests can only be **fulfilled** once 07C is live. Therefore A, B and C
  release together; A and B may pass their own Gate 2 first.

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
| R8 | **Operator plane as scripts before consoles.** Early enterprise SaaS runs tenant/plan administration through audited internal tooling before building a staff console. | Kaenal's own precedent: `provision-tenant`, `offboard-tenant`, `migrate-tenants` (TECH_STACK: "tenant provisioning is a script, not a project") | **[AM1] Superseded by U-D5 for plan administration.** Provisioning stays a script (P8: `provision-tenant --bundle / --from-request`). Plan, request, catalog and price-book administration is the staff web console in `SPRINT-07C-staff-console.md`, recorded as `actor_kind='support'` with a mandatory `reason` (the audit table already enforces this). | P8, 07C |
| R9 | **[AM1] Compliance-scoped packaging.** Compliance products price by framework: the controls a declared framework needs come with that framework, and generic depth is sold on top. | Vanta / Drata (framework-based packaging; the frameworks you select determine the control set you receive) | The modules a tenant's **declared** frameworks require are included free for that tenant ("framework inclusions"), keyed by framework in an admin-editable table; everything else is sold as packs. This is what makes the Core promise true per tenant instead of false for some (§3.0 D2). | P0, P1, P4, O1 |

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
   `addons.jsx`), grouped into the 3 tiers in `pricing.jsx` (Core, Professional, Enterprise). **[AM1]** On top of
   the universal Core floor, every module its **declared compliance frameworks require** is included free (D2);
   the catalog, framework rules, industry/framework lookups and a versioned price book are control-plane **data**
   seeded here and edited by staff in 07C. Locked modules render the real page blurred behind the upsell card
   (04 §5), carry a lock in the sidebar, and are write-blocked server-side. Admins manage the plan on a
   **tenant-aware** `/pricing`, can start real 14-day trials, and hand off to Kaenal sales through real requests;
   Kaenal staff fulfil requests and set the contracted plan in the staff console (07C). The `Billing & plan`
   settings section shows the plan (payment features hidden per Q6). `Download quote` produces a real PDF.
2. **Industry-aware onboarding (Increment B).** A prospect can request a workspace from the sign-in screen (the
   drawn `request` stage), capturing industry / plant size / frameworks. When the tenant's first admin signs in,
   a short first-run flow confirms those answers and shows a ranked, clause-referenced module recommendation
   computed by a pure function in `packages/core`. The admin lands on the drawn `OnboardingWizard` checklist,
   whose tasks complete themselves from real data and include setup tasks for the modules the admin chose to
   focus on. Every module stays reachable regardless of any answer.

**[AM1] Build waves (decided by the PO, Q-S1 closed):** **A → B**, then 07C's **C**. A owns the catalog schema
and seed (P0) that both B (industry/framework lookups, framework rules for suggestions) and C (editors) read, so
P0 merges first; after P0 + P1 merge, B and the rest of A may run in parallel worktrees; C starts once A's
migrations and services are merged. Coupling is now two-way between A and B: O2/O4 show a lock chip or an
"Included with <framework>" chip from P1's resolver, and P1's resolver reads O1's declared frameworks — so O1's
**types and storage** (AC1-AC2) are built in wave A alongside P1, and O1's UI-facing routes stay in B.

**Roles served**

| Role | What they get this sprint |
|---|---|
| **Workspace admin** (`admin`; holds `billing:manage` and `settings:manage`) | Plans & add-ons page, plan changes (self-service) or requests (request mode), trials, quote PDF, Billing & plan section, first-run flow, onboarding checklist, approving member access requests by acting on them; **[AM1] declaring compliance frameworks** (which now changes entitlements, D2) |
| **Manager** (`settings:manage`, not `billing:manage`) | Onboarding checklist and editing the workspace profile's industry, plant size and focus modules, like every other `settings:manage` screen. **[AM1] Frameworks are read-only for managers** (they change entitlements; 03 §3: billing/entitlements are admin-only) |
| **Auditor / inspector / viewer** | Sidebar lock icons and the locked-module overlay; a **"Request access"** action that notifies admins (R5). Never a control that would 402 or 403 (04 §6) |
| **Partner** (supplier portal) | Portal writes are gated by the `supplier` pack like the internal supplier module. No new UI |
| **Kaenal staff (operator)** | **[AM1]** In this file: `provision-tenant --bundle` / `--from-request` only. Plan, request, catalog and price-book administration is the staff console — see `SPRINT-07C-staff-console.md` (roles `support`, `sales`, `admin`) |
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
| Migration head is `0072_ecn.sql`; this sprint uses **0073-0077** ([AM1]; 07C uses 0078-0081) | `ls packages/db/migrations` |

---

## 2. Stories

Ordering is by value and dependency (Scrum/INVEST): P1 is the foundation every gate reads; P2-P3 make gating
real; P4-P9 make it sellable and administrable; O1-O5 are Increment B; X1 is the standing cross-cutting wiring.
Each story names its design source. "[D#]" marks an AC whose exact behaviour depends on a §3.0 decision; the AC
is written for the **recommended** option and changes only as that decision states.

Vocabulary used throughout: a **pack** is one of the 9 catalog entries in `addons.jsx` (6 packs + 3 à la carte).
A **tier** is one of the 3 bundles in `pricing.jsx` (`core`, `pro`, `ent`); a tenant's tier is **derived** from its
active packs exactly as `tierMatches` does, and is `null` ("Custom") when no bundle matches. A pack is
**effective** when it is `active`, or when it has an unexpired trial. **[AM1]** The **Core floor** is every module
no pack claims. A **framework inclusion** is a module that a framework the tenant has declared marks `required`
(D2). A module is **effective** when it is in the floor, framework-included, or in an effective pack. A **gated
module** is a module that is not effective (previously: "whose pack is not effective" — no longer sufficient,
because an IATF tenant's FMEA is effective without the QE pack).

### Increment A — Plans & entitlements

### P0 — [AM1, NEW] Catalog data store: packs, pack→module map, framework rules, industry and framework lookups, versioned price book (Shared foundation)

**Design:** none (data). Source values: `addons.jsx:13-199` (packs, includes, prices, route map), `pricing.jsx:88-111`
(tiers), `auth.jsx:197-209` + `settings.jsx:454-467` (industries, frameworks), the D2 inclusion table and O2's
requirements table. Decisions U-D2, U-D3, U-D4.

UC
- Happy: the API, the web and 07C's console read one catalog: pack display data, which module belongs to which
  pack, which modules each framework requires or supports (with clause), the active industries and frameworks,
  and the current published price book.
- Happy (extensibility, U-D4): a staff member adds a 10th framework or a 9th industry through the console (07C
  C7); it appears in the public request form, the first-run flow and the profile editor on the next fetch, with
  **no migration and no redeploy**. This story proves the read side by inserting a row in a test and observing it
  everywhere.
- Happy (price book, U-D3): prices shown on `/pricing`, in the estimate and in the quote come from the published
  price-book version; publishing a new version (07C C8) changes them with no redeploy; a quote cites its version.
- Edge: a retired (inactive) framework or industry still renders its label for tenants that already hold it and
  keeps its inclusions (D2); it is not offered for new selection.
- Error: the catalog cannot be read → the API fails closed (every non-floor module gated, 503-class error on
  catalog-dependent routes, never a hard-coded fallback); the web shows the inline retry card.
- Permission: authenticated tenant members read the catalog they need (no staff fields); the public request form
  reads only active industry/framework keys and labels; nothing tenant-side can write it.
- Cross-tenant: the catalog is global and contains no tenant data; nothing in it is tenant-identifying.

AC
1. Migration `0073_catalog.sql` creates the §3.1 control tables, the `catalog_meta` version trigger and the
   grants, and seeds: the 9 packs with every display value from `addons.jsx`; the pack→module map exactly as
   `addons.jsx`'s `routes[]` (`intelligence` → graph, predictive, ai; `supplier` → suppliers, ppap, scar, portal;
   `qe` → fmea, spc, msa, risk, ecn; `platform` → report_builder, integrations [non-SMTP only, 09 §1];
   `security`, `multiplant`, `mobile`, `standards`, `support` → none); the 8 industries and 9 frameworks approved
   by U-D4 with their `suggested_frameworks` and `module_priors` (from O2 AC3); every `framework_module_rules`
   row (D2 table for `required`, O2's table for `supports`, each with its clause); price-book version 1
   (`published`, the jsx list prices, note "placeholder price book (U-D3)").
2. `packages/types`: `CatalogKey` = `z.string().regex(/^[a-z0-9_]{2,40}$/)` (syntax only — never a literal union
   for industries or frameworks); `PackId` stays a fixed enum of the 9 ids (packs are a fixed set, U-D2);
   `ModuleId` stays an enum (a module cannot exist without code); `CatalogDto` `{ version, packs[], packModules,
   frameworks[], industries[], frameworkRules[], priceBook: { versionId, currency, items[] } }`;
   `PublicOnboardingCatalogDto` `{ industries: {key,label}[], frameworks: {key,label}[], plantSizes }`; and the
   **catalog-bound schema factories** `makeWorkspaceProfileSchema(catalog)` and
   `makeWorkspaceRequestSchema(catalog)`, which accept an **active** catalog key **or** the free-text fallback
   (`industry.key='other'` + `label` ≤ 80; `frameworks.custom[]` ≤ 5 × ≤ 60 chars), so web and API validate with
   the same Zod code against the same snapshot (rule 4).
3. `packages/core/src/entitlements/catalog.ts` holds **no data**: it exports the `Catalog` type, pure accessors
   (`packForModule`, `frameworkRequired(catalog, key)`, `priceItem`), `CORE_FLOOR_GUARANTEED` (the 8 modules of
   pricing.jsx:168) and `validateCatalog(catalog)` (every module in ≤ 1 pack; no guaranteed-floor module in a
   pack; every rule references a known framework and module; the price book has an item for `core_base` and
   every pack). A unit test runs `validateCatalog` against the seed; a guard test (grep-style, like the
   placeholder-ledger test) fails if `packages/core/src/entitlements/**`, `packages/core/src/onboarding/**`,
   `apps/api/src/entitlements/**` or `apps/web/src/features/pricing/**` contains a `$`-amount, a known pack
   price (2400, 1200, 450, 600, 900, 2000) or a framework/industry key string literal outside test fixtures.
4. Routes: `GET /v1/catalog` (any authenticated internal member or partner; returns `CatalogDto` minus
   `updated_by_staff` and other staff fields; ETag = `catalog_meta.version`) and `GET /v1/public/onboarding-catalog`
   (`@Public`, served by the `kaenal_public` pool; active industries/frameworks + plant sizes only; cacheable
   60 s). Not paginated (small fixed-size reference data, exempt from rule 6 like `GET /v1/me`; stated in the
   contract summary).
5. API catalog snapshot cache keyed on `catalog_meta.version` (§3.2); test: bump the version in a test
   transaction → the next request sees the new rule; catalog read failure → fail closed.
6. Explicit grant test (new, beside `control-identity.test.ts`): `kaenal_app` can SELECT and cannot
   INSERT/UPDATE/DELETE any catalog table; `kaenal_public` can SELECT only the listed columns of
   `catalog_industries`/`catalog_frameworks` and nothing else in `control`; no role but the migrator (and, from
   07C, the staff role) can write.
7. Extensibility test: insert an 11th framework with one `required` rule in a test → it is returned by both
   catalog routes, accepted by `makeWorkspaceProfileSchema`, and a tenant declaring it gets the module effective
   (P1) — with no code change.

Web: `useCatalog()` hook (key `['catalog']`) consumed by P2/P4/O4; the sign-in request stage reads the public
catalog (O3). Mobile: none (additive types; typecheck green). Shared: everything above.

Backend: migration 0073; routes above; no audit in this story (no mutation — writes are 07C's, audited there);
RBAC: authenticated / public as stated; tenancy: control-plane, not tenant-owned, explicit grant test.

### P1 — Entitlement store and framework-aware resolver (Shared foundation) [AM1]

**Design:** `addons.jsx:13-199` (catalog, route gate map, estimate), `pricing.jsx:88-111` (tiers, `tierMatches`).
**[AM1]** Reads P0's catalog; implements D2 DECIDED (framework inclusions).

UC
- Happy: any service or screen asks "is module X usable for this tenant right now?" and gets one consistent
  answer from one resolver; the tier label, lock icons, overlay, API gate, AI gateway and estimate all agree.
- Edge: a trial ended one second ago → the pack is no longer effective everywhere at once, without waiting for a
  job to run (the resolver compares `trial_ends_at` to `now()`).
- Edge: a tenant whose active set matches no bundle → tier `null`, shown as "Custom" (no tier card marked current).
- Error: an unknown `pack_id` can never be stored (DB CHECK + Zod enum).
- Cross-tenant: tenant A's entitlements are invisible to tenant B (forced RLS; foreign ids → 404).
- **[AM1] Framework inclusion (D2):** an IATF 16949 tenant with no QE pack → FMEA, SPC and MSA are effective
  (`source: framework`, `frameworkKeys: ['iatf_16949']`), Risk and ECN stay gated; the same tenant removes IATF
  16949 from its profile → FMEA/SPC/MSA/PPAP/Suppliers become gated on the next request (after P4's confirm).
- **[AM1] No framework declared:** only the Core floor (plus effective packs) is effective.
- **[AM1] Custom framework label:** no inclusion. **Retired catalog framework** already declared: inclusion kept.
- **[AM1] Double source:** a module that is both framework-included and in an active pack reports both reasons;
  removing the pack leaves it effective (the downgrade-impact count for it is 0).

AC
1. `packages/types`: `PackId` enum = exactly the 9 ids in `addons.jsx` (`intelligence`, `supplier`, `qe`,
   `platform`, `security`, `multiplant`, `mobile`, `standards`, `support`); `TierId` = `core|pro|ent`;
   `ModuleId` enum covering every nav module (`inspections`, `ncr`, `eight_d`, `capa`, `audits`, `documents`,
   `calibration`, `training`, `complaints`, `ecn`, `risk`, `fmea`, `spc`, `msa`, `suppliers`, `ppap`, `scar`,
   `graph`, `predictive`, `reports`, `report_builder`, `ai`, `integrations`, `portal`); DTOs `EntitlementDto`,
   `EntitlementsDto`, `TrialDto`, **[AM1]** `ModuleEntitlementDto` `{ id, effective, sources: ({kind:'core'} |
   {kind:'framework', frameworkKeys} | {kind:'pack', packId} | {kind:'trial', packId, endsAt})[] }` (§4).
2. **[AM1] Catalog data is P0's control tables, not code.** The pack→module map, framework rules and prices are
   read from the catalog snapshot. The 3 tiers are data too: `0073` adds `control.catalog_tiers` (`id` fixed
   `core|pro|ent`, `name`, `blurb`, `features jsonb`, `packs text[]`, `cta` `apply`|`sales`, `sort_order`,
   `lock_version`), seeded exactly from `pricing.jsx:88-107`; the tier price line comes from the price book.
3. Pure functions in `packages/core/src/entitlements/resolver.ts`, unit-tested with no DB, all taking the
   `Catalog` snapshot as an argument: `effectivePacks(rows, trials, now)`, **[AM1]**
   `frameworkInclusions(catalog, declaredFrameworkKeys)`, `effectiveModules(catalog, declaredFrameworkKeys,
   rows, trials, now)` → `ModuleEntitlement[]`, `isModuleGated(moduleId, effectiveModules)`, `tierFor(catalog,
   effectivePacks)` (≡ `tierMatches`), `packCoverage(catalog, packId, declaredFrameworkKeys)` →
   `{ includedModules, addedModules, fullyIncluded }` (drives P4's pack-card states),
   `estimateMonthly(catalog.priceBook, effectivePacks, orgProfile)` (≡ `billingSummary`: Core base line + one line
   per effective pack; `hasVariable` when a custom-priced or metered item is on; carries `priceBookVersionId`).
   Tests cover: all 3 bundles resolve to their tier; a single toggle off a bundle → `null`; a trial ending at
   `now` is not effective (boundary is exclusive); **IATF 16949 declared, no packs → exactly floor + fmea, spc,
   msa, ppap, suppliers effective (seed data); ISO 9001 only → floor only; nothing declared → floor only; a
   custom label → floor only; IATF + ISO 13485 → union (floor + the IATF five + risk); a `supports` rule never
   makes a module effective; removing a framework removes exactly its non-overlapping inclusions; property
   test: adding a framework never makes a module gated (monotonic).** The `CORE_FLOOR_GUARANTEED` guard lives in
   `validateCatalog` (P0 AC3).
4. Migration **`0074_entitlements.sql`** ([AM1] renumbered from 0073, which is now P0's catalog): `entitlements` gains `source text NOT NULL DEFAULT 'operator' CHECK
   (source IN ('operator','self_service','bundle','grandfathered'))`, `lock_version int NOT NULL DEFAULT 0` with
   the shared bump trigger, `updated_by` composite member FK (`(tenant_id, updated_by) → memberships`, nullable
   because operator writes have no member), and `CHECK (pack_id IN (<the 9 ids>))`. New table
   `entitlement_trials` (`tenant_id`, `pack_id` same CHECK, `started_at`, `ends_at`, `started_by` composite member
   FK, `created_at`; `PRIMARY KEY (tenant_id, pack_id)` — which *is* the once-per-pack rule), forced RLS,
   leading-`tenant_id` index. Trial state lives only here, so expiry never has to mutate `entitlements`.
5. **Backfill, so nothing that works today stops working:** for every tenant that exists when `0074` runs, insert
   all 9 packs `active=true, source='grandfathered'` (`ON CONFLICT (tenant_id, pack_id) DO UPDATE SET
   active=true` — this also covers the demo's existing `intelligence` row). The `supplier_quality` fixture row
   (`fixtures.ts:237`) is corrected to `supplier` in the same change. New tenants get the bundle P8's provisioning
   requires explicitly (`--bundle` is mandatory, [AM1] closing Q-C1) and request mode (D1 DECIDED).
6. RLS suite covers `entitlements` (now with writes) and `entitlement_trials`; `pnpm db:check` green; mutation
   test: removing the `entitlement_trials` policy makes `test:rls` fail.
7. **[AM1]** The resolver reads the tenant's declared frameworks from O1's `profile` document (built in wave A,
   §1 build waves). The API composes `effectiveModules` once per request (memoised on the request context) from:
   the catalog snapshot (P0), `entitlements` + `entitlement_trials` rows, and `profile.frameworks.keys`.

Web: none directly (consumed by P2/P4). Mobile: none; additive types only, `pnpm --filter @kaenal/mobile
typecheck` green. Shared: everything above.

Backend: migration 0074 (+ `control.catalog_tiers` in 0073); no route (P2 adds the read route); no audit (no
mutation in this story); RBAC n/a; tenancy: both tenant tables tenant-owned, forced RLS, composite member FKs;
the catalog is control-plane (P0).

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
- Happy: the pack becomes effective (any path: toggle, trial, staff console [AM1], request fulfilled, framework declared [AM1]) → the overlay
  lifts and the lock icons disappear **without a reload**: the entitlements query is invalidated by the
  mutation, and by the realtime `entity.updated {kind:'entitlements'}` event for changes made elsewhere (staff console [AM1],
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
   boolean, gatedModules: ModuleId[], modules: ModuleEntitlementDto[] [AM1], declaredFrameworks: CatalogKey[]
   [AM1], catalogVersion [AM1] }`, computed with P1's `effectiveModules`. **[AM1]** The overlay decides "locked"
   from `modules`, never from pack state alone (an IATF tenant's `/fmea` is never overlaid), and its copy never
   mentions framework inclusion (D2). Not paginated (a fixed 9-row catalog,
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
8. Realtime: P4/P5/P6 and O1 frameworks [AM1] mutations (and 07C's staff writes) emit `entity.updated {kind:'entitlements'}` on the tenant channel; the web
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
- Happy: `qe` not effective → `POST /v1/risks` returns **402 `ENTITLEMENT_REQUIRED`** with `details.moduleId='risk'`,
  `details.packId='qe'` [AM1];
  `GET /v1/risks`, `GET /v1/risks/:id` and the board-pack export still succeed (the tenant's own records).
- **[AM1] Framework inclusion:** an IATF 16949 tenant without `qe` → `POST /v1/fmea…`, SPC ingest and MSA writes
  succeed (framework-included), `POST /v1/risks` and ECN writes return 402. The gate is per **module**.
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
1. **[AM1]** A `@RequireModule(moduleId)` decorator (replaces the earlier `@RequirePack(packId)`: with framework
   inclusions a pack-level check would wrongly 402 an IATF tenant's FMEA) evaluated **inside the lifecycle
   interceptor** after `@RequireCapability`, within the tenant-scoped transaction, reading P1's `effectiveModules`
   once per request (memoised on the request context). It is the only mechanism; no service contains its own
   entitlement `if`. The 402 `details` carry `{ moduleId, packId | null }` (packId = the pack that would unlock it).
2. Applied, per controller, to every **write** route of: `risk`, `fmea`, `spc` (measurement ingest), `msa`, `ecn`
   (qe); `suppliers`, `ppap`, `scar`, portal respond routes (supplier); `reports` POST/PUT, `integrations`
   POST/PUT/connect/webhook/test for non-SMTP kinds (platform). Applied to **read** routes of `graph` and
   `predictions` (intelligence). The architect produces the exhaustive route list from the controllers as part of
   the slice plan; a test enumerates every route of these controllers and fails if a write route lacks the
   decorator (a mutation-style guard, like the placeholder-ledger test). **[AM1]** Because the pack→module map is
   now data (P0), a module can be moved into a pack by staff (07C C7) — so the decorator is applied to **every**
   non-floor-guaranteed module's write routes regardless of today's mapping; for a module currently in the floor
   it is a no-op.
3. The AI gateway's entitlement read (`gateway.service.ts:218`) is replaced by P1's resolver, so an unexpired
   `intelligence` trial passes and an expired one fails closed; existing AI tests stay green plus two new cases
   (trial active → allowed; trial expired → 402 `ENTITLEMENT_REQUIRED`, `block_reason='entitlement'`).
4. Tests per pack: 402 on a representative write, 200 on read/export of the same module, 403-before-402 for a
   role lacking the capability, 402 disappears in the same request after the pack becomes effective (no cache
   staleness across requests), and SMTP integration writes never 402. **[AM1]** Plus: IATF declared, no `qe` →
   FMEA/SPC/MSA writes 2xx and Risk/ECN writes 402; the framework removed → FMEA write 402 on the next request;
   a catalog edit moving a module into a pack (test transaction bumping `catalog_meta.version`) → gated on the next
   request.
5. Existing integration suites for gated modules (risk, msa, fmea, spc, ecn, suppliers, ppap, scar, graph,
   predictions, reports, integrations, portal) seed their tenants with the needed packs via one fixture helper
   (`grantPacks(tenantId, packs)`), so the suite measures module behaviour, not the default plan or the declared
   frameworks [AM1]. This is
   required work, not optional: without it those suites fail the moment P3 lands.

Web: 402 handling in the shared mutation error mapper (toast + CTA per role). Mobile: the NCR AI draft already
maps 402 → "AI unavailable"; verified unchanged against an expired trial (X1). Shared: decorator, resolver use,
error details shape `{ moduleId, packId }` [AM1] added to the `ENTITLEMENT_REQUIRED` envelope (additive).

Backend: no migration; interceptor + decorator; no audit (a refused write writes nothing, matching RBAC 403
precedent); tenancy: resolver runs in the tenant transaction.

### P4 — Plans & add-ons page (`/pricing`) and admin plan changes

**Design:** `pricing.jsx:5-231` in full (binding), `addons.jsx` catalog values. New states (§5): request-mode
buttons and pending chips, downgrade confirm, non-self-service header note, loading/error. **[AM1]** New
tenant-aware states (§5 D-S12, D-S13): framework inclusions on the Core card, "Included · <framework>" marks on
pack includes, "Included with your frameworks" pack state, per-tenant guardrail callout, no-framework prompt.

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
- **[AM1] Tenant-aware page (D2).** An IATF 16949 + ISO 9001 tenant sees: the Core card listing the floor and a
  block "Included for <workspace> with IATF 16949: FMEA workbench, SPC charts, MSA / Gauge R&R, PPAP, Suppliers";
  the Quality Engineering card with FMEA/SPC/MSA marked "Included · IATF 16949" and the line "Adds Risk register
  and Engineering changes"; the Supplier Network card with Suppliers/PPAP marked included and "Adds SCAR and the
  supplier portal"; the guardrail callout rendered from the tenant's frameworks ("Everything IATF 16949 and ISO
  9001 require — <modules> — is included for <workspace> and never gated"). An ISO 9001-only tenant sees no
  inclusion block and the full QE / Supplier cards. A tenant with no declared framework sees the floor, the
  callout variant "Declare your compliance frameworks to see what is always included for you" and, for admins,
  a **Declare frameworks** link to `/onboarding?step=frameworks` (O4 re-entry).
- **[AM1] Fully covered pack.** If `packCoverage(...).fullyIncluded` (every module of the pack is already
  framework-included), the card shows "Included with your frameworks" and **no** Add / Request / Trial control —
  in either D1 mode — so a tenant can never be sold, or ask sales for, what it already has.
- **[AM1] Estimate.** Unchanged by inclusions (an included module has no price of its own; packs are priced per
  the published price book, §3.3, §7 Q-C13).

AC
1. `/pricing` replaces the `planned:pricing` placeholder; ledger entry removed; the page reproduces every element,
   size, colour and copy string of `pricing.jsx` (web-fidelity review side-by-side), with prices and includes
   read from **P0's catalog and published price book** [AM1], never hard-coded in the component. The drawn static
   guardrail sentence and Core tier line are replaced **only** by the approved tenant-aware variants (D-S12);
   every other element stays pixel-exact.
2. Estimate: `GET /v1/entitlements/org-profile` (`billing:manage`) returns `{ plants, activeSuppliers,
   inspectors, members, extraStandards, workspaceName }` computed server-side (counts only, no names;
   `extraStandards` = declared frameworks whose catalog row has `counts_as_extra_standard=true` [AM1] (seeded true
   for all but IATF 16949 and ISO 9001, reproducing `addons.jsx:120`'s "beyond IATF 16949 & ISO 9001"; custom
   labels count as extra standards). The summary lines/total come from `estimateMonthly` (P1); the "*" footnote and
   "Annual billing · taxes calculated at checkout" line render as drawn. **The estimate is labelled an estimate
   and is never an invoice or charge** (Q6).
3. `PUT /v1/entitlements/packs/:packId` `{ active: boolean, lockVersion }` (`billing:manage`, `@RequireModule`
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
   architect lists them per module). Counts only. **[AM1]** Modules that stay effective through a framework
   inclusion are excluded from the impact (count 0, not listed). The same endpoint accepts
   `?removeFrameworks=iatf_16949` for O1's framework-removal confirm.
6. Header note in request mode (§5 D-S2) explains that plan changes go through Kaenal sales. [D1]
7. Playwright: self-service add → overlay lifts on `/risk` without reload; remove with confirm → overlay returns;
   apply Professional → tier card flips to "Current plan"; request mode → button shows "Requested".
8. **[AM1]** The Core card's inclusion block, the per-module "Included · <framework short label>" marks and the
   per-tenant callout are computed by `frameworkInclusions` / `packCoverage` (P1) from `GET /v1/entitlements` +
   `GET /v1/catalog` — no inclusion logic in components (rule 5).
9. **[AM1]** A fully covered pack renders no mutating control; `PUT …/packs/:packId`, `POST …/trials` and `POST
   …/requests` (`add_pack`) for a fully covered pack return 422 `details.reason='already_included'` (defence in
   depth; the UI never offers them).
10. **[AM1]** Playwright: IATF tenant without `qe` → `/pricing` shows the IATF inclusion block and QE "Adds Risk
   register and Engineering changes", and `/fmea` renders unlocked; ISO 9001-only tenant → no inclusion block,
   `/fmea` overlaid; no-framework tenant → the declare-frameworks callout and link resolve to the O4 step.

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
- Happy (member → admin, R5): a viewer in an ISO 9001-only tenant [AM1] on a locked `/fmea` taps "Request access" → a `member_access` request for
  `qe`; every admin gets an in-app notification "Priya requested Quality Engineering (FMEA workbench)" linking to
  `/pricing?pack=qe&request=<id>`; the admin adds the pack (self-service) or forwards it (request mode:
  "Request from Kaenal" creates the sales request and links it); when the pack becomes effective, open
  `member_access` requests for it are auto-fulfilled and the requester is notified.
- Happy (admin → sales, request mode): "Add to plan"/"Remove"/"Apply bundle"/"Talk to sales"/"Contact sales"/
  "Update subscription" open a small dialog (what is being requested, optional note, Send). On Send: an
  `open` request is stored, Kaenal sales receives an email (outbox → `send-email`, to `SALES_NOTIFY_EMAIL`) with
  tenant name/slug, requester, kind, pack/tier, composition snapshot and estimate; the button shows "Requested".
- Fulfil/decline: **[AM1] moved to `SPRINT-07C-staff-console.md` C6** — Kaenal staff fulfil (apply the change and
  mark the request fulfilled) or decline (with a reason) in the staff console's sales inbox; the requesting admin
  is notified in-app + email (`plan_request_resolved`, defined here, sent by 07C). This story delivers everything
  up to and including the open request, the sales email and the outbox event 07C projects.
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
1. Migration `0076`: `plan_requests` (`tenant_id`, `id`, `kind` CHECK in (`member_access`, `add_pack`,
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
5. Tests: dedupe, capability per kind, auto-fulfil on activation (via self-service toggle; trial is **not**
   fulfilment; staff-console activation is tested in 07C), outbox row committed atomically, withdraw state
   machine, cross-tenant id → 404. **[AM1]** `member_access` / `add_pack` for a module or pack that is
   framework-included (fully covered) → 422 `already_included`.
6. **[AM1]** Every insert and status change writes an outbox event `plan_request.changed` `{ tenantId,
   requestId, kind, status, packId, tier, note, requester: { name, email }, createdAt }` — exactly the content the
   requester addressed to Kaenal sales, which the sales email already carries, and nothing else from the tenant —
   in the same transaction — the input to 07C's cross-tenant sales-inbox projection. Only admin→sales kinds
   emit it (`member_access` stays inside the tenant).

Web: dialogs, chips, notification rows. Mobile: notification list renders the two kinds, tap hands off to web
(X1). Shared: table, routes, notification kinds, outbox email template.

Backend: migration 0076 (shared with P7/P9/O1); `PlanRequestsService`; audit `created`/`status_changed`; RBAC
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
1. `ExportResource` gains `plan_quote`; `exports_resource_check` widened in `0076`; `run-export.ts` gains the
   render branch using P1's `estimateMonthly` and P4's org-profile counts (one source of numbers, so the PDF can
   never disagree with the page).
2. `ExportsService` requires `billing:manage` for `plan_quote`; audit `exported` (existing).
3. Test: the PDF's total equals `estimateMonthly` for a fixture composition; non-admin → 403.
4. **[AM1]** The quote prints the price-book version it was priced from ("Prices: price book v<N>, published
   <date>") and the tenant's framework inclusions ("Included with IATF 16949 at no charge: …"), both from the same
   snapshot as the page. A quote regenerated after staff publish a new price book uses the new version; the
   export row stores `price_book_version_id` so an earlier quote remains attributable.

Web: button wired to the existing export hook. Mobile: none. Shared: enum + renderer.

### P8 — Provisioning defaults: `provision-tenant --bundle` / `--from-request` [AM1 — narrowed]

**Design:** none; provisioning stays a script (R8, TECH_STACK "tenant provisioning is a script, not a project").
**[AM1]** The `pnpm tenant-plan` CLI that this story used to specify is **removed** (U-D5): every operator write it
carried (show, bundle, packs, self-service flag, contract and CSM fields, requests list/fulfil/decline, history,
workspace-request listing) is specified as a staff-console story in `SPRINT-07C-staff-console.md` (C4-C6), so
there is one operator write path with one audit shape. Provisioning a new tenant (creating databases, roles and
the registry row) stays in `provision-tenant`; a console "Provision" action is §7 Q-SC4 in 07C.

UC
- Happy: `pnpm provision-tenant --slug … --name … --model shared --bundle core|pro|ent` creates the tenant (as
  today) and seeds the bundle's packs (`source='operator'`) and a `control.tenant_plans` row with
  `self_service=false` (request mode, D1 DECIDED).
- Happy: `--from-request <workspaceRequestId>` (O3) additionally pre-fills the O1 profile (industry, plant size,
  frameworks — so the tenant's framework inclusions apply from its first request) and marks the workspace
  request `provisioned` with the new tenant id.
- Error: `--bundle` omitted → exit 1 with usage (no silent default; [AM1] closes Q-C1); unknown bundle → exit 1;
  unknown or already-provisioned request id → exit 1 with a clear message; a request whose industry/framework
  keys are no longer in the catalog → provisioned with those keys kept as-is (retired values keep working, D2)
  and a warning printed.
- Re-running with the same arguments is idempotent (no duplicate rows, no second audit event).
- Dedicated (Model B) tenants: tenant-owned rows are written through the same db-router/secret-resolver the
  provisioning scripts already use.

AC
1. Migration `0075_control_plane_plans.sql`: `control.tenant_plans` (`tenant_id` PK FK → `control.tenants`,
   `self_service boolean NOT NULL DEFAULT false` [D1 DECIDED], `contract_renews_on date`,
   `contract_value_annual numeric(12,2)`, `contract_currency text DEFAULT 'USD'`, `csm_name`, `csm_email`,
   `csm_booking_url`, `csm_chat_url` (https-only CHECK on both URLs), `lock_version`, `updated_at`,
   `updated_reason text`, `updated_by_staff uuid NULL`). `GRANT SELECT` to `kaenal_app` only (the API can read,
   never write — the same boundary as `control.tenants`); in this file writes are migrator-only
   (`provision-tenant`); 07C grants its staff role UPDATE. Not tenant-owned → outside the RLS lint by design; its
   access is covered by an explicit grant test (app role cannot INSERT/UPDATE/DELETE).
2. The tenant-owned writes this story adds to provisioning (entitlements, the pre-filled profile) each write an
   audit event (`actor_kind='system'`, `entitlement_changed` / `settings_changed`, `after` = the seeded values) in
   the same transaction as the rows (rule 3). Verified this session: `provision-tenant` and `scripts/lib/seed.ts`
   write **no** audit events today for what they already seed (admin membership, SLA config, plant, template) —
   a pre-existing gap outside this sprint's scope, recorded in §7 (Q-P1) and PROGRESS.md Known issues, not fixed
   silently here.
3. `--help` documents both flags; CLAUDE.md "Commands" line for `provision-tenant` is updated.
4. Tests (script-level, against the test DB): bundle seeding per tier, `--bundle` required, `--from-request`
   pre-fill + status change, idempotent re-run, dedicated-tenant routing path unit-tested with the existing router
   fake.

Web/Mobile: none. Shared: the script imports the catalog snapshot from P0 (tiers come from `control.catalog_tiers`,
one source of truth).

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
3. Namespace CHECK widened in `0076` (`billing`, and O1's `profile`, `onboarding`).
4. **[AM1]** The banner's tier name / blurb come from `control.catalog_tiers` and the no-contract price line from
   the published price book (P0), never from component constants; when the tenant has framework inclusions the
   banner's feature line appends "+ included with <framework short labels>" (D-S6 variant).

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
- Frameworks: any subset of the **active catalog frameworks** [AM1] plus up to 5 custom labels (≤ 60 chars each),
  or the explicit "None of these yet" option (mutually exclusive with the others). [AM1] The question is asked as
  "Which frameworks are you certified to or working towards?" — a framework being pursued counts as declared (it
  needs the same tools), "None of these yet" means neither.
- Edit later: changing industry never resets checklist progress (progress is derived from real data, O5) and
  never changes entitlements. **[AM1] Changing frameworks does change entitlements (D2 DECIDED):** adding one
  applies its inclusions on the next request (no request to sales, in either D1 mode); removing one that would
  make modules ineffective first shows the downgrade confirm (P4 AC5 with `removeFrameworks`) listing the open
  records that become read-only; Cancel changes nothing.
- **[AM1] Extensible values (U-D4):** a key staff added to the catalog yesterday is accepted today; a key that
  was retired stays valid for tenants that already hold it (shown with its label, not re-offered); an unknown key
  → 422.
- Error: invalid payload → 422 with Zod issues; concurrent edits → 409 `STALE_WRITE` → reload-and-reapply.
- Permission: read — every authenticated internal member (industry may inform shell copy later; it is not
  sensitive); write — `settings:manage` (admin + manager, the same capability as branding) for industry, plant
  size and focus modules; **[AM1] `billing:manage` (admin) for `frameworks`**, because it changes entitlements
  (03 §3). A manager's PUT that changes `frameworks` → 403 `details.reason='frameworks_require_billing_manage'`;
  the UI renders frameworks read-only for managers (D-S1 state).
- Offline: writes disabled.

AC
1. `packages/types`: **[AM1] industries and frameworks are catalog keys (`CatalogKey`, P0 AC2), not literal
   unions** (U-D4). The approved values (8 industries: `automotive`, `aerospace_defense`, `medical_devices`,
   `electronics`, `pharmaceutical`, `food_beverage`, `general_manufacturing`, `other`; 9 frameworks: `iatf_16949`,
   `iso_9001`, `iso_13485`, `as9100`, `iso_14001`, `iso_45001`, `fda_qmsr`, `fda_part_11`, `haccp`, display labels
   per the design, e.g. "FDA 21 CFR Part 11") are **seed rows** in `0073`, not code. The profile body is validated
   by `makeWorkspaceProfileSchema(catalog)` (P0 AC2) on web and API alike; `PlantSizeBand` = the design's 4 bands `50-200 | 200-1000 | 1000-5000 |
   5000+` plus `unspecified` (a fixed design list, not extensible — U-D4 names industries and frameworks only);
   `WorkspaceProfile` = `{ industry: { key: CatalogKey, label? } | null, frameworks: { keys: CatalogKey[], custom:
   string[], noneYet: boolean }, plantSize, focusModules: ModuleId[], answeredBy,
   answeredAt }`; `OnboardingState` = `{ status: not_started | in_progress | completed | dismissed, startedAt,
   completedAt, dismissedAt, ownerId }`.
2. Storage: `tenant_settings` namespaces `profile` and `onboarding` (CHECK widened in `0076`), reusing its
   `lock_version`, composite `updated_by` FK and forced RLS — no new table (0025's stated purpose).
3. Routes: `GET /v1/settings/workspace-profile` (any internal member), `PUT /v1/settings/workspace-profile`
   (`settings:manage`; **`billing:manage` additionally when `frameworks` changes** [AM1]; `lockVersion`); audit
   `settings_changed` with changed fields only. **[AM1]** A frameworks change also: publishes the realtime
   `entitlements` event (the effective set may have changed), and writes an outbox email to Kaenal sales
   ("<workspace> declared/removed <framework>") in the same transaction (D2 abuse visibility).
4. `0076` backfill: every existing tenant gets `onboarding.status='dismissed'` (no forced first-run for existing
   workspaces, incl. the demo — protects rule 12's sign-in landing) and an empty profile. [§7 Q-S3 USER]
   New tenants start `not_started`, or with the profile pre-filled when provisioned `--from-request` (P8/O3).
5. **[AM1]** Tests: a catalog key added in a test transaction is accepted; a retired key already held stays
   valid; an unknown key → 422; manager changing frameworks → 403, manager changing industry → 200; adding IATF
   16949 makes `/v1/entitlements` report FMEA effective with `source: framework` in the next request; removing it
   reverses that; the sales outbox row exists iff frameworks changed.
6. **[AM1] Build wave:** AC1-AC2 and the frameworks read used by P1 ship in wave A (P1 depends on them); AC3-AC5
   and the UI consumers ship in wave B.

Web: consumed by O4/O5 (and P4's declare-frameworks link). Mobile: none (additive types). Shared: types, routes,
namespace widening.

### O2 — Module-suggestion engine (`packages/core`, pure)

**Design:** none (logic). Pattern R1 (framework-first) + R2 (shape, never lock).

UC
- Happy: `suggestModules({ industry, frameworks, plantSize })` returns **every** `ModuleId` exactly once, each with
  a tier (`essential` | `recommended` | `optional`), a score, and machine-readable reasons (`framework` +
  clause, `industry`, `core_loop`, `size`). The UI renders the reasons as copy; nothing is ever omitted from the
  list (user decision 2: suggest and highlight, never hide).
- Happy: `suggestFrameworks(catalog, industry)` returns the frameworks to **pre-select** in O4 step 2, read from
  the industry's `suggested_frameworks` catalog row [AM1] (seeded: automotive → IATF 16949 + ISO 9001;
  aerospace_defense → AS9100; medical_devices → ISO 13485 [+ FDA QMSR offered, not pre-selected];
  pharmaceutical → FDA 21 CFR Part 11 + ISO 9001; food_beverage → HACCP + ISO 9001; electronics and
  general_manufacturing → ISO 9001; other → none). The admin can change every one. An industry staff added
  with no suggestions pre-selects nothing.
- Skipped / nothing answered: returns the ISO 9001 core-loop baseline (the sensible default for a skipped
  questionnaire, R2).
- Plan interplay: the engine knows nothing about plans; the UI overlays P1's `isModuleGated` to show a lock chip
  on a suggested module that is not in the plan, **[AM1] or an "Included with <framework>" chip on a module the
  selected frameworks include free**. A suggestion is never removed because it is locked.
- **[AM1] Essential ⇔ required.** Because O2 and P1 read the **same** `framework_module_rules` rows, a module is
  `essential` for a framework reason **iff** a declared framework marks it `required` — and therefore iff it is
  free for the tenant. `supports` rows lift a module to `recommended` with the clause as reason. The onboarding
  copy "Required by <framework> §x" can therefore never appear next to a lock chip.

AC
1. `packages/core/src/onboarding/suggest.ts` exports `suggestModules(catalog, input)`, `suggestFrameworks(catalog,
   industry)`, `defaultFocusModules(suggestions)` (= essential ∪ recommended), all pure, deterministic, no I/O, no
   `Date`; **[AM1] the catalog snapshot is an argument** (P0), so the functions stay pure while their data is
   staff-editable.
2. The logic is **table-driven data** — **[AM1] now in P0's control tables, not in
   `packages/core/src/onboarding/requirements.ts`** (that file is not created): (a) `framework_module_rules` —
   a `required` rule of a selected framework makes the module `essential` with that clause as its reason; a
   `supports` rule lifts it to `recommended` with the clause; (b) `catalog_industries.module_priors` — additive
   boosts that can lift a module to `recommended` but never to
   `essential` (only a framework obligation makes a module essential); (c) `CORE_LOOP` (inspections, ncr, capa,
   documents) always `essential` with reason `core_loop`; (d) size: band `50-200` demotes `optional`-scored
   analytics (graph, predictive) and caps `recommended` at the framework set; bands `1000-5000`/`5000+` lift
   `reports` and `predictive` to `recommended`. Ties break by catalog order.
3. The initial requirements table (indicative; every clause string is reviewed by a QMS subject-matter expert
   before it ships as user-visible copy — DoD item, §7 Q-S5). **[AM1]** This table is the **seed** for
   `framework_module_rules`: a row is seeded `required` when the module is in the Core floor or in §3.0 D2's
   "adds free" column for that framework, and `supports` otherwise (e.g. ISO 9001's risk/suppliers/ecn and
   IATF's scar/ecn/risk are `supports`). The level of every row is part of Q-C11's sign-off:

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
   MSA/PPAP essential (the question §3.0 D2 depends on). **[AM1]** Plus: for every framework and every module,
   `essential-for-a-framework-reason ⇔ frameworkInclusions(...)` contains it (the no-false-claim property, run over
   the seed catalog and over random catalogs); a staff-added industry with empty priors yields framework-only
   suggestions; a staff-added framework with one `required` rule makes that module essential.

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
- **[AM1] Catalog-driven options (U-D4).** The Industry select's options and the Compliance-frameworks chips are
  the **active** catalog values from `GET /v1/public/onboarding-catalog` (P0 AC4), in catalog order, rendered in
  exactly the drawn select and chip controls (the drawn option list is the prototype's sample; the approved 8/9
  are the seed). A value staff add appears here without a deploy. Catalog fetch fails → the form still renders
  with Industry "Other" + free text and no framework chips, plus a one-line notice, so a prospect is never
  blocked (the request is still valid: industry `other`, frameworks as custom labels).
- **[AM1] Triage:** Kaenal staff see and triage these requests (decline / mark spam / open the provisioned
  tenant) in the staff console (07C C6); provisioning itself stays `provision-tenant --from-request` (P8).

AC
1. `0075` [AM1] adds `control.workspace_requests` (`id`, `company_name` ≤ 120, `work_email citext` ≤ 254,
   `industry` (`CatalogKey` text, no CHECK — validated against the active catalog at insert) [AM1],
   `industry_label`, `plant_size` (band), `frameworks text[]` (catalog keys) + `custom_frameworks text[]` [AM1],
   `status`
   CHECK in (`new`, `provisioned`, `declined`, `spam`), `provisioned_tenant_id` FK nullable, `created_at`,
   `request_ip_hash` (salted hash, never the raw IP)). `GRANT INSERT` only to the API's public path role — the
   API can add a request but can never read, list or update them (enumeration-proof by grant); the migrator-role
   provisioning script and (07C) the staff role read them. Explicit grant test.
2. `POST /v1/public/workspace-requests` (`@Public`): Zod body from `makeWorkspaceRequestSchema(catalog)` in
   `packages/types` [AM1]; honeypot non-empty → 202
   and discard; rate limit → 429 `RATE_LIMITED` with `Retry-After`; success → insert + sales email via the
   `send-email` job in one transaction → 202. No PII in logs (email redacted, per CLAUDE.md "never log PII").
3. `provision-tenant --from-request <id>` pre-fills the O1 profile and marks the request `provisioned` with the
   tenant id (idempotent) (P8). [AM1] Listing requests is the staff console's (07C C6); the old `tenant-plan
   --workspace-requests` flag is removed with the CLI.
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
- **[AM1] Catalog-driven steps (U-D4):** Step 1's industries and step 2's frameworks are the active catalog values
  (`GET /v1/catalog`), so staff additions appear without a deploy.
- **[AM1] Deep link:** `/onboarding?step=frameworks` opens step 2 directly (P4's "Declare frameworks" link) and
  returns to the referring page on Finish.
- Step 1 — Industry: the suggested list (O1) as selectable cards or a select, "Other" reveals a free-text label.
  Pre-filled from the workspace request when provisioned from one.
- Step 2 — Compliance frameworks: chips, pre-selected by `suggestFrameworks(catalog, industry)` (visibly marked
  "suggested for <industry>"), editable, "+ Add another" (custom label), and "None of these yet" [AM1]. The
  question reads "Which frameworks are you certified to or working towards?". **[AM1]** Under the chips, a live
  line computed by `frameworkInclusions` states what the selection includes free ("With IATF 16949, FMEA, SPC,
  MSA, PPAP and Suppliers are included in your plan"), so the commercial effect of the answer is visible before
  saving. For a manager (no `billing:manage`) the step is read-only with "Only an admin can change compliance
  frameworks" (D-S1 state); removing a framework that would lock modules opens the P4 downgrade confirm on
  Next.
- Step 3 — Size: the design's plant-size bands (+ "Prefer not to say"). One sentence explains why it is asked
  (it tunes how lean the starting set is). [§7 Q-S2b USER — whether to ask at all; assumed kept]
- Step 4 — Recommended modules: `suggestModules(...)` grouped Essential / Recommended / Optional; each row has
  the module icon/name, the top reason as copy (e.g. "Required by IATF 16949 §7.1.5.1.1"), a checkbox
  pre-checked per `defaultFocusModules`, a lock chip ("Not in your plan — try it free for 14 days from Plans &
  add-ons") when P1 says the module is gated, **[AM1] and an "Included with <framework>" chip when it is
  framework-included** (by construction every "Required by …" row carries the included chip, never the lock
  chip — O2 AC4 property). Unchecking never hides a module anywhere; the copy says so ("Every
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

6. **[AM1]** Playwright: an automotive admin accepts the suggested IATF 16949 + ISO 9001 → step 2 shows the
   inclusion line, step 4 shows FMEA/SPC/MSA/PPAP/Suppliers as "Required by IATF 16949" with the included chip and
   Risk/ECN with a lock chip (tenant without `qe`), and after Finish `/fmea` is unlocked; a manager re-entering the
   flow sees step 2 read-only; `?step=frameworks` lands on step 2 and returns to `/pricing`.

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
1. **RBAC:** no new tenant capability. `billing:manage` (admin, existing) gates plan changes, trials, requests other than
   `member_access`, org-profile, downgrade-impact, quote, billing settings **and [AM1] the profile's `frameworks`
   field**; `settings:manage` gates the rest of the profile write and onboarding; (staff roles are 07C's and never
   appear in the tenant capability list); `member_access` requests need any internal role. The web capability list from `GET
   /v1/me` drives every hidden control (04 §6).
2. **Placeholder ledger:** remove `planned:pricing`, `settings:billing`, `settings:onboarding`; renumber every
   remaining entry to the new sprint numbers from ROADMAP §3 (the ledger test keys on ids, the numbers must still
   be truthful).
3. **`excluded.md`:** add Billing → Payment method and Invoices (Q6), and the four non-existent demo onboarding
   tasks (O5 AC4).
4. **Audit log UI:** `entitlement_changed` (incl. `support` actor + reason, trials, expiry) and `plan_requests`
   events render readably in Settings → Audit log (actor "Kaenal support — <reason>" for operator changes, which
   arrive from 07C; the rendering is built here so 07C only has to write the events). **[AM1]** A `settings_changed`
   event on the `profile` namespace that changes frameworks renders as "Declared IATF 16949" / "Removed AS9100".
5. **Mobile (small, real):** (a) `apps/mobile/src/app/(app)/audit.tsx` categorises `plan_request` entity events
   with the existing `settings` category (entitlement events already match); (b) the mobile notification list
   renders `trial_ending`, `trial_ended`, `plan_request_created`, `plan_request_resolved` with a sensible icon and
   hands off to the web `/pricing` via `lib/web-links.ts` (the existing manage-on-web pattern); (c) the NCR AI
   draft's existing 402 handling is re-verified against an expired `intelligence` trial; (d) `pnpm --filter
   @kaenal/mobile typecheck` and the mobile test suite stay green; `progress_mobile.md` gets a Sprint 07 entry.
6. **Seed:** `seed-demo.ts` gives `acme` the Enterprise bundle (every pack active, so every existing demo surface
   keeps working), a `control.tenant_plans` row with `self_service=true` and a demo CSM, onboarding `dismissed`,
   and a profile (automotive, IATF 16949 + ISO 9001). **[AM1]** It also seeds a second workspace for the same demo
   user, `globex` (general manufacturing, ISO 9001 only, `core` bundle, `self_service=false`), reachable through
   the existing workspace picker, so request mode and the lean (no-inclusion) Core are demonstrable without
   touching `acme`. Browser verification of locks/trials/requests is done in `globex` and by self-service toggles
   in `acme` from `/pricing`, restoring the Enterprise bundle afterwards ([AM1] the `pnpm tenant-plan` route is
   gone); the demo login to **both** workspaces is re-verified (201) at the end (rule 12). The catalog seed lives
   in migration `0073`, so `seed-demo.ts` never writes catalog rows.
7. **Docs:** [AM1] CLAUDE.md Commands updates the `provision-tenant` line (`--bundle` required, `--from-request`);
   `.env.example` gains `SALES_NOTIFY_EMAIL`, `SUPPORT_EMAIL`; `apps/web/src/config/navigation.ts` unchanged (Plans
   & add-ons already exists).
8. **[AM1] Commercial-state outbox event (input to 07C's directory and impact preview).** Every change to a tenant's
   effective commercial state — pack toggle / bundle (P4), trial start (P5) and the trials job's expiry event
   (P5 AC2), frameworks change (O1), provisioning (P8) — writes an outbox event `tenant_commercial.changed`
   `{ tenantId, tier, effectivePacks, declaredFrameworkKeys, at }` in the same transaction (identifiers and
   catalog keys only; no names, no content). Test: each path emits exactly one event; rollback emits none.

---

## 3. Backend + commercial design — D1, D2, D5 DECIDED (user, 2026-09-30); D3, D4 still need sign-off

### 3.0 Five decisions with commercial weight

Each decision states the conflict, the options and the outcome. **[AM1]** Status after the user's 2026-09-30
answers:

| Decision | Status |
|---|---|
| D1 self-service vs request mode | **DECIDED 2026-09-30** — option (c) as recommended |
| D2 what is included in Core | **DECIDED 2026-09-30** — both proposed options rejected; redesigned as framework-conditional inclusions (below) |
| D3 gates block writes, never the tenant's own records | **PROPOSED — still needs explicit user approval** (not covered by the 2026-09-30 answers) |
| D4 real 14-day trials, once per pack | **PROPOSED — still needs explicit user approval** (not covered by the 2026-09-30 answers) |
| D5 operator surface | **DECIDED 2026-09-30** — real staff web console, built now, in `SPRINT-07C-staff-console.md` |

**D1 — Who can turn a pack on: the customer's admin, or only Kaenal? (the gate's teeth) — DECIDED 2026-09-30:
option (c), per-tenant `self_service` flag, new tenants default to request mode.** The analysis that led to it
is kept below for the record.
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
  requests instead of toggling) — **approved by the user 2026-09-30 (U-D1).**
- *Final, as decided.* `control.tenant_plans.self_service boolean NOT NULL DEFAULT false`; only Kaenal staff can
  change it (staff console, 07C C5); the demo tenant is seeded `true`. **[AM1] Interaction with D2:** the
  self-service / request split applies **only to packs** (genuinely optional upsells). A module included free by
  a declared framework (D2) is effective the moment the framework is declared and **never** goes through a
  request, in either mode. A pack whose every module is already framework-included for the tenant offers no Add
  / Request button at all (nothing to sell, nothing to ask sales for; P4 AC9).

**D2 — What is included in Core — DECIDED 2026-09-30 (U-D2): framework-conditional inclusions, as admin-editable
data.**

*The user's decision, verbatim:* "Design the pack depending on the industry and not as a single source. Because
one guy needs 4 modules but others need 8 modules." Both options the PO proposed — (a) keep the drawn map and
shrink the Core claim, (b) move the IATF core tools into Core for everyone — are rejected: (a) paywalls what an
IATF tenant is obliged to run, (b) gives an ISO 9001-only tenant for free what it does not need for compliance
and destroys the Quality Engineering pack's value for the majority of the market.

*Key chosen: the declared compliance framework, not the industry label.* The O1 profile already captures the two
separately (`industry: {key,label}` and `frameworks: {keys, custom, notCertifiedYet}`, O1 AC1). The framework is
the precise, compliance-driving signal (an "electronics" company may run IATF 16949 because it supplies
automotive; a "general manufacturing" company may be ISO 9001 only), so inclusions are keyed by **framework**.
Industry keeps its role from O2: it shapes *suggestions*, never *entitlements*. This follows R9 (§0).

*The model (three layers, all data except one safety rail):*

1. **Universal Core floor** — every module that no pack claims in `control.catalog_pack_modules`. Never gated for
   anyone. Seeded as today's Core: inspections, ncr, eight_d, capa, audits, documents, calibration, training,
   complaints, reports (read), every settings screen. **Safety rail (code, not data):** the modules pricing.jsx:168
   names ("Inspections, NCR, CAPA, 8D, Audits, Document control, Calibration and Training") are
   `CORE_FLOOR_GUARANTEED` in `packages/core`; the catalog service refuses (422) to map any of them to a pack.
   That public promise is a deliberate code change, never a console slip.
2. **Framework inclusions** — `control.framework_module_rules (framework_key, module_id, level, clause, note)`
   with `level ∈ {required, supports}`. For each framework the tenant has declared, every `required` module is
   **included free regardless of plan**. `supports` rows only feed onboarding suggestions (O2) and have no
   commercial effect. One table drives both the onboarding copy ("Required by IATF 16949 §7.1.5.1.1") **and** the
   inclusion, so it is structurally impossible to tell a tenant a framework requires a module while paywalling
   that module for them — the exact false-claim problem the old D2 exposed.
3. **Packs** — `control.catalog_packs` + `control.catalog_pack_modules` (the 9 packs of `addons.jsx`, fixed ids,
   editable display, trialability and module mapping; a module belongs to at most one pack). A pack is effective
   when active or on an unexpired trial (P1, P5).

`effectiveModules(tenant) = CoreFloor ∪ ⋃_{f ∈ declaredCatalogFrameworks} required(f) ∪ modules(effectivePacks)`,
and every effective module carries **why** it is effective: `core`, `framework` (+ which framework keys),
`pack` (+ pack id), `trial` (+ pack id, ends at). The resolver is pure (`packages/core`) and takes the catalog
snapshot as an argument; nothing about which framework includes what is written in code.

*Answers to the questions the redesign raises:*

- **A tenant that declares no framework** ("None of these yet", or skipped) **gets the universal Core floor only
  — the leanest set.** Why: an inclusion exists to honour a compliance obligation; with no declared obligation
  there is nothing to honour. The floor is already a complete ISO 9001-grade QMS (by construction, the seeded
  ISO 9001 `required` rows are a subset of the floor), every module stays visible and suggestible (soft tagging,
  Q10), every pack stays trialable, and declaring a framework later applies its inclusions on the very next
  request, with no sales step. Neither "richest" (gives the paid packs away to anyone who skips a question) nor
  an arbitrary middle set (a second, framework-less rule set to maintain) is defensible.
- **A custom (free-text) framework** gets no inclusions — there are no rules for a label the catalog does not
  know. Staff can promote a recurring custom label into the catalog and give it rules (07C C7), after which it
  applies to every tenant that declares it.
- **An inactive (retired) catalog framework** keeps applying its inclusions to tenants that already declared it:
  deactivation stops it being *offered*, it never silently gates existing tenants.
- **Interaction with D1:** framework inclusions never require a request, in either mode; only packs do (D1
  "Final").
- **Pricing page:** it can no longer be one static table. `/pricing` renders the **viewing tenant's** effective
  set: the Core card lists the floor plus "Included for <workspace> with IATF 16949: FMEA, SPC, MSA, PPAP,
  Suppliers"; each pack card marks its modules that are already included ("Included · IATF 16949"); a pack fully
  covered shows "Included with your frameworks" with no CTA; the guardrail callout is rendered from the tenant's
  declared frameworks instead of the static IATF sentence (P4 AC8-AC10, design D-S12/D-S13). A tenant with no
  framework sees the floor and a "Declare your compliance frameworks" link (admins) to the profile step.
- **Changing frameworks is now a commercial act.** Adding one can unlock modules; removing one can lock them.
  So (i) the `frameworks` field of the workspace profile requires `billing:manage` (admin, 03 §3 "billing,
  entitlements = admin"), while industry / size / focus modules keep `settings:manage`; (ii) a removal that
  would make modules ineffective opens the same downgrade confirm as P4 (open records that become read-only);
  (iii) every change is audited (`settings_changed`) and emails Kaenal sales (outbox) so a surprising
  declaration is visible, and the staff console shows the declaration history (07C C4). Whether staff get a
  remedy beyond that for a false declaration is §7 Q-C12 [USER].
- **Overlay copy does not advertise framework inclusion** ("declare IATF to get this free") — that would invite
  false attestations. The overlay sells the pack; the profile explains inclusions.
- **Everything the redesign introduces is data** in the control plane (§3.1): packs' display fields and module
  map, framework rules, the industry and framework lookups, the versioned price book. In this sprint the data is
  seeded by migration `0073` and read by the API; **editing it is the staff console's job (07C C7, C8)**, with no
  redeploy.

*Initial framework-inclusion seed (proposed; requires the user's commercial sign-off and a QMS SME review before
it ships — §7 Q-C11 [USER]).* `required` beyond the universal floor, i.e. what each framework adds free:

| Framework | Adds free beyond the floor (`required`) | `supports` only (suggestion, no commercial effect) |
|---|---|---|
| ISO 9001:2015 | — (its required set ⊆ floor) | risk (§6.1), suppliers (§8.4), ecn (§8.5.6) |
| IATF 16949:2016 | **fmea** (§8.3.5.2), **spc** (§9.1.1.1), **msa** (§7.1.5.1.1), **ppap** (§8.3.4.4), **suppliers** (§8.4.2.4, and PPAP cannot run without supplier records) | risk (§6.1.2.1), ecn (§8.5.6.1), scar (§8.4.2.5) |
| ISO 13485:2016 | **risk** (§7.1, ISO 14971) | ecn (§7.3.9), suppliers (§7.4) |
| FDA QMSR (21 CFR 820) | **risk** (alias of ISO 13485) | ecn, suppliers |
| AS9100D | **risk** (§8.1.1 operational risk), **ecn** (§8.1.2 configuration management) | suppliers (§8.4) |
| FDA 21 CFR Part 11 / HACCP / ISO 14001 / ISO 45001 | — | per O2's table |

This reproduces the user's example: an IATF tenant's free set is floor + 5 (FMEA, SPC, MSA, PPAP, Suppliers); an
ISO 9001-only tenant's is the floor, and Quality Engineering / Supplier Network remain legitimate paid add-ons
for it. SCAR, the supplier portal, Risk and ECN stay in their packs for IATF tenants because IATF can be met
without them in Kaenal (the PO's reading; the SME confirms or corrects each row as data).

*The record of the superseded analysis follows.*

**D2 (superseded record) — The pack map vs the "What always stays in Core" promise**
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
  pack's revenue. Either way (c) must not ship. ~~[USER decision required before build; §7 Q-C2]~~ **[AM1]
  Answered 2026-09-30: neither (a) nor (b); see D2 DECIDED above.** (c) is also ruled out by the redesign: the
  callout becomes per-tenant and true.

**D3 — What a gate blocks: writes, never the customer's own records — PROPOSED, needs user approval**
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

**D4 — Trials: real, time-boxed, once per pack — PROPOSED, needs user approval**
- *Conflict.* The prototype's "Start 14-day trial" just turns the pack on permanently.
- *Recommendation.* 14 days, once per pack per tenant (enforced by the table's primary key), admin-started,
  available in both modes, not offered for `security`/`support` (no in-product effect / custom-priced), T-3
  warning, auto-expiry by comparison (no job needed to lock), records readable after expiry (D3). Figma-style
  provisional access for *member* requests is **not** included (§7 Q-C6).

**D5 — The operator surface — DECIDED 2026-09-30 (U-D5): a real staff web console, built now.**
- *The user's decision:* build the staff web console in this release, not the audited-CLI-only interim the PO
  proposed. Required capabilities named by the user: list/search tenants; view/edit a tenant's plan and
  entitlements; view/resolve plan requests; edit the pack catalog and the price book (U-D2, U-D3); manage the
  industry/framework catalogs (U-D4).
- *Where it is specified:* **`SPRINT-07C-staff-console.md` (Increment C)** — staff identity (outside
  `control.users` and memberships), staff authentication and sessions (a non-tenant-scoped branch of the one
  lifecycle interceptor), staff RBAC (`support`, `sales`, `admin`), the spec's support-access model (01 §3.2
  "dedicated `support` role + explicit `app.support_reason` … never bypasses RLS silently"; 07 §7 "support role
  path with reason + time-boxed grant (4h), fully audited, visible to the tenant admin"), a least-privilege
  support database role, a platform audit log, and a separate `apps/staff` app. It is sequenced after Increment A
  because it edits A's catalog, price book, plans and requests.
- *Effect on this file:* the `pnpm tenant-plan` CLI (old P8) is **removed**; every operator write it carried
  (set packs/bundle, self-service flag, contract and CSM fields, list/fulfil/decline requests, history) is a
  console story in 07C. P8 here keeps only provisioning (`provision-tenant --bundle / --from-request`), which
  stays a script per TECH_STACK. P6's fulfil/decline half moves to 07C C6.
- *Superseded record:* the PO had recommended the CLI because no staff identity, route, role or design existed
  (still true, verified again for 07C) and `phases/README.md` puts platform-admin screens out of scope; the
  user's decision is the explicit decision to build it.

### 3.1 Data model **[AM1]** (migrations 0073-0076; 0077 reserved buffer; 07C owns 0078-0081)

**Where catalog data lives, and why.** Packs, framework rules, the industry / framework lookups and the price book
are **global** (not tenant-owned), must be readable by every tenant's requests — including Model B (dedicated)
tenants whose rows live in another database — and writable only by Kaenal staff. They therefore live in the
**`control` schema of the control database**, like `control.tenants`: exempt from the RLS lint by design, with
explicit per-role grants and an explicit grant test (the `control-identity.test.ts` precedent). They are never
FK targets of tenant tables (a dedicated tenant database cannot reference them); tenant rows store the catalog
**key** as text and the API validates it against the catalog. No Postgres ENUM type and no TypeScript literal
union is used for anything a staff member can extend (U-D4).

| Migration | Object | Kind | Notes |
|---|---|---|---|
| 0073 | `control.catalog_packs` (`id` text PK — the 9 fixed ids, CHECK; `kind` `pack`\|`alacarte`; `name`, `tagline`, `icon`, `accent_token`, `includes jsonb` (display list), `value_line`, `trialable bool`, `sort_order`, `lock_version`, `updated_at`, `updated_by_staff uuid NULL`) | control | Fixed set of 9 (as before; adding a pack is a product change). Display, trialability and order are editable data |
| 0073 | `control.catalog_pack_modules` (`module_id` text PK, `pack_id` → `catalog_packs`) | control | A module belongs to at most one pack (the PK). A module with no row is in the universal Core floor. `CORE_FLOOR_GUARANTEED` modules are refused by the service (and by a CHECK listing them, so a hand-written INSERT fails too) |
| 0073 | `control.catalog_frameworks` (`key` text PK, `label`, `short_label`, `counts_as_extra_standard bool` (replaces `addons.jsx:120`'s hard-coded "beyond IATF 16949 & ISO 9001"), `sort_order`, `active bool`, `lock_version`, audit columns) | control | Seeded with the approved 9 (U-D4). Keys: `^[a-z0-9_]{2,40}$`. Never deleted (no DELETE grant); `active=false` stops offering it |
| 0073 | `control.catalog_industries` (`key` text PK, `label`, `suggested_frameworks text[]`, `module_priors jsonb` (`{moduleId: boost}`), `sort_order`, `active`, `lock_version`, audit columns) | control | Seeded with the approved 8 (U-D4). `other` is a reserved key meaning "free-text label" |
| 0073 | `control.framework_module_rules` (`framework_key` → `catalog_frameworks`, `module_id`, `level` CHECK `required`\|`supports`, `clause`, `note`, PK `(framework_key, module_id)`, `lock_version`, audit columns) | control | D2's single source for both onboarding reasons (O2) and free inclusions (P1). Seeded per the D2 table + O2's table |
| 0073 | `control.price_book_versions` (`id`, `status` CHECK `draft`\|`published`\|`archived`, `currency` (`USD` this sprint), `note`, `published_at`, `published_by_staff`, `created_at`); partial unique index: at most one `published` | control | **Versioned** (U-D3): staff edit a draft and publish it atomically; the previous published version becomes `archived`. A quote or request snapshot cites the version it was priced from, so it stays reproducible after prices change. Seeded with version 1 = the jsx list prices, `published`, note "placeholder price book (U-D3)" |
| 0073 | `control.price_book_items` (`version_id`, `item_key` (`core_base`, `pack:<id>`, `unit:supplier`, `unit:extra_plant`, `unit:inspector`, `unit:extra_standard`, …), `amount numeric(12,2) NULL` (NULL = custom / "Talk to sales"), `unit` CHECK `month`\|`supplier_month`\|`plant_month`\|`inspector_month`\|`standard_month`\|`custom`, `included_units int`, `label`; PK `(version_id, item_key)`) | control | Everything `estimateMonthly` multiplies comes from here; nothing price-like stays in code |
| 0073 | `control.catalog_tiers` (`id` fixed `core`\|`pro`\|`ent`, `name`, `blurb`, `features jsonb`, `packs text[]`, `cta` `apply`\|`sales`, `sort_order`, `lock_version`, audit columns) | control | The 3 bundles of `pricing.jsx:88-107` as data; tier price lines come from the price book |
| 0073 | `control.catalog_meta` (single row: `version bigint`, bumped by trigger on any write to the tables above) | control | Lets every API instance cache the catalog snapshot and revalidate with one PK read per request (§3.2) |
| 0073 | Grants | — | `kaenal_app`: SELECT on all the above. `kaenal_public`: `USAGE` on schema `control` (today only `kaenal_app` has it, `0000_foundation.sql`) plus SELECT on `catalog_industries` / `catalog_frameworks` (keys, labels, sort order, active only, via column grants) for the public request form — and nothing else in `control` (grant test). Write grants: migrator only in this sprint; **07C grants the staff role INSERT/UPDATE** |
| 0074 | `entitlements` + `source`, `lock_version`, `updated_by` (composite member FK), `pack_id` CHECK | tenant, forced RLS (existing) | Backfill all 9 packs `grandfathered` for existing tenants (P1 AC5) |
| 0074 | `entitlement_trials` (PK `tenant_id, pack_id`) | tenant, forced RLS | Once-per-pack by PK; expiry by comparison |
| 0075 | `control.tenant_plans` | control plane | `self_service` (DEFAULT false, D1 DECIDED), contract fields, CSM fields; app role SELECT only; 07C grants the staff role UPDATE |
| 0075 | `control.workspace_requests` | control plane | Public intake; `industry` / `frameworks` stored as catalog keys (text, no CHECK; validated against the active catalog at insert). The `kaenal_public` role (0000) may INSERT only (never SELECT) |
| 0076 | `plan_requests` (+ `price_book_version_id` in the composition snapshot) | tenant, forced RLS | Partial unique open-request index; self composite FK for forwarding |
| 0076 | `tenant_settings` namespace CHECK + `billing`, `profile`, `onboarding` | tenant (existing) | Backfill onboarding `dismissed` for existing tenants |
| 0076 | `exports_resource_check` + `plan_quote` | tenant (existing) | Mirrors 0066/0070 widening |

Staff identity, staff sessions, support grants, the support database role, the platform audit log and the
sales-inbox projection are **07C's** migrations (0078-0081), not this file's.

No new audit action (existing `entitlement_changed`, `created`, `status_changed`, `settings_changed`, `exported`
cover every tenant mutation; `support_accessed` already exists for 07C). New notification kinds: `trial_ending`,
`trial_ended`, `plan_request_created`, `plan_request_resolved`.

### 3.2 Enforcement architecture **[AM1]**

One resolver (`packages/core` `effectiveModules(catalog, profileFrameworks, entitlementRows, trials, now)`),
**module-level**, because a module can now be effective without its pack (framework inclusion). It is read in the
API by **`@RequireModule(moduleId)`** (replaces the old `@RequirePack`) inside the lifecycle interceptor (after
RBAC, inside the tenant transaction), by the AI gateway (`intelligence` modules), by the trials job, and by 07C's
staff services; read in the web through `GET /v1/entitlements` + `isModuleGated`.

Caching: tenant entitlement rows and the profile are read **per request** (so an unlock is visible on the very
next request). The **catalog snapshot** is cached per API process keyed on `control.catalog_meta.version`, which is
re-read once per request (one PK read), so a staff catalog edit is enforced on the next request on every
instance. Web clients pick catalog changes up on their next `['entitlements']` / `['catalog']` refetch (staleTime
≤ 60 s) and immediately on the tenant realtime `entitlements` event for tenant-specific changes. Fail-closed on
resolver or catalog-read error everywhere (matches the AI gateway's existing order); a failed catalog read never
falls back to a hard-coded map.

### 3.3 Commercial boundaries (what this sprint deliberately does not do, Q6)

No payment provider, card capture, invoices, tax calculation, dunning, proration or PCI scope. Prices come from
the **published price-book version** (U-D3: placeholder values, staff-editable in 07C) and are used for an
**estimate** and a **quote** only; the contract value shown on Billing & plan is whatever Kaenal staff recorded.
Pack prices are **not** framework-conditional this sprint (an IATF tenant pays the listed QE price even though
FMEA/SPC/MSA are already free for it; the pack card shows exactly what the pack adds — §7 Q-C13 [USER]).
Seat/plant limits ("Up to 500 members · 10 plants") are **not enforced** this sprint (§7 Q-C7). All money movement
stays outside the product; the product's job is to record what the customer may use, what they asked for, and to
hand that to sales.

---

## 4. Backend needs (per story) [AM1]

| Story | Migration | Routes (contract + controller) | Service / job | Audit | RBAC | Tenancy notes |
|---|---|---|---|---|---|---|
| P0 | 0073 | `GET /v1/catalog`, `GET /v1/public/onboarding-catalog` (`@Public`) | `CatalogService` (snapshot cache keyed on `catalog_meta.version`); `packages/core/entitlements/catalog.ts` (types, accessors, `validateCatalog`, `CORE_FLOOR_GUARANTEED`) | — (read-only here; writes audited in 07C) | authenticated member/partner; public (active keys/labels only) | control-plane, not tenant-owned; explicit grant test (`kaenal_app` SELECT only; `kaenal_public` column SELECT on two tables) |
| P1 | 0074 (+ `catalog_tiers` in 0073) | — | `packages/core/entitlements/resolver.ts` (`effectiveModules`, `frameworkInclusions`, `packCoverage`, `estimateMonthly`) | — | — | forced RLS on both tenant tables; composite member FKs; reads profile frameworks (O1 AC1-2, wave A) |
| P2 | — | `GET /v1/entitlements` (+ `modules`, `declaredFrameworks`, `catalogVersion`) | `EntitlementsService.get` | — | authenticated | RLS read; realtime topic `entitlements` |
| P3 | — | `@RequireModule` on existing routes (every non-guaranteed module's writes; graph/predictions reads) | lifecycle interceptor, AI gateway | — (refusals write nothing) | after `@RequireCapability` | resolver inside tenant tx; 402 before lookup |
| P4 | — | `PUT /v1/entitlements/packs/:packId`, `POST /v1/entitlements/apply-bundle`, `GET /v1/entitlements/org-profile`, `GET /v1/entitlements/downgrade-impact` (+ `removeFrameworks`) | `EntitlementsService` | `entitlement_changed` | `billing:manage` | `lock_version` / `expectedPacks` 409; self-service flag read from control plane; 422 `already_included` |
| P5 | — (0074) | `POST /v1/entitlements/trials` | job `entitlement-trials` | `entitlement_changed` (user + system) | `billing:manage` | PK once-per-pack; job tenant-iterating; fully covered pack → 422 |
| P6 | 0076 | `POST/GET /v1/entitlements/requests`, `POST …/requests/:id/withdraw` | `PlanRequestsService`, outbox email + outbox `plan_request.changed` (07C projects it) | `created`, `status_changed` | per kind | partial unique open index; foreign id → 404; fulfil/decline in 07C |
| P7 | 0076 | existing `POST /v1/exports` (`plan_quote`) | `run-export.ts` branch | `exported` | `billing:manage` | numbers + price-book version from the same snapshot |
| P8 | 0075 | CLI only (`provision-tenant --bundle` required, `--from-request`) | `provision-tenant.ts` | `system` events for the rows it seeds | migrator role | db-router for dedicated tenants; `control.tenant_plans` app-role SELECT only |
| P9 | 0076 | `GET /v1/billing/plan`, `GET/PUT /v1/settings/billing` | settings service | `settings_changed` | `billing:manage` | `tenant_settings` RLS |
| O1 | 0076 | `GET/PUT /v1/settings/workspace-profile` | settings service; catalog-bound validation | `settings_changed` (+ sales outbox email on frameworks change) | read: member; write: `settings:manage`, `frameworks`: `billing:manage` | backfill `dismissed`; realtime `entitlements` on frameworks change |
| O2 | — | — | `packages/core/onboarding/suggest.ts` (catalog as argument) | — | — | pure |
| O3 | 0075 | `POST /v1/public/workspace-requests` (`@Public`) | intake service, `send-email` | — (no tenant) | public, rate-limited | INSERT-only grant; hashed IP; no PII logs; catalog-validated keys |
| O4 | — | `GET /v1/onboarding`, `POST /v1/onboarding/start|dismiss|resume` | onboarding service | `settings_changed` | `settings:manage` | — |
| O5 | — | `GET /v1/onboarding` (tasks) | task completion queries | — | `settings:manage` | tenant-scoped EXISTS on indexed columns |
| X1 | — | — | seed (+ `globex`), ledger, excluded.md, audit-log UI, mobile | — | — | — |

Gap proof for every "new" route: none of them exist in `packages/types/src/contract.ts` or any
`apps/api/src/**/*.controller.ts` (§1a; re-checked 2026-09-30 for the [AM1] additions: `grep -n -i
"catalog\|entitle\|price" packages/types/src/contract.ts` and the same over `apps/api/src/**/*.controller.ts`
return only the unrelated training **competency** catalog (`contract.ts:1438,1486`,
`training/competencies.controller.ts`) — no pack catalog, price-book or entitlement route). They are all built this sprint (CLAUDE.md rules 0 and 10).
Staff-side routes (catalog/price-book writes, plan administration, request resolution) are specified in
`SPRINT-07C-staff-console.md` §4.

## 5. Design needs

**Existing binding jsx (rule 9 — reproduce pixel-for-pixel):**

| Screen / element | Source |
|---|---|
| Plans & add-ons page (tiers, guardrail callout, pack cards, à-la-carte rows, sticky estimate, header actions) | `pricing.jsx:5-231` |
| Upsell overlay over a locked route (admin variant) | `addons.jsx:201-275` |
| Sidebar lock icons | `shell.jsx:141,164-166,196` |
| Billing & plan section (Current plan card, Billing email, Tax ID) | `settings.jsx:848-869` |
| Onboarding checklist (header, hero, checklist rows, CSM card, Helpful right now) | `adoption.jsx:7-139` |
| Request a workspace form + "Request access →" link | `auth.jsx:117-119,190-213` |
| Industry / Plant size / Compliance-frameworks controls (reused inside the new flow) | `auth.jsx:197-209`, `settings.jsx:454-467` |

**No jsx — the UI Lead Designer must design these (boards in the existing `.k-*` language, web; none on mobile):**

| ID | What to design | Why it is needed |
|---|---|---|
| D-S1 | **First-run setup flow** (`/onboarding`): 4 steps (Industry, Frameworks, Size, Recommended modules) + step indicator, Back/Next, Skip for now, Skip setup; "suggested for <industry>" marking; Recommended-modules list grouped Essential/Recommended/Optional with reason copy, checkboxes and lock chip; re-entry (pre-filled) variant; loading, save-error, 409 "completed by someone else", offline; 375px width. **[AM1]** Plus: catalog-length-agnostic industry/framework layouts (8-9 today, must hold 20+ without redesign, U-D4); "None of these yet" chip; the live "included free with your selection" line under the frameworks chips; the "Included with <framework>" chip on module rows; the manager read-only frameworks state; the `?step=frameworks` entry variant; the framework-removal confirm (reuses D-S8) | O4 — the questionnaire itself has no design anywhere |
| D-S2 | **Request-mode states** on `/pricing` and the overlay: header note; "Requested" chip + disabled button + Withdraw; request dialog (what is requested, optional note, Send); overlay footer copy in request mode | P4/P6, D1 |
| D-S3 | **Non-admin overlay variant** (Request access only; "Requested — your admin has been notified") | P2/P6 |
| D-S4 | **Locked type in CreateWizard / quick-create / palette** (lock chip + inline upsell) | P2 AC7 |
| D-S5 | **Onboarding checklist deviations and states**: CSM empty state (support fallback); hero line without the drawn CSM check-in sentence when no CSM exists; not-started ("Start setup") state; dismissed ("Resume setup") state; completed state; locked-module task row; "Helpful right now" with in-product destinations | O5 |
| D-S6 | **Billing & plan**: no-contract banner variant; "Custom plan" variant; the added "Manage plan" link; confirmation that Payment method + Invoices are removed | P9 |
| D-S7 | **Trial states**: pack-card and overlay "Trial · N days left", "Trial used", trial-ending banner/notification row | P5 |
| D-S8 | **Downgrade confirm dialog** (modules becoming read-only + open-record counts) | P4, D3 |
| D-S9 | **Request-a-workspace confirmation** and error states (rate-limited, server error) | O3 |
| D-S10 | **Notification rows** for the 4 new kinds (web centre; mobile list uses its existing row) | P5/P6 |
| D-S11 | **Accessibility check of the 9 pack accents** as button backgrounds with white text (WCAG AA); darker token where needed | P2 AC6 |
| D-S12 | **[AM1] Tenant-aware guardrail callout and Core tier card** (replaces "rewrite the static copy"): the callout rendered from the tenant's declared frameworks (1, 2, 3+ frameworks; long module lists wrap); the Core card's "Included for <workspace> with <framework>" block; the no-framework variant with the admin-only "Declare frameworks" link; the non-admin read of the same page is not needed (`/pricing` is admin-only) | D2 DECIDED, P4 AC8 |
| D-S13 | **[AM1] Framework inclusion states on pack cards and the overlay**: "Included · <framework short label>" mark on an include row; "Adds <modules>" line on a partially covered pack; "Included with your frameworks" fully-covered card with no CTA; Billing & plan banner "+ included with …" line (with D-S6) | D2 DECIDED, P4 AC9, P9 AC4 |
| D-S14 | **[AM1] Catalog-driven intake form**: Request-a-workspace with a longer industry list and more framework chips than drawn (wrapping rules), and the catalog-unavailable fallback (Other + free text, notice) | O3, U-D4 |

Mobile: no `m-*.jsx` for any of this; `m-auth.jsx` has no request stage. Nothing is designed or built on mobile
except the small X1 items that use existing mobile patterns.

**[AM1] Staff console screens** (sign-in, tenant directory, tenant detail, plan editing, sales inbox, workspace
requests, catalog and price-book editors, platform audit log) have **no jsx anywhere** — verified 2026-09-30 by
grepping every `project_brain/project/src/*.jsx` and `project_brain/mobile/src/m-*.jsx` for
`staff|operator|backoffice|superadmin|impersonat|support access|kaenal support`: the only hits are shop-floor
"operator" strings (e.g. `operations.jsx:586`, `trust-center.jsx:37`) and none is a console. Every console screen
is listed as a design gap in `SPRINT-07C-staff-console.md` §5, not here.

## 6. Dead-end audit (every control this sprint introduces or touches)

| Control | Resolves to |
|---|---|
| Sidebar lock icon (item + child) | Informational; the item still navigates to the module → overlay |
| Overlay: Add to plan | P4 toggle (self-service) or P6 request (request mode) |
| Overlay: Start 14-day trial | P5 trial; "Trial used" state after use; hidden for non-admins and non-trialable packs |
| Overlay: Compare plans | `/pricing` (admins only; hidden for non-admins) |
| Overlay: Request access (non-admin) | P6 `member_access` request + admin notification |
| Pricing: Download quote | P7 PDF export |
| Pricing: Contact sales | P6 `contact_sales` request + sales email |
| Pricing: Apply bundle (Core/Pro) | P4 apply-bundle (self-service) or P6 request; downgrade → P4 confirm |
| Pricing: Current plan | Disabled by design (current tier) |
| Pricing: Talk to sales (Enterprise) | P6 `enterprise_inquiry` |
| Pricing: Add to plan / Added to plan (pack cards) | P4 toggle or P6 request / P4 remove with confirm |
| Pricing: Add / Remove (à la carte) | P4 toggle or P6 request |
| Pricing: Update subscription | P6 `confirm_subscription` (composition + estimate to sales) |
| Pricing: Back to dashboard | `/dashboard` |
| Pricing: Withdraw request (new) | P6 withdraw |
| Downgrade dialog: Cancel / Confirm | No change / P4 change |
| CreateWizard/quick-create/palette locked type | Inline upsell → same CTAs as the overlay |
| Billing & plan: Save (billing email, tax ID) | P9 PUT |
| Billing & plan: Manage plan (new) | `/pricing` |
| Billing & plan: Payment method "Change", Invoices "PDF" | **Not rendered** (Q6), listed in `excluded.md` |
| Sign-in: Request access → / Back / Request access (submit) | O3 stage / workspace stage / O3 POST |
| Setup flow: Next / Back / Skip for now / Skip setup / Finish / + Add another / None of these yet / module checkboxes | O4 (profile PUT, onboarding start/dismiss); all real |
| Checklist: Skip onboarding | O4 dismiss → `/dashboard` |
| Checklist: Schedule kickoff with CSM | CSM booking URL (rendered only when set) |
| Checklist: Start / Continue per task | Each task's real `href` (catalog test forbids dead links) |
| Checklist: Start setup / Resume setup (new) | `/onboarding` / O4 resume |
| CSM card: Book 30 min / Slack message / Email | booking URL / chat URL / `mailto:` — each rendered only when the field exists |
| Helpful right now links | In-product routes from the core catalog (test-checked) |
| Notification rows (4 kinds, web + mobile) | `/pricing?pack=` (web) / web hand-off (mobile) |
| CLI flags (`provision-tenant --bundle/--from-request`) [AM1: `tenant-plan` removed] | Real writes, audited (`system` events for seeded rows) |
| [AM1] Pricing: "Declare frameworks" link (no-framework callout, admins) | `/onboarding?step=frameworks` (O4 deep link), returns to `/pricing` |
| [AM1] Pricing: fully covered pack card | **No control by design** ("Included with your frameworks"); the API refuses toggles/trials/requests for it with 422 `already_included` |
| [AM1] Pricing: "Included · <framework>" marks, Core-card inclusion block, per-tenant callout | Informational, computed from real entitlements + catalog (no control) |
| [AM1] Setup flow: live inclusion line, "Included with <framework>" chip, manager read-only frameworks | Informational / disabled-with-explanation; the only writer is an admin's Next/Finish (profile PUT) |
| [AM1] Framework-removal confirm: Cancel / Confirm | No change / profile PUT (frameworks) |
| [AM1] Request-a-workspace: catalog-driven Industry options and framework chips | Real catalog values; fallback (Other + free text) when the catalog is unavailable |
| [AM1] Anything a staff member does (fulfil/decline, set plan, edit catalog/price book) | Not a tenant-app control; specified with its own dead-end audit in `SPRINT-07C-staff-console.md` §6 |
| Designed demo tasks: Connect SSO, Connect SAP S/4HANA, IATF audit readiness scan, Add plants & areas | **Not rendered** (no real feature yet); `excluded.md` + §7; *Add plants & areas* joins when Sprint 08 ships Sites |
| Designed "Helpful right now" video tour / articles / starter pack | Replaced by in-product destinations until Sprint 12 (knowledge base, tours) — D-S5 deviation |
| Placeholders retired | `/pricing` (`planned:pricing`), settings `billing`, settings `onboarding` |

No "coming soon", no dead control, no placeholder route is introduced.

## 7. Open questions and out of scope [AM1]

**Resolved by the user on 2026-09-30 (retired, kept for traceability).**
- ~~Q-C2 D2 — IATF core tools in Core or in packs?~~ → **U-D2**: neither; framework-conditional inclusions as data
  (§3.0 D2 DECIDED).
- ~~Q-C9 Price book~~ → **U-D3**: jsx prices stay as a **placeholder**, held in the versioned, staff-editable price
  book (P0; editor in 07C C8).
- ~~Q-S2 (list part) Industry list and framework list~~ → **U-D4**: the 8 industries and 9 frameworks are approved
  and must be extensible without a migration (catalog tables, P0). The **size question** part of Q-S2 was not
  answered — see Q-S2b.
- ~~Q-S4 Staff web console~~ → **U-D5**: build it now → `SPRINT-07C-staff-console.md`.
- ~~D1 self-service vs request mode~~ → **U-D1**: confirmed as recommended; new tenants default to request mode.

**Resolved by the PO in this amendment (smallest reasonable choice, recorded; revisitable).**
- ~~Q-C1 default bundle when `--bundle` is omitted~~ → `--bundle` is **required** by `provision-tenant` (no silent
  default); request mode is the default per U-D1.
- ~~Q-S1 build waves~~ → A → B, then C (07C); P0 + P1 (+ O1 AC1-2) first; B and the rest of A in parallel after.
- Split of Increment C into its own sprint file (§ header, "PO scope call").

**Strategic — the user decides before build ([USER]).**
- **Q-D3 [USER] Approve D3** (gates block create/update/transition, never reading or exporting the tenant's own
  records; derived analytics gated on read; reducing actions never gated). Not covered by the 2026-09-30 answers.
- **Q-D4 [USER] Approve D4** (real 14-day trials, once per pack, admin-started, both modes, not for
  `security`/`support`). Not covered by the 2026-09-30 answers.
- **Q-C11 [USER, NEW] The framework-inclusion seed** — which modules each framework includes free (§3.0 D2 table:
  IATF adds FMEA, SPC, MSA, PPAP, Suppliers; ISO 13485 / FDA QMSR add Risk; AS9100 adds Risk + ECN; ISO 9001 and
  the rest add nothing beyond the floor). This is revenue-defining (every IATF tenant gets those five free) and
  compliance-defining (the SME must confirm each `required` reading). It is data, so a later change needs no
  deploy — but the day-one values need the user's commercial sign-off. PO recommendation: approve as proposed.
- **Q-C12 [USER, NEW] Remedy for a false framework declaration.** Declaring IATF 16949 unlocks five modules for
  free and is a self-attestation. Designed now: admin-only field, audited, Kaenal sales emailed on every change,
  history visible in the staff console. Options for more: (a) nothing more — contractual remedy (PO
  recommendation: IATF certification is publicly verifiable, and a verification step would contradict "free
  inclusion never needs a request"); (b) a staff "suspend inclusion for framework X, with reason" override per
  tenant (a 07C story + a resolver input); (c) inclusions apply only after staff verify the declaration (makes the
  free part sales-gated — contradicts D1 "Final").
- **Q-C13 [USER, NEW] Framework-aware pack pricing.** An IATF tenant pays the listed Quality Engineering price even
  though three of its five modules are already free for it. Options: (a) no change — the card shows exactly what
  the pack adds (current design, PO recommendation while the price book is a placeholder); (b) conditional price
  items per framework in the price book (schema extension + 07C editor + estimate/quote logic). Decide before the
  price book stops being a placeholder.
- **Q-S2b [USER] Keep the plant-size question?** The design already asks "Plant size" on the request form; its
  effect on suggestions is deliberately small. Assumed: keep it (O4 step 3) unless the user says drop it.
- **Q-S3 [USER] Existing tenants.** Recommended: not force-prompted (`dismissed` backfill); the checklist is
  available under Settings → Onboarding with "Start setup". Alternative: prompt every existing admin once.
  **[AM1] Related:** existing tenants are backfilled with an **empty** profile, so they declare no framework and get
  no inclusions — harmless today because they are backfilled with every pack `grandfathered` (P1 AC5).
- **Q-S6 [USER] Ongoing nav emphasis.** Should focus modules also change the sidebar (e.g. order focus modules
  first within "Quality system", never hiding any)? Not in this sprint's scope; if yes, it needs a design and a
  story in a later sprint.

**Product/technical — smallest reasonable choice made, recorded, revisitable.**
- Q-S5 QMS SME review of every clause reference (O2's table **and** Q-C11's `required` levels) before it ships as
  copy (DoD item). If no SME is available, reason copy falls back to "Commonly required by <framework>" without
  clause numbers — **but the `required` levels still need the user's Q-C11 sign-off**, because they carry money.
- Q-C3 `security` and `multiplant` packs gate nothing in-product (their design `routes` are empty or planned
  pages). Already-built settings screens they "include" (legal hold, DLP, white-label, cross-tenant analytics,
  cost centers) stay ungated, as drawn. Gate them? Not without a user decision. [AM1] If decided later, it is a
  catalog data edit (07C C7) plus `@RequireModule` on those routes.
- Q-C4 Planned modules (AI governance, developer platform, multi-tenancy) inherit their pack gate when their own
  sprint builds them: [AM1] that sprint adds the `ModuleId` and a `catalog_pack_modules` seed row in its own
  migration (ROADMAP §4 updated accordingly).
- Q-C5 Should close-out transitions (close/withdraw an open ECN or SCAR) stay allowed after a downgrade? Current
  choice: no (all writes blocked, downgrade warns). Revisit if customers report stuck in-flight records.
- Q-C6 Figma-style provisional access while a member request is pending — not included.
- Q-C7 Seat/plant/API limits shown in the design's Organization "Plan & usage" card and Billing banner are not
  enforced; the Organization section (Sprint 08) will show usage against limits only if the user decides limits
  exist.
- Q-C8 The `mobile` à-la-carte pack does not gate the mobile app (every tier bundles it; no mobile locked-state
  design). Gating the app would need a mobile design and would risk rule 12 (sign-in).
- Q-C10 After `platform` is removed, already-connected integrations keep delivering until disconnected (reducing
  is never gated; D3). Stop them instead?
- **Q-P1 [NEW, found this session]** `provision-tenant` / `scripts/lib/seed.ts` write no audit events for what
  they seed today (admin membership, SLA config, default plant, example template). P8 audits only what it adds.
  The pre-existing gap goes to PROGRESS.md Known issues for a later hardening pass; it is not silently fixed here.
- **Q-C14 [NEW]** Tenants whose declared framework is retired by staff keep its inclusions (D2). If a framework is
  ever retired because it was wrong (not merely superseded), staff have no bulk "re-evaluate" tool this sprint —
  recorded, not built.

**Out of scope (named, not silently dropped).** Payment provider, invoices, tax, proration, dunning (Q6); **the
staff console itself (in `SPRINT-07C-staff-console.md`, same release)**; Organization settings section, including
its Identity card and Plan & usage card (Sprint 08 — it will read and write O1's profile, with the same
`billing:manage` rule for frameworks); Sites & areas (Sprint 08); product tours, knowledge base, NPS, adoption
analytics, release notes (adoption.jsx, Sprint 12); mobile onboarding/pricing (no design); SSO/SCIM (Sprint 14).
Any unresolved item above moves to PROGRESS.md "Known issues" at close.

## 8. Definition of Done [AM1]

- [ ] User has approved **D3 and D4** (Q-D3, Q-D4) and answered **Q-C11, Q-C12, Q-C13, Q-S2b, Q-S3** (D1, D2, D5,
      the price book and the industry/framework lists were decided 2026-09-30); UI Lead Designer's boards
      D-S1…D-S14 approved by the user (Gate 1); `planner` architecture review returned SIGN OFF with the slice
      plan, covering both this file and `SPRINT-07C-staff-console.md` (one review of the release, since 07C
      writes this file's tables).
- [ ] Migrations **0073-0076** applied (0077 buffer unused or used for a recorded correction); `pnpm db:migrate`
      clean on a fresh DB and on a DB with existing tenants (backfill proven: existing tenants keep every pack,
      onboarding `dismissed`; catalog seeded: 9 packs, 3 tiers, 8 industries, 9 frameworks, every rule, price book
      v1 published); `pnpm db:check` green; `pnpm test:rls` green including `entitlements` writes,
      `entitlement_trials`, `plan_requests`; **RLS mutation test** (drop one new policy → suite fails) run and
      recorded; explicit grant tests for every new `control` table (P0 AC6), `control.tenant_plans` (app SELECT
      only) and `control.workspace_requests` (public INSERT only).
- [ ] `packages/core` unit tests: `validateCatalog` on the seed (P0 AC3); resolver/tier/estimate including every
      framework-inclusion case and the monotonicity property (P1 AC3); suggestion engine golden + property tests
      including the **essential ⇔ included** no-false-claim property (O2 AC4); task/helpful catalogs with the
      dead-link cross-check (O5 AC3); the no-hard-coded-catalog guard test (P0 AC3).
- [ ] **Extensibility proven without a deploy** (U-D2/U-D3/U-D4): a test inserts a framework + rule, an industry
      and a new published price-book version, and observes them in `GET /v1/catalog`, the public catalog,
      profile validation, `GET /v1/entitlements`, the estimate and a quote (P0 AC7, P7 AC4).
- [ ] Contract + controllers for every route in §4; `@RequireModule` coverage test (P3 AC2) green; 402/403/200
      matrix tests per module including framework-included modules (P3 AC4); every existing gated-module suite
      seeds packs via `grantPacks` and stays green.
- [ ] Every mutation writes its audit event in the same transaction (rule 3), including the trials job's `system`
      events and provisioning's `system` events for the rows it seeds; idempotency on every create (trials,
      requests, public intake); optimistic concurrency on toggles, bundle apply, profile and billing settings
      (rule 6).
- [ ] Web: `/pricing` (tenant-aware: IATF tenant, ISO-only tenant, no-framework tenant), overlay (both variants),
      sidebar locks, create-surface locks, Billing & plan, sign-in request stage (catalog-driven), `/onboarding`
      (incl. `?step=frameworks` and manager read-only), `/settings/onboarding` — each browser-verified
      side-by-side against its jsx or approved board (rule 9), including loading/empty/error/409/offline/
      permission states (04 §6), at desktop and 375px.
- [ ] Playwright journeys: lock → trial → unlock → expiry (clock helper) → locked-but-readable; self-service add/
      remove with downgrade confirm; request mode (`globex`) → sales email in the dev sink → request visible and
      withdrawable (fulfilment is proven in 07C's journeys); member Request access → admin notification →
      self-service add → auto-fulfilled → requester notified; **declare IATF 16949 → FMEA unlocks with no request
      → remove it → confirm → FMEA locks**; public workspace request → `provision-tenant --from-request` → first
      admin sign-in → first-run flow pre-filled → checklist with module tasks → a task self-completes.
- [ ] Mobile: X1 AC5 done; `pnpm --filter @kaenal/mobile typecheck` + mobile tests green; `progress_mobile.md`
      updated.
- [ ] O2 clause copy **and Q-C11's `required` levels** reviewed by a QMS SME, or the Q-S5 fallback wording used
      for copy — recorded in PROGRESS.md.
- [ ] Gates green: `pnpm typecheck && pnpm lint`, `pnpm test`, `pnpm test:rls`, `pnpm db:check`.
- [ ] Demo re-seeded (`pnpm --filter @kaenal/api exec tsx scripts/seed-demo.ts`), `acme` Enterprise bundle +
      self-service restored after browser verification, `globex` present, **real sign-in returns 201** to both
      workspaces (rule 12); sign-in stage change (O3) proven not to affect sign-in.
- [ ] Placeholder ledger shrunk by 3 and renumbered; `excluded.md` updated; CLAUDE.md Commands + `.env.example`
      updated; PROGRESS.md "Current status", Decisions log (U-D1…U-D5 and the PO split decision, with dates) and
      Known issues (every unresolved §7 item incl. Q-P1, Q-C14) updated in the same commit as the work.
- [ ] PO verifies every AC above against code, tests and browser evidence at Gate 2. **Release rule:** this file
      may pass Gate 2 before 07C, but it is not released to any request-mode tenant until 07C passes Gate 2
      (§ header, release coupling).

## 9. Out-of-scope confirmation

No scope beyond `pricing.jsx`, `addons.jsx`, `adoption.jsx` `OnboardingWizard`, `auth.jsx` stage `request`,
`settings.jsx` `Billing` (+ its Industry/Frameworks controls reused in the new flow), 02 §2 `entitlements`, 03 §3,
04 §5, 06 §3.1, 07 §1 and 09 §1 is introduced, **except** the named additions each required to make a designed
control real without a payment provider (plan requests, the self-service flag, trial storage, the
workspace-request store) and the one new design (the first-run flow) that the user explicitly asked for, **and
[AM1] the additions the user's 2026-09-30 decisions require**: the control-plane catalog (packs, pack→module map,
tiers, framework rules, industry and framework lookups) and the versioned price book as admin-editable data
(U-D2/U-D3/U-D4), framework-conditional inclusions in the resolver and on `/pricing` (U-D2), and the `globex` demo
workspace needed to verify them. The operator CLI is removed (U-D5); the staff console is specified in
`SPRINT-07C-staff-console.md`. Each is justified in its story and in §3.0.

---

**[AM1] Decision record.** D1 DECIDED (user, 2026-09-30). D2 DECIDED (user, 2026-09-30; redesigned as
framework-conditional inclusions). Price book: placeholder, staff-editable (user, 2026-09-30). Industry/framework
lists: approved, extensible (user, 2026-09-30). D5 DECIDED (user, 2026-09-30; staff console now, `SPRINT-07C`).
D3, D4: PROPOSED, awaiting approval. Split into `SPRINT-07` (A+B) and `SPRINT-07C` (C): PO decision, 2026-09-30.

**§3 backend + commercial design sign-off: PARTIAL (user).** D1, D2 and D5 approved 2026-09-30 and recorded as
DECIDED; the D2 **redesign itself** (the three-layer model, the no-framework = floor rule, frameworks requiring
`billing:manage`, the tenant-aware pricing page) is the PO's rendering of the user's decision and needs the user's
confirmation that it matches their intent, together with **Q-D3 (D3), Q-D4 (D4), Q-C11 (inclusion seed), Q-C12,
Q-C13**. No build starts before those.

**PO use-case sign-off: PENDING.** Use-case coverage is complete in this amended draft (**16 stories**: P0-P9,
O1-O5, X1; every happy/error/empty/permission/offline/cross-tenant path mapped to testable ACs with a
Web/Mobile/Shared split, including the new framework-inclusion, extensibility and price-book paths). The PO flips
this to SIGNED when the §3 items above are answered, because Q-C11/Q-C12/Q-C13 and D3/D4 change ACs (P1 AC3's
expected sets, P3, P4 AC8-10, P5); signing before those answers would sign ACs that may still change.
