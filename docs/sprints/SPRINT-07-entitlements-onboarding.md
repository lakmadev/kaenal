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
