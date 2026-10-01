# SPRINT-07C — Platform Console (Sprint 07, Increment C)

> **Terminology [AR — architecture review, 2026-09-30].** This increment was drafted as the "staff console". The
> codebase already uses "staff" for a tenant's own internal members (`packages/types/src/enums.ts:50` "internal
> (staff) roles", `apps/api/src/auth/auth.service.ts:180` "staff sessions", the existing member-invite flow), so
> every identifier of the new operator plane is now **`platform`**: roles `platform_support` / `platform_sales` /
> `platform_admin`; capabilities `platform:*`; decorator `@PlatformRoute`; types in the `@kaenal/types/platform`
> sub-entry-point; app `apps/platform`; API entry point `apps/api/src/platform-main.ts`; tables `control.platform_*`;
> DB role `kaenal_platform`; env `DATABASE_PLATFORM_URL` / `PLATFORM_HOST` / `PLATFORM_ALLOWED_CIDRS`; routes
> `/platform/v1/*`. A person with a platform account is a **platform user**; "Kaenal staff" survives only as plain
> English for the company's employees and in quotations of the spec. Three names deliberately keep the word
> "support" because the **spec** names them (01 §3.2 "dedicated `support` role + explicit `app.support_reason`"; 07
> §7 "support role path"): the DB roles `kaenal_support` / `kaenal_support_reader` / `kaenal_support_gate`, the
> existing `audit_events.actor_kind='support'`, and the `support_grants` / `support_view_*` tables — none of them is a
> platform *role* or a *pack*. The file name `SPRINT-07C-staff-console.md` is kept so existing links (ROADMAP,
> SPRINT-07) do not break.

Author: Product Owner. Date: 2026-09-30. Part of the **Sprint 07 release** in `ROADMAP.md` (row 07C), split out of
`SPRINT-07-entitlements-onboarding.md` by the PO under that file's Amendment 1. Governing rules: CLAUDE.md rules 0-12
and `SCRUM.md`. Builds on Sprints 01-06 (merged) and on **Increment A of Sprint 07** (catalog, price book, plans,
requests), which must be merged first. Migration range pre-assigned: **0078-0081** (0081 buffer). Sprint 08 starts
at 0082.

**Why this file exists.** On 2026-09-30 the user decided (U-D5): *build the real platform web console now, not the
audited-CLI-only interim plan.* The user named what it must do: list/search tenants; view/edit a tenant's plan and
entitlements; view/resolve plan requests; edit the pack catalog and the price book (U-D2, U-D3); manage the
industry and framework catalogs (U-D4). Kaenal has **no** concept of a platform-level user today — every identity is
a `control.users` row that acts only through a tenant membership, and every authenticated request runs inside one
tenant's scoped transaction. A platform console therefore needs a new identity, a new session path through the request
lifecycle, a new least-privilege database role and a new app. That is a different risk profile from Increments A/B
(auth and cross-tenant access), so it has its own file, its own design gate and a mandatory security review.

**It is not deferred.** 07C ships in the same release as 07 A/B. Request-mode tenants (the default for new tenants,
U-D1) can raise plan requests after A, but only this increment can fulfil them, so **A, B and C release together and
Sprint 08 cannot open until 07C closes** (ROADMAP §4).

**APPROVAL GATE (ROADMAP §0 Q2) + SECURITY REVIEW.** §3 is a security-relevant backend design with no spec-grade
precedent in this codebase beyond two sentences of the spec (01 §3.2, 07 §7, quoted in §1a). **No build starts
until ~~(1) the user approves §3 and answers §7's [USER] items,~~ ([AM2] done — see below) (2) the UI Lead Designer's
boards for §5 are approved, and (3) the `planner` architecture review and a `security-reviewer` pass both return
SIGN OFF.** **[AR]** The first architecture review returned SEND BACK (Amendment 4); a **re-review** of the amended
files against DoR #4's checklist is now what (3) requires.

**Amendment 2 — final planning amendment, 2026-09-30 (tagged [AM2]).** The user confirmed **full tenant-content
access for Kaenal staff, through the time-boxed (4-hour), reasoned, audited grant** (Q-SC3). The PO's earlier SD7
was **narrower** — grants were scoped to commercial data only and content access / impersonation were explicitly
out of scope — so this amendment **widens** it: a grant now has a scope, and a `content` grant gives a read-only
**support view** of every record in the tenant's workspace (new story **C10**), still fully audited in both logs and
visible to the tenant admin. The lead also instructed the PO to close every remaining question under CLAUDE.md's
standing rule. Decisions:

| # | Decision (2026-09-30) | By | Where it lands |
|---|---|---|---|
| U-SC3 | Full tenant-content access for staff via the 4 h audited grant | user | SD7 (rewritten), SD9 (new), C3, **C10 (new)**, D-C4, D-C12 |
| PO-SC1 | Platform accounts: a bootstrap script creates the first platform admin; that admin creates/manages further platform accounts **in the console** | PO (lead's instruction) | C1 (narrowed), **C11 (new)**, D-C11 |
| PO-SC2 | Production network restriction is an ops runbook item (host check + optional CIDR in code) | PO (standing rule) | §7, CX AC3 |
| PO-SC4 | Provisioning from the console → not built; `provision-tenant` stays the only provisioning path | PO (standing rule) | §7, C6 |
| PO-SC5 | WebAuthn not required; mandatory TOTP is the bar | PO (as recommended) | SD4, §7 |
| PO-SC6 | Platform users may reset a tenant's **ended** trial of a pack (goodwill re-trial), mandatory reason, audited like a plan change | PO (lead's instruction) | C5 AC6, D-C6 |
| PO-SC8 | Every platform user can export **their own** action log as CSV; admins can export what they can already read | PO (lead's instruction) | C9 AC4-AC5, D-C10 |

A note on labels: the lead's message filed the content-access decision under "Q-SC3/SC4". In this file Q-SC3 is
content access and **Q-SC4 is provisioning from the console**, a different question; it is recorded as PO-SC4
above, not as part of the user's decision.

**Amendment 3 — pre-build security review, 2026-09-30 (tagged [AM3]).** A `security-reviewer` pass on §3 (still
fully planning-stage — no code exists) returned **1 High and 3 Medium findings**, plus one prerequisite flagged for
when the architect finalizes C10 AC2's denylist. All four findings are resolved in this amendment; the flagged
prerequisite is recorded as an explicit requirement on that future step. **This amendment closes the findings at
the design level only** — it is a spec fix, not a re-run of the review: the `security-reviewer`'s sign-off on this
revised §3, and a second pass on the built code (already required by CX AC6 and Definition of Ready #3), both still
stand between this file and Gate 2. Nothing here should be read as the security gate being closed by a doc edit.

| # | Finding | Severity | Resolution |
|---|---|---|---|
| SR1 | `content`-scope grant validity was checked only at the application layer (`SupportViewAuthenticator`), never backstopped by the database, unlike the write path's DB-enforced 403 (C10 AC8) | High | SD7 gets a finalized DB-level backstop: a RESTRICTIVE policy + `support_reader_grant_active()` function on every `kaenal_support_reader`-reachable table, mirroring the existing `tenant_isolation` pattern (C10 AC2, AC4, AC8) |
| SR2 | No step-up re-authentication when opening a `content` grant — the highest-privilege action gated only by an hours-old session + free-text reason | Medium | New `POST /platform/v1/auth/step-up` (C2 AC5); required on `content`-scope grant creation only (C3 new AC, UC) |
| SR3 | No rate limit or anomaly detection on `content`-grant creation — unbounded blast radius from one phished-but-past-MFA credential | Medium | Per-platform-user rate limit (5/rolling hour) + a flagged `content_grant_anomaly` platform audit event at 3+ distinct tenants/rolling hour (PO-SC9; C3 new AC) |
| SR4 | List/aggregate reads under a `content` grant logged only route+status+grant id — no record-level reconstruction from list views | Medium | Platform audit event for list/search endpoints under a content grant also captures returned entity ids (capped at 200, with a truncation flag) (C10 AC5) |
| SR5 (flagged, not yet a defect) | The `kaenal_support_reader` denylist is correctly unfinished pending the architect (Definition of Ready), but a table-level denylist alone misses column-level secrets mixed into an otherwise-needed table | Prerequisite | Explicit requirement added to C10 AC2: the architect must also check for column-level secrets when finalizing the list |

New decision from this pass: **PO-SC9** (§7) — the two concrete numbers in SR3's fix (5 grants/hour, 3-tenant
anomaly threshold), decided by the PO under CLAUDE.md's standing rule (smallest reasonable choice, revisitable).


**Amendment 4 — architecture review SEND BACK, 2026-09-30 (tagged [AR]).** The `planner` architecture review of 07 +
07C returned **SEND BACK with 23 blocking defects**, grouped into 15 themes. The PO verified each code citation
before writing a fix (all were accurate except one, noted as AR23) and amended both files; this table itemizes every
separable defect, so it has more rows than the reviewer's count. Sprint 07's side is recorded in its own Amendment 3
(same [AR] tag). **This amendment answers the SEND BACK in the documents; it does not close the architecture gate.**
The reviewer's own follow-up list (theme 15) is carried as Definition of Ready #4, a named re-review checklist, and
the `security-reviewer` must re-read §3 because [AR] changed it materially (DoR #3). No design board for this file
exists yet (the UI Lead Designer's pass is running separately); nothing here claims Gate 1.

| # | Defect (reviewer theme) | Resolution |
|---|---|---|
| AR1 | Staff and tenant pipelines not separated: platform branch inside the ONE global tenant interceptor (`app.module.ts:545`), tenant routes on the platform host; SD1's reason for rejecting a separate process was wrong (1) | Separate platform API process: `platform-main.ts` → `PlatformAppModule`, own listener, deployment and single `PlatformLifecycleInterceptor`; reasoning why this is not a breach of the one-interceptor decision; two-router enumeration test (C2 AC2-AC3, SD1 revised to option (c)) |
| AR2 | `staff` not reserved (`tenant.ts:14`) (1) | `staff` and `platform` reserved; 0078 guard (CX AC2a) |
| AR3 | Tenant API held `DATABASE_STAFF_URL` + `DATABASE_SUPPORT_URL`; support-view validation and platform events via the full staff pool (1a) | Those credentials exist only in the platform process (C2 AC1); new narrow `kaenal_support_gate` role (C10 AC1) |
| AR4 | A cookie picked the authenticator and the pool (1b) | Principal resolved before the tenant tx; pool follows the principal; `current_user` test (C10 AC4) |
| AR5 | Content-grant DB backstop incomplete vs the reviewer's `support_grant_live()` (2) | AM3's function kept as the ONE mechanism and completed: tenant, platform-user status + current role, `clock_timestamp()`, InitPlan per statement, `kaenal_support` commercial scope, `USING` + `WITH CHECK`, built into `apply_tenant_rls`, one body for shared/dedicated (C10 AC2a, SD7) |
| AR6 | `GET /v1/events` SSE outlives a grant (`realtime.controller.ts:30`) (3a) | Refused for support viewers, with the reason refusal beats per-event re-checks (C10 AC4, SD7) |
| AR7 | Presigned URLs live 900 s (3b) | `min(60 s, grant remaining)` (C12 AC6) |
| AR8 | Client caches survive grant end (3c) | Explicit web ACs in `apps/platform` (C4 AC6) and `apps/web` support view (C10 AC7) |
| AR9 | Audit coverage of query / search / graph unclear (4) | Route classification table; `/v1/query*`, `/v1/search`, graph named; query definition logged when there are no ids (C10 AC5) |
| AR10 | `support_accessed` with a real `entity_kind` becomes a customer webhook and throws under the reader role (5) | Verified in `outbox-event.ts` / `audit.ts:201`; `support_view` / `support_grant` internal kinds + both bridges skip them (C10 AC5, C3 AC6, SD11) |
| AR11 | "Unsafe method = 403" breaks read-only POSTs (`query.controller.ts:48-60`) (6) | `@ReadOnlyPost` allowlist with write-guard tests (C10 AC4) |
| AR12 | `support_viewer` principal undefined; 195 member-assuming sites in 38 files; Settings reads undecided (7) | **New story C12**; PO decision **PO-SC10** on Settings reads (§7) |
| AR13 | Commercial grant's History tab needs `audit_events`, which would expose every payload (8a) | Column SELECT + RESTRICTIVE entity-kind policy; Sprint 07 settings events get dedicated kinds (C3 AC3) |
| AR14 | Support-view tables could reference a commercial grant (8b) | Composite `(grant_id, grant_scope)` FK + CHECK; `UNIQUE (id, scope)` (C10 AC1, C3 AC2) |
| AR15 | Role change left content grants live; capability checked only at creation (8c) | Role change ends grants the new role cannot hold; current role re-checked per request by every authenticator and the DB function (C11 AC2, C3 AC1/AC5) |
| AR16 | Catalog / `tenant_plans` could be read from a dedicated DB's stale copy (9) | Primary-database pool always; router-fake test (SPRINT-07 P0 AC5, §3.2) |
| AR17 | Resolver snapshot could mix versions (10a) | Catalog in one `REPEATABLE READ` tx keyed by its own version; tenant inputs in one statement; why one tx is impossible for dedicated tenants (SPRINT-07 P0 AC5, P1 AC7) |
| AR18 | `apply-bundle` check-then-write; 9-row precondition assumed (10b) | `FOR UPDATE` on all 9 rows in fixed order; 9-row invariant made real in provisioning (SPRINT-07 P1 AC5, P4 AC4, P8; C5 AC2) |
| AR19 | Grant creation not idempotent / not unique per scope; price-book drafts and catalog writes unserialized (10c) | Advisory lock + reuse of the open grant (C3 AC7); single-draft index, conditional publish, `catalog_meta FOR UPDATE`, typed count recomputed in-tx (C7 AC2, C8 AC2, SPRINT-07 §3.1) |
| AR20 | Plan-request double fulfilment (10d) | Guarded transition first, before any entitlement change, same tx (C6 AC3) |
| AR21 | "staff" / "support" / "admin" naming collisions (11) | Whole plane renamed to `platform` (terminology note above); import-boundary lint recommended (CX AC1) |
| AR22 | Outbox treated as a generic bus: PII to wildcard webhooks; `sales_inbox` unwritable from the tenant-tx drainer (12a) | Ids-only internal events (`outbox.audience`), webhook skip, `InternalProjectionHandler` + `kaenal_projector` (SD11, C4 AC2, C6 AC1; SPRINT-07 P6 AC6, X1 AC8) |
| AR23 | "Email in the same transaction" is false (12b). *Correction to the review:* today's call sites enqueue **before** commit, not after (`auth.controller.ts:221`) | After-commit enqueue chosen and applied everywhere; durable records carry the hand-offs (SD12; SPRINT-07 P6, O1, O3; C6, C11); the pre-existing in-handler enqueues → Known issues |
| AR24 | SD5 updated an append-only row (12c) | Intent row + outcome row referencing it; flagged outcome-less intents (SD5, C3 AC2) |
| AR25 | `kaenal_support` grants incomplete (12d) | + INSERT `notifications`, SELECT `notification_prefs`, column SELECT `memberships (user_id, role, status)`; PO also found and added the QMS status columns C5's downgrade counts need (C3 AC3) |
| AR26 | C7 AC1 promised cross-tenant counts that AC3/SD7 forbid (12e) | Counts struck from C7 AC1 and §4 |
| AR27 | P2 AC4 locked only today's gated routes (12f) | Every non-guaranteed module wrapped via `MODULE_ROUTES`, resolver decides (SPRINT-07 P2 AC4, AC7) |
| AR28 | `entitlement_trials` lacked an `id` and exactly-once expiry; `entitlements.created_by`/`updated_by` had no FK (13) | `id uuid`, `expiry_processed_at`; FKs by `ALTER` on the existing columns (`0001_core.sql:618`) (SPRINT-07 P1 AC4, P5 AC2) |
| AR29 | New LOGIN roles would inherit the local default password on every dedicated DB via `migrate-tenants` (14) | All five new roles `NOLOGIN`; credentials set by provisioning / ops / dev-only `db:dev-roles` (SD6) |

Reviewer items confirmed sound and left as designed (theme 14): migrations 0073-0081 free on every branch; 07C's
dependency on 07's schema satisfied by filename order; 07C adds no new tenant tables, so the RESTRICTIVE policies
combine correctly with `tenant_isolation` (no `TO` clause). The resolver's catalog-as-argument / cached-by-version
design is kept (theme 9), with AR16's trap closed.

Where the PO did **not** apply the reviewer's wording literally, and why: (1) AR17 — one `REPEATABLE READ`
transaction over profile + entitlements + trials + catalog cannot exist for a dedicated tenant (two physical
databases), so each side gets its own consistent snapshot; (2) AR3 — `kaenal_support_gate` needs two column-scoped
writes beyond the reviewer's list (insert the support-view session at exchange, set `revoked_at` at End), stated
with their reason; (3) AR5 — the two RESTRICTIVE **policies** keep AM3's names (`support_reader_grant_active`,
`support_commercial_grant_active`) per the lead's instruction not to introduce a second mechanism; **[AR2] the backing
FUNCTION is renamed below (Amendment 5) to disambiguate it from the policy of the same name** — a naming fix, not a
second mechanism; (4) AR21 — the DB roles keep "support" because the spec names a "support role" (01 §3.2), and the
spec term is not a platform role or a pack.

**Amendment 5 — architecture-review delta check, 2026-09-30 (tagged [AR2]).** A second, narrower `planner` pass —
run only over Amendment 4's own new mechanisms, not a full re-review — confirmed AR1-AR29's big-picture fixes hold
(pipeline separation, the single RESTRICTIVE mechanism, the webhook-leak fix, the two-snapshot concurrency reasoning,
the full staff→platform rename) and found **5 small, concrete bugs (B1-B5)** in what Amendment 4 itself introduced,
plus delivered build-ready reference material (exact route/capability lists, denylists, RBAC gaps) that this
amendment folds into the spec rather than leaving as review commentary. The reviewer characterized this pass as
narrow and said a delta check is enough for the *next* pass, not a full re-review. Every fix below is a text
amendment to an existing story; no story is added or removed.

| # | Bug (reviewer finding) | Fix | Where it lands |
|---|---|---|---|
| B1 | A `content` grant cannot write its own tenant audit-transparency row: AR5's `WITH CHECK` requires a live **commercial** grant for every `kaenal_support` INSERT into `audit_events`, but C3 AC6/AC7 need exactly that write for a **content** grant, and AC7 separately makes `SupportAccess.withTenant` refuse content grants outright | `audit_events` gets its own dedicated, command-scoped RESTRICTIVE policy for `kaenal_support` (not the generic FOR-ALL one); new narrow `SupportAccess.recordGrantStart` method; explicit activation ordering; `mirror_failed` widened to `activation_failed` | C3 AC2, AC3, AC6, AC7; C10 AC2a; SD5 |
| B2 | `kaenal_support` has INSERT on `notifications` but `NotificationsService.notify()` (`apps/api/src/notifications/notifications.service.ts:218-238`) does `INSERT … RETURNING <columns>`, which needs SELECT on those columns too — a blanket SELECT would expose real QMS notification bodies | A narrower platform-side writer that inserts and `RETURNING id` only, backed by a column-scoped `SELECT (id)` grant | C3 AC3; C5 AC3; C6 AC3 |
| B3 | SD12's "enqueued after commit" premise is false for `notify()`'s own emails (it enqueues **inside** the caller's transaction, before commit, per `notifications.service.ts:244` / `deliver-notification.ts:38-39`, and the processor silently drops the email on a rollback-adjacent race) — true only for this amendment's own new direct `sendEmail` calls. Citation correction: `auth.controller.ts:255` is `@Public` with no tenant transaction, not part of this bug | Route `notify()`'s job-enqueue through the same after-commit job buffer SD12 already built for the direct calls | SD12 |
| B4 | Process-global single-slot observers (the realtime + outbox audit bridges, installed once by `AppModule.onModuleInit`) write into the **tenant** `RequestContext`, a no-op outside a tenant request — so a `withAudit` call made inside `SupportAccess.withTenant` silently drops its realtime signal, breaking C5 AC4's "overlay lifts without reload" as designed; CX AC1's import allowlist never named the bridges, publisher, job producer or notification writer as shared; the two-router test would let simultaneous module boot clobber a single-slot registration | A genuine `apps/api/src/shared/**` layer: a context-agnostic after-commit store for signals + jobs, usable by both contexts, plus the audit bridges, realtime publisher, job producer, `CatalogService` and a notification writer; both apps import **only** `shared/**` on the other's side; the two-router test boots the modules **sequentially**, stated as a requirement, not left to be rediscovered as flakiness | New SD13; CX AC1; C2 AC3 |
| B5 | The outbox drainer's `ORDER BY created_at LIMIT n` claim strategy re-claims held internal rows (no registered handler) at the head of every batch; once a tenant accumulates `batchSize` of them, real customer webhooks stop draining | The claim query explicitly excludes internal rows with no registered handler, so they never occupy a batch slot (they are still held, never dead-lettered — only the *claim* query changes) | SD11 |

**Two PO decisions the reviewer flagged (R2), decided here, not silently guessed:**
- **Risk "open" definition (R2a).** Migration `0064_risk_register.sql`'s actual enum is `active` / `monitoring` /
  `accepted` — there is no `closed` status, so Sprint 07 P4 AC5's "open = status ≠ closed" cannot be built as worded
  for risk. **Decided:** for the downgrade-warning context, a risk record is **open** when its status is `active` or
  `monitoring`; `accepted` is **not** open. Reasoning: an accepted risk is a closed decision (the organisation chose
  to accept the residual risk and recorded that decision) — it is not an in-flight record that a downgrade would
  interrupt, so warning about it would be noise. This is a smallest-reasonable, revisitable PO call under CLAUDE.md's
  standing rule. Lands in SPRINT-07 P4 AC5, and in this file's C3 AC3 per-module open-column grant list.
- **FMEA / SPC / customer-supplier portal have no "open record" concept (R2b).** FMEA has no status column at all;
  SPC and the portal have no lifecycle concept at all. **Decided:** these three modules simply have **no**
  open-record downgrade-warning behaviour — there is nothing to warn about, because there is no in-flight state to
  freeze. This is a deliberate scope boundary stated here, not an oversight found later. Consequence: `kaenal_support`'s
  column-scoped SELECT grants for the downgrade-impact count (C3 AC3, AR25's addition) correspondingly **exclude any
  status column for these three modules**, because none exists to grant.

**Smaller confirmed fixes made in this amendment:**
- **C1 AC4** said "C2's lifecycle branch" — stale wording from before AR1's pipeline-separation fix (there is no
  branch inside a shared interceptor any more). Corrected in place to name the platform API process's own lifecycle
  interceptor.
- **SD7** carried an un-struck AM3-era paragraph describing the DB backstop as "a second, RESTRICTIVE policy
  `support_reader_grant_active`, scoped `TO kaenal_support_reader` only" — the version superseded by AR5's
  reconciliation (two policies, both roles) in the very next paragraph. Struck explicitly below so it cannot be built
  as the superseded single-role version.
- **Function/policy name collision.** The RESTRICTIVE **policies** keep their AM3 names
  (`support_reader_grant_active` `TO kaenal_support_reader`; `support_commercial_grant_active` `TO kaenal_support`);
  the backing **function** both call is renamed to **`support_content_grant_active(expected_scope)`** so a reader
  never has to infer from context whether "`support_reader_grant_active`" names the policy or the function. Purely a
  clarity fix — no behaviour changes. Applied throughout C10 AC2a, SD7 and the data-model table below.
- **R1-R10 build-ready reference content** is folded into the spec as new **§3.4** below (not left as review
  commentary), with cross-references from the ACs each item bears on. R1's dead-button gap (C4 AC2's "Refresh" tenant
  row action having no backing route) is fixed by adding `POST /platform/v1/tenants/:id/summary/refresh` to C4 AC2.
- **`DESIGN-07C-staff-console.md` is stale** (still says `apps/staff` and "C1-C11"; has no board or state for C12 or
  the step-up-auth flow added to D-C4). **Not fixed here** — design-doc edits are not this role's job. Flagged
  explicitly in §5 and in the Definition of Ready as a required `ui-lead-designer` re-sync pass, to be dispatched
  separately.

**Amendment 6 — architecture-review delta check #2, 2026-10-01 (tagged [AR3]).** A third, narrower `planner` pass —
explicitly scoped by the reviewer to Amendment 5's own fixes only ("a delta check limited to D1, D2, and S1-S6 is
enough for the next pass") — found **2 blocking defects (D1, D2)** in B1's RESTRICTIVE-policy mechanics and B3's
job-processor coverage, plus **6 small fixes (S1-S6)**. Every fix below is a text amendment to an existing story or
to §3/§3.4; no story is added or removed.

| # | Defect / fix (reviewer finding) | Fix | Where it lands |
|---|---|---|---|
| D1(a) | RESTRICTIVE policies are ANDed, not overridden — AM5's "`audit_events` additionally carries … supersedes …" wording for `support_audit_write_scope` is impossible to build as written: the generic `support_commercial_grant_active` FOR-ALL policy would still block a content grant's INSERT into `audit_events` even with the new policy present | `apply_tenant_rls()` (0079) gets a named, explicit exception: `audit_events` is skipped for the commercial FOR-ALL policy specifically (it keeps the reader policy for content-scope reads) and instead gets only the two dedicated, command-scoped policies (`support_commercial_audit_scope` FOR SELECT, `support_audit_write_scope` FOR INSERT) already named in C3 AC3 | C10 AC2a; C3 AC3; §3.1's 0079 row; schema + mutation tests |
| D1(b) | `support_commercial_audit_scope`'s USING clause filters by `entity_kind` only, with no liveness check — an expired grant or a content-only grant could still read commercial audit rows if `SupportAccess`'s application-layer check were bypassed | Add `AND (SELECT support_content_grant_active('commercial'))` to the USING clause (safe: the `withAudit` INSERT path has no RETURNING, `packages/db/src/audit.ts:174-178`) | C3 AC3; new DB-level tests, C3 AC10 |
| D1(c) | A dedicated-database `support_grant_backstop` mirror can stay live after an activation failure: if the mirror insert (step 2) commits and a later step (step 3, the tenant audit-transparency write) fails, nothing un-lives the mirror — `activation_failed` was missing from the list of outcomes that propagate `ended_at` to it | `activation_failed` added to that list: the same request that ends the grant `activation_failed` also immediately sets `ended_at` on the mirror row if it was already committed, synchronously, not queued for the retry job | C10 AC2a; SD5's grant-activation ordering note; new test, C3 AC10 — **[AR4] superseded by Amendment 7: the mirror insert and the audit-row insert are restructured into one atomic transaction, removing the failure window instead of clearing it up after the fact; the synchronous `UPDATE … SET ended_at` described here is no longer built** |
| D2 | `notify()` is called from numerous job processors (`scan-file`, `complaint-sla`, `document-expiry`, `training-expiry` ×2, `run-export`, `calibration-due` ×2, the `sla` sweep, Sprint 07's P5 trial-notification processor) running inside `withTenant` with **no** HTTP request context at all; SD13's after-commit store is scoped only to the tenant-request or platform-request context, and "no context" is silently a no-op today (confirmed `apps/api/src/context.ts:66-72`'s `bufferRealtimeSignal`) — B3's fix, as worded, would silently **drop** every one of these deliveries | Four-part fix: (i) SD12's buffer and SD13's store are named explicitly as the **same single mechanism**, not two similar ones; (ii) a **third scope type** — a processor-opened scope, flushed after the processor's own transaction commits — is added for job processors, which have no HTTP context to piggyback on; (iii) a job-enqueue call made with **no** active scope (HTTP-tenant, HTTP-platform, or processor) **throws immediately** instead of silently no-op'ing; (iv) a DoD test proves a processor-path `notify()` call enqueues exactly one delivery job after that processor's transaction commits, and that `notifyMinimal()` goes through the identical path | SD12; SD13; DoD — **[AR4] (iii) narrowed by Amendment 7: the blanket throw-on-no-scope broke seed scripts, tests and `@Public` routes; it now applies only to the shared buffer's job-enqueue path, with an exhaustive caller table (SD13 D2(v)) naming every category, and seed/test code fixed by opening a processor scope rather than being broken or silently exempted. Amendment 7 also fixed a separate, pre-existing bug found while building that table: the worker's `NotificationsService` has no real producer (SD13 D2(vi))** |
| S1 | C3/C5/C6's ACs call `NotificationsService.notifyMinimal()` directly from platform code, but `NotificationsService` lives in `apps/api/src/notifications` — violating CX AC1's import-boundary rule (platform code may import only `shared/**` on the tenant side) | Named: the actual writer is a shared, context-agnostic `notifyMinimal()` in `apps/api/src/shared/notifications.ts` (the writer SD13 already places in `shared/**`); `NotificationsService.notify()` delegates to it internally for its own INSERT; platform code imports the shared `notifyMinimal()` directly, never `apps/api/src/notifications` | C3 AC3; C5 AC3; C6 AC3; SD13 |
| S2 | Nothing stated that `PlatformAppModule.onModuleInit` installs the shared audit/realtime bridges — without it the platform process has empty observer slots and C5 AC4 ("overlay lifts without reload") stays broken even after B4's fix; SD13 cites the audit-bridge path as `apps/api/src/...audit.ts:57,85` (wrong — it is `packages/db/src/audit.ts:57,85`) | Explicit requirement added: `PlatformAppModule.onModuleInit` installs the same shared bridges `AppModule.onModuleInit` does; the sequential two-router test (C2 AC3) also asserts both processes' observer slots are populated after boot; citation corrected | SD13; C2 AC3 |
| S3 | SD7's own R6 paragraph says `current_setting` uses the "single-argument form wrapped in `NULLIF(..., '')`" while showing `current_setting('app.grant_id', true)` — the two-argument form — contradicting itself and C10 AC2a's own correct text | Wording fixed to "two-argument, non-throwing form" | SD7 (R6 paragraph) |
| S4 | §3.4 R1 gives the tenant-summary-refresh route `platform:tenants:read`, but C4 AC2 (the actual story AC) says `platform:tenant:access`; R1's first row mislabels the pre-session `sign-in`/`mfa` routes as "session only" | R1's table row split: `GET /tenants` (list) keeps `platform:tenants:read`; `GET /tenants/:id`, `/:id/history` and `POST /:id/summary/refresh` (all grant-required) now say `platform:tenant:access`, matching C4 AC2/AC3's own wording; `sign-in`/`mfa` relabelled `@PlatformPublic` (pre-session), separated from the session-only row | §3.4 R1 |
| S5 | Circular reference: 07C's DoR R2 says the open-record module list "was already produced in P4 AC5"; Sprint 07's P4 AC5 says "the architect lists the rest (SPRINT-07C DoR re-review item R2)" and also opens with a stale "corrects the wording below" pointing at text a prior amendment already removed | Both reworded: P4 AC5 states its per-module examples are a slice-plan **input**, not a finished list, feeding 0079's column-grant list; the dangling "corrects … below" clause is dropped; 07C's DoR R2 says the architect **produces** the remaining per-module definitions from that input, not that they are "already produced" | SPRINT-07 P4 AC5; 07C DoR item R2 |
| S6 | The spec states a fixed call-site count ("195 sites/38 files", "~204/36 files") in several places; a fresh grep today gives **195 matches/38 files** for the three named helpers, **202/42** once direct `.membership`/`requireMembership` sites are counted, **plus** a previously-uncounted helper family (`inspections.controller.ts`'s local `membership(ctx)`/`actorId(ctx)` at lines 176/180); `query.controller.ts:68` is inside a helper's own definition, not a call site — the real call sites are `:41` and `:86` | No AC depends on an exact number again: the **grep pattern** (the named helper/method set) is recorded as the authoritative definition of scope; any count given is explicitly labelled an illustrative, approximate snapshot; the local-helper family and the `:41`/`:86` correction are folded in; §4's C12 row no longer cites "195" | C12 "Verified current state"; §3.4 R8; §4 C12 row |

---

## 0. Research grounding — the patterns this increment borrows

| # | Pattern | Who does it (publicly documented; cited from general product knowledge of their public docs) | What Kaenal takes from it | Used in |
|---|---|---|---|---|
| RC1 | **A separate operator plane.** Vendor staff administer customers from a surface that is not the customer app: its own URL, its own staff accounts, its own audit. | GitHub Enterprise Server "site admin" (stafftools) dashboard; Atlassian and Salesforce internal admin tooling | A separate app (`apps/platform`) on a separate host, a platform identity that is never a tenant member, and a platform audit log | C1-C4, CX |
| RC2 | **Customer-visible, justified platform access.** Every vendor-platform access to customer data carries a justification and appears in a log the customer can read. | Google Cloud Access Transparency (platform access logged with a justification reason, visible to the customer); Salesforce "Grant login access" (time-boxed) | The spec already mandates this (07 §7): a **time-boxed support grant (4 h) with a reason**, written to the tenant's own audit log as "Kaenal support accessed …" | C3, C4 |
| RC3 | **Just-in-time, least-privilege access.** Access is granted per target, per purpose, expiring; the credential can touch only what the purpose needs. | JIT / break-glass access patterns in cloud IAM | A dedicated `kaenal_support` DB role (01 §3.2) with table/column grants limited to commercial data, RLS still enforced, plus an API-level grant check | C3 |
| RC4 | **Prices are immutable versions.** A price is never edited in place; a new version is published and old quotes keep pointing at theirs. | Stripe Prices (a Price's amount cannot be changed; you create a new Price); CPQ price books | Price-book **draft → publish → archive** (Sprint 07 P0 schema), edited here | C8 |
| RC5 | **Blast-radius preview before a global change.** A change that affects many customers shows who is affected before it applies and requires an explicit, reasoned confirm. | Feature-flag and IAM consoles (targeting previews, change reasons) | Catalog edits that alter any tenant's effective modules show the affected tenants and require `platform_admin` + reason + typed confirmation | C7 |

---

## 1. Goal and roles served

Give Kaenal staff a **real, secure, audited web console** to run the commercial side of the product that Sprint 07
A/B built: find a tenant, see and change its plan, resolve what it asked sales for, and maintain the catalog, the
framework inclusions and the price book as data — with every tenant-touching action justified, time-boxed, visible
to the tenant ~~, and incapable of reaching tenant QMS content~~. **[AM2]** A `commercial` grant reaches only
commercial data (and is the only path to commercial writes); a `content` grant gives a **read-only** view of all of
the tenant's records (C10) and can write nothing but its own audit trail — enforced by the database role, not only
by the service.

| Role | What they get |
|---|---|
| **`platform_support`** | Sign in (password + mandatory TOTP); tenant directory; open a tenant (commercial grant with reason) and read its plan, packs, trials, framework inclusions, profile, requests and history; read catalog and price book; **[AM2] open a `content` grant and use the read-only support view of the tenant's workspace (C10)**; own activity log + CSV export. No commercial writes |
| **`platform_sales`** | Everything `platform_support` has **except content grants** [AM2] (least privilege: sales work needs no QMS records), plus: change a tenant's packs / bundle (incl. Enterprise), self-service flag, contract and CSM fields; **[AM2] reset an ended trial**; fulfil / decline plan requests; triage workspace requests |
| **`platform_admin`** | Everything `platform_support` and `platform_sales` have (incl. content grants), plus: edit the catalog (packs' display/trialability/module map, framework rules, industries, frameworks) and the price book (draft/publish); read and export the platform audit log; **[AM2] manage platform accounts (C11)** |
| **Tenant admin** (existing tenant role) | Sees every platform access and change in Settings → Audit log as "Kaenal support — <reason>" (07 §7 transparency) — **[AM2] including "opened read-only access to your workspace" and each record viewed** ("Kaenal support viewed NCR-0042"). Gains no new control |
| **Tenant members, partners, prospects** | Unaffected. No tenant session can reach any platform route and no platform session can reach any tenant route; **[AM2]** the only platform presence on a tenant host is a grant-bound, read-only support-view session (C10), which is not a member session and cannot act as one |

**Mobile.** No platform console on mobile (no design; an internal desktop tool). The mobile app is unaffected: the only
effects it can observe are entitlement changes, which already arrive through Sprint 07's realtime/notification
paths, and **[AM2]** support-access audit events in the oversight audit feed, which the existing generic row already
renders ("Support accessed", `apps/mobile/src/app/(app)/audit.tsx:11-22`). The support view (C10) is web-only
(staff work at a desktop). Proven by `pnpm --filter @kaenal/mobile typecheck` + mobile tests staying green.

## 1a. Verified current state (grepped this session, 2026-09-30)

| Fact | Evidence |
|---|---|
| **Spec for staff access exists, in two sentences.** 01: "Cross-tenant admin (Kaenal staff support tooling) uses a dedicated `support` role + explicit `app.support_reason` audit field — never bypasses RLS silently." 07 §7: "Support (Kaenal staff) access: only via the support role path with reason + time-boxed grant (4h), fully audited, visible to the tenant admin in their audit log ('Kaenal support accessed…') — transparency is a feature." 07 §1 logs "support-role access (with reason)" | `implementation/01-ARCHITECTURE.md:61`, `07-SECURITY-COMPLIANCE.md:6,47` |
| **No platform-level identity exists.** `control` holds `tenants`, `users`, `password_resets`, `mfa_recovery_codes`, `push_tokens`, `audit_partition_stats` — no staff, operator or admin table. A `control.users` row acts only through a tenant membership | `grep -hoE "CREATE TABLE (IF NOT EXISTS )?control\.[a-z_]+" packages/db/migrations/*.sql` |
| **Every authenticated request is tenant-scoped.** `RequestLifecycleInterceptor` resolves a tenant (header / subdomain / `kaenal_tenant` cookie; none → 404), opens `withTenant`, authenticates inside it, then RBAC. `@Public` skips everything (no DB scope); `@AllowAnonymous` keeps the tenant tx without a session; everything else is default-deny | `apps/api/src/lifecycle.interceptor.ts:69-230`, `apps/api/src/decorators.ts` |
| Sessions resolve **inside** the tenant tx (RLS on `sessions`); cookie `kaenal_session`, CSRF double-submit `kaenal_csrf` / `x-csrf-token`, bearer for mobile | `apps/api/src/auth/session.authenticator.ts:10-118` |
| **`CONTROL_POOL` is the migrator (superuser) connection** and is already a tracked Known issue ("more reach than the API needs … should be replaced before production"). The platform surface must **not** reuse it | `apps/api/src/app.module.ts:255-262`; `PROGRESS.md:3210-3216` |
| DB roles today: `kaenal_app` (API, no BYPASSRLS), `kaenal_public` (no tenant tables), migrator. RLS policy `tenant_isolation` has **no `TO` clause** (applies to every role), so a new role is isolated by the same policy automatically | `0000_foundation.sql:44-59,151-155` |
| **Audit already supports staff actors.** `audit_events.actor_kind` allows `support`; CHECK `actor_kind <> 'support' OR reason IS NOT NULL`; action `support_accessed` exists in the action CHECK; the web audit log already renders `support` as a source | `0001_core.sql:707,727`, `0015_audit_partitioning.sql:47-55`, `0061_audits_module.sql:73-81`, `apps/web/src/features/settings/sections/audit-log.tsx:50` |
| Reusable auth primitives: argon2id hashing (OWASP floor), TOTP secret encryption, lockout constants (`LOCKOUT_DURATION_MS` 15 min), Redis `RateLimiter`, constant-time compare | `apps/api/src/auth/passwords.ts`, `mfa-crypto.ts`, `packages/core/src/auth-policy.ts:15-37`, `apps/api/src/http/rate-limit.ts` |
| Dedicated (Model B) tenants: `TenantPoolManager.poolFor(tenantId, secretRef)` opens a pool from the tenant's **app** secret ref; there is no support-role credential for dedicated databases | `apps/api/src/tenant/pool-manager.ts:38-50` |
| `apps/web` is one Next.js app whose root layout wraps every route in `NextIntlClientProvider` + the app `Providers`, with the tenant shell in the `(app)` group layout, and proxies `/api/*` to the API for same-origin cookies; no middleware. `pnpm-workspace.yaml` includes `apps/*`, so a new `apps/platform` joins the workspace with no config change | `apps/web/src/app/layout.tsx:49-50`, `apps/web/src/app/(app)/layout.tsx`, `apps/web/next.config.*:35-37`, `pnpm-workspace.yaml` |
| **No design exists for any platform screen.** Grep of every `project_brain/project/src/*.jsx` and `project_brain/mobile/src/m-*.jsx` for `staff|operator|backoffice|superadmin|impersonat|support access|kaenal support` → only shop-floor "operator" strings (`operations.jsx:586`, `trust-center.jsx:37`, `settings-extra.jsx:556`, …) | grep, this session |
| Sprint 07 A provides what this increment edits: `control.catalog_*`, `control.framework_module_rules`, `control.price_book_*`, `control.tenant_plans`, `control.workspace_requests`, tenant `entitlements` / `entitlement_trials` / `plan_requests`, the `plan_request.changed` outbox event, and the `plan_request_resolved` notification kind | `SPRINT-07-entitlements-onboarding.md` §3.1, P0, P6 AC6 |

---

## 2. Stories

Order by dependency (INVEST): C1-C3 are the security foundation (identity, session path, access model) and ship
before any screen; C4 is the first screen; C5-C8 are the commercial capabilities the user named; C9 is
accountability; **[AM2] C10 is the user-decided content access (read-only support view) and C11 platform account
management**; **[AR] C12 defines the `support_viewer` principal C10 depends on (build C12 with or before C10's tenant
side)**; CX is isolation and wiring. Every story states its Web / Mobile / Shared split: **Web** here means
`apps/platform` (the tenant web app `apps/web` is untouched unless stated), **Mobile** is always "unaffected" with the
reason, **Shared** is `packages/types` (platform contract, a separate entry point), `packages/core` (platform RBAC, pure
rules), API and migrations.

### C1 — Platform identity and bootstrap (Shared foundation)

**Design:** none (data + CLI); the account-setup page is D-C2.

UC
- Happy (bootstrap, [AM2] PO-SC1 — mirrors how `provision-tenant` / `seed-demo` bootstrap the tenant side): an
  engineer with migrator access runs `pnpm platform-bootstrap --email ana@kaenal.com --name "Ana"`; the script creates
  a **`platform_admin`** in `pending_setup` and prints a **one-time setup link** (valid 24 h) and nothing else secret.
  Ana opens it on the platform host, sets a password (tenant password policy), enrols TOTP (QR + secret), saves 10
  recovery codes, and lands signed in. From then on Ana creates and manages every further platform account in the
  console (C11).
- Break-glass: when an active platform admin already exists, `platform-bootstrap` refuses unless `--reason "…"` is given
  (e.g. every admin lost their second factor); with a reason it creates one more admin and records the break-glass
  in the platform audit log. It has no other subcommands: create / role / deactivate / reactivate / reset live only
  in the console, so there is **one** platform-account management write path (the lesson of the removed `tenant-plan` CLI).
- Error: duplicate email → exit 1; an active admin exists and no `--reason` → exit 1 before touching the DB; an
  expired or used setup link → "This link has expired — ask a Kaenal admin for a new one" (no detail about whether
  the account exists).
- Separation: a platform email may also exist in `control.users` (a Kaenal employee who is also a demo-tenant member);
  the two identities never share a credential, session or MFA secret, and neither can become the other.
- Permission: the migrator-role script creates platform admins (bootstrap / break-glass); everything else is
  `platform:users:manage` in the console (C11).

AC
1. Migration `0078_platform_identity.sql`: `control.platform_users` (`id` uuidv7, `email citext UNIQUE` ≤ 254,
   `display_name` ≤ 80, `role` CHECK `platform_support|platform_sales|platform_admin`, `status` CHECK `pending_setup|active|deactivated`,
   `password_hash` NULL until setup, `mfa_secret_enc` NULL until setup, `mfa_enabled_at`, `failed_attempts int`,
   `locked_until`, `last_sign_in_at`, `lock_version`, `created_at`, `updated_at`); `control.platform_setup_tokens`
   (`token_hash` PK, `platform_user_id`, `purpose` `setup|reset`, `expires_at`, `used_at`);
   `control.platform_mfa_recovery_codes` (hashed, single-use). No tenant table references a platform-user id by FK.
2. `CHECK (status <> 'active' OR (password_hash IS NOT NULL AND mfa_enabled_at IS NOT NULL))` — an active platform
   account without MFA is impossible at the database level (07 §7 spirit; MFA mandatory for platform users, §3 SD4).
3. **[AM2]** `packages/db/scripts/platform-bootstrap.ts` + `package.json` script `platform-bootstrap` (`--email`, `--name`,
   `--reason` required when an active admin exists), writing the creation (and, for break-glass, the reason) to
   `control.platform_audit_events` (C3) in the same transaction as the row; setup tokens stored hashed (the raw token
   only ever printed once). The earlier `platform-user create|list|set-role|deactivate|reactivate|reset` CLI is
   **not built** — those operations are C11.
4. Setup routes (platform host only, served by the platform API process's own `PlatformLifecycleInterceptor` — C2
   AC2, not a branch of the tenant interceptor — no session required): `GET /platform/v1/setup/:token`
   (validity only), `POST /platform/v1/setup/:token/password`, `POST /platform/v1/setup/:token/mfa/enrol`, `POST
   /platform/v1/setup/:token/mfa/activate` (returns recovery codes once, marks the token used, sets `active`, starts a
   session). Reuses `passwords.ts` and `mfa-crypto.ts`; rate-limited per IP.
5. Tests: bootstrap → setup → active; bootstrap refused without `--reason` while an active admin exists, accepted
   and audited with one; the MFA CHECK rejects a hand-written activation without MFA; token single-use and expiry;
   a `control.users` row with the same email is unaffected by every platform operation and vice versa; grant test:
   `kaenal_app` and `kaenal_public` cannot SELECT any `control.platform_*` table.

Web (`apps/platform`): the setup page (D-C2). Mobile: unaffected (no platform surface on mobile). Shared: migration, CLI,
setup routes, Zod bodies in the platform contract.

Backend: migration 0078; bootstrap script; setup routes; audit → platform audit (C3); RBAC n/a (pre-session);
tenancy: control plane only, touches no tenant table.

### C2 — Platform authentication, sessions and the platform API process's request lifecycle (Shared foundation)

**Design:** platform sign-in, TOTP step, lockout, expired-session states (D-C1).

UC
- Happy: on `https://platform.<root-domain>/sign-in` Ana enters email + password → TOTP code (or a recovery code) →
  lands on the tenant directory. Session: **idle 30 min, absolute 8 h** (§3 SD3), then back to sign-in with
  "Your session expired" and her target URL preserved.
- Happy: Sign out revokes the session server-side and clears the cookies.
- Error: wrong password / wrong code → one generic message ("Email, password or code is incorrect"); 5 failures →
  locked 15 min (tenant lockout constants), same generic message plus the lockout notice; per-IP rate limit on the
  credential routes → 429 with `Retry-After`; deactivated account → the same generic failure (no account-state
  leak).
- Isolation: a tenant `kaenal_session` cookie or bearer token sent to a platform route → 401; a platform cookie sent to a
  tenant route → ignored by the tenant authenticator → 401; any `/platform/v1/*` request whose `Host` is not the
  configured platform host → **404** (the route does not exist on tenant hosts); optionally, a request from outside
  `PLATFORM_ALLOWED_CIDRS` (when set) → 404.
- Offline: the console is online-only; network failure shows the inline retry card, never a stale write.

AC
1. `0078` adds `control.platform_sessions` (`id`, `token_hash` UNIQUE, `platform_user_id`, `created_at`, `last_seen_at`,
   `idle_expires_at`, `absolute_expires_at`, `revoked_at`, `ip inet`, `user_agent`) and **[AM3]** `control.
   platform_step_up_tokens` (`token_hash` PK, `platform_user_id`, `expires_at` = issue + 5 min, `used_at`) — the re-auth
   artifact `POST /platform/v1/auth/step-up` issues (AC5) and `content`-scope grant creation (C3) consumes — and the DB
   role **`kaenal_platform`** (**[AR] created `NOLOGIN` by the migration** — `LOGIN` and its credential are set by
   provisioning / ops from the secret manager, never by a migration, AR29; no BYPASSRLS; `USAGE` on `control`;
   SELECT/INSERT/UPDATE on `control.platform_*` (no DELETE); SELECT on `control.tenants`; the commercial control-plane
   write grants of C5-C8). New env `DATABASE_PLATFORM_URL` (+ `.env.example`), a dedicated `PLATFORM_POOL` provider.
   **[AR] Both exist only in the platform API process (AC2):** the tenant API's env schema (`apps/api/src/env.ts`) does
   not declare `DATABASE_PLATFORM_URL` or `DATABASE_SUPPORT_URL`, and the tenant `AppModule` has no provider for either
   (test: the tenant app boots with neither set, and a DI lookup for `PLATFORM_POOL` / `SUPPORT_POOL` in it fails).
   **The platform surface never uses `CONTROL_POOL`** (the migrator superuser, a tracked Known issue).
2. **[AR] A separate platform API process — replaces the "platform branch inside the ONE tenant interceptor" of the
   earlier draft (AR1).** A new entry point `apps/api/src/platform-main.ts` bootstraps a new `PlatformAppModule` with
   its own `NestFactory.create`, its own listener (`PLATFORM_PORT`, default 3003), its own deployment unit and its own
   ingress route (`PLATFORM_HOST` → the platform process only); `apps/api/src/main.ts` keeps bootstrapping the tenant
   `AppModule`, unchanged by this story. Both applications live in `apps/api` and **import** the same building blocks
   as libraries — `@kaenal/db` (`withAudit`, `withTenant`, the audit observers), the outbox writer, `packages/core`
   (resolver, RBAC), `CatalogService` — so nothing is copied or forked. `PlatformAppModule` registers **its own single
   `APP_INTERCEPTOR`**, `PlatformLifecycleInterceptor`, and a new `@PlatformRoute(capability?)` class/method decorator
   (plus `@PlatformPublic` for the setup and sign-in routes, the platform twin of `@Public`/`@AllowAnonymous`). Per
   request: (1) `Host` must equal `PLATFORM_HOST` else 404 (defence in depth behind the ingress); (2) optional CIDR
   allowlist else 404; (3) `PlatformAuthenticator` resolves `kaenal_platform_session` (cookie only; bearer refused)
   through `PLATFORM_POOL`, enforces idle/absolute expiry and slides `idle_expires_at`, and enforces CSRF double-submit
   (`kaenal_platform_csrf` / `x-platform-csrf-token`) on unsafe methods; (4) platform RBAC computed from the platform
   user's **current** `role` and `status`, re-read on every request — never from a value cached in the session (C3
   AC1, AR15); (5) the handler runs in `runWithPlatformContext({ platformUserId, role, requestId, ip, userAgent, tx })`
   with a **control-plane transaction on `PLATFORM_POOL` — no `app.tenant_id`**. Tenant data is reachable only through
   C3's `SupportAccess.withTenant(...)`. The tenant `AppModule`'s `RequestLifecycleInterceptor` gains **no** platform
   branch; its only change in this increment is C10's support-view principal.

   **Why a second interceptor is not a breach of the settled "the request lifecycle is ONE interceptor" decision
   (recorded here so no future engineer re-litigates it).** That decision (CLAUDE.md, PROGRESS.md Decisions log) is
   about the shape of **one application's request pipeline**: authentication and RBAC must run inside a single
   interceptor, inside the scoped transaction, rather than as middleware + guards that run outside it. It does not
   limit how many services exist. `PlatformAppModule` is a separate NestJS application with a separate listener and a
   separate deployment; it has exactly one lifecycle interceptor of its own, which authenticates and authorizes
   inside its own control-plane transaction. That is the same discipline applied a second time, to a second service —
   not middleware or guards creeping back into either app. What the decision forbids (a second place in the same
   pipeline where authentication or RBAC can run) stays forbidden in both apps, and AC3's guard test enforces it for
   both. SD1 records the trade-off.
3. **[AR] Default-deny in both apps, proved by enumerating both routers (AR1).** **[AR2, B4 — test-ordering
   requirement, stated explicitly per SD13:** because the audit bridges and other process-global observers are
   single-slot (`AppModule.onModuleInit`), this test boots `AppModule`, runs its assertions and tears it down
   **before** booting `PlatformAppModule` and running its assertions — never both Nest contexts alive at once in the
   same test process. A simultaneous boot would let the second module's `onModuleInit` silently clobber the first's
   bridge registration, which would surface later as flaky realtime/audit gaps rather than a failure here; stating
   the ordering requirement up front means it is never rediscovered as a flaky-test mystery during build.]** With that
   ordering, the test boots `AppModule`, enumerates every registered route (Nest's route explorer /
   `DiscoveryService`), then separately boots `PlatformAppModule` and does the same, and
   asserts: the tenant app mounts **no** `/platform/v1/*` route and no handler carrying `@PlatformRoute`; the platform
   app mounts **no** `/v1/*` route (its only non-platform route is `/health`) and every handler carries
   `@PlatformRoute` or `@PlatformPublic`; every platform controller file lives under `apps/api/src/platform/**` and is
   registered only in `PlatformAppModule`. Mutation checks: registering one tenant controller in `PlatformAppModule`,
   one platform controller in `AppModule`, or removing one `@PlatformRoute` each make the test fail. A platform route
   reached with only a tenant session → 401; a tenant route reached with only a platform cookie → 401 (the tenant app
   contains no code that reads `kaenal_platform_session`). The import-boundary lint rule (CX AC1) keeps the two apps'
   internals from importing each other.
4. Cookies: `kaenal_platform_session` (httpOnly, `Secure` in production, `SameSite=Strict`, **host-only** — no
   `Domain` attribute, so it is never sent to tenant subdomains) and `kaenal_platform_csrf`. Distinct names from the
   tenant cookies so neither authenticator can ever read the other's token.
5. Routes: `POST /platform/v1/auth/sign-in` (email + password → `mfa_required` challenge token, 5-min TTL), `POST
   /platform/v1/auth/mfa` (TOTP or recovery code → session), `POST /platform/v1/auth/sign-out`, `GET /platform/v1/me`
   (`{ id, name, email, role, capabilities }`), `GET /platform/v1/me/sessions`, `POST /platform/v1/me/sessions/:id/
   revoke`, **[AM3]** `POST /platform/v1/auth/step-up` (body `{ password }` or `{ code }`; the caller's existing
   session must already be active — this re-proves the second factor, it does not sign in) → a single-use
   `stepUpToken` valid 5 minutes, scoped to the calling platform user; wrong password/code → the same generic
   sign-in failure message and counts toward the same lockout counter (C2 AC's existing 5-failure lockout applies
   here too, so step-up cannot be used to brute-force TOTP separately from sign-in). Its only consumer this sprint
   is `content`-scope grant creation (C3). Sign-in success/failure, sign-out and step-up success/failure write
   platform audit events (C3).
6. The platform contract is a **separate ts-rest contract** `packages/types/src/platform/contract.ts`, exported only from
   the `@kaenal/types/platform` entry point, with its own OpenAPI document served only on the platform host. The tenant
   OpenAPI document and `packages/types/src/contract.ts` gain nothing.
7. Tests: sign-in happy path (password → TOTP → session); generic failures; lockout at 5; rate limit; idle expiry at
   30 min and absolute at 8 h (clock helper); CSRF required on unsafe methods; host check 404; CIDR 404 when
   configured; cross-plane cookie/bearer isolation both ways; deactivation revokes a live session on its next
   request. **[AM3]** step-up: correct password or TOTP issues a token; wrong credential → generic failure and
   counts toward lockout; the token is single-use (a second use → 422), expires at 5 min, and is rejected if
   presented by a different platform user than the one who requested it. **[AR]** Plus: AC3's two-router enumeration
   and its mutation checks; the tenant app boots without `DATABASE_PLATFORM_URL` / `DATABASE_SUPPORT_URL`; a
   role/status change of a signed-in platform user is effective on that user's very next request (AR15). **The tenant
   sign-in is re-proved end to end (201) for `demo@acme.test`** after every change to `apps/api` in this increment
   (rule 12) — the tenant interceptor itself changes only in C10.

Web (`apps/platform`): sign-in, TOTP, expired/locked states, sign-out, "My sessions" in the account menu (D-C1).
Mobile: unaffected (the tenant bearer path is unchanged; proved by its tests). Shared: migration, the platform API
process (`platform-main.ts`, `PlatformAppModule`, `PlatformLifecycleInterceptor`), platform authenticator, platform
contract entry point.

Backend: migration 0078; routes above; audit → platform audit; RBAC → C3; tenancy: no tenant scope on this path by
construction.

### C3 — Platform RBAC, support-access grants, least-privilege support role, platform audit log (Shared foundation)

**Design:** the access-reason dialog, grant banner/countdown and expiry states (D-C4).

UC
- Happy: Ana (`platform_sales`) opens tenant "Acme" → dialog "Why are you accessing Acme?" (reason ≥ 10 chars, optional
  ticket/request reference, prefilled "Resolving request #…" when she came from the inbox) → a **support grant**
  valid **4 hours** (07 §7) is created; the tenant's audit log gets `support_accessed` "Kaenal support accessed plan
  & entitlements — <reason>"; a banner shows "Access to Acme · expires in 3 h 59 min · End access".
- Happy: every write she makes inside the grant asks for its own **change reason** (e.g. "Order form #1042"); the
  tenant audit event carries it (`actor_kind='support'`), and the platform audit log records who, what, which
  tenant, which grant.
- Expiry: at 4 h, or on "End access", further tenant reads/writes fail with "Your access to Acme has expired —
  re-open with a reason"; nothing already committed is affected. A new grant needs a new reason.
- **[AM2] Two scopes.** The access dialog asks for the scope: **Commercial** (plan & requests — as above) or
  **Workspace content (read-only)** — "view any record in Acme's workspace to resolve a support case". A content
  grant additionally requires a **reference** (support ticket / incident id), because it exposes QMS records and
  personal data; it writes the tenant audit event "Kaenal support opened read-only access to your workspace —
  <reason> (<reference>) — until <time>" and is used through the support view (C10). A platform user may hold one
  grant of each scope for the same tenant at once; each has its own 4 h clock and reason.
- **[AM3] Step-up for content access.** Choosing *Workspace content (read-only)* requires a fresh re-auth first: Ana
  gets a `stepUpToken` from `POST /platform/v1/auth/step-up` (current password or a new TOTP code, C2 AC5) and it
  travels with the grant-creation call. This mirrors 07-SECURITY-COMPLIANCE.md §2's e-signature step-up principle,
  applied to the single highest-privilege action in the console; a `commercial` grant never asks for it — it
  exposes no tenant content, so the existing session is enough.
- **[AM3] Throttled and watched.** `content`-grant creation is rate-limited per platform user, and opening grants
  across several tenants in a short window is flagged in the platform audit log for an admin to find (PO-SC9) — a
  single phished-but-past-MFA credential cannot quietly walk every tenant.
- Least privilege: a **commercial** grant reaches only commercial data — entitlements, trials, plan requests, the
  profile / onboarding / billing settings documents, tenant plan, counts — through `kaenal_support`, which cannot
  read QMS content. A **content** grant reaches every tenant record **read-only** through a separate role
  (`kaenal_support_reader`, C10) that has no write privilege on any tenant table except its own audit rows. Neither
  path can reach the other's privileges.
- Permission: commercial grants — any platform role (`platform_support` reads only); **content grants —
  `platform:tenant:content` (`platform_support`, `platform_admin`; not `platform_sales`)** [AM2]; writes per the capability matrix (§3 SD2).
- Cross-tenant: a grant is for exactly one tenant; a request carrying tenant B while holding a grant for A → 404.

AC
1. `packages/core/src/platform-rbac.ts`: `PlatformRole` (`platform_support|platform_sales|platform_admin`), `PlatformCapability` and the matrix of §3
   SD2, `authorizePlatform(role, capability)`; unit-tested exhaustively (every role × capability), including "no
   platform capability is ever returned by tenant `authorize`" and vice versa. **[AR] Capabilities are evaluated
   against the platform user's current `role` and `status`, re-read from `control.platform_users` on every request by
   `PlatformAuthenticator` (C2 AC2), by `SupportAccess.withTenant` (AC5) and by `SupportViewAuthenticator` (C10 AC4) —
   never against the role at grant-creation or sign-in time (AR15).** The types live in the `@kaenal/types/platform`
   sub-entry-point, structurally separate from tenant types (no shared union with tenant `Role` / `Capability`).
2. Migration `0079_support_access.sql`: `control.support_grants` (`id`, `platform_user_id`, `tenant_id`, `reason`
   ≥ 10 chars, `reference` ≤ 120, `scope` CHECK `commercial` | `content` ([AM2]; CHECK `scope <> 'content' OR
   reference IS NOT NULL`), `granted_at`,
   `expires_at = granted_at + interval '4 hours'` (CHECK), `ended_at`, **[AR]** `end_reason` CHECK `ended_by_user` |
   `expired` | `user_deactivated` | `role_changed` | **[AR2, B1, widened from `mirror_failed`]
   `activation_failed`** (NULL while open; covers either the dedicated-database mirror insert or the tenant
   audit-transparency row failing during grant activation, AC6), `idempotency_key`,
   `UNIQUE (id, scope)` for C10's composite FK (AR14)), and `control.platform_audit_events`
   (append-only: `kaenal_platform` has INSERT + SELECT only; a trigger rejects UPDATE/DELETE even for owners except
   the migrator's partition maintenance; columns: `id`, `platform_user_id` NULL for CLI/system, `actor_label`,
   `action`, `tenant_id` NULL, `grant_id` NULL, `target_kind`, `target_id`, `before`, `after`, `reason`,
   `request_id`, `ip`, `user_agent`, `created_at`, **[AR]** `phase` CHECK `single` | `intent` | `outcome`,
   `intent_id` (→ `platform_audit_events.id`, required iff `phase='outcome'`), `outcome` `ok|failed` (NULL iff
   `phase='intent'`) — the two-row intent/outcome shape of SD5, so the table stays strictly append-only, AR24).
3. `0079` creates DB role **`kaenal_support`** (**[AR] `NOLOGIN`** in the migration, AR29; no BYPASSRLS) for
   tenant-plane access, used **only by the platform API process**, with **only**:
   SELECT/INSERT/UPDATE on `entitlements`; SELECT **and DELETE** on `entitlement_trials` ([AM2] trial reset, C5
   AC6; a trigger rejects deleting a row whose `ends_at > now()`); SELECT and UPDATE(`status`,
   `resolved_at`, `resolution_note`, `lock_version`) on `plan_requests`; SELECT on `tenant_settings` plus a
   **RESTRICTIVE** policy `TO kaenal_support USING (namespace IN ('profile','onboarding','billing'))`; column
   SELECT on the id/tenant/status columns needed for counts (`memberships`, `plants`, `suppliers`, inspector
   roles) — never a name, email or content column; INSERT on `audit_events` (**[AR2, B1] under its own dedicated
   policy, see below — not the blanket commercial-grant policy**) and `outbox`. **[AR] Added because C5,
   C6 and C4 need them (AR25), [AR2, B2] corrected:** ~~INSERT on `notifications`~~ — a bare INSERT is not enough,
   because the only real writer, `NotificationsService.notify()` (`apps/api/src/notifications/notifications.service.
   ts:218-238`), does `INSERT … RETURNING <columns>`, and RETURNING a column requires SELECT on it too, which would
   fail the permission check under `kaenal_support` and break C6 AC3 (plan-request fulfil) and C5 AC3 (auto-fulfil).
   Granting blanket SELECT on `notifications` is wrong regardless, because bodies can carry real QMS content. **Fix:**
   `kaenal_support` gets INSERT on `notifications` **plus a column-scoped `SELECT (id)`** grant on it — never a
   full-row SELECT — and the platform code path for C5 AC3 / C6 AC3 calls a narrower writer, `notifyMinimal()` (same
   row shape as `notify()`, `INSERT … RETURNING id` only), instead of `notify()` directly, so the RETURNING clause
   never touches a column the role cannot read. **[AR3, S1] `notifyMinimal()` lives in the shared layer, not in
   `apps/api/src/notifications`.** The earlier wording named it `NotificationsService.notifyMinimal()`, which platform
   code would have to import from `apps/api/src/notifications` — a tenant-side module, which CX AC1's import-boundary
   rule forbids platform code from reaching into directly (it may import only `shared/**` on the tenant side, SD13).
   Fix: `notifyMinimal()` is exported from the shared, context-agnostic writer SD13 already places at
   `apps/api/src/shared/notifications.ts`; `NotificationsService.notify()` (tenant-side) delegates to this same shared
   `notifyMinimal()` internally for its own row insert, then does its tenant-only work (preference resolution, the
   full-row shape its own callers need) on top — so there is exactly one INSERT implementation, and platform code
   calls the shared `notifyMinimal()` directly, never `apps/api/src/notifications`. SELECT on
   `notification_prefs` (the insert honours the recipient's preferences, as the tenant notification service does);
   column SELECT on `memberships
   (user_id, role, status)` (to address the requester and the tenant's admins — ids and roles only, still no name or
   email column; the email channel resolves addresses in the worker as today); INSERT + UPDATE(`ended_at`) on
   `control.support_grant_backstop` (C10 AC2a mirror, dedicated databases only); **[AR, found while verifying C5]**
   column SELECT on `(tenant_id, id, <status/stage column>)` of exactly the QMS tables named by the per-module
   "open record" definitions (SPRINT-07 P4 AC5; the list is DoR re-review item R2), because C5's downgrade confirm
   computes that tenant's open-record counts inside the commercial grant and the role otherwise holds no QMS-table
   privilege — never a title, description, name or content column. **[AR2, PO decision R2a]** For `risk`, the granted
   status column follows SPRINT-07 P4 AC5's finalized "open" definition: `status IN ('active','monitoring')` counts
   as open, `accepted` does not (an accepted risk is a closed decision, not an in-flight record). **[AR2, PO decision
   R2b]** FMEA (no status column exists), SPC and the customer/supplier portal (no lifecycle concept at all) are
   **excluded** from this grant entirely — there is no status/stage column to grant SELECT on for any of the three,
   by deliberate scope boundary (no in-flight state to freeze, so there is nothing to warn about on downgrade), not
   an oversight. **[AR] Commercial-scope audit read
   (AR13):** C4's History tab and declaration history need to read `audit_events`, but a plain SELECT would expose every
   before/after payload in the tenant — de facto content access without a content grant. So `kaenal_support` gets
   **column** SELECT on `audit_events` (every column except `ip` and `user_agent`) and a RESTRICTIVE policy
   `support_commercial_audit_scope` `TO kaenal_support FOR SELECT USING (entity_kind IN ('entitlement',
   'entitlement_trial', 'plan_request', 'support_grant', 'workspace_profile', 'onboarding_state', 'billing_settings')
   AND (SELECT support_content_grant_active('commercial')))`
   — the commercial entity kinds only, which requires Sprint 07's profile / onboarding / billing events to use those
   dedicated entity kinds rather than the generic `settings` kind (SPRINT-07 O1 AC3, O4 AC3, P9 AC2 [AR]); the
   support-view record trail (`support_view`) is deliberately **not** in the list. **[AR3, D1b] The entity-kind filter
   alone is not a liveness check.** Without the added `support_content_grant_active('commercial')` clause, an
   **expired** commercial grant, or a platform user holding only a **content** grant (no commercial grant at all),
   could still read every commercial audit row on this table if `SupportAccess`'s application-layer check were ever
   bypassed — silently undoing the point of the B1/D1(a) fix for this one table. The added clause closes that: the
   same per-statement InitPlan check C10 AC2a already uses elsewhere now also gates reads here. Confirmed safe to add:
   the `withAudit` INSERT path has no `RETURNING` (`packages/db/src/audit.ts:174-178`), so the write path this policy
   does not govern is unaffected. New tests (C3 AC10): a read of `audit_events` after the grant's `expires_at` has
   passed returns zero rows / a permission error even with the application check bypassed; a read attempted while
   holding only a `content`-scope grant for the tenant (no commercial grant) likewise returns zero rows / a
   permission error — both proving the liveness check gates reads on this table, not only the generic policy's writes
   elsewhere. **[AR2, B1] The commercial write
   path's usual RESTRICTIVE policy does not, on its own, cover this table.** `audit_events` is excluded from the
   generic `support_commercial_grant_active` `FOR ALL` policy for `kaenal_support` (it already needed the bespoke
   `FOR SELECT` policy above, per AR13) and instead carries **two** command-scoped RESTRICTIVE policies that together
   replace the generic one for this table: the `FOR SELECT` policy above (AR13), and a new `FOR INSERT` policy,
   **`support_audit_write_scope`** `TO kaenal_support WITH CHECK (support_content_grant_active('commercial') OR
   (action = 'support_accessed' AND entity_kind = 'support_grant' AND entity_id =
   NULLIF(current_setting('app.grant_id', true), '')::uuid AND support_content_grant_active('content')))`. Why: AC6
   below needs `kaenal_support` to write exactly one row — the tenant's "opened read-only access" transparency event
   — under a live **content** grant, which the generic commercial-only policy would otherwise refuse outright (a
   content grant can never satisfy `support_content_grant_active('commercial')`), silently either failing the write
   or (worse) letting the transparency row be skipped. This dedicated policy admits that one narrow case by name and
   nothing else: every other `kaenal_support` INSERT into `audit_events` still requires a live commercial grant. The
   existing permissive
   `tenant_isolation` policy (no `TO` clause) still applies on top, so RLS is
   never bypassed (01 §3.2) and no statement runs without a live grant of the scope it claims.
4. A trigger on `audit_events` rejects any row inserted by `current_user = 'kaenal_support'` unless `actor_kind =
   'support'` and `reason = current_setting('app.support_reason')` — the DB proves every support write is
   attributed and justified, not just the service.
5. `SupportAccess.withTenant(grantId, fn)` is the **only** way platform code reaches tenant data: it verifies the grant
   (same platform user, not expired, not ended, **[AR]** grant tenant = the target tenant, and the caller's **current**
   role still holds the scope's capability — re-checked on every call, AR15), resolves the tenant's pool (shared →
   `DATABASE_SUPPORT_URL`; dedicated → a **support secret ref** per dedicated tenant, §3 SD6), opens a transaction with
   `app.tenant_id`, `app.support_reason`, `app.platform_user_id` and **[AR]** `app.grant_id` via `set_config(..., true)`
   (SET LOCAL — the DB then re-verifies the grant on every statement, C10 AC2a), and after
   commit publishes the tenant realtime signal(s) the audit observer buffered (same after-commit rule as the
   tenant lifecycle). A guard test fails if any file under `apps/api/src/platform/**` imports `withTenant`,
   `appPool` or `CONTROL_POOL` directly.
6. **[AR2, B1 — rewritten; [AR4] renumbered to one consistent scheme and the mirror+audit write made atomic (Blocking
   A fix of the 2026-10-01 delta check — see C10 AC2a for the full mechanism and rationale).** Grant creation's
   control-plane row commit is **step 1** — the SD5 intent row (§3 SD5) — using the one numbering scheme now shared
   verbatim by this AC, by §3 SD5's "Grant-activation write ordering" note and by C10 AC2a (previously these three
   places numbered the same writes two different ways; fixed here, once, for all three). After step 1 commits:
   - **Step 2 — one atomic tenant-side transaction, opened once, on the `kaenal_support` role.** **[AR4]** The
     dedicated-tenant mirror insert and the tenant audit-transparency row are no longer two writes that can succeed
     and fail independently — they are the **same transaction**: for a dedicated tenant, the first statement inside
     it inserts the `control.support_grant_backstop` mirror row (C10 AC2a); the next (and, for a shared tenant, the
     *only*) statement inserts the tenant `audit_events` "opened access" row — `actor_kind='support'`,
     `action='support_accessed'`, `entity_kind='support_grant'`, `entity_id` = the grant id, `reason` (and, for a
     `content` grant, the message includes the reference and the expiry time, per the UC). **For a `commercial`
     grant** this transaction is `SupportAccess.withTenant`'s own transaction, exactly as AC5 already opens one (the
     mirror insert, where it applies, is prepended as that call's first statement; the audit row is typically its
     only other statement if the caller does nothing else in the same call). **For a `content` grant**, which
     `SupportAccess.withTenant` refuses outright (AC7), the same narrow method
     **`SupportAccess.recordGrantStart(grantId)`** opens this one transaction on the `kaenal_support` role (not
     `kaenal_support_reader` — that role holds no INSERT privilege at all) with `app.tenant_id`, `app.support_reason`
     and `app.grant_id` set to the **content** grant's id (SET LOCAL), does the mirror insert first (dedicated tenant
     only) and then inserts **only** the one audit row — no other read or write. AC3's dedicated
     `support_audit_write_scope` policy is what lets this INSERT succeed under a content-scoped `app.grant_id` even
     though `kaenal_support` otherwise requires a commercial grant for everything else. **Why one transaction removes
     the failure window, not just narrows it:** the dedicated backstop function reads `control.support_grant_backstop`
     from the *same* database connection the mirror row was just inserted on, inside the *same still-open*
     transaction — Postgres's own read-your-writes guarantee makes the just-inserted mirror row visible to the
     audit-row INSERT's own policy check without needing it to be committed first. So either both rows commit
     together, or (the dedicated database is unreachable, the audit insert is refused, anything else fails) **neither**
     commits — there is no longer a moment where a mirror row is live on disk with no corresponding tenant audit row,
     because that moment required two separate commits and there is now only one.
   - **Step 3.** In the control tx, the SD5 outcome row (a platform audit event) is appended, `ok` or `failed`.
   If step 2 fails (whether the failure originates in the mirror insert, where one applies, or in the audit-row
   insert later in the same transaction — both roll back together), the grant is ended in the same request
   (`end_reason = 'activation_failed'`, AC2) and grant creation returns **503**: there is no path where a usable
   grant exists with no tenant-visible record of it, and (new, by construction) no path where a dedicated tenant's
   mirror row exists with no corresponding tenant audit row either. **[AR]** `support_grant` (like C10's
   `support_view`) is an internal entity kind the outbox and realtime bridges skip (SD11, AR10) —
   `entity_kind='tenant'` is replaced so a grant can never become a customer webhook or a realtime refetch. Test:
   failure injected at either point inside step 2's transaction (the mirror insert, where it applies, or the
   audit-row insert) rolls back the whole transaction and yields an ended grant (`activation_failed`) and a 503, for
   both scopes and for both shared and dedicated tenants, with **neither** the mirror row **nor** the audit row
   visible afterward (not "one cleared after the other failed" — neither was ever committed); a successful
   content-grant creation always leaves exactly one tenant `support_accessed` row visible via the tenant's own
   `GET /v1/audit…` before the create call returns.
7. Routes: `POST /platform/v1/tenants/:tenantId/grants` (body `scope`, reason, reference, **[AM3]** `stepUpToken`
   required when `scope='content'`; `platform:tenant:access` for `commercial`, **`platform:tenant:content` for
   `content`** [AM2]; content without reference → 422), `POST /platform/v1/grants/:id/end`, `GET /platform/v1/me/grants`
   (active grants, with scope). `SupportAccess.withTenant` still accepts only a `commercial` grant (a content grant there
   → 403) for reaching tenant **data**; **[AR2, B1] the one content-grant tenant write this story itself needs — its
   own audit-transparency row — goes through `SupportAccess.recordGrantStart` (AC6), not `withTenant`**; every other
   content-scope tenant access is C10's read-only support view. **[AR] Idempotent and one-per-scope (rule 6, AR19).** The create route takes an
   `Idempotency-Key` (a replay returns the original response). C3's UC already fixes the rule "one grant of each scope
   for the same tenant at once" per platform user; it is now enforced: the create transaction takes
   `pg_advisory_xact_lock(hashtextextended('support_grant:' || platform_user_id || ':' || tenant_id || ':' || scope,
   0))`, then looks for an open grant (`ended_at IS NULL AND clock_timestamp() < expires_at`) for that triple; if one
   exists it returns **200 with that grant** (`reused: true`, original reason and expiry unchanged, no new tenant or
   platform audit row, no step-up token consumed, no rate-limit slot used); otherwise it inserts and returns 201. (A
   partial unique index cannot express "not yet expired", because `now()` is not immutable — hence the advisory
   lock.) Test: two concurrent creates for the same triple produce exactly one grant and one audit pair; different
   scopes or tenants do not block each other.
8. **[AM3] Step-up re-auth for content-scope grants (SR2).** `POST /platform/v1/tenants/:tenantId/grants` with
   `scope: 'content'` requires a `stepUpToken` (from C2 AC5's `POST /platform/v1/auth/step-up`) in the body: valid,
   unexpired (5 min), unused, and issued to the same `platform_user_id` making this call. Missing, expired, reused or
   user-mismatched → 422 `STEP_UP_REQUIRED`, and the grant is not created. The token is consumed (marked `used_at`)
   in the same transaction as the grant row, so it cannot be replayed for a second grant. `commercial`-scope
   creation never checks for or consumes a `stepUpToken`.
9. **[AM3] Rate limit and anomaly signal on content-grant creation (SR3, PO-SC9).** A per-platform-user Redis
   `RateLimiter` (the same primitive C2's sign-in lockout uses) caps `content`-scope grant creation at **5 per
   rolling hour**; the 6th attempt in the window → 429 with `Retry-After` (chosen because a legitimate support case
   rarely needs more than one or two tenants open at once, while 5/hour still covers a genuinely busy shift without
   making a fast sweep across many tenants practical). Independently of the rate limit, when a platform user's
   `content` grants opened in the trailing rolling hour span **3 or more distinct tenants**, the grant-creation
   write also inserts a platform audit event `content_grant_anomaly` (`platform_user_id`, the distinct tenant ids and
   count, the window) in the same control transaction as the grant — fired once, on the write that crosses the
   threshold, not on every subsequent grant in the same window. C9's platform audit log surfaces it via a
   **Flagged** filter/badge (D-C10) so an admin can find it without reading every row. A push/email alert to platform
   admins is a future enhancement, not built this sprint (→ Known issues); a flagged, queryable audit event is the
   minimum this finding requires.
10. Tests: grant happy path + tenant audit row visible via the tenant `GET /v1/audit…` as "support"; expiry at 4 h
    (clock helper); ended grant refuses; wrong platform user refuses; tenant mismatch → 404; `kaenal_support` **cannot**
    SELECT `ncrs`, `documents`, `suppliers.name`, `control.users.email` or any tenant_settings namespace outside the
    three (explicit grant tests, and a mutation test: widening the RESTRICTIVE policy makes a test fail); the audit
    trigger rejects a support-role insert with a missing/mismatched reason; RLS still isolates `kaenal_support`
    across tenants (`test:rls` extended with this role). **[AM2]** Plus: `platform_sales` → 403 on a content grant; content
    grant without reference → 422; a content grant cannot be used for a commercial write (and vice versa: a
    commercial grant cannot open the support view). **[AM3]** Plus: content-grant creation without a `stepUpToken`,
    with an expired one, a reused one, or one issued to a different platform user → 422 `STEP_UP_REQUIRED` (and is
    never required for `commercial`); a 6th content grant inside the rolling hour → 429; the write that opens the
    3rd distinct tenant within the rolling hour (and only that write) inserts one `content_grant_anomaly` event,
    visible via the Flagged filter. **[AR]** Plus: `kaenal_support` can read `audit_events` rows only of the seven commercial entity kinds, never
    `ip` / `user_agent`, never a `support_view` or QMS-record row (mutation test: widening
    `support_commercial_audit_scope` fails a test); `kaenal_support` can insert a `notifications` row and read
    `notification_prefs` / the three `memberships` columns, and nothing more on those tables; a commercial write or
    read after `expires_at` fails at the DB even with `SupportAccess`'s check bypassed (C10 AC2a); the idempotent,
    one-per-scope create (AC7); a platform user demoted from `platform_support` to `platform_sales` loses their open
    content grant on the demotion commit and cannot use a commercial grant after deactivation (C11 AC2). **[AR2, B1]**
    Plus: creating a **content** grant always yields exactly one tenant `support_accessed` / `support_grant` row,
    visible via the tenant's own `GET /v1/audit…`, even though `SupportAccess.withTenant` refuses content grants
    (proves `recordGrantStart`'s separate path actually runs); `kaenal_support` cannot insert an `audit_events` row
    for any `action`/`entity_kind` other than `support_accessed`/`support_grant` while holding only a content grant
    (mutation test: widening `support_audit_write_scope`'s `WITH CHECK` fails a test); **[AR4]** failure injected
    anywhere inside step 2's one atomic transaction — the dedicated-tenant mirror insert or the `recordGrantStart`
    audit-row insert that follows it in the same transaction — rolls back both together, leaving **neither** row
    committed, and ends the grant with `end_reason = 'activation_failed'` and the create call returns 503, for both
    scopes and for both shared and dedicated tenants (C10 AC2a, SD5). **[AR2, B2]** Plus: `kaenal_support` can
    `INSERT … RETURNING id` on `notifications` but a `RETURNING` of any other column fails the permission check
    (proving the grant is genuinely column-scoped, not accidentally blanket); the C5/C6 platform code paths call the
    shared `notifyMinimal()` (`apps/api/src/shared/notifications.ts`, **[AR3, S1]** never
    `NotificationsService.notifyMinimal()`), never `notify()`, under this role. **[AR3, D1b]** Plus: a `kaenal_support`
    read of `audit_events` attempted after the grant's `expires_at` has passed returns zero rows / a permission error
    even with `SupportAccess`'s application-layer check bypassed; a read attempted while holding only a `content`-scope
    grant for the tenant (no commercial grant at all) likewise returns zero rows / a permission error (mutation test:
    removing `support_commercial_audit_scope`'s `support_content_grant_active('commercial')` clause makes both fail).
    **[AR3, D1a]** Plus: creating the generic `support_commercial_grant_active` policy directly on `audit_events` in a
    scratch migration, or dropping either of its two dedicated policies, each makes the schema test fail (C10 AC2a).
    **[AR3, D1c; [AR4] superseded by the atomic step-2 transaction]** Plus: for a dedicated tenant, failure injected on
    the audit-row insert inside the *same* step-2 transaction as an already-attempted `support_grant_backstop` mirror
    insert rolls the whole transaction back — **neither** row is visible afterward (read directly from
    `control.support_grant_backstop` and from the tenant's `audit_events`), not a committed mirror with its `ended_at`
    cleared after the fact; the control-plane grant row is marked `activation_failed` in the same request that returns
    503.

Web (`apps/platform`): access dialog (**[AM3]** incl. the step-up prompt for the content scope), grant banner/countdown,
expiry state, **[AM3]** the audit log's Flagged filter/badge (C9/D-C10) surfacing `content_grant_anomaly`. Mobile:
unaffected. Shared: migration, core RBAC, `SupportAccess`, platform audit writer. **Tenant web (`apps/web`):** no
code change for commercial grants — Sprint 07 X1 AC4 already renders support events ("Kaenal support — <reason>");
the content scope's tenant-web changes are C10's.

Backend: migration 0079; routes above; audit: tenant `support_accessed` + platform events (incl. **[AM3]**
`content_grant_anomaly`); RBAC matrix; tenancy: RLS enforced for the support role, restrictive namespace policy,
column-level grants. **[AM3]** Plus: the step-up route (C2, `control.platform_step_up_tokens` in 0078) and a Redis
rate limiter for content-grant creation.

### C4 — `apps/platform` shell, tenant directory and tenant detail (read)

**Design:** shell, directory, tenant detail tabs (D-C3, D-C5). No jsx exists (§1a).

UC
- Happy (directory, no grant needed — control-plane data only): a searchable, filterable, cursor-paginated table
  of tenants: name, slug, model (shared/dedicated), status, derived tier, self-service flag, declared frameworks
  (short labels), open sales requests count, created date. Search by name/slug; filters: status, tier, mode, has
  open requests, framework. Row click → tenant detail.
- Happy (detail, grant required): header (name, slug, status, model, mode chip, tier) and tabs:
  **Plan** (packs with active/effective/source/trial, module list with effective reason — core / framework /
  pack / trial — the same `effectiveModules` the tenant sees; contract and CSM fields),
  **Requests** (this tenant's plan requests, any status, with notes), **Profile** (industry, frameworks with the
  **declaration history** from `settings_changed` events — D2's abuse visibility — plant size, onboarding status,
  counts: plants, members, active suppliers, inspectors), **History** (the tenant's entitlement / plan-request /
  support audit events, newest first).
- Without a grant, opening detail shows the access dialog (C3); cancelling returns to the directory.
- **[AM2]** The detail header carries **View workspace (read-only)** for holders of `platform:tenant:content`: it opens
  the content-scope access dialog (or reuses an active content grant) and then the support view (C10) in a new tab.
  Hidden for `platform_sales` (never a button that would 403).
- Empty: no tenants match → empty state with "Clear filters". Loading: skeleton rows. Error: inline retry card with
  requestId.
- Permission: every platform role sees directory and detail (read). Write controls on Plan/Requests render only for
  roles holding the capability (never a button that would 403).
- Deleted/offboarding tenants: listed with their status; detail read-only; no writes offered (§7 Q-SC9).

AC
1. New app **`apps/platform`** (Next.js App Router, Tailwind, TanStack Query/Table, the same stack as `apps/web`),
   importing `packages/types` (platform entry point), `packages/core` and the tokens from
   `project_brain/project/styles/tokens.css` via the same token pipeline as `apps/web`. It **does not** import
   anything from `apps/web` (lint rule) and `apps/web` does not import the platform entry points (lint rule,
   `no-restricted-imports`). Dev: `pnpm --filter @kaenal/platform dev` on :3002, proxying `/platform-api/*` to the
   **[AR] platform API process (`pnpm --filter @kaenal/api dev:platform`, :3003)** with `Host` set to `PLATFORM_HOST`
   — never to the tenant API on :3001. Justification in §3 SD1.
2. `GET /platform/v1/tenants?q=&status=&tier=&mode=&hasOpenRequests=&framework=&cursor=` (`platform:tenants:read`;
   cursor-paginated, rule 6) reads `control.tenants` + `control.tenant_plans` + `control.sales_inbox` counts +
   a control-plane **tenant summary** (`control.tenant_commercial_summary`: tier, declared framework keys,
   effective packs, refreshed from Sprint 07's `tenant_commercial.changed` outbox event (Sprint 07 X1 AC8) — no
   tenant-scoped read needed to list). **[AR]** That event is an ids-only **internal** event (`audience='internal'`,
   payload `{ tenantId }`); the worker's `InternalProjectionHandler` re-derives the summary from current tenant state
   inside the drainer's tenant transaction and writes it through `kaenal_projector` (SD11) — the webhook handler never
   sees it. A summary older than its last event is corrected on the next event; a "Refresh" action on a tenant row
   re-derives it inside a grant via **[AR2, R1 dead-button fix, new route] `POST /platform/v1/tenants/:id/summary/
   refresh`** (`platform:tenant:access`, grant required) — the route the directory's "Refresh" control (§6) was
   missing; it re-runs `InternalProjectionHandler`'s derivation synchronously inside the grant's tenant transaction
   and returns the refreshed summary fields (§3.4 R1).
3. `GET /platform/v1/tenants/:id` (grant required, via `SupportAccess.withTenant`) → `PlatformTenantDetailDto` (plan,
   packs, trials, `modules` with reasons, contract, CSM, profile, declaration history, counts, open requests).
   `GET /platform/v1/tenants/:id/history?cursor=` (grant; cursor). Foreign/unknown id → 404.
4. Directory and detail views are platform-audited (`tenant_viewed` with the grant id), so "who looked at Acme" is
   answerable — but viewing writes nothing to the tenant (only the grant did).
5. Playwright (platform): sign in → search "acme" → open → reason dialog → Plan tab shows the same effective modules as
   the tenant's `/v1/entitlements`; a `platform_support` user sees no write controls.
6. **[AR] Client hygiene on grant end (AR8).** When a commercial grant ends (End access, countdown reaching zero, or
   any `401`/`403` carrying the grant-ended code), `apps/platform` removes every query keyed under that tenant
   (`queryClient.removeQueries({ queryKey: ['tenant', tenantId] })`) before rendering the expired state; responses
   carry `Cache-Control: no-store`; the query cache is never persisted. Playwright: after End access, no tenant-detail
   query remains in the cache and Back shows the access dialog, not the old data.

Web (`apps/platform`): shell (nav: Tenants, Sales inbox, Workspace requests, Catalog, Price book, Audit log;
header with platform user name/role, environment badge, account menu), directory, detail tabs. Mobile: unaffected. Shared:
routes, DTOs in the platform contract, `control.tenant_commercial_summary` (migration 0080) and its outbox-fed
projector.

Backend: migration 0080 (summary + inbox projection); routes above; platform audit `tenant_viewed`; RBAC
`platform:tenants:read`, `platform:tenant:access`; tenancy: directory from control plane only, detail only through a
grant.

### C5 — Tenant plan administration (packs, bundle, self-service, contract, CSM)

**Design:** Plan-tab edit states and the change-reason confirm (D-C5, D-C6). Replaces the removed `pnpm
tenant-plan` flags `--bundle`, `--pack`, `--self-service`, `--contract-*`, `--csm-*`.

UC
- Happy (`platform_sales`): inside a grant, toggle a pack on/off, apply a bundle (**including Enterprise**, which tenants can
  never self-apply), switch self-service on/off, set contract renewal / annual value / currency, set CSM name /
  email / booking URL / chat URL. Each change opens a confirm with a **change reason** and a diff ("QE: off → on;
  effective modules +Risk, +ECN"); on confirm it applies, the tenant's open browsers update without reload
  (realtime `entitlements`), and the tenant audit log shows "Kaenal support — Order form #1042".
- Downgrade: turning off a pack that would lock modules shows the same open-record impact the tenant admin sees
  (Sprint 07 P4 AC5, computed inside the grant) and requires the reason.
- Fully covered pack (framework inclusions cover every module): the toggle is still available to platform users (a
  contract may include it) but the diff states "no effective change".
- **[AM2] Trial reset (PO-SC6).** A pack row whose trial has **ended** shows "Trial used · ended <date>" and a
  **Reset trial** action: confirm with a mandatory reason (e.g. "Goodwill re-trial after onboarding delay, ticket
  #881") → the tenant's trial record for that pack is removed, the tenant admin can start a new 14-day trial from
  `/pricing` (Sprint 07 P5 AC5), and both audit logs record it. A running trial shows no Reset (409 if forced); an
  extension is not offered (Sprint 07 D4).
- Error: 409 stale (someone else changed it) → reload-and-reapply dialog; invalid URL (non-https CSM link) →
  inline error; expired grant → expiry state (C3).
- Permission: `platform:plans:write` (`platform_sales`, `platform_admin`); `platform_support` sees read-only.

AC
1. Routes (all `platform:plans:write`, grant required, `lockVersion`/expected-state on every write, body `reason`
   ≥ 5 chars): `PUT /platform/v1/tenants/:id/packs/:packId` `{ active }`, `POST /platform/v1/tenants/:id/apply-bundle`
   `{ tier: core|pro|ent, expectedPacks }`, `PUT /platform/v1/tenants/:id/plan` `{ selfService?, contract?, csm? }`,
   **[AM2]** `POST /platform/v1/tenants/:id/trials/:packId/reset` `{ reason, expectedEndsAt }` (AC6).
2. Tenant rows (`entitlements`) are written through `SupportAccess.withTenant` with `source='operator'` and one
   `entitlement_changed` event per changed row (`actor_kind='support'`, reason) in the same tx (rule 3); the
   `control.tenant_plans` row is written in the control tx with `updated_reason`, `updated_by_platform_user` and a platform
   audit event. Ordering per §3 SD5 (intent row, tenant tx, outcome row). **[AR] Concurrency (AR18):** `apply-bundle`
   locks all 9 `entitlements` rows (`… ORDER BY pack_id FOR UPDATE`, SPRINT-07 P1 AC5 invariant) and compares
   `expectedPacks` **inside** the tenant transaction, exactly as SPRINT-07 P4 AC4 [AR]; single-pack writes are guarded
   by `lock_version`; the `control.tenant_plans` write is `UPDATE … WHERE tenant_id = $t AND lock_version = $v`. A
   platform write racing a tenant admin's self-service write resolves to one 409, never a merged state.
3. Any activation auto-fulfils the tenant's open `member_access` requests for that pack (Sprint 07 P6 rule) and
   sends `plan_request_resolved` to those requesters. **[AR2, B2]** This insert runs through the shared
   `notifyMinimal()` (`apps/api/src/shared/notifications.ts`, `INSERT … RETURNING id` only), **[AR3, S1]** not
   `NotificationsService.notifyMinimal()` (platform code never imports `apps/api/src/notifications`, CX AC1) and not
   `notify()`, matching `kaenal_support`'s column-scoped `SELECT (id)` grant (C3 AC3). **[AR4]** This call runs inside
   the platform HTTP-request / `SupportAccess` scope (SD13 D2(ii)'s scope type 2, opened by `PlatformPlanService`'s
   own transaction), not a job processor, so it is unaffected by the worker's pre-existing no-op-producer bug (SD13
   D2(vi)) — that bug affects only job-processor-originated notifications (SD13 D2(v) row 8).
4. Realtime `entitlements` signal published to the tenant after commit (C3 AC5); the tenant-side overlay lifts
   without reload (proved in Playwright against `apps/web`).
5. Tests: each write + its two audit records; reason required (422 without); 409 on stale `lockVersion` /
   `expectedPacks`; Enterprise bundle applies; self-service switch changes the tenant's `/pricing` behaviour on the
   next request; dedicated-tenant path via the support secret ref (router fake); `platform_support` role → 403.
6. **[AM2] Trial reset.** The route deletes the tenant's `entitlement_trials` row for the pack through
   `SupportAccess.withTenant` (commercial grant, `platform:plans:write`) only when `ends_at <= now()` and `ends_at =
   expectedEndsAt` (else 409 `TRIAL_ACTIVE` / `STALE_WRITE`; the DB trigger of C3 AC3 is the backstop); writes one
   tenant `entitlement_changed` event `{ before: { trial: { startedAt, endsAt } }, after: { trial: null, reason:
   'trial_reset' } }` (`actor_kind='support'`, reason, **[AR]** `entity_kind='entitlement_trial'`, `entity_id` = the
   deleted row's `id`, SPRINT-07 P1 AC4) in the same tenant tx and a platform event (SD5 ordering);
   emits the tenant realtime `entitlements` signal and the Sprint 07 `tenant_commercial.changed` outbox event. No
   new notification kind (the tenant sees "Start 14-day trial" again on `/pricing`). Tests: reset of an ended trial
   → tenant can start one more trial → a second reset is possible only after that one ends; running trial → 409;
   reason missing → 422; `platform_support` → 403; both audit records present.

Web (`apps/platform`): Plan-tab edit controls and confirm dialogs. **Tenant web:** no change (it already reacts to the
realtime event and renders support audit events). Mobile: unaffected (nothing mobile uses is gated). Shared:
routes, `PlatformPlanService` (the one operator write path), resolver reuse.

Backend: no new migration (grants in 0080); routes above; audit: tenant `entitlement_changed` (support) +
platform; RBAC `platform:plans:write`; tenancy: via grant, RLS enforced.

### C6 — Sales inbox (resolve plan requests) and workspace-request triage

**Design:** inbox list, resolve dialog, workspace-request list (D-C7). Replaces the removed `--requests`,
`--fulfil`, `--decline`, `--workspace-requests` flags and completes Sprint 07 P6's loop.

UC
- Happy (inbox, no grant needed to list): every open admin→sales request across tenants (from the
  `plan_request.changed` projection): tenant, kind, pack/tier, requester name + email, note, age; filters by kind /
  status / age; newest first; cursor. The count badge in the nav shows open items.
- Happy (fulfil): "Resolve" opens the tenant (grant dialog prefilled "Resolving request #<id>") and a resolve
  dialog: **Fulfil** applies exactly the requested change (add/remove pack, apply bundle; for
  `enterprise_inquiry` / `contact_sales` / `confirm_subscription` there is no automatic plan change — Fulfil means
  "handled", with a required resolution note) and marks the request `fulfilled`; **Decline** requires a reason
  shown to the requester. The requesting admin gets `plan_request_resolved` in-app + email; forwarded member
  requests linked to it are resolved too.
- Happy (workspace requests): list of public intake requests (Sprint 07 O3): company, email, industry, plant size,
  frameworks, received, status. Actions: **Decline** (reason), **Mark as spam**, and for provisioned requests a
  link to the tenant. For `new` requests the row shows the exact provisioning command to run (`pnpm
  provision-tenant … --from-request <id>`), because provisioning stays a script (Sprint 07 P8; §7 Q-SC4 /
  PO-SC4, DECIDED [AM2]).
- Stale: a request withdrawn by the tenant while open in the dialog → 409 "This request was withdrawn".
- Empty: "No open requests" / "No workspace requests". Error: retry card.
- Permission: list — every platform role; resolve and triage — `platform:requests:resolve` / `platform:workspace_requests:
  manage` (`platform_sales`, `platform_admin`).

AC
1. `0080` adds `control.sales_inbox` (PK `(tenant_id, request_id)`, `kind`, `status`, `pack_id`, `tier`, `note`,
   `requester_name`, `requester_email`, `created_at`, `updated_at`) and an idempotent outbox consumer that upserts
   it from `plan_request.changed` (Sprint 07 P6 AC6), tolerant of out-of-order delivery (last `updated_at` wins).
   **[AR] How it is actually written (AR22):** the drainer runs as `kaenal_app` in a tenant transaction and cannot
   touch `control.*`, and `plan_request.changed` is an ids-only internal event (`{ tenantId, requestId }` — the
   requester's name and email are **not** in the outbox). The consumer is SD11's `InternalProjectionHandler`: it
   re-reads the plan request and resolves the requester's name and email inside the drainer's tenant transaction
   (as the P6 sales email does) and upserts `control.sales_inbox` through the **`kaenal_projector`** pool on the
   primary database. Grants: `kaenal_platform` SELECT; **`kaenal_projector` INSERT/UPDATE** (and on
   `control.tenant_commercial_summary`), nothing else; `kaenal_app` none. Tests: a `*`-subscribed customer webhook
   receives no `plan_request.changed`; the projection holds the requester's email while the outbox row does not.
2. Routes: `GET /platform/v1/sales-inbox?status=&kind=&cursor=` (`platform:tenants:read`), `POST
   /platform/v1/tenants/:id/requests/:requestId/fulfil` and `…/decline` (`platform:requests:resolve`, grant, reason /
   resolution note, `lockVersion`) — state machine `open → fulfilled|declined`, non-open → 409
   `INVALID_TRANSITION`; `GET /platform/v1/workspace-requests?status=&cursor=`, `POST /platform/v1/workspace-requests/
   :id/decline|spam` (`platform:workspace_requests:manage`, reason; `kaenal_platform` SELECT + UPDATE(`status`) on
   `control.workspace_requests`).
3. Fulfil applies the change through `PlatformPlanService` (C5) in the same tenant tx as the status change; audit
   `status_changed` + `entitlement_changed` (support, reason) + platform event (SD5 intent/outcome); notification row
   `plan_request_resolved` (kind defined in Sprint 07) **inserted** in the same tx via **[AR2, B2]** the shared
   `notifyMinimal()` (`apps/api/src/shared/notifications.ts`, `kaenal_support` INSERT + column-scoped `SELECT (id)` on
   `notifications`, C3 AC3 — **[AR3, S1]** not `NotificationsService.notifyMinimal()` [platform code never imports
   `apps/api/src/notifications`, CX AC1] and never `notify()`, whose `RETURNING <columns>` would fail the permission
   check under this role) and its email-channel job **enqueued after commit** (SD12, **[AR2, B3]** including
   `notify()`'s own underlying delivery-job enqueue, now routed through the same after-commit buffer). **[AR4]** This
   call likewise runs inside the platform HTTP-request / `SupportAccess` scope (SD13 D2(ii) scope type 2), not a job
   processor, so SD13 D2(vi)'s worker no-op-producer bug does not affect it. **[AR] Double-fulfilment guard
   (AR20):** the guarded transition `UPDATE plan_requests SET status = 'fulfilled' | 'declined', … WHERE id = $id AND
   status = 'open' AND lock_version = $v` runs **first** in the tenant transaction, **before** any entitlement change;
   if it affects zero rows the transaction rolls back and returns 409 (`INVALID_TRANSITION` if no longer open,
   `STALE_WRITE` otherwise). So two platform users resolving the same request concurrently cannot both succeed, and
   the loser never applies an entitlement change. Test: two concurrent fulfils → exactly one 200, one 409, one set of
   entitlement rows changed, one audit pair.
4. Tests: projection idempotence and ordering; fulfil applies exactly the requested change and nothing else; decline
   notifies with the reason; withdrawn-meanwhile → 409; workspace-request status transitions; `platform_support` role → 403
   on resolve; the Sprint 07 journey "request mode (`globex`) → sales email → platform user fulfils → tenant unlocks without
   reload" passes end to end.

Web (`apps/platform`): inbox, resolve dialog, workspace-request list. **Tenant web:** unchanged (Sprint 07 renders
`plan_request_resolved`). Mobile: the mobile notification list already renders `plan_request_resolved` (Sprint 07
X1 AC5b); no change. Shared: projection, routes, consumer.

Backend: migration 0080; routes above; audit as stated; RBAC as stated; tenancy: listing from control plane,
resolution only through a grant.

### C7 — Catalog editor: packs, pack→module map, framework rules, industries, frameworks

**Design:** catalog screens and the impact-preview confirm (D-C8). Implements U-D2 and U-D4's "admin-editable".

UC
- Happy (packs): edit a pack's name, tagline, includes list, value line, icon, accent token, trialable flag, sort
  order; move a module into / out of a pack (the pack→module map).
- Happy (frameworks): add a framework (key, label, short label, counts-as-extra-standard), edit labels, reorder,
  retire (`active=false`) or re-activate; keys are immutable once created.
- Happy (industries): add an industry (key, label, suggested frameworks, module priors), edit, reorder, retire.
- Happy (framework rules): per framework, the module list with level `required` / `supports` / none, clause and
  note; changing a level is the U-D2 lever ("which modules this framework includes free").
- **Impact preview (RC5):** any edit that can change a tenant's effective modules (module map, rule level,
  rule level; retiring never removes inclusions) first computes the affected tenants from the control-plane
  summary: "3 tenants gain FMEA; 12 tenants lose ECN" with both lists; applying requires `platform_admin`, a reason and
  typing the number of tenants that lose access. Open-record counts are **not** computed across tenants (that would
  read tenant data without a grant); platform users open an affected tenant with a grant to see its impact. Pure display edits apply with a reason and no preview.
- Guard rails: mapping a `CORE_FLOOR_GUARANTEED` module to a pack → 422 with the reason (Sprint 07 P0 AC3); a rule
  referencing an unknown module → 422; deleting anything → not offered (retire instead).
- Propagation: the tenant API enforces the edit on the next request (catalog version, Sprint 07 §3.2); tenant
  browsers pick it up on their next catalog/entitlements refetch; the public request form on its next load.
- Error: 409 when another admin edited the same row (`lock_version`) → reload-and-reapply.
- Permission: read — every platform role; write — `platform:catalog:write` (`platform_admin`).

AC
1. Routes (`platform:catalog:write` for writes, `platform:catalog:read` for reads; `lockVersion` + `reason` on every
   write): `GET /platform/v1/catalog`, `PUT /platform/v1/catalog/packs/:packId`, `PUT /platform/v1/catalog/pack-modules/
   :moduleId` `{ packId | null }`, `POST /platform/v1/catalog/frameworks`, `PUT /platform/v1/catalog/frameworks/:key`,
   `POST /platform/v1/catalog/industries`, `PUT /platform/v1/catalog/industries/:key`, `PUT /platform/v1/catalog/
   framework-rules/:frameworkKey/:moduleId` `{ level | null, clause, note }`, `POST /platform/v1/catalog/
   impact-preview` (body = the proposed change; returns the gained/lost tenant lists — **[AR] no open-record counts**:
   AC3/SD7 forbid cross-tenant counts, and the earlier "with open-record counts" wording contradicted them, AR26).
2. Validation reuses `validateCatalog` (Sprint 07 P0 AC3) on the proposed catalog before writing; keys match
   `CatalogKey`; `0080` grants `kaenal_platform` INSERT/UPDATE (never DELETE) on the catalog tables; every write bumps
   `catalog_meta.version` (trigger from 0073) and writes a platform audit event with before/after in the same tx.
   **[AR] Serialized, with the confirmation recomputed inside the transaction (AR19):** every catalog and price-book
   write transaction starts with `SELECT version FROM control.catalog_meta FOR UPDATE`, so catalog writes are strictly
   serialized and each gets its own version. For an edit that can remove access, the lost-tenant set is **recomputed
   after that lock, inside the transaction**, from the proposed catalog and `control.tenant_commercial_summary`; if its
   count differs from the request's typed `confirm`, the transaction rolls back and returns **409 `IMPACT_CHANGED`**
   with the fresh preview — the typed number the admin saw is never trusted after the fact. (The summary is itself an
   eventually consistent projection, SD11; the recompute makes the confirm consistent with what the server knows at
   commit, which is the strongest guarantee available without reading tenant databases.)
3. The impact preview evaluates `effectiveModules` for each tenant from `control.tenant_commercial_summary` (C4 AC2
   — declared frameworks + effective packs), so it needs no per-tenant grant and reads no tenant database; it
   returns the gained/lost tenant lists only (no cross-tenant record counts, by design — SD7).
4. Tests: each editor write + audit; floor-guaranteed guard; typed-count confirm enforced server-side (`confirm`
   field must equal the lost-tenant count; **[AR]** a summary change between preview and apply → 409
   `IMPACT_CHANGED`; two concurrent catalog writes get distinct consecutive versions); a rule change makes a test tenant's module effective/gated on its next
   tenant API request; a new framework/industry appears in `GET /v1/public/onboarding-catalog`; retire keeps
   existing tenants' inclusions (Sprint 07 D2).

Web (`apps/platform`): Catalog section with tabs Packs, Frameworks & rules, Industries (D-C8). Tenant web: no code
change (it reads the catalog). Mobile: unaffected. Shared: routes, catalog write service, impact preview.

Backend: grants in 0080; routes above; platform audit; RBAC `platform:catalog:*`; tenancy: control plane; the
preview never reads tenant content.

### C8 — Price book editor (draft → publish → archive)

**Design:** price-book screens (D-C9). Implements U-D3.

UC
- Happy: `platform_admin` clicks "New draft" (copies the published version), edits item amounts / labels / included units
  (e.g. QE $450 → $500), previews the estimate for a sample org profile and for a chosen real tenant's composition
  (from the summary table, no grant needed — composition only), and **Publishes** with a note; the previous
  published version becomes archived; tenant `/pricing`, estimates and new quotes use the new version on their next
  fetch; old quotes keep citing theirs.
- Draft hygiene: at most one draft at a time; "Discard draft" deletes only a draft; published and archived
  versions are read-only.
- Error: publishing a draft that fails validation (missing `core_base` or a pack item; negative amount) → 422 with
  the list; concurrent publish → 409.
- Permission: read — every platform role; draft/publish — `platform:pricebook:write` (`platform_admin`).

AC
1. Routes: `GET /platform/v1/price-book/versions` (cursor), `GET /platform/v1/price-book/versions/:id`, `POST
   /platform/v1/price-book/drafts` (copy of published), `PUT /platform/v1/price-book/drafts/:id/items/:itemKey`,
   `DELETE /platform/v1/price-book/drafts/:id` (draft only; the only DELETE grant, on draft rows, enforced by a
   policy/trigger), `POST /platform/v1/price-book/drafts/:id/publish` `{ note, reason }`, `POST
   /platform/v1/price-book/preview` `{ versionId, composition }` → `estimateMonthly` output.
2. Publish is one control-plane transaction: draft → `published`, previous → `archived`, `catalog_meta.version`
   bump, platform audit event with the item diff. The partial unique index (Sprint 07 §3.1) makes two published
   versions impossible. **[AR] (AR19)** A second partial unique index (`WHERE status = 'draft'`, SPRINT-07 §3.1) makes
   two drafts impossible — a concurrent "New draft" gets 409 `DRAFT_EXISTS` with the existing draft's id. Publish
   takes the `catalog_meta` lock first (C7 AC2), then runs `UPDATE price_book_versions SET status = 'published', …
   WHERE id = $id AND status = 'draft'` and proceeds only if exactly one row changed (else 409 — already published or
   discarded); item edits and discard are likewise conditional on `status = 'draft'`. Tests: concurrent "New draft" →
   one 201, one 409; concurrent publish of the same draft → one 200, one 409, one archive; editing an item of a just
   published version → 409.
3. Currency stays `USD` this sprint (a CHECK); multi-currency is §7 Q-SC7.
4. Tests: draft lifecycle; publish atomicity and archive; validation 422; the tenant estimate and a newly generated
   quote use the new version on the next request; an earlier quote export still references its version.

Web (`apps/platform`): Price book section (D-C9). Tenant web: no code change. Mobile: unaffected. Shared: routes,
`estimateMonthly` reuse.

Backend: grants in 0080; routes above; platform audit; RBAC `platform:pricebook:*`; tenancy: control plane.

### C9 — Platform audit log and platform accountability

**Design:** audit log screen (D-C10).

UC
- Happy (`platform_admin`): a filterable, cursor-paginated log of every platform event — sign-ins/failures/sign-outs, grants
  opened/ended/expired, tenant views, plan changes, request resolutions, catalog and price-book edits, CLI
  platform-account changes (bootstrap script and C11) — filter by platform user, tenant, action, date; each row shows reason and, for tenant actions,
  a link to the tenant.
- Happy (anyone): "My sessions" (C2) and "My active grants" (C3) in the account menu, with revoke/end.
- **[AM2] Happy (anyone): "My activity"** in the account menu — the platform user's own platform audit events
  (same columns and filters, fixed to themselves) — with **Export CSV** (PO-SC8: standard support-ops tooling; it
  exports the platform user's own actions, not tenant data).
- **[AM2] Export (admin):** Export CSV on the platform audit log exports the current filter (an admin can already
  read every row; the export adds no exposure). Both exports are a synchronous capped download (≤ 10,000 rows; above
  the cap the UI asks to narrow the date range) and are themselves platform-audited (`audit_exported`, filter,
  row count).
- Empty/error/loading states as elsewhere.
- Permission: full log and its export — `platform:audit:read` (`platform_admin`); own activity and its export —
  `platform:audit:own` (every platform role) [AM2].

AC
1. `GET /platform/v1/audit?platformUserId=&tenantId=&action=&from=&to=&cursor=` (`platform:audit:read`).
2. Every platform route writes a platform audit event (a guard test enumerates `@PlatformRoute` write routes and asserts each
   calls the platform audit writer — mutation-style, like Sprint 07 P3 AC2).
3. Tests: filters, pagination, immutability (UPDATE/DELETE rejected for `kaenal_platform`), sign-in failure events
   recorded without the attempted password.
4. **[AM2]** `GET /platform/v1/me/audit?action=&from=&to=&cursor=` (`platform:audit:own`; server forces `platformUserId =
   caller`) and `GET /platform/v1/me/audit/export.csv?…` (same filter). `GET /platform/v1/audit/export.csv?…`
   (`platform:audit:read`). Both CSV routes: ≤ 10,000 rows else 422 `EXPORT_TOO_LARGE` with the count; RFC 4180
   quoting; **CSV-injection safe** (cells starting with `=`, `+`, `-`, `@`, tab or CR are prefixed with `'`);
   columns = the log columns minus `ip`/`user_agent` for the own-activity export (they are the caller's own, but
   add nothing to an action log); one `audit_exported` platform event per download.
5. **[AM2]** Tests: a non-admin's export contains only their own rows even when a `platformUserId` of someone else is
   passed; cap → 422; injection-prefix cases; the export event is written; `platform_support` → 403 on the full-log export.

Web (`apps/platform`): Audit log section (+ Export CSV), **My activity panel (+ Export CSV)** [AM2]. Mobile: unaffected.
Shared: routes.

### C10 — [AM2, NEW] Support view: read-only access to all tenant content under a `content` grant

**Design:** tenant-app support-view mode (D-C12) and the content-scope access dialog (D-C4). No jsx exists. Decided
by the user (U-SC3): full tenant-content access for staff through the time-boxed, audited grant.

UC
- Happy: Ana (`platform_support`) is handling ticket #4471 ("our PPAP approval page shows the wrong status"). In the console
  she opens Acme → **View workspace (read-only)** → dialog: scope *Workspace content*, reason "Investigating PPAP
  status display, ticket #4471", reference "#4471" → a 4 h content grant; a new browser tab opens the **tenant web
  app on Acme's host** in *support view*: the normal Acme screens (dashboard, NCRs, PPAP, documents, suppliers,
  settings pages that are readable…), every record readable, all plants, with a persistent banner "Kaenal support
  view · read-only · Acme · <reason> · ends in 3 h 58 min · **End support view**".
- Read-only everywhere: no create, edit, transition, delete, comment, sign, upload, export-job or settings-save
  control is rendered; the shell hides the account menu's personal items (the viewer is not a member). A crafted
  write request is refused by the API (403 `SUPPORT_VIEW_READ_ONLY`) **and** would be refused by the database
  (the role has no write privilege on tenant tables).
- Attachments: opening a single attachment or photo on a record works and is audited; bulk exports / ZIP downloads
  (which create export jobs) are not available in support view.
- Transparency: the tenant's audit log shows "Kaenal support opened read-only access to your workspace — <reason>
  (#4471) — until 18:32" at grant start, and "Kaenal support viewed PPAP-2026-0031" for each record detail opened
  and each attachment downloaded. The platform log records every request (route, status, grant).
- Expiry / end: at 4 h, on **End support view**, on the grant ended in the console, or on the platform user's
  deactivation, the next request returns 401 and the tab shows the D-C12 ended state ("Support view ended — reopen
  from the Kaenal console with a new reason"); nothing else is affected.
- Error: exchange link expired (60 s) or reused → "This support-view link has expired" with no detail; the browser
  already holds a member session for this workspace (a Kaenal employee who is also a member) → the exchange is
  refused with "Sign out of your own Acme session or use a private window" (the two sessions never mix).
- Permission: `platform:tenant:content` (`platform_support`, `platform_admin`); `platform_sales` never sees the action. Cross-tenant: the
  support-view session is bound to the grant's tenant; a request carrying another tenant's host / header → 404.
- Offline: n/a (online-only, like the console).

AC
1. `0079` adds `control.support_view_sessions` (`token_hash` UNIQUE, `grant_id`, **[AR] `grant_scope text NOT NULL
   DEFAULT 'content' CHECK (grant_scope = 'content')` with a composite FK `(grant_id, grant_scope) →
   control.support_grants (id, scope)` — `support_grants` gains `UNIQUE (id, scope)` for it — so a support-view session
   can reference only a `content`-scope grant, which a plain FK cannot express (AR14)**, `created_at`, `expires_at` =
   the grant's `expires_at`, `revoked_at`, `ip`, `user_agent`) and `control.support_view_exchange_tokens` (`token_hash`
   PK, `grant_id` **[AR] + the same `grant_scope` column, CHECK and composite FK**, `expires_at` = issue + 60 s,
   `used_at`). Neither is readable by `kaenal_app` or `kaenal_public` (grant test). **[AR] The tenant API validates
   them through a new, narrow role `kaenal_support_gate` — never through `PLATFORM_POOL`, which exists only in the
   platform process (C2 AC1) (AR3).** `kaenal_support_gate` is created `NOLOGIN` (AR29) and holds only: SELECT on
   `control.support_grants`, `control.support_view_sessions`, `control.support_view_exchange_tokens`; column SELECT on
   `control.platform_users (id, status, role)`; UPDATE(`used_at`) on `support_view_exchange_tokens`; INSERT on
   `support_view_sessions` and UPDATE(`revoked_at`) on it (the exchange creates the session row and End support view
   revokes it — the two writes the hand-off cannot avoid, both column-scoped); INSERT on
   `control.platform_audit_events` (the per-request platform record, AC5). Nothing else: no tenant table, no other
   control table, no write on `support_grants`, no `platform_users` credential column. New env
   `DATABASE_SUPPORT_GATE_URL` (primary database only) and pool `SUPPORT_GATE_POOL` in the tenant `AppModule`. An
   explicit grant test asserts each privilege and its absence everywhere else (e.g. the gate cannot SELECT
   `platform_users.password_hash` or `mfa_secret_enc`, cannot UPDATE `support_grants`, cannot SELECT any tenant
   table).
2. `0079` creates DB role **`kaenal_support_reader`** (**[AR] `NOLOGIN`**, AR29; no BYPASSRLS; the existing `tenant_isolation` policy
   applies unchanged): SELECT on **every tenant-owned table** except a named credential/secret denylist. **[AR2, R4,
   FINALIZED — the list Definition of Ready #2 asked for]** Table-level denylist: `sessions`, `api_keys`,
   `webhook_endpoints`, `integrations`, `integration_events`, `outbox`, `exports`, `notifications`,
   `notification_prefs`, `user_preferences`, `device_sync_status`. Column-level exclusion within an otherwise-granted
   table: `invitations` minus `token_hash`. Confirmed clean (no column-level secret, no exclusion needed):
   `signatures`, `ai_settings` (full list and reasoning: §3.4 R4). **[AM3, superseded by the R4 finalization]** the
   column-level-secret check the pre-build security review flagged as a prerequisite (SR5) is discharged by this
   finalization: `invitations.token_hash` is the one column-level secret found, and it is excluded as stated. INSERT on `audit_events` only (the C3
   AC4 attribution trigger extended: rows from this role must be `actor_kind='support'`,
   `action='support_accessed'`, `reason = current_setting('app.support_reason')`); **no INSERT/UPDATE/DELETE on any
   other table**. A schema test enumerates every tenant-owned table and fails if one lacks reader SELECT without
   being on the denylist, or if the role holds any other write privilege — so every future migration must grant it
   (mutation test: revoking one grant or adding one write privilege fails the test). Dedicated tenants: provisioning
   / `migrate-tenants` create the role and a **support-reader secret ref** (SD6). New env
   `DATABASE_SUPPORT_READER_URL` (+ `.env.example`).
2a. **[AM3, reconciled in AR] DB-level backstop for grant validity — ONE mechanism for both support roles (SR1/High
    finding; architecture-review finding 2, AR5).** The architecture review independently proposed the same fix under
    the name `support_grant_live()`; it is **not** introduced. **[AR2] The two RESTRICTIVE policies keep AM3's names
    (below); the backing function is renamed to `support_content_grant_active` (Amendment 5) so it is never confused
    with the `support_reader_grant_active` policy of the same historical name — a clarity fix only, no behaviour
    change.** The single mechanism,
    **`support_content_grant_active(expected_scope text)`**, backs both `kaenal_support_reader`'s content scope and
    `kaenal_support`'s commercial scope. What AR changed in AM3's text, and why: AM3 checked the
    grant id, scope and "not ended" only; it compared against `now()` (frozen at transaction start, so a transaction
    that began before expiry kept reading after it); it did not check the tenant or the platform user; it covered only
    `kaenal_support_reader`; it relied on each future migration remembering the policy; and it did not say how one
    migration, run identically on every database, yields a "shared" and a "dedicated" behaviour.
    - **The function.** `support_content_grant_active(expected_scope text) RETURNS boolean`, `LANGUAGE plpgsql`,
      `VOLATILE`, `SECURITY DEFINER` owned by the migrator, `SET search_path = pg_catalog, control` (definer
      hygiene), `REVOKE EXECUTE … FROM PUBLIC` and `GRANT EXECUTE` to `kaenal_support` and `kaenal_support_reader`
      only. **[AR2, R6]** It reads `NULLIF(current_setting('app.grant_id', true), '')` and
      `NULLIF(current_setting('app.tenant_id', true), '')` — never a bare `current_setting(...)` call — because a
      connection reused from a pool can read back `''` instead of throwing; `NULLIF` turns that case into `NULL`,
      which the function's own NULL-check then rejects exactly as it rejects a genuinely unset variable (throws or
      denies — either is an acceptable "properly denied" outcome for a test to assert, per R6 below)
      and returns true only when **all** of these hold for the persisted grant row: `id = app.grant_id`; `tenant_id =
      app.tenant_id`; `scope = expected_scope`; `ended_at IS NULL`; **`clock_timestamp() < expires_at`**; and, on the
      primary database, the grant's platform user is `status = 'active'` and their **current** `role` is one that
      holds the scope's capability (`control.platform_scope_roles(scope)`, an immutable SQL function mirroring
      `packages/core`'s matrix — `content` → `platform_support`, `platform_admin`; `commercial` → all three — with a
      drift test asserting it equals `authorizePlatform`, AR15).
    - **Per statement, not per row (cut-off mid-request, cheap) — [AR2, R6] confirmed as the intended, accepted
      design.** Every policy calls it as an uncorrelated scalar
      subquery — `USING ((SELECT support_content_grant_active('content')))` — so Postgres evaluates it once per
      statement as an InitPlan rather than once per row (a `SECURITY DEFINER` function is never inlined; per-row
      evaluation would cost one control-table lookup per scanned row). Because RESTRICTIVE policies are re-evaluated
      for every statement and the function uses `clock_timestamp()`, the first statement that starts after
      `expires_at`, after `ended_at` is set, or after the platform user is deactivated or demoted sees **zero rows**
      even inside a transaction or request that began while the grant was live. The architect confirms the InitPlan
      shape with `EXPLAIN` on a representative list query (DoR re-review item R6) — confirming an already-decided
      design, not deciding whether it is wanted.
    - **Two policies, both RESTRICTIVE, both `FOR ALL` with `USING` and `WITH CHECK`**, ANDed with the existing
      permissive `tenant_isolation` (which has no `TO` clause): the policy **`support_reader_grant_active`** `TO
      kaenal_support_reader` calling `support_content_grant_active('content')`, and the policy
      **`support_commercial_grant_active`** `TO kaenal_support` calling
      `support_content_grant_active('commercial')`. `WITH CHECK` matters: the reader's own `audit_events` INSERT and every commercial write also
      require a live grant, so an expired commercial grant cannot write even if `SupportAccess` forgot to check.
      **[AR3, D1a — "supersedes" is impossible, fixed.]** `audit_events` does **not** additionally carry
      `support_audit_write_scope` on top of `support_commercial_grant_active` — Postgres ANDs RESTRICTIVE policies
      together, so a second RESTRICTIVE policy can never override or "supersede" a first one that already blocks a
      statement: if the generic `support_commercial_grant_active` FOR-ALL policy were present on `audit_events`, its
      `WITH CHECK` would still refuse a content grant's INSERT regardless of what `support_audit_write_scope` allows.
      The actual mechanism is **exclusion, not supersession**: `audit_events` is the one named exception to "every
      table gets both policies" (below) — the generic `support_commercial_grant_active` FOR-ALL policy is never
      created on it at all. In its place, `audit_events` carries exactly the two narrower, command-scoped RESTRICTIVE
      policies C3 AC3 defines by name: `support_commercial_audit_scope` (FOR SELECT, the commercial entity kinds,
      **[AR3, D1b]** now also gated on a live commercial grant) and `support_audit_write_scope` (FOR INSERT, admitting
      either a live commercial grant or — by name — the one content-grant transparency-row case). The reader's own
      `support_reader_grant_active` policy (content scope) is **unaffected** by this exception and still applies to
      `audit_events` as it does to every other table, since the reader's content-scope SELECT is what the content
      grant's own read access needs. Because a content grant can never satisfy `support_content_grant_active('commercial')`,
      without this exclusion the generic policy would refuse the content-grant's one transparency-row INSERT outright —
      exactly the gap AC6 below exists to close.
    - **Inherited automatically (fail-closed for future tables), with one named exception.** `0079` redefines
      `apply_tenant_rls(tbl)` (`0000_foundation.sql:141`) so that, besides `tenant_isolation`, it (re)creates
      **`support_reader_grant_active` on every table it is applied to, and `support_commercial_grant_active` on every
      table it is applied to EXCEPT `audit_events`** (an explicit `IF tbl <> 'audit_events'` branch inside the
      function, not a convention someone must remember), and `0079` loops over every existing table that already
      carries `tenant_isolation` to apply them under that same rule. `0079` separately creates
      `support_commercial_audit_scope` and `support_audit_write_scope` directly on `audit_events` (C3 AC3), outside
      the loop, since they are specific to that one table and not something a future tenant table inherits. A future
      tenant table therefore gets both generic policies from the one call it must already make (02 §5); only
      `audit_events` is the named exception, and the exception lives in the function body, not in a human's memory.
      Table **grants** stay explicit per migration (AC2's enumerating schema test), so a new table is unreadable by
      the support roles until someone deliberately grants it — policy automatic, access opt-in; both directions fail
      closed.
    - **Shared vs dedicated, from one migration.** Migrations run identically everywhere (`migrate-tenants` fans them
      into each dedicated database), so the function has **one** body that branches on a per-database marker:
      `control.database_identity` (single row, `kind` CHECK `primary` | `dedicated`), created by `0079` as `primary`
      and set to `dedicated` by `provision-tenant` / `migrate-tenants` for a dedicated tenant's database. `primary` →
      the checks above against `control.support_grants` + `control.platform_users` (the source of truth, same physical
      database). `dedicated` → the same grant checks (id, tenant, scope, not ended, `clock_timestamp() < expires_at`)
      against a local mirror **`control.support_grant_backstop`** (`grant_id` PK, `tenant_id`, `platform_user_id`,
      `scope`, `expires_at`, `ended_at`) — in the `control` schema so it is not a tenant table (outside the RLS lint,
      explicit grant test), carrying no business data. The mirror is written only by the **platform API process**
      through the dedicated tenant's `kaenal_support` credential (INSERT; UPDATE(`ended_at`) — granted in every
      database, unused on the primary): inserted as part of **step 2** of the three-step activation ordering (§3 SD5's
      "Grant-activation write ordering" note; C3 AC6) — **this is the one, single numbering now used identically in
      all three places that describe it (SD5, C3 AC6, here): step 1 is the control-plane row's commit; step 2 is one
      atomic tenant-side transaction; step 3 is the SD5 outcome row.** If step 2 fails, the grant is ended with
      `end_reason = 'activation_failed'` (widened from the narrower `mirror_failed`, which named only one of the two
      writes step 2 now covers) and creation returns 503 — no grant is usable in the app without its backstop, and
      (C3 AC6) none is usable without its tenant-visible record either.
      **[AR3, D1c — a failed activation could otherwise leave a live-looking mirror behind] [AR4, Blocking A fix,
      2026-10-01 delta check — restructured so the gap cannot occur, rather than patched after the fact.]** The D1(c)
      finding: a failed activation could leave a dedicated tenant's mirror row committed with **no** corresponding
      tenant audit row, if the mirror insert and the audit-transparency insert were two separate writes and the
      second failed after the first had already committed — and the dedicated-database backstop function checks
      *only* that local mirror, with no path to the control-plane's definitive `support_grants` row to notice the
      grant was ended. **The fix removes the window instead of racing to close it:** the mirror insert (where it
      applies) and the tenant audit-transparency row insert are now **one transaction**, opened once on the
      `kaenal_support` role against the dedicated tenant's own database, not two separate calls. The mirror insert
      runs first as a normal statement inside that transaction; the audit-row insert runs second, in the same
      not-yet-committed transaction — and can safely rely on the mirror row it just inserted, because
      `support_content_grant_active()`'s check (run implicitly by the audit insert's own RESTRICTIVE policy) reads
      `control.support_grant_backstop` through the *same* database connection and transaction, so Postgres's
      read-your-writes guarantee makes the uncommitted mirror row visible to it without needing a prior commit.
      Either both rows commit together, or (the dedicated database is unreachable, the audit insert is refused for
      any reason, anything else fails) the whole transaction rolls back and **neither** row exists — there is no
      longer a state where the mirror is live and the audit row is missing, because producing that state required two
      independent commits and there is now only one. This supersedes the earlier design (a synchronous
      `UPDATE … SET ended_at = now()` issued against an already-committed mirror row after the fact): that design
      would have worked, but restructuring into one transaction is simpler and removes the failure window entirely
      rather than closing it after the fact, so it is preferred as the smaller, safer change. The *asynchronous*
      end-propagation rule for every other end reason is unaffected and unchanged: `ended_at` still propagates to an
      **already-activated, already-live** grant's mirror row on End, expiry-sweep, platform-user deactivation and
      demotion (C11 AC2), each retried by a job until it succeeds, with the primary-side checks in `SupportAccess` /
      `SupportViewAuthenticator` refusing in the meantime — that is a different lifecycle event (ending a grant that
      activated successfully), not an activation failure, and a dedicated database's platform-user status/role still
      cannot be read locally, which is why that propagation exists at all (stated here, not hidden). (AM3's text had
      the tenant-side authenticator write the mirror; that authenticator holds no write privilege on it, so the
      writer is the platform process, as above.)
    - `app.grant_id` joins the `SET LOCAL` context AC4 opens (with `app.tenant_id`, `app.support_reason`,
      `app.platform_user_id`) and the context `SupportAccess.withTenant` opens (C3 AC5).
    - **Tests (extends AC2's schema test and AC8).** **[AR3, D1a]** The schema test enumerates
      `support_reader_grant_active` on every table carrying `tenant_isolation`, and `support_commercial_grant_active`
      on every such table **except `audit_events`**, which it instead asserts carries exactly
      `support_commercial_audit_scope` (FOR SELECT) and `support_audit_write_scope` (FOR INSERT) in place of the
      generic policy — a named special case the test checks explicitly, not a table the generic-policy enumeration
      silently skips. Mutation checks, each of which must make a test fail: dropping either generic policy on any
      table **other than `audit_events`**; for `audit_events` specifically, creating the generic
      `support_commercial_grant_active` policy on it (proving the exclusion branch in `apply_tenant_rls` is load-bearing,
      not cosmetic) and, separately, dropping either of `audit_events`'s own two dedicated policies; redefining
      `apply_tenant_rls` without the reader policy, or without the commercial-policy exclusion for `audit_events` (a
      scratch table created in the test lacks the reader policy; `audit_events` itself regains the generic policy);
      stubbing the function to `true`; replacing `clock_timestamp()` with `now()` (a statement issued after
      `expires_at` inside a transaction opened before it must return zero rows); removing the tenant predicate (a
      live grant for tenant A with `app.tenant_id` = B must return zero rows); removing the platform-user status or
      role predicate (deactivating or demoting the user mid-session must cut off the next statement on the primary
      branch). Each check runs for `kaenal_support_reader` (`content`) and `kaenal_support` (`commercial`, reads and
      writes), and the dedicated branch runs against the router-fake dedicated database with its local mirror. **[AR3,
      D1c; [AR4] superseded, atomic design]** Plus: for a dedicated tenant, failure injected on the audit-row insert
      within step 2's one transaction, after its mirror insert has already run (but not yet committed, since both are
      the same transaction), rolls back the whole transaction — `control.support_grant_backstop` carries **no** row
      for that grant id afterward (not a committed row with `ended_at` set), read directly from the mirror table, and
      the control-plane row is marked `activation_failed` in the same request that returns 503.
3. Hand-off (SD9): `POST /platform/v1/grants/:id/view-link` (`platform:tenant:content`, own active content grant) returns
   a tenant-host URL carrying a single-use exchange token **in the URL fragment** (never sent to servers or
   `Referer`); the tenant web route `/support-view` posts it to `POST /v1/support-view/exchange`
   (`@AllowAnonymous`, tenant-scoped, rate-limited), which verifies the token (unused, unexpired, grant active,
   grant tenant = request tenant), marks it used and sets a host-only `kaenal_support_view` cookie (httpOnly,
   `Secure` in production, `SameSite=Strict`, expiry = grant expiry) plus its CSRF pair. Refused with 409 when a
   `kaenal_session` cookie is present. **[AR]** The token check, `used_at` update and session-row insert run on
   `SUPPORT_GATE_POOL` (AC1); `POST /v1/support-view/end` revokes the support-view session (UPDATE `revoked_at`) —
   it does not end the grant, whose lifetime stays owned by the platform console (C3 AC7).
4. **[AR] Tenant lifecycle interceptor (still the ONE tenant interceptor) — the pool is derived from the resolved
   principal, never from a cookie (AR4).** The interceptor today opens the tenant transaction *before* it
   authenticates (`lifecycle.interceptor.ts:144`, so that the member lookup runs under RLS). A support-view request
   therefore gets a principal-first path: when the request carries `kaenal_support_view` (both it and `kaenal_session`
   → 401), `SupportViewAuthenticator` resolves the principal **before any tenant transaction is opened**, through
   `SUPPORT_GATE_POOL`: session row valid and unrevoked; grant is `content`, unended, `clock_timestamp() <
   expires_at`, for **this** request's tenant (else 404, rule 8); the platform user is `active` and their **current**
   role still holds `platform:tenant:content` (AR15). Any failure → 401 with the ended state, and the request **never**
   falls through to the member authenticator or the app pool. Only a successfully resolved principal of kind
   `support_viewer` selects the `kaenal_support_reader` pool; only a resolved `member` principal uses the app pool
   exactly as today. The cookie only chooses which authenticator *attempts*; a forged, expired or foreign cookie
   produces no transaction at all. Then:
   - **Read-only gate (AR11).** Unsafe methods → **403 `SUPPORT_VIEW_READ_ONLY`** before any handler, except (a)
     `POST /v1/support-view/end` and (b) routes carrying a new **`@ReadOnlyPost()`** decorator — reads that take a
     body and are therefore POSTs. Seeded allowlist: `POST /v1/query`, `/v1/query/metric`, `/v1/query/series`
     (`query.controller.ts:48-60`). `@ReadOnlyPost` is a promise that the handler performs no write; a test runs every
     `@ReadOnlyPost` route in a support-view session and asserts it succeeds **and** that the reader role's lack of
     write privileges was never hit (no permission error in the transaction), and a guard test fails if a
     `@ReadOnlyPost` handler reaches `withAudit` or an INSERT/UPDATE/DELETE. A blanket "POST = write" rule is not used.
   - **Per-user and secrets denylist** (own sessions, MFA, password, recovery codes, push tokens, notification
     preferences) plus the **secrets exclusion of C12's Settings decision** (API keys, the whole integrations /
     webhook-endpoint surface, invitation tokens) → 403 `SUPPORT_VIEW_NOT_AVAILABLE` (the web renders the existing
     "not available" in-shell state for these screens). **[AR2, R5, finalized list]** Plus: notifications list +
     unread-count, `GET/PUT /v1/me/preferences`, `GET /v1/me/dashboard`, the workspaces list, exports (list and
     download), import, the AI gateway routes, the customer/supplier portal routes, presence, collab, and
     device-sync routes — with **`GET /v1/me` special-cased as allowed** (needed to render the support-view identity
     and grant countdown). §3.4 R5 has the web-shell consequence: `apps/web` must not call the notification-bell,
     unread-count or preferences endpoints at all while `GET /v1/me` reports `kind: 'support_viewer'`, not merely
     swallow their 403s.
   - **Long-lived and write-on-read routes (AR6, AR7).** `GET /v1/events` (SSE, `realtime.controller.ts:30`) → **403
     `SUPPORT_VIEW_NO_STREAM`** for a support viewer; see SD7 for why refusal is chosen over per-event re-checking.
     Attachment downloads presign with `min(60 s, seconds remaining on the grant)` (C12 AC6) — **[AR2, R7]** which
     requires `files.service.ts`'s presign call to take a per-call TTL parameter (it has none today; this is the
     concrete change that makes the `min(60 s, …)` rule buildable, not an assumed capability). Every other GET that
     writes as a side effect is handled per C12 AC6, **[AR2, R7]** including the two additional routes named there:
     `GET /v1/exports/:id` (writes an `exported` event on read, `exports.service.ts:175` — denied, per the existing
     wholesale export denial above) and `GET /v1/audit-log/export` (already denied above; restated as a
     GET-that-writes for completeness).
   - Otherwise the handler runs in a tenant transaction opened on the **`kaenal_support_reader`** pool with
     `app.tenant_id`, `app.support_reason`, `app.platform_user_id`, **[AM3]** `app.grant_id` (SET LOCAL). A test
     asserts `SELECT current_user` inside a support-view handler returns **`kaenal_support_reader`**, inside a member
     handler returns `kaenal_app`, and that a request with an invalid support-view cookie opens no transaction.
   The caller is the `support_viewer` principal defined in **C12** (read capabilities, all-plant scope, Settings read
   decision). `GET /v1/me` returns `{ kind: 'support_viewer', displayName: 'Kaenal support', capabilities, grant: {
   expiresAt, reason, reference } }`. No realtime subscription and no notifications for the viewer (lists are
   refetched on navigation). **[AM3]** `app.grant_id` exists so AC2a's RESTRICTIVE policy re-verifies the grant
   independently of this authenticator on every statement: the authenticator governs the request's outcome
   (401/403/200) and its messages; the RESTRICTIVE policy is the fail-safe that still holds if the authenticator is
   buggy or bypassed.
5. **Audit [AR-revised].** Grant start writes the tenant "opened read-only access" event (C3 AC6,
   `entity_kind='support_grant'`). Coverage is decided by an explicit **route classification table** in the API (one
   entry per route the support viewer can reach; a test fails if a reachable route is unclassified), not by "does the
   path have a parameter" (which misfiles e.g. `GET /v1/graph/query/:queryId`, whose parameter is not an entity id):
   - **Detail routes** (the path parameter is a record id) and **every attachment download** → one tenant audit row
     per request, in the request's transaction (the reader role's only write): `actor_kind='support'`,
     `action='support_accessed'`, **`entity_kind='support_view'`**, `entity_id` = the viewed record's (or file's) id,
     `after = { viewedKind, route }`, `reason` = the grant's reason. **Why `support_view` and not the record's own
     kind (AR10, verified against the code):** the audit writer awaits the transactional outbox observer unguarded
     inside the same transaction (`packages/db/src/audit.ts:201-203`), and `outboxEventFor`
     (`apps/api/src/outbox/outbox-event.ts`) maps any event whose `entityKind` is in `OUTBOX_ENTITIES` (`ncr`,
     `capa`, `document`, `supplier`, …) and whose action is anything but created/deleted to `<kind>.updated`. So
     `support_accessed` on `entity_kind='ncr'` would (1) try to INSERT an `ncr.updated` outbox row — which the reader
     role has no privilege for, throwing and **failing every detail read under a content grant** — and, had it been
     granted, (2) deliver that webhook to the customer's own endpoints (an empty or `*` subscription receives
     everything, `webhook-signing.ts:58`), announcing Kaenal's access to any third-party consumer; the realtime
     bridge would likewise push `entity.updated {ncr}` to every member (`realtime/audit-signal.ts:33-34`).
     `support_view` is in neither map, and SD11 makes both bridges skip it explicitly as well.
   - **Collection routes** — lists, `GET /v1/search` (`contract.ts:345`), the graph explorer (`GET /v1/graph/seeds`,
     `/v1/graph/expand`, `/v1/graph/query/:queryId`, `contract.ts:1956-1975`), dashboards, and the `@ReadOnlyPost`
     query routes (`POST /v1/query`, `/metric`, `/series`) — are recorded in the **platform** log (through
     `SUPPORT_GATE_POOL`, AC1) with route, status, grant id and **[AM3]** the returned entity ids: `entityIds`, up to
     **200** in response order, else `entityIdCount` + the first 200 + `truncated: true`. **[AR] Widened (AR9):**
     AM3's wording named "list/aggregate GETs", which missed the three POST query routes and left search and graph to
     interpretation; they are now named. Responses that carry no record ids (metric values, series buckets,
     aggregates) record the **query definition** instead (`sourceId`, filters, grouping, row count), so "what did you
     see" is still reconstructable. The platform-log write is part of the request: if it fails, the response is
     not sent (500) — a read never happens without its record.
   Tenant web Settings → Audit log renders `support_view` rows as "Kaenal support viewed <entity label>" (label
   resolved from `after.viewedKind` + `entity_id`) and the `support_grant` row as "Kaenal support opened read-only
   access — <reason> (<reference>) — until <time>" (small extension of Sprint 07 X1 AC4's renderer); collection-route
   events are platform-log-only (not shown in the tenant's own audit log, same as today), reconstructable by Kaenal on
   request.
6. **Every tenant GET works read-only:** a contract-enumerating test calls every GET route of the tenant contract
   (and every plain-REST GET controller route) **[AR] and every `@ReadOnlyPost` route** in a support-view session
   against a seeded tenant and asserts 2xx / 403 (`SUPPORT_VIEW_NOT_AVAILABLE` / `SUPPORT_VIEW_NO_STREAM` only for the
   routes C10 AC4 and C12 name) / 404 **[AR2, R5 test correction] / 402** (a gated-module read under Sprint 07's
   `@RequireModule`, e.g. `graph`/`predictions`/`supplier-scorecard` when the tenant itself lacks the pack, is a
   correct pre-existing entitlement gate doing its job — the test must accept it as a valid outcome, not flag it as
   unclassified) — never a 5xx from a write side effect. GETs that write as a side effect are
   handled per **C12 AC6** (known: `files.service.ts:261` `file_downloaded`, Sprint 07 O5's completion-on-read, the
   SSE stream). Every other unsafe route returns 403 (same test, inverse).
7. **Web (`apps/web`) support-view mode (D-C12):** the `/support-view` exchange page; the banner (reason, reference,
   live countdown announced politely, **End support view** → `POST /v1/support-view/end` → ended state); every
   mutating control hidden because the viewer holds no write capability (04 §6) — a Playwright sweep over the main
   screen of every module and every settings section asserts **no enabled mutating control is rendered**, and any
   control found that is not capability-gated is fixed to be (that is a latent 04 §6 defect, not a support-view
   special case); personal account-menu items hidden; ended / expired states. `apps/web` never imports the platform
   contract (CX AC1 still holds: the exchange and end routes are tenant-contract routes). **[AR] Client hygiene on
   grant end (AR8):** the moment the support view ends — End support view, the banner countdown reaching zero, or any
   response `401` carrying the ended code — the web app calls `queryClient.clear()` (TanStack Query) and drops every
   in-memory record before rendering the ended state, so no tenant record stays readable in the tab, the back/forward
   cache or devtools after access ends; support-view responses carry `Cache-Control: no-store`; support-view mode never
   opens the `EventSource` for `/v1/events` (the API refuses it anyway, AC4) and never persists the query cache.
   Playwright: after End, the ended state renders, `queryClient.getQueryCache().getAll()` is empty and navigating back
   shows the ended state, not a record.
8. Tests: exchange single-use and 60 s expiry; fragment token never reaches server logs (the exchange is a POST
   body); cookie flags; both-cookies → 401; member-session present → 409; expiry at 4 h, End, console end and platform-user
   deactivation each → 401 on the next request; write attempts → 403 and, with the interceptor check bypassed in a
   test, → a database permission error (defence in depth proven); per-user denylist → 403; `platform_sales` → 403 on
   view-link; cross-tenant host with a valid cookie → 404; tenant audit rows for detail views and attachments;
   **tenant sign-in re-proved end to end (201)** after the interceptor change (rule 12) and the mobile bearer path
   unchanged. **[AM3]** Plus (SR1/High finding, DB-level backstop): connecting directly as `kaenal_support_reader`
   (bypassing `SupportViewAuthenticator` entirely) with `app.grant_id` absent, pointing at an expired grant, or
   pointing at an ended grant asserts **zero rows / a permission error** on a representative sample of
   reader-accessible tables — independent of, and even when, the application-layer check is skipped; the same
   assertion holds for a dedicated-tenant database against its local `control.support_grant_backstop` mirror; a mutation
   test confirms dropping the RESTRICTIVE policy, or stubbing `support_content_grant_active()` to always return
   true, makes this test fail. **[AM3]** Plus (SR4): a list-view request made under a content grant records the
   returned entity ids (or `entityIdCount` + a capped 200-id sample with `truncated: true`) in its platform audit
   event, verified against the endpoint's actual response body. **[AR]** Plus: a detail view under a content grant writes exactly one
   `support_view` audit row and **no** outbox row and no realtime signal (a webhook endpoint subscribed to `*` receives
   nothing; the detail read succeeds even though the reader role has no `outbox` privilege); `POST /v1/query` and
   `/v1/search` and one graph route record their platform events (ids or query definition); the platform-log write
   failing makes the request 500; `GET /v1/events` → 403; `SELECT current_user` = `kaenal_support_reader` in a
   support-view handler; an invalid support-view cookie opens no transaction; the gate role's grant test (AC1).

Web: `apps/platform` (View workspace action, content dialog variant) and **`apps/web`** (support-view mode, exchange
page, banner, audit-log renderer extension). Mobile: unaffected (no support view on mobile; the oversight feed's
generic row renders the events). Shared: migration 0079 additions, `SupportViewAuthenticator` in the lifecycle
interceptor, the two tenant-contract routes (`POST /v1/support-view/exchange`, `POST /v1/support-view/end`), the
platform route `POST /platform/v1/grants/:id/view-link`, the reader role and its schema test, **[AM3]** the
`support_content_grant_active()` function and its two RESTRICTIVE policies and (dedicated tenants) the `control.support_grant_backstop`
mirror table.

Backend: migration 0079; routes above; audit: tenant `support_accessed` per detail view / attachment + grant start,
platform event per request (**[AM3]** incl. entity ids on list views); RBAC `platform:tenant:content` + synthetic
read-only `support_viewer`; tenancy: RLS enforced
for the reader role, grant-bound tenant, no write privilege.

### C11 — [AM2, NEW] Platform account management in the console

**Design:** Platform users section (D-C11). Decided by the PO under the lead's instruction (PO-SC1).

UC
- Happy (`platform_admin`): Platform users section lists every platform account (name, email, role, status, MFA enrolled, last sign-in,
  created by). **Invite platform user** (email, name, role) → the account is created `pending_setup` and a one-time setup
  link (24 h) is emailed to the invitee through the control-plane email path Sprint 07 O3 uses; the admin never sees
  the link. **Resend setup email** issues a fresh link (old one invalidated).
- Happy: **Change role** (**[AR]** ends, at once, every open grant whose scope the new role cannot hold — e.g.
  `platform_support` → `platform_sales` ends that person's open `content` grants and revokes their support-view
  sessions; the confirm dialog names what will be ended), **Deactivate** (reason; revokes every platform session, ends
  every active grant and support-view session of that person at once), **Reactivate** (reason), **Reset credentials**
  (reason; new setup link: password + TOTP re-enrolment; existing sessions revoked).
- Guard rails: an admin cannot change their own role or deactivate themselves; the **last active admin** cannot be
  demoted or deactivated (422 `LAST_ADMIN`); a duplicate email → 409; every change requires a reason.
- Error: 409 stale (`lockVersion`); email transport failure → the account exists and "Resend setup email" is offered
  (**[AR]** the send-email job retries transport failures; the email is enqueued after the control transaction
  commits — SD12).
- Empty: only the bootstrap admin → the list shows one row and the Invite action.
- Permission: `platform:users:manage` (`platform_admin`); other roles do not see the nav entry.

AC
1. Routes (`platform:users:manage`, `lockVersion` + `reason` on writes): `GET /platform/v1/platform-users?cursor=&status=&role=`,
   `POST /platform/v1/platform-users` (`Idempotency-Key`), `POST /platform/v1/platform-users/:id/resend-setup`, `PUT
   /platform/v1/platform-users/:id/role`, `POST /platform/v1/platform-users/:id/deactivate|reactivate|reset`.
2. Each write updates `control.platform_*` in one control transaction with a platform audit event (before/after, reason);
   deactivation revokes `platform_sessions`, ends `support_grants` (`end_reason='user_deactivated'`) and revokes
   `support_view_sessions` in the same transaction. **[AR] A role change does the same for every open grant whose
   scope the new role cannot hold (`end_reason='role_changed'`, AR15)**, and both paths enqueue the dedicated-database
   mirror propagation of `ended_at` (C10 AC2a) after commit. Because every authenticator and the DB function re-read
   the **current** role and status (C3 AC1, C10 AC2a), a demoted or deactivated user's already-open session cannot
   keep using access their role no longer has, even between the commit and the grant-ending propagation. The invite
   and resend emails are enqueued after the control transaction commits (SD12), never claimed as same-transaction.
3. Tests: invite → email in the dev sink → setup → active; resend invalidates the previous token; self-demotion /
   self-deactivation → 422; last-admin → 422; deactivation ends a live grant and a live support-view session on their
   next request; **[AR]** demotion `platform_support` → `platform_sales` ends the open content grant and its
   support-view session (next request 401, next reader statement zero rows) while leaving the commercial grant open;
   `platform_sales` / `platform_support` → 403; every write audited.

Web (`apps/platform`): Platform users section (D-C11). Mobile: unaffected. Shared: routes, `PlatformIdentityService` (shared with
C1's setup routes).

Backend: no new migration (0078 tables); routes above; platform audit; RBAC `platform:users:manage`; tenancy: control
plane only.

### C12 — [AR, NEW] The `support_viewer` principal: a defined request context for a non-member reader

**Design:** no new screen; its visible effects are states on D-C12 (the "not available in support view" state for the
Settings sections PO-SC10 excludes). Split out of C10 by the architecture review (finding 7): C10 decided *that* a
content grant yields a read-only viewer; nothing defined *what that principal is* to the ~200 places in the API that
assume a real tenant member. That is its own vertical slice, not something C10 can absorb silently.

**Verified current state.** **[AR3, S6 — stop stating a fixed count; record the grep pattern instead.]** The
authoritative definition of this slice's scope is the **grep pattern**, not a number: every call site of
`membershipOf()`, `actorIdOf()` or `currentActorId()` under `apps/api/src` (excluding tests), plus every direct
`currentContext().membership` / `.userId` read, plus every local per-controller re-implementation of the same idea
(see the `inspections.controller.ts` note below). A count is given below only as an **illustrative, approximate
snapshot of the day it was taken** — no AC depends on it being exact, because a grep-based count on a live codebase
drifts every time someone re-runs it. Snapshot, 2026-09-30: `membershipOf()` / `actorIdOf()` / `currentActorId()`
alone, **195 matches across 38 files**; widening to also count direct `.membership`/`requireMembership` call sites,
**202 matches across 42 files**; **[AR2, R8]** an independent delta-check re-run the same day counted **~204 matches
across 36 files** for a similarly-scoped query — the two re-runs differ because they counted slightly different
patterns, not because the codebase changed meaningfully between them, which is itself the point: **any one of these
numbers is a snapshot, not a target.** **[AR3, S6]** A further helper family the earlier snapshots missed entirely:
`inspections.controller.ts`'s own local `membership(ctx)` / `actorId(ctx)` helpers (lines 176/180) re-implement the
same member-assuming pattern ad hoc and must be classified alongside the three named helpers, not left out because
they have different names. **[AR3, S6]** `query.controller.ts:68` was previously cited as a call site; it is actually
**inside a helper's own definition**, not a call site — the real call sites in that file are `query.controller.ts:41`
and `:86`. The architect's slice plan works from a fresh run of the grep pattern above against the actual codebase at
build time, not from any number fixed in this document. Each site throws `UNAUTHENTICATED` when there is no
member (`apps/api/src/ncr/handler-ctx.ts:13-23`); further code reads `currentContext().membership` directly (e.g.
`query.controller.ts` `requireMembership()`, `realtime.controller.ts:35`). Read handlers use the membership for
capability filtering and plant scoping (e.g. `GET /v1/query/sources` filters by `hasCapability(membership.role, …)`),
so today a principal with no membership would fail every one of them with 401. Settings GETs are gated by the
**manage** capabilities (`settings:manage` on `/v1/settings/legal-holds`, `/dlp-policies`, `/cost-centers`,
`/cost-centers/assignments`, `/chargeback`, `/chargeback/report` — `settings.controller.ts:129-249`;
`integration:manage` on the whole integrations controller — `integrations.controller.ts:34`); there is no separate
"settings read" capability to hand a read-only viewer.

UC
- Happy: Ana, in a support view of Acme (C10), opens NCR, PPAP, FMEA, calibration and supplier screens and every
  plant's records; lists, filters, search, dashboards and the report viewer work exactly as for an all-plant auditor.
- Happy: she opens Settings → Organization-level sections (branding, session policy values, NCR validation rules,
  legal holds, DLP policies, cost centers and chargeback, members / plants / areas, plan and billing details, the
  workspace profile, onboarding, the tenant audit log) read-only.
- Permission: Settings → Integrations (incl. webhook endpoints and their delivery logs), API keys, and any
  credential-bearing screen render the existing "not available" in-shell state with the copy "Not available in
  support view" — never a dead control, never a 500.
- Error: a code path that tries to act as a member (a write, or a read that records a per-user side effect) returns
  **403 `SUPPORT_VIEW_READ_ONLY`**, never 401, 500 or a fabricated actor id.
- Offline: n/a (online-only).

AC
1. **Principal type.** `packages/types`: `PrincipalKind = 'member' | 'support_viewer'`. `packages/core/src/principal.ts`:
   `Principal = { kind: 'member'; userId; membership } | { kind: 'support_viewer'; platformUserId; grantId; tenantId }`
   and `accessScopeOf(principal): AccessScope` = `{ capabilities: ReadonlySet<Capability>; plantIds: readonly string[]
   /* empty = all */; supplierScope: null }`. The tenant request context carries `principal` (C10 AC4 sets it); the
   member path is unchanged in behaviour. **[AR2, R8] `AccessScope.plantIds` carries an already-resolved plant
   filter, not a role to re-derive one from.** Read services today test plant scoping directly and inconsistently
   (e.g. `graph.service.ts:210`, `training.service.ts:103`, `entity-ref.ts:114` each inline
   `isPlantScoped(membership.role) && plantIds.length > 0` against a real `membership`); a migrated site takes its
   plant filter from `accessScopeOf(principal).plantIds` instead, with `[]` meaning "all plants" — the same meaning
   today's inline check already gives an all-plant real member, so migrating a site changes **no behaviour for a real
   member** and is what lets a support viewer's all-plant read (AC3) fall out of the same code path (full reasoning
   and the characterisation-test requirement: §3.4 R8's AccessScope note).
2. **The read capabilities, as an explicit list in `packages/core` (not "every read").**
   `SUPPORT_VIEWER_READ_CAPABILITIES` = `inspection:view`, `ncr:view`, `capa:view`, `audit:view`, `prediction:view`,
   `document:view`, `supplier:view`, `ppap:view`, `scar:view`, `fmea:view`, `spc:view`, `report:view`, `graph:view`,
   `risk:view`, `msa:view`, `calibration:view`, `training:view`, `complaint:view`, `ecn:view`, `auditlog:read` —
   20 of the 50 capabilities in `rbac.ts`. **Never granted:** every `:manage`, `:create`, `:perform`, `:verify`,
   `:approve`, `:respond` capability, `import:run`, `billing:manage`, `settings:manage`, `members:manage`,
   `apikeys:manage`, `integration:manage`, `portal:*` (supplier-scoped by design), and `ai:use` (a model call sends
   tenant content to a provider under Kaenal's name, costs money and writes usage rows — not "reading"). A unit test
   pins the list and fails if a capability is added to `CAPABILITIES` without being classified here as granted or
   never-granted (so a future capability cannot be silently readable or silently broken).
3. **All-plant scope, stated.** `accessScopeOf` returns `plantIds: []` (no restriction) for a support viewer. Why:
   the user's decision (U-SC3) is read access to *every* record in the workspace; plant scoping in Kaenal restricts
   what a member may see, it is not a data partition, and a support engineer reproducing a customer's problem must see
   what any member might see — choosing one plant would be arbitrary. Tenant isolation is untouched (RLS +
   C10 AC2a).
4. **PO-SC10 — Settings sections a support viewer may read (named decision, smallest reasonable choice).** Because
   Settings GETs are gated by manage capabilities, the viewer is **not** given those capabilities; instead one
   **route policy table** in `packages/core` (`SUPPORT_VIEW_ROUTE_POLICY`, the same table C10 AC5 uses for audit
   classification) marks each tenant route `detail` | `collection` | `settings_read` | `denied`, and the support-view
   RBAC check is: safe method (GET or `@ReadOnlyPost`) **and** (route capability ∈ AC2's list **or** route is
   `settings_read`) **and** route is not `denied`. An unclassified route is `denied` (fail closed); a test fails if any
   tenant route is unclassified.
   - **Readable (`settings_read`):** `GET /v1/settings/branding`, `/session-policy` (the policy values — not anyone's
     sessions), `/ncr-validation-rules`, `/legal-holds`, `/dlp-policies`, `/cost-centers`, `/cost-centers/assignments`,
     `/chargeback`, `/chargeback/report`; `GET /v1/members`, `/v1/plants`, `/v1/areas`, `/v1/members/workload`
     (who holds which role and plant scope — the RBAC-assignment context most "I can't see X" tickets need); the
     tenant audit log `GET /v1/audit-log`, `/v1/audit-events`; and Sprint 07's `GET /v1/settings/workspace-profile`,
     `/v1/onboarding`, `/v1/billing/plan`, `/v1/settings/billing`, `/v1/entitlements`, `/v1/entitlements/org-profile`,
     `/v1/entitlements/downgrade-impact`, `/v1/entitlements/requests`. Billing email and tax ID are business contact
     data, not credentials.
   - **Denied (`denied`), even read-only:** the whole integrations surface (`/v1/integrations*` incl.
     `webhook-policy`, endpoint config, credential references and delivery logs whose payloads can embed tokens), any
     API-key route (none exists today; `apikeys:manage` is reserved), any SSO/SCIM configuration (future, ROADMAP
     Sprint 14), invitation tokens, every per-user route (own sessions, MFA, password, recovery codes, push tokens,
     notification preferences), `GET /v1/audit-log/export` and every export download (bulk export, SD7), and
     `GET /v1/events` (SSE, SD7).
   - **Reasoning.** A support engineer needs the organisation's configuration to reproduce a problem, so
     configuration is readable. A secret or credential is different in kind: holding it lets the holder *act as the
     tenant outside Kaenal* (sign webhook deliveries, call the API, federate sign-in) — a read of it is an escalation
     from "read" to "act", which a read-only content grant must never provide. Integration *health* without config
     would help support; a config-free projection is a future candidate (→ Known issues), not built this sprint.
5. **Member-assuming call sites (the slice's bulk).** The three helpers keep their signatures for write paths and now
   throw **`ApiError('SUPPORT_VIEW_READ_ONLY')` (403)** — not `UNAUTHENTICATED` — when the principal is a support viewer,
   so any write path a support viewer somehow reaches fails as a clean 403 and can never run with a fabricated actor
   id. Every **read** path among the member-assuming sites matched by **[AR3, S6]** the grep pattern above (R8) and the direct `currentContext().membership` / `.userId` reads moves to
   `accessScopeOf(currentPrincipal())` for capability and plant decisions, per **R8**'s `AccessScope`-carries-the-filter
   refactor (AC1). The architect's slice plan classifies all
   sites against **§3.4 R8's named read-migrate and per-user-deny lists** (read → migrate; per-user route → deny, never
   migrate; everything else → confirmed write, keep) — DoR re-review item R8. Unit tests: the helpers throw 403 for a support viewer
   and behave unchanged for a member; C10 AC6's contract-enumerating test is the integration proof that every read
   route works.
6. **GETs that write (C10 AC6, DoR R7).** (a) Attachment download (`files.service.ts:261`, which today writes a
   `user` `file_downloaded` audit event with the member's id) writes C10 AC5's `support_view` row instead, and presigns
   with **TTL = `min(60 s, seconds until the grant's expires_at)`** (the global `S3_URL_TTL_SECONDS` is 900 s,
   `env.ts:67`); with under 5 s left the request is refused as ended (401). (b) Sprint 07 O5's completion-on-read
   (`GET /v1/onboarding` setting `status='completed'`) skips its write for a support viewer and returns the computed
   state. (c) `GET /v1/events` is refused (SD7). Any further write-on-read found by the architect's enumeration gets
   the same treatment (skip the write, or record `support_view`), never a grant of write privilege to the reader role.
   Tests for (a)-(c), including a download link that stops working when the grant has under 60 s left.
7. **Tenant web.** `GET /v1/me`'s `kind` drives the shell (C10 AC7); denied Settings sections render the existing
   "not available" in-shell state with the support-view copy (D-C12). No new screen.

Web (`apps/web`): the support-view variants of the "not available" state; `useMe()` consumers treat `kind:
'support_viewer'` as holding exactly AC2's capabilities. Mobile: unaffected (no support view on mobile; the mobile app
never receives a `support_viewer` principal — the support-view cookie is web-only and bearer requests never resolve to
one). Shared: `packages/types` (`PrincipalKind`), `packages/core` (`Principal`, `accessScopeOf`,
`SUPPORT_VIEWER_READ_CAPABILITIES`, `SUPPORT_VIEW_ROUTE_POLICY`), the API helpers and read-path migration.

Backend: no migration; no new route; audit per C10 AC5; RBAC as above; tenancy: grant-bound tenant, RLS + C10 AC2a
unchanged.

### CX — Cross-cutting: isolation, deployment, seeds, docs, security review

AC
1. **Bundle/route isolation:** `apps/web`'s build output contains no platform route or platform contract (a test greps
   the Next build manifest and the client chunks for `/platform/v1` and platform contract symbols); lint rules from C4
   AC1 enforced in CI. **[AR] Import boundaries (recommended DoD item, AR21), [AR2] tightened per SD13 (B4):** an
   ESLint boundary rule (`no-restricted-imports` / `eslint-plugin-boundaries`) forbids (a)
   `apps/api/src/platform/**` from importing tenant-side controllers, services or `lifecycle.interceptor.ts`, and
   tenant-side `apps/api/src/**` from importing `apps/api/src/platform/**` — **both may import only
   `apps/api/src/shared/**` (SD13) on the other side**, never a tenant-side or platform-side file directly, which now
   explicitly names the audit bridges, the realtime publisher, the job producer, `CatalogService` and the
   notification writer as the shared surface (SD13 closes the earlier gap where these were "shared" in intent but not
   in the lint rule); (b) `packages/types/src/platform/**` from importing tenant contract internals and the tenant
   contract from importing `@kaenal/types/platform`; (c) `apps/web` ↔ `apps/platform` (already C4 AC1). The PO
   cannot verify a lint rule's effect by reading; the architect confirms it fails on a planted violation — **[AR2,
   R9]** a fixture test that plants exactly one forbidden import per boundary (platform → tenant-side non-`shared`
   file; tenant-side → platform-side non-`shared` file; platform contract → tenant contract internals; `apps/web` →
   `apps/platform`) and asserts the lint run fails on each, so the rule's effect is proven once, not asserted.
2. **Host isolation:** `PLATFORM_HOST` (e.g. `platform.kaenal.localhost` in dev, `platform.<root>` in prod) required when
   the platform module is enabled; `PLATFORM_ALLOWED_CIDRS` optional; `apps/platform` served only there, with a strict CSP
   (`default-src 'self'`, no third-party script), `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`,
   `frame-ancestors 'none'`. **[AR]** The ingress routes `PLATFORM_HOST` to the platform API process only and never to
   the tenant API; the tenant API never receives a request for that host.
2a. **[AR] Reserved slugs (AR2).** `RESERVED_TENANT_SLUGS` (`packages/types/src/tenant.ts:14`) gains `staff` and
   `platform`, so no tenant subdomain can ever equal the platform host label (or the historical one). Migration
   `0078` fails loudly (`RAISE EXCEPTION`) if an existing `control.tenants` row already owns either slug (none does in
   dev; the check protects any other environment). Test: `TenantSlug.parse('platform')` and `('staff')` fail;
   `provision-tenant --slug platform` exits 1.
3. **Env/docs:** `.env.example` gains `DATABASE_PLATFORM_URL`, `DATABASE_SUPPORT_URL`, `DATABASE_SUPPORT_READER_URL`
   [AM2], **[AR] `DATABASE_SUPPORT_GATE_URL`, `DATABASE_PROJECTOR_URL`, `PLATFORM_PORT`** (each annotated with the one
   process that may read it: platform API — `DATABASE_PLATFORM_URL`, `DATABASE_SUPPORT_URL`; tenant API —
   `DATABASE_SUPPORT_READER_URL`, `DATABASE_SUPPORT_GATE_URL`; worker — `DATABASE_PROJECTOR_URL`), `PLATFORM_HOST`,
   `PLATFORM_ALLOWED_CIDRS`; CLAUDE.md "Commands" gains `pnpm platform-bootstrap …` [AM2], **[AR] `pnpm --filter
   @kaenal/api dev:platform` (platform API :3003), `pnpm db:dev-roles` (dev-only LOGIN credentials for the new roles,
   AR29)** and `pnpm --filter @kaenal/platform dev` (:3002); `apps/platform/README.md` documents the security model in one page (identity,
   session, grant scopes, support view, roles, DB roles) and, **[AM2] PO-SC2**, a production runbook line: the platform
   host must sit behind a network restriction (`PLATFORM_ALLOWED_CIDRS` or an ingress-level VPN / zero-trust proxy)
   before production use.
4. **Seed:** a dev-only `scripts/seed-platform.ts` creates `platform-admin@kaenal.test`, `platform-sales@kaenal.test`,
   `platform-support@kaenal.test` with a known dev password and a **fixed dev TOTP secret** printed with its
   otpauth URI (dev only; the script refuses to run when `NODE_ENV=production`). It runs after `seed-demo.ts` and
   never touches tenant rows, so the tenant demo login is unaffected (rule 12).
5. **Test-suite hygiene:** the platform suites seed and clean their own `control.platform_*` rows; the serial-package
   rule holds (`--concurrency=1`). After `pnpm test` / `pnpm test:rls`, re-seed both the demo tenant and the platform
   accounts, and prove **both** sign-ins (tenant 201; platform password + TOTP → session).
6. **Security review:** a `security-reviewer` pass on the design (before build) and on the merged code
   (**[AR]** both lifecycle interceptors — `PlatformLifecycleInterceptor` and the tenant interceptor's [AM2] support-view principal path — the two-router enumeration, cookies, CSRF, grants and scopes, the fragment
   hand-off, DB roles incl. `kaenal_support_reader`, audit triggers, host check) with findings resolved or recorded
   before Gate 2.
7. **PROGRESS.md:** the `CONTROL_POOL` Known issue is updated to state the platform surface does not use it (the tenant
   auth path still does; unchanged by this sprint).
8. **[AR2, NEW, R9] Deployment/tooling deliverables, named concretely.** Beyond the `dev:platform` script already
   named in AC3: `package.json` gains **`start:platform`** (production boot of `platform-main.ts`, mirroring the
   existing `start` script for `main.ts`); the repo gains **`Dockerfile.platform-api`** (the platform API process,
   alongside the existing tenant-API Dockerfile) and **`Dockerfile.platform`** (the `apps/platform` Next.js app,
   alongside `apps/web`'s); `apps/api/src/env.ts` (today one Zod schema for the whole process) is **split into
   `env.base.ts`, `env.tenant.ts`, `env.platform.ts`, `env.worker.ts`**, each validating only the variables its
   process reads (this is what makes C2 AC1's "the tenant API's env schema does not declare
   `DATABASE_PLATFORM_URL`" test possible without hand-maintained exclusion lists) — `main.ts` loads
   `env.base + env.tenant`, `platform-main.ts` loads `env.base + env.platform`, the worker loads `env.base +
   env.worker`. Test: each process's schema parses successfully with only its own required variables set and fails
   (missing var) if a variable belonging to a different process's schema is required instead.

---

## 3. Security + architecture design — DECIDED [AM2/AM3/AR] (architecture re-review and security-reviewer pass still required before build)

**[AM2] Status.** SD1-SD6 and SD8 stand as the PO's decisions under CLAUDE.md's standing rule (the user was asked
no further questions, per the lead's instruction); SD7 is **rewritten** for the user's Q-SC3 decision; SD9 is new.
A design decision is not a security sign-off: the `security-reviewer` pass (CX AC6) reviews this section before
any build starts and may send changes back.

**[AM3] Status update.** A pre-build `security-reviewer` pass on this section (SD1-SD9, still design-only — no code
existed to review) returned 1 High and 3 Medium findings, resolved in this amendment: SD7 gains the finalized
DB-level backstop for content-scope reads (High, SR1); a new SD10 covers step-up re-auth and the rate
limit/anomaly signal on content-grant creation (Medium, SR2/SR3); C10 AC5 gains list-view audit completeness
(Medium, SR4); C10 AC2 gains an explicit column-secret check requirement for when the architect finalizes the
reader denylist (flagged prerequisite, SR5, not yet a defect). **Resolving these findings in the document is not
the same as the security gate closing:** the `security-reviewer` still owes (1) a sign-off on this revised §3
before build starts, and (2) the code review already required by CX AC6 / Definition of Ready #3 once 07C is
built — both stand as before.

**SD1 — [AR, revised] A separate app (`apps/platform`) on a separate host, served by a separate API process
(`PlatformAppModule`, entry point `apps/api/src/platform-main.ts`) with its own contract and its own single
lifecycle interceptor.**
- *Options.* (a) A `/platform` area inside `apps/web`. (b) A new `apps/platform` Next.js app; API routes in the existing
  NestJS process under `/platform/v1` with a host check. (c) A new app **and** a separate API process.
- *Decision: (c)* — **[AR] changed from (b)** after the architecture review. Why not (a): `apps/web`'s root layout
  wraps every route in the tenant app's providers and i18n, and its route groups assume a tenant (shell,
  entitlements, realtime) — the console would have to escape all of it; tenant hosts would serve the platform routes'
  build artefacts; the tenant session cookie and CSRF token live on the same origin; and one misconfigured route
  guard would expose a cross-tenant tool on customer domains. A separate origin gives host-only cookies (a tenant-page
  XSS cannot ride a platform session, and vice versa), an independent CSP, independent deploys and a network
  restriction at the ingress.
- *Why (b) was withdrawn.* The earlier draft rejected (c) because a second process would "duplicate the
  interceptor, audit writer, resolver and outbox". That was wrong: a second NestJS application inside `apps/api`
  (`platform-main.ts` → `PlatformAppModule`) **imports** those modules and packages; nothing is copied. Meanwhile (b)
  left the two planes entangled in ways a host check cannot fix: a platform branch inside the tenant app's one
  global interceptor (`app.module.ts:545`), tenant routes still mounted on the platform host, and the tenant API
  process holding the platform and support database credentials (`DATABASE_PLATFORM_URL`,
  `DATABASE_SUPPORT_URL`), so any tenant-app RCE or SSRF would inherit cross-tenant commercial write access. With (c)
  the tenant process holds neither credential (C2 AC1); its only platform-adjacent credentials are the two narrow
  roles C10 needs (`kaenal_support_reader`, `kaenal_support_gate`).
- *Consequence for the settled "ONE interceptor" decision.* None: each app has exactly one lifecycle interceptor that
  authenticates and authorizes inside its own scoped transaction. The full reasoning is in C2 AC2 so it is recorded
  next to the code it governs. The two routers are enumerated by a test (C2 AC3), the two apps' internals cannot
  import each other (CX AC1 lint rule), and each app's env schema declares only its own credentials.
- *Cost accepted (ADR trade-off, [AR]):* one more deployable (the platform API) and one more ingress route; a
  second bootstrap (`platform-main.ts`) and module graph to keep healthy; shared libraries must stay free of
  app-specific globals so both apps can import them. Accepted because it removes the platform credentials and routes
  from the customer-facing process entirely.
- *Cost accepted (ADR trade-off):* `apps/platform` builds its own small set of primitives (table, form fields,
  dialog, tabs, badge, toast) from the shared tokens rather than importing `apps/web` components — some visual
  duplication, in exchange for zero coupling to the tenant app. Extracting a shared `packages/ui` is a separate
  refactor, not done here (§7 Q-SC10).

**SD2 — Platform identity separate from `control.users`; three roles; capability matrix.**
- `control.platform_users` is a separate identity table (C1): a platform user is never a tenant member by virtue of
  being a platform user, never appears in any tenant member list, and a membership bug cannot mint platform access. Roles
  reuse the audit system's `actor_kind='support'` for all platform actions; the platform role is recorded in the
  platform audit log.

| Capability | support | sales | admin |
|---|---|---|---|
| `platform:tenants:read` (directory, inbox list, workspace-request list) | yes | yes | yes |
| `platform:tenant:access` (open a support grant; read tenant commercial data) | yes | yes | yes |
| `platform:plans:write` (packs, bundle incl. Enterprise, self-service, contract, CSM, [AM2] reset an ended trial) | — | yes | yes |
| `platform:requests:resolve` (fulfil / decline) | — | yes | yes |
| `platform:workspace_requests:manage` (decline / spam) | — | yes | yes |
| `platform:catalog:read` / `platform:pricebook:read` | yes | yes | yes |
| `platform:catalog:write` (packs, module map, rules, industries, frameworks) | — | — | yes |
| `platform:pricebook:write` (draft / publish) | — | — | yes |
| `platform:audit:read` (platform audit log + its CSV export) | — | — | yes |
| **[AM2]** `platform:audit:own` (own activity + its CSV export) | yes | yes | yes |
| **[AM2]** `platform:tenant:content` (open a `content` grant; read-only support view of all tenant records, C10) | yes | — | yes |
| **[AM2]** `platform:users:manage` (invite, role, deactivate / reactivate, reset platform accounts, C11) | — | — | yes |

**SD3 — Platform sessions.** Opaque random token, stored hashed; host-only `SameSite=Strict` cookie; idle 30 min /
absolute 8 h (shorter than tenant web's 12 h absolute, because the blast radius is every tenant); CSRF
double-submit; no bearer tokens (web-only tool); sessions revocable individually and all at once on deactivation.

**SD4 — MFA mandatory (TOTP) for every platform account**, enforced by a DB CHECK on `active` (C1 AC2) and by the
sign-in flow (no session without the second factor). Reuses the tenant TOTP crypto. **[AM2] Q-SC5 DECIDED:** TOTP is
the bar this sprint; WebAuthn / passkeys are a reasonable future enhancement (no WebAuthn code exists in the
repository), not blocking (→ Known issues).

**SD5 — Two audit trails, one ordering rule.** Tenant-side: `audit_events` with `actor_kind='support'` + reason,
written atomically with the tenant change (rule 3), visible to the tenant admin (07 §7). Platform-side:
`control.platform_audit_events`, append-only, for everything (including actions with no tenant). The two live in
different transactions (and, for dedicated tenants, different databases), so the rule is: ~~write the platform
event first (`outcome` pending), run the tenant transaction, then mark the platform event `ok` or `failed`~~ **[AR,
corrected — AR24]** the earlier wording updated an audit row's `outcome` from pending to ok/failed, which contradicts
the table's own append-only trigger (C3 AC2). The rule is now **two appended rows**: (1) commit an **intent** row
(`phase='intent'`, `outcome` NULL, the intended change and reason) in the control transaction; (2) run the tenant
transaction; (3) append an **outcome** row (`phase='outcome'`, `intent_id` = the intent row's id, `outcome` `ok` |
`failed`, error code if failed). Nothing is ever updated. A tenant change therefore never exists without a platform
intent record; an intent with a `failed` outcome means nothing changed in the tenant; an intent with **no** outcome
row after 5 minutes (a crash between steps 2 and 3) is surfaced in the platform audit log's **Flagged** filter as
"outcome not recorded" so an admin reconciles it against the tenant's own audit log (which, being written in the
tenant transaction, is authoritative for whether the change happened). Actions with no tenant side write one
`phase='single'` row. Test: failure injection between (1)/(2) and (2)/(3) yields, respectively, an intent + `failed`
outcome with no tenant change, and a flagged outcome-less intent with the tenant change present.

**[AR2, B1; [AR4] re-numbered and made atomic] Grant-activation write ordering (fixed, three steps — one numbering
scheme, shared verbatim with C3 AC6 and C10 AC2a).** Opening a support grant (either scope) is a special case of step
(2) above, with three numbered steps of its own: **step 1**, the control-plane `support_grants` row commits (the SD5
intent row, above); **step 2**, one atomic tenant-side transaction, opened once on `kaenal_support` — **for a
dedicated tenant only**, its first statement inserts the `control.support_grant_backstop` mirror row, and then (the
only statement, for a shared tenant) the tenant `audit_events` "opened access" row is inserted in the **same**
transaction — for a `commercial` grant, inside `SupportAccess.withTenant`'s own transaction as today (C3 AC5-6); for
a `content` grant, through the new `SupportAccess.recordGrantStart` method (C3 AC6), because `SupportAccess.withTenant`
refuses content grants (AC7); **step 3**, the SD5 outcome row is appended in the control transaction, `ok` or
`failed`. **[AR4] Why step 2 is one transaction, not two:** the mirror insert and the audit-row insert used to be
two separate writes that could succeed and fail independently, leaving a dedicated tenant's mirror row committed
with no corresponding tenant audit row if the second write failed after the first had already committed (the gap
D1(c), below, first found). Folding both into one transaction removes that window structurally — see C10 AC2a for
the full mechanism (the backstop function reads the just-inserted, not-yet-committed mirror row via Postgres's
read-your-writes guarantee inside that same transaction, so there is nothing unsafe about writing both before either
commits). If step 2 fails (anywhere inside that one transaction), the grant is ended in the same request with
`end_reason = 'activation_failed'` (widened from the narrower `mirror_failed` — it now names either write inside
step 2, not only the mirror) and grant creation returns 503: **there is no path where a usable grant exists with no
tenant-visible record of it, and no path where a dedicated tenant's mirror row exists with no corresponding tenant
audit row** — step 2's atomicity makes the second guarantee as structural as the first. The SD5 outcome row records
the failure the same way any other tenant-transaction failure would.

**SD6 — Least-privilege database roles; RLS never bypassed.** `kaenal_platform` (control plane: platform tables,
tenants read, commercial control tables write) and `kaenal_support` (tenant plane: commercial tables only,
restrictive namespace policy, column-level count grants, audit/outbox insert). Neither has BYPASSRLS; the
existing `tenant_isolation` policy applies to both. For **dedicated** tenants, provisioning must create
`kaenal_support` in the tenant database and store a **support secret ref** alongside the app secret ref;
`provision-tenant` and `migrate-tenants` gain that step, and existing dedicated tenants get it via a one-off
`migrate-tenants` run (dev has none; tested with the router fake + `dedicated-provision.test.ts`).
**[AR] Role inventory and credentials (AR29).** Five new roles, each for exactly one process: `kaenal_platform` and
`kaenal_support` (platform API), `kaenal_support_reader` and `kaenal_support_gate` (tenant API), `kaenal_projector`
(worker). **Every one is created `NOLOGIN` by its migration.** Why: `0000_foundation.sql:49-52` creates the existing
app roles `LOGIN PASSWORD 'kaenal_local_pw'`, and `migrate-tenants` replays every migration on every dedicated
database — a new role created the same way would exist with a well-known password on every customer's dedicated
database. Instead, `LOGIN` and a per-environment secret are set outside migrations: by `provision-tenant` /
`migrate-tenants` (from the secret manager, for dedicated databases — they already store the app secret ref, SD6) and
by ops for the primary; locally by a dev-only `pnpm db:dev-roles` that refuses to run when `NODE_ENV=production` or
the host is not local. Tests connect with `SET ROLE` from the migrator connection and need no LOGIN. Grant test: each
new role is `rolcanlogin = false` right after `pnpm db:migrate` on a fresh database. (The two pre-existing roles'
local password is unchanged by these sprints; it is already documented as docker-only in `0000_foundation.sql`.)

**SD7 — [AM2, rewritten] The support grant is the spec's "time-boxed grant (4h)", with two scopes.** One tenant,
one platform user, one reason, 4 hours, ends early on demand. **Scope `commercial`** — commercial reads and (per
role) commercial writes, via `kaenal_support`. **Scope `content`** — the user's 2026-09-30 decision (Q-SC3): a
read-only view of **every** record in the tenant's workspace, via the separate `kaenal_support_reader` role and the
tenant web app's support-view mode (C10); reference required; `platform_support` and `platform_admin` only. The earlier version of
this SD excluded content access entirely; that exclusion is withdrawn. What the content scope deliberately does
**not** do (PO decisions, smallest reasonable reading of "full content access", revisitable):
- **No writes to tenant QMS records by staff.** Records must stay attributable to the tenant's own personnel —
  IATF 16949 §7.5.3 control of documented information, ISO 13485 §4.2.5 records, and 21 CFR Part 11 §11.10(e) /
  §11.50 (attributable audit trails and signature manifestations) all assume the author is the customer's
  identified user. A vendor writing into those records would undermine the customer's own compliance. If a record
  must be corrected, the tenant does it (support guides them) — recorded as a future question if support workflows
  prove otherwise (→ Known issues).
- **No "log in as member X".** The viewer sees the workspace as an all-plant read-only viewer, not as a specific
  person (per-member "view as" would expose per-user state — sessions, notifications, MFA — and adds a second
  impersonation surface). Future candidate (→ Known issues).
- **No tenant consent toggle or per-access notification this sprint.** 07 §7 requires visibility in the tenant
  admin's audit log, which C10 AC5 delivers per record viewed. A customer-controlled "allow Kaenal content access"
  setting is a future candidate (→ Known issues).
- **No bulk export in support view** (export jobs are writes and bulk exfiltration); single attachments only, each
  audited.
- **[AR] No live stream in support view (AR6).** `GET /v1/events` is refused (403 `SUPPORT_VIEW_NO_STREAM`) for a
  support viewer rather than re-checked per event. Why: the stream deliberately commits and releases its transaction
  after the handshake and then touches no database (`realtime.controller.ts:14-24`), so neither the grant check nor
  the RESTRICTIVE policy would ever run again on that socket — it would outlive expiry by design (and, being a GET, it
  passes any "unsafe methods only" rule). Re-checking the grant on every emitted event would add a control-table read
  per event per viewer to the fan-out path and still reveal the timing of tenant activity between checks. The support
  view does not need push: it refetches on navigation. Refusal is simpler, cheaper and has no expiry window.
- **[AR] Presigned downloads are capped to the grant (AR7):** `min(60 s, time left on the grant)` instead of the
  global 900 s (`S3_URL_TTL_SECONDS`), so an attachment link cannot outlive the grant by up to 15 minutes (C12 AC6).

**[AM3] DB-level backstop for content-scope reads — finalized mechanism (pre-build security review, 2026-09-30,
High finding SR1).** The application check (`SupportViewAuthenticator` verifying the grant once per request, C10
AC4) is necessary but, on its own, not the same rigor the write path already has: any tenant write under a grant is
refused by the database even if the interceptor check is bypassed (C10 AC8's mutation test), because `kaenal_support`
and `kaenal_support_reader` simply hold no write privilege — but before this amendment nothing re-verified *grant
validity itself* below the application layer, so an expired or ended grant would still be readable if
`SupportViewAuthenticator` had a bug or was skipped. The fix mirrors, deliberately and exactly, how tenant isolation
already works: `current_tenant_id()` / the permissive `tenant_isolation` policy
(`packages/db/migrations/0000_foundation.sql:104-155`) trusts a session-scoped `current_setting()` value, applied to
every role with no `TO` clause, and throws (single-argument form) rather than silently passing when unset.
~~C10 AC2a adds a second, **RESTRICTIVE** policy `support_reader_grant_active`, scoped `TO kaenal_support_reader`
only, on every table that role can SELECT, ANDed with `tenant_isolation` — both must pass for a row to be
readable.~~ **[AR2] Struck — this was the un-struck AM3-era single-role draft, superseded in full by the AR
reconciliation in the very next sentence (two policies, both roles) and by C10 AC2a's finalized text; kept here only
so nobody builds the superseded single-role version.** Its
backing function re-derives validity from the **persisted** `support_grants` row on every check (shared-model
tenants: a `SECURITY DEFINER` function querying `control.support_grants` directly, same physical database;
dedicated-model tenants: the same function name checking a local `control.support_grant_backstop` mirror row, since
Postgres cannot join across physical databases — full mechanism in C10 AC2a), not from a value the request handler
computed and could get wrong. `app.grant_id` joins `app.tenant_id` / `app.support_reason` / `app.platform_user_id` in
the `SET LOCAL` context C10 AC4 opens. ~~Every future tenant-table migration must carry this policy the same way it
must carry `apply_tenant_rls()`~~ **[AR] Reconciled and completed in C10 AC2a (architecture review, AR5):** the one
function **[AR2, renamed for clarity] `support_content_grant_active(expected_scope)`** (was
`support_reader_grant_active`, sharing its name with the `support_reader_grant_active` policy — see Amendment 5) now
also checks the tenant, the platform user's status and
current role, and `clock_timestamp() < expires_at` (evaluated once per statement as an InitPlan, so access is cut off
mid-request); it backs two RESTRICTIVE policies (`support_reader_grant_active` `TO kaenal_support_reader` for
`content`, `support_commercial_grant_active` `TO kaenal_support` for
`commercial`, both `USING` + `WITH CHECK`); and `apply_tenant_rls()` itself creates both policies, so future tables
inherit them without anyone remembering. The shared/dedicated split is one function body branching on
`control.database_identity`, with the dedicated mirror written by the platform process. The AC2 schema test and the
mutation tests prove each predicate is load-bearing.

**[AR2, R6] InitPlan shape and `current_setting` hygiene, confirmed as the intended, accepted design.** An
uncorrelated RLS sublink — `USING ((SELECT support_content_grant_active('content')))`, as written above — becomes a
Postgres **InitPlan**: the planner evaluates it once per statement, not once per row, because it does not correlate
to any column of the table being scanned. This is deliberately relied on (a `SECURITY DEFINER` function is never
inlined, so a per-row evaluation would cost one control-table lookup per scanned row) and is confirmed here as the
intended and accepted performance characteristic, not an incidental optimisation the architect must re-derive; the
architect's job (DoR re-review item R6) is only to confirm it holds with `EXPLAIN` on a representative list query,
not to decide whether it is wanted. Inside the function, every `current_setting(...)` read (`app.grant_id`,
`app.tenant_id`, `app.support_reason`, `app.platform_user_id`) uses the **[AR3, S3 — wording fixed; was
self-contradictory] two-argument, non-throwing form wrapped in
`NULLIF(..., '')`** — `NULLIF(current_setting('app.grant_id', true), '')` — never a bare
`current_setting('app.grant_id')` call: a connection reused from a pool can read back an empty string rather than
raising, and a bare call would then silently treat that as "unset" only if it also threw, which it does not for an
empty string. `NULLIF` turns the empty-string case into `NULL`, which the function's own NULL-check then rejects the
same way it rejects a genuinely unset variable. Because Postgres may serve either an error (a hard NULL-and-reject)
or a permission failure on top of zero returned rows depending on exactly where the check trips, **every test that
proves "properly denied" accepts EITHER outcome** (a thrown error, or zero rows) as valid — a test that requires one
specific shape is over-fitted to an implementation detail the function does not promise.

**[AM3] SD10 — Content-grant creation hardening: step-up re-auth, rate limit, anomaly signal (pre-build security
review, Medium findings SR2/SR3).** Opening a `content` grant is the single highest-privilege action in the
console (SD7 above), currently gated only by the platform user's existing session plus a free-text reason — a bar no
higher than a routine `commercial` grant, despite exposing all of a tenant's workspace. Two independent guards close
this: (1) **step-up re-authentication** — 07-SECURITY-COMPLIANCE.md §2 requires re-auth at the moment of a sensitive
action (e-signatures); the same principle now applies here: `content`-grant creation requires a short-lived
`stepUpToken` from a fresh password or TOTP re-entry (`POST /platform/v1/auth/step-up`, C2 AC5), checked and consumed
server-side on the grant-creation call (C3 AC8); `commercial` grants are unaffected — they expose no tenant content,
so the existing session remains sufficient. (2) **Rate limit and anomaly signal** — nothing today throttles how many
tenants one platform user can open in sequence, so a single phished-but-past-MFA credential could otherwise walk
every tenant with no friction or alert; C3 AC9 adds a per-platform-user cap of 5 `content`-grant creations per
rolling hour (PO-SC9, a judgment call: generous enough for a busy support shift, tight enough that a sweep across
many tenants is impractical within the window) and a flagged `content_grant_anomaly` platform audit event the first
time a platform user's rolling-hour window reaches 3 distinct tenants, surfaced to admins via the platform audit
log's Flagged filter (C9/D-C10). A push/email alert is a future enhancement (→ Known issues); the flagged, queryable
event is the floor this finding requires.

**[AR] SD11 — Internal events are not webhooks; support audit rows never reach the outbox or realtime
(AR10, AR22).** Verified against the code: the customer-webhook outbox is **not** a generic event bus. Its rows carry
ids only (`outbox.payload = { entityId, at }`, `0041_outbox.sql`), its `action` is CHECK-limited to
created/updated/deleted, it is written by the transactional audit observer for any `entityKind` in
`OUTBOX_ENTITIES` (`outbox-event.ts`), and the webhook handler delivers each row to every endpoint whose subscription
matches — where an empty or `*` subscription means **everything** (`webhook-signing.ts:45-58`). The drainer runs as
`kaenal_app` inside a **tenant** transaction (`drain-outbox.ts`), so it cannot write any control-plane table. Four
consequences are designed here, once, for both sprint files:
1. **Support audit kinds are internal.** `support_grant` and `support_view` are internal entity kinds; they are not in
   the tenant `EntityKind` enum's customer-facing set and not in `OUTBOX_ENTITIES` or the realtime `ENTITY_TOPIC`
   map. Belt and braces: both bridges (`outbox-event.ts` `outboxEventFor`, `realtime/audit-signal.ts`
   `signalForAuditEvent`) return `null` first for **any** event with `action = 'support_accessed'` or an internal
   entity kind (`INTERNAL_ENTITY_KINDS` in `packages/types`), regardless of any future edit to their allow-lists.
   Unit tests: `support_accessed` on `entity_kind='ncr'` yields no outbox record and no realtime signal; a
   mutation that adds `support_view` to `OUTBOX_ENTITIES` still yields none.
2. **Internal events are a separate audience.** SPRINT-07's migration `0076` (not 07C's — Sprint 07 is what first
   emits these events) adds `outbox.audience text NOT NULL DEFAULT 'webhook' CHECK (audience IN
   ('webhook','internal'))`, the webhook skip below, and drainer routing of `internal` rows to a registry of internal
   handlers; a row whose event type has no registered handler yet stays `pending` **without** consuming an attempt
   (held, never dead-lettered), so events emitted by Sprint 07 before 07C's projector is deployed are projected when it
   is (the release coupling means this window is test-only in practice). **[AR2, B5]** The "held without consuming an
   attempt" design combined with `drain-outbox.ts`'s `ORDER BY created_at LIMIT n` claim strategy means held rows
   (internal rows with no registered handler) would otherwise be re-claimed at the head of every batch — once a
   tenant accumulates `batchSize` of them, its real customer webhooks would stop draining entirely, because every
   slot in the next batch is filled by rows that immediately no-op. The fix is in the **claim query itself**, not the
   no-op path: it explicitly excludes rows whose `audience = 'internal'` and whose event type has no row in the
   internal-handler registry (`WHERE NOT (audience = 'internal' AND event_type NOT IN (<registered internal event
   types>))`, alongside its existing `status = 'pending'` predicate), so such a row is never claimed into a batch
   slot at all — it is still held, never dead-lettered, and still delivered once a handler is registered; it simply
   never displaces a real webhook row's claim. Test: seed a tenant with `batchSize` held internal rows (no registered
   handler) plus one real, ready `ncr.updated` webhook row; a drain cycle delivers the real row (the held rows never
   occupy a slot); once the handler is registered, a later cycle drains the held rows too. Internal event types — `plan_request.changed` and
   `tenant_commercial.changed` (SPRINT-07 P6 AC6, X1 AC8) — are written with `audience='internal'` and an **ids-only**
   payload (`{ tenantId, requestId }` / `{ tenantId }` — never names, emails, notes or composition). The webhook
   handler skips every `internal` row explicitly (and a wildcard subscription can never match one); a test with a
   `*`-subscribed endpoint proves no internal event and no requester email ever leaves. (Before this fix,
   `plan_request.changed` as drafted — carrying `requester: { name, email }` and the note — would have been delivered
   to any wildcard webhook: a PII leak to third-party consumers.)
3. **An internal-projection handler, with its own narrow role.** The drainer dispatches `audience='internal'` rows to
   `InternalProjectionHandler` instead of the webhook handler. It reads the current source rows **through the
   drainer's tenant transaction** (the plan request, its requester's name and email resolved the way the P6 sales
   email resolves them, the tenant's effective commercial state via the resolver) and writes the result to
   `control.sales_inbox` / `control.tenant_commercial_summary` through a new **`kaenal_projector`** pool on the
   **primary** database (`NOLOGIN` in the migration, AR29; INSERT/UPDATE on those two tables only; nothing else;
   `DATABASE_PROJECTOR_URL`, worker process only; 07C migration `0080`). Upserts are idempotent and ordered by the source row's
   `updated_at` (last write wins), so a re-delivered or out-of-order event converges. Because the payload is ids only
   and the projector re-reads current state, a stale event can never write stale PII.
4. **Nothing else changes for customer webhooks:** existing `OUTBOX_ENTITIES` events keep flowing exactly as today.

**[AR] SD12 — Email is enqueued after commit; no AC claims "same transaction" (AR23).** Verified against the code:
email is an asynchronous BullMQ job (`jobs/producer.ts:82`), and today's call sites enqueue it from inside the request
handler (`auth.controller.ts:221`, `suppliers.controller.ts:186`) — i.e. **before** the interceptor's tenant
transaction commits and not atomically with it (the reviewer described it as after-commit; it is actually earlier,
which is worse: a rolled-back request can still send its email). **[AR2, citation correction]** `auth.controller.ts:255`
is a `@Public` route with no tenant transaction at all, so it is not an instance of this bug and is removed from the
list below; `:221` and `suppliers.controller.ts:186` remain accurate as pre-existing, out-of-scope, disclosed issues.
Of the two options offered, the PO chooses the
honest, simpler one and applies it everywhere in both sprint files: **every email these sprints add is enqueued only
after its originating transaction commits**, and no AC says "same transaction". Mechanism: the request context gains
an after-commit job buffer next to the existing realtime one (`context.ts:66`), flushed by each app's lifecycle
interceptor after commit and discarded on rollback; control-plane paths (O3 intake, C1/C11 setup emails) enqueue after
their control transaction commits; job processors enqueue after their per-tenant transaction commits. Delivery is
retried by BullMQ; the window between commit and enqueue is at-most-once, which is acceptable because **no business
hand-off depends on an email**: the plan request row and the `sales_inbox` projection (durable, via the internal
outbox event), the `workspace_requests` row, and the platform account's "Resend setup email" are the durable records.
**[AR2, B3] `notify()`'s own delivery job is NOT after-commit today, and this SD's "enqueued after commit" claim did
not actually cover it.** Verified against `apps/api/src/notifications/notifications.service.ts:244` and
`apps/api/src/jobs/processors/deliver-notification.ts:38-39`: `notify()` enqueues its delivery job **inside** the
caller's transaction (before commit), and the processor silently no-ops if it cannot yet see the notification row —
not a leak, but a silent loss, on a fast worker racing a slow commit or a rollback. This SD's after-commit buffer, as
originally written, only ever covered the sprints' own new **direct** `sendEmail` call sites (O3 intake, C1/C11 setup
emails, the sales-notify email); every Sprint 07/07C notification that goes through `notify()` — `plan_request_resolved`
(C6 AC3), the auto-fulfil notification (C5 AC3), `trial_ending`/`trial_ended` (Sprint 07 P5) — was **not** covered.
**Fix, kept to the same scope as the direct-call fix ("one line plus a race test," per the reviewer):** `notify()`'s
job-enqueue moves out of the caller's transaction and into the same after-commit job buffer this SD already built for
the direct calls — the notification row is still written inside the transaction (so its existence is transactional),
only the delivery-job enqueue moves to fire after that transaction commits, alongside every other after-commit
enqueue. Test: a `notify()` call inside a transaction that then rolls back enqueues no delivery job; a `notify()` call
whose transaction commits enqueues exactly one, after commit, race-free against a worker that starts polling the
instant the job is visible. Emails that notify a tenant user go through the existing notification row + `deliverNotification` job, whose row is
written in the transaction and whose delivery job is now enqueued after commit (this fix). The pre-existing in-handler enqueues named
above (`auth.controller.ts:221`, `suppliers.controller.ts:186`) are **not** changed by these sprints (they are outside their scope) and are recorded as a Known issue.

**[AR3, D2] The B3 fix above, as worded, would have silently DROPPED every job-processor `notify()` delivery — fixed
by SD13's third scope type.** `notify()` is not only called from HTTP request handlers; it is called from **numerous
BullMQ job processors** running inside `withTenant(tenantId, null, async (tx) => { … })` with **no** HTTP request
context at all (verified: `scan-file.ts`, `complaint-sla.ts`, `document-expiry.ts`, `training-expiry.ts` ×2,
`run-export.ts`, `calibration-due.ts` ×2, the `sla.ts` sweep, and Sprint 07's own new P5 `entitlement-trials`
trial-notification job). Before this fix, "the after-commit job buffer" named above was scoped only to the tenant
HTTP-request context or the platform HTTP-request context (`apps/api/src/context.ts`'s `bufferRealtimeSignal`, which
silently no-ops when `storage.getStore()` is `undefined` — i.e. exactly the case inside a job processor, confirmed at
`apps/api/src/context.ts:70-73`, not `packages/api/src/context.ts`). Applying the B3 fix literally — "route `notify()`'s
enqueue through the after-commit buffer" — without first giving job processors a scope of their own would have moved
the bug from "enqueues too early" to "silently enqueues nothing at all" for every processor-path `notify()` call,
including the very `trial_ending`/`trial_ended` notifications SD12/SD13 exist to cover. **This is one mechanism, not
two.** SD12's "after-commit job buffer" and SD13's "context-agnostic after-commit store" (below) are the **same
single implementation**, described from two angles in two SDs that were drafted before either amendment settled on
final wording; "the same shape as SD12's buffer" in SD13's original text read ambiguously as "a second, similar
buffer" — it is not: there is exactly one store, and SD13 below is where its three scope types are specified. See
SD13 for the processor scope itself and the fail-loud rule for "no scope at all".
AR1/SD1's "the platform process is a separate app that just imports shared libraries" claim has a real gap the
architecture review's own re-review found: the realtime and outbox audit bridges (**[AR3, S2 — citation corrected]**
`packages/db/src/audit.ts:57,85`, not `apps/api/src/...audit.ts`) are **process-global singletons**, installed once
by `AppModule.onModuleInit` (`app.module.ts:555-563`), and the realtime bridge writes into the **tenant**
`RequestContext` (`apps/api/src/context.ts:69-72`), which is a no-op outside a tenant request. A `withAudit` call made
inside `SupportAccess.withTenant`'s platform-process context therefore silently drops its realtime signal entirely —
breaking C5 AC4 ("the tenant's open browsers update without reload") and giving `notify()`'s realtime nudge the
identical problem. CX AC1's cross-app import allowlist never named the bridges, the realtime publisher, the job
producer or the notification writer as shared, so nothing stopped a future edit from forking them per app.
- **The fix: a real shared layer, named explicitly.** `apps/api/src/shared/**` holds (a) **one context-agnostic
  after-commit store** for signals and jobs — this is the exact same mechanism SD12 calls "the after-commit job
  buffer" above, not a second, similarly-shaped one (**[AR3, D2(i)]** SD12's and SD13's wording describe one
  implementation from two angles — the email/job angle in SD12, the shared-layer/import-boundary angle here — "the
  same shape as SD12's buffer" in the earlier draft read ambiguously as "a second, similar buffer"; it is one); (b)
  the audit bridges (realtime + outbox), the realtime publisher, the job producer, `CatalogService` and a notification
  writer, including the shared `notifyMinimal()` (**[AR3, S1]**, `apps/api/src/shared/notifications.ts`). Both apps
  may import **only** from `shared/**` on the other's side, never each other's internals directly — this sharpens CX
  AC1's lint rule, which already forbids `apps/api/src/platform/**` ↔ tenant-side controllers/services/
  `lifecycle.interceptor.ts` and now additionally requires that every import crossing that boundary resolve to a
  `shared/**` path (a planted violation importing a non-`shared` tenant-side file from `platform/**`, or vice versa,
  must fail the lint rule — architect-confirmed, CX AC1).
- **[AR3, D2(ii)] A third scope type, for job processors.** The store is keyed off **one of three** active scopes:
  (1) the tenant HTTP-request context (`RequestContext`, flushed by the tenant lifecycle interceptor after its
  transaction commits); (2) the platform HTTP-request / `SupportAccess` context (flushed the same way, after the
  platform process's control or tenant-support transaction commits); and (3) a **processor scope**, which a BullMQ job
  processor opens explicitly around its own `withTenant(...)` call (e.g. `runWithProcessorScope(tx, fn)`, mirroring
  `runWithContext`'s shape) and which flushes **after that processor's own transaction commits** — the same
  after-commit discipline the other two scopes already have, opened by code that has no HTTP request to piggyback on.
  Every job processor that calls `notify()` or buffers a realtime signal (`scan-file`, `complaint-sla`,
  `document-expiry`, `training-expiry`, `run-export`, `calibration-due`, `sla`, Sprint 07's `entitlement-trials`) opens
  this scope; `notifyMinimal()` and `notify()` both resolve "the active scope" the same way (whichever of the three is
  open), so they share one enqueue path regardless of caller.
- **[AR3, D2(iii)] No active scope at all is a loud error, not a silent no-op — [AR4] scoped precisely, after the
  2026-10-01 delta check found the blanket version would have broken real, working code (Blocking A).** Before this
  fix, a signal or job buffered with no `RequestContext`, no platform context and (before this story) no processor
  scope open was silently dropped (`bufferRealtimeSignal`'s existing `storage.getStore() === undefined` no-op,
  `apps/api/src/context.ts:70-73`, and the job-buffer's equivalent check). The realtime-signal buffer's pre-existing
  no-op for non-request callers (seed scripts, unit tests calling services directly) is unaffected and stays exactly
  as it is. **The throw-on-no-scope rule applies to exactly one thing: the shared after-commit buffer path that
  `notify()` / `notifyMinimal()` use to enqueue a delivery job when a caller claims to be inside a transactional
  context.** It does **not** apply indiscriminately to every job-enqueue call site in the codebase — a direct
  `JobProducer` call (`scanFile`, `sendEmail`, `runExport`, `deliverNotification` called directly rather than through
  `notify()`) never touches the shared buffer at all and so can never hit this throw, and a caller with **no**
  transactional context to buffer against (a `@Public` route with no tenant transaction) is correctly exempt by
  design, not by oversight — see the exhaustive table below (D2(v)), which is the authoritative enumeration of every
  caller category and whether this rule applies to it. **Fix to the gap the 2026-10-01 delta check found:** the
  realtime-signal exemption for seed scripts and tests did **not**, before this fix, extend to `notify()`'s job-enqueue
  half — so a seed script or a test that calls `notify()` with no scope open would have hit the throw and broken (the
  demo-seed script is CLAUDE.md rule 12 territory: breaking it is not acceptable). Fix, stated in the table below: both
  `apps/api/scripts/seed-demo.ts` and test code calling `notify()` directly open a **processor scope** around their
  `withTenant(...)` calls — the same scope a job processor opens — so the throw never fires for them and their
  delivery-job enqueues work correctly (rather than being silently dropped, which is what today's un-scoped
  `bufferRealtimeSignal` no-op would otherwise still do for the realtime half).
- **[AR3, D2(iv)] DoD test.** A processor-path `notify()` call (run inside one of the processors named above, with a
  processor scope opened around its `withTenant` transaction) enqueues exactly one delivery job, visible only after
  that transaction commits (a rollback enqueues none); `notifyMinimal()` called from the same processor scope goes
  through the identical enqueue path — proven by one shared test helper exercising both, not two assertions that
  could silently diverge later. A second test asserts that invoking the job-enqueue path with no scope open (no
  tenant `RequestContext`, no platform context, no processor scope) throws rather than returning having silently done
  nothing.
- **[AR4, D2(v)] Exhaustive caller inventory — the enumeration table the 2026-10-01 delta check asked for, so no
  caller category is missed again.** The prior rounds patched this mechanism's scope rule piecemeal — first for HTTP
  handlers, then job processors, then the `@Public` routes, seed scripts and tests were each found missing in turn.
  Rather than add another prose patch, every job/notification-enqueue call site in the codebase is enumerated here
  once, by caller category, with its scope and whether the throw-on-no-scope rule (D2(iii)) applies to it. This table
  is the spec's source of truth for this mechanism; a future caller that doesn't fit a listed row is a spec gap to
  fix here, not to patch around in code.

  | # | Caller | Scope held or opened | Throw-on-no-scope applies? |
  |---|---|---|---|
  | 1 | `auth.controller.ts:221` — `jobs.sendEmail()` direct call (invite email) | Tenant `RequestContext` is open (inside an authenticated request) | **No.** A direct `JobProducer` call never touches the shared after-commit buffer — it enqueues immediately, synchronously, bypassing the buffer entirely. Pre-existing bug (enqueues *before* commit, not after): disclosed, out of this sprint's scope (Known issues), unrelated to the throw rule. |
  | 2 | `auth.controller.ts:255` — `jobs.sendEmail()` direct call, inside `forgotPassword` | **None.** `@Public()`, no tenant transaction, no platform context, no processor scope — verified against the file: the method has no `withTenant`/transaction of any kind | **No, by design, not by gap.** There is no transaction to buffer against, so immediate, unbuffered enqueue *is* the correct strategy here — "enqueue now, no buffering" is a valid, different strategy for a route with nothing to commit against. The throw rule exists to catch a caller that *should* have a scope and doesn't; this caller correctly has none. |
  | 3 | `suppliers.controller.ts:186` — `jobs.sendEmail()` direct call | Tenant `RequestContext` is open | **No**, same reasoning as row 1 — direct producer call, pre-existing before-commit bug, disclosed, out of scope. |
  | 4 | `files.service.ts:208` — `jobs.scanFile()` direct call, after `withAudit`'s inner transaction returns | Tenant `RequestContext` is open (the call site is reached only from an authenticated upload-completion request) | **No**, same reasoning as row 1 — direct producer call, same before-commit pattern (newly named here for completeness; not previously called out in this spec, but the same disclosed, out-of-scope category, since this sprint does not touch `files.service.ts`). |
  | 5 | `exports/exports.service.ts:152` — `jobs.runExport()` direct call | Tenant `RequestContext` is open | **No**, same reasoning as row 1/4. |
  | 6 | `notifications.service.ts:244` — `jobs.deliverNotification()`, inside `notify()` | Varies — this is the **one** direct-producer call this sprint's B3/D2 fix moves *into* the shared after-commit buffer, so its scope is whatever `notify()`'s own caller has (rows 7-11) | **Yes.** After the fix, this is literally the call that resolves "the active scope" and is what throws when none is open — it is the implementation of the rule, not a caller subject to it in addition. |
  | 7 | `notify()` / future `notifyMinimal()` callers inside an HTTP-handler tenant transaction: `comments.service.ts`, `ncr.service.ts`, `scar.service.ts`, `http/create-extras.ts`, `eight-d.service.ts`, `audits.service.ts`, `inspections.service.ts`, `ecn.service.ts` (8 call sites) | Tenant `RequestContext`, opened by the tenant lifecycle interceptor, flushed after its transaction commits | **Yes, in principle — never fires in practice**, since every one of these runs inside an authenticated tenant request, which always has this scope open. This is the pre-existing case SD12 already covers. |
  | 8 | `notify()` callers inside job processors: `scan-file.ts`, `complaint-sla.ts`, `document-expiry.ts`, `training-expiry.ts` (×2), `run-export.ts`, `calibration-due.ts` (×2), `sla.ts` (9 call sites across 7 files), plus Sprint 07's new `entitlement-trials` processor (P5) | **Processor scope**, which each processor must open explicitly around its own `withTenant(...)` call (D2(ii)) | **Yes, and this is the case D2 exists to fix** — before D2(ii) gave processors a scope of their own, these calls would have hit the throw (or, under the pre-D2 buffer, silently dropped). After D2(ii), every one of these opens the scope, so the throw never fires once built correctly; a processor that *forgets* to open it is exactly the bug this rule is designed to catch loudly instead of silently. |
  | 9 | `@Public` routes with no transaction at all: `auth.controller.ts`'s `forgotPassword` (row 2, repeated here for the category) and Sprint 07 O3's `POST /v1/public/workspace-requests` (public-intake controller — `@Public`, "no tenant transaction or outbox on this public, control-plane path," per SPRINT-07-entitlements-onboarding.md O3 AC2) | **None**, by design — both routes are `@Public`: no tenant, no session, no scope of any of the three kinds | **No, explicitly exempt.** Both enqueue their email immediately after their own local write (if any) commits, with no buffering. This is a valid, different strategy for a route with no transaction to defer against — not a gap. |
  | 10 | Seed scripts: `apps/api/scripts/seed-demo.ts`, which calls `AuditsService.create` (→ `notify()` at `audits.service.ts:424`) and `runExport` (→ `notify()` at `run-export.ts:718`) inside a bare `withTenant(tenantId, null, ...)` with no HTTP/processor scope | **None today** — this is the gap D2(iii)'s original exemption missed (it covered realtime signals, not job enqueues) | **Would throw today; fixed by having the script open a scope.** The seed script's `withTenant` calls that can reach `notify()` are wrapped in a **processor scope** (`runWithProcessorScope`), exactly as a job processor would — the smallest change that makes the throw never fire here, chosen because breaking `seed-demo.ts` is a CLAUDE.md rule 12 violation (never break the demo login) and because this exercises the real enqueue path rather than special-casing around it. |
  | 11 | Test code calling `notify()` directly: `apps/api/test/notifications.test.ts` (`beforeAll`, two groups, inside bare `withTenant(acmeId, null, ...)`), and any other test following the same pattern | **None today** — same gap as row 10 | **Would throw today; fixed the same way as row 10.** Test setup opens a processor scope around its `withTenant` call before calling `notify()` directly, rather than being granted a special exemption — this is the smallest reasonable, most consistent choice (one rule: "call `notify()` → have a scope," with no silent carve-out for tests) and it has the side benefit of actually exercising the real after-commit enqueue path the test is meant to validate, including the dedupe behaviour these tests assert on. |

  **Net effect:** rows 1, 3, 4, 5 are pre-existing, out-of-scope, disclosed legacy call sites that bypass this
  mechanism entirely (direct producer calls, never touch the buffer). Row 2 and row 9's second route are `@Public`
  and correctly, permanently exempt by design. Rows 7 and 8 are the two scopes SD12 (HTTP) and D2 (processor) already
  build for. Rows 10 and 11 are this fix's actual new requirement: seed scripts and tests that call `notify()`
  directly must open a processor scope, exactly like a real processor, so the throw rule — which is otherwise correct
  and desirable — never fires on code that is working as intended.
- **[AR4, D2(vi)] Pre-existing bug, found incidentally while building the table above: the worker constructs
  `NotificationsService` with no real job producer, so every processor-originated `notify()` call enqueues nothing,
  silently, today.** Verified against the code: `apps/api/src/jobs/worker.ts:87` reads `const notifications = new
  NotificationsService();` — no argument — and `NotificationsService`'s constructor
  (`apps/api/src/notifications/notifications.service.ts:81`) is `constructor(private readonly jobs: JobProducer = new
  NoopProducer())`, so the worker's instance silently falls back to a `NoopProducer`. Every job processor's `notify()`
  call (row 8 above) therefore writes its in-app notification row correctly but **never enqueues the delivery job** —
  no email, no push, nothing — today, in the deployed worker, independent of anything this sprint changes. This is
  not optional to fix: Sprint 07 P5 AC3's trial-ending/trial-ended emails run from exactly this path (the
  `entitlement-trials` processor) and **cannot possibly work** without it — it is a hard dependency of this sprint's
  own new feature, not a pre-existing issue merely disclosed and deferred. **Fix:** the worker constructs its
  `NotificationsService` with a real producer, gated on the same `JOBS_ENABLED` check the main API process already
  uses for the identical choice (`apps/api/src/app.module.ts:471-472`: `env.JOBS_ENABLED ? new
  BullMqProducer(env.REDIS_URL) : new NoopProducer()`) — `worker.ts` applies the same ternary rather than hard-coding
  `new NotificationsService()`. **Realtime signals from processor-originated notifications: explicitly dropped this
  sprint, by decision, not left ambiguous.** `notify()` also buffers a realtime "refetch your notifications" nudge
  (`bufferRealtimeSignal`); publishing that nudge across instances requires a Redis publisher, and the worker process
  has none today (verified: no `Redis`/publish usage anywhere in `apps/api/src/jobs/worker.ts`). Building one is a
  bigger lift than this sprint needs, and nothing today depends on a processor-originated notification's live-update
  ping (the in-app list still shows it on the next poll or page load; email/push delivery — the part P5 AC3 actually
  needs — works once the producer fix above lands). **Decision (smallest reasonable choice): this sprint fixes the
  producer so email/push/in-app-row delivery works for every processor-originated notification, and explicitly does
  not add a worker-side realtime publisher** — the live "ping" nudge simply does not fire for a processor-originated
  notification this sprint; a user sees it on next refresh, not instantly. A worker-side Redis publisher is named
  here as a deliberate, scoped-out follow-up (→ Known issues), not a silent gap. **DoD test, pinned to a real, named
  processor through the actual fixed wiring, not a mock:** Sprint 07's own new `entitlement-trials` expiry processor
  (P5) is run end-to-end through the **actual worker wiring** (the same `NotificationsService` construction path
  fixed above, with `JOBS_ENABLED=true` and a real `BullMqProducer` against a test Redis) — a trial crossing its T-3
  or expiry boundary produces an in-app notification row **and** a delivery job actually enqueued and actually
  processed by `deliverNotification`, proving the fix end to end rather than asserting the wiring in isolation with a
  mock producer.
- **Effect on `SupportAccess.withTenant` and `SupportAccess.recordGrantStart` (B1):** both now write their audit
  events through the shared context-agnostic buffer (scope 2, above), so a realtime `entitlements` signal fired inside
  a grant (C5 AC4) and the tenant audit row (B1) both flush correctly after the platform-process transaction commits,
  exactly as the tenant lifecycle interceptor already does for member requests.
- **[AR3, S2] `PlatformAppModule.onModuleInit` must install the same shared bridges `AppModule.onModuleInit` does.**
  Stated explicitly because it is easy to miss: the fix above only works if **both** Nest applications actually
  register the shared audit/realtime bridges at boot — a `PlatformAppModule` that imports the shared layer's types but
  never calls its own `onModuleInit` registration would leave the platform process with genuinely empty observer
  slots, and C5 AC4 would stay broken even with the shared store and the processor scope in place.
  `PlatformAppModule.onModuleInit` therefore installs the identical bridge registrations `AppModule.onModuleInit`
  does, against the same shared singletons.
- **Effect on the two-router enumeration test (C2 AC3).** Because the bridges are process-global single-slot
  registrations, **the test must boot `AppModule` and `PlatformAppModule` one after the other, never simultaneously**
  — a simultaneous boot would let the second module's `onModuleInit` silently clobber the first's bridge
  registration, which would show up later as flaky, hard-to-reproduce realtime/audit gaps rather than a test failure
  at the point of the actual bug. This ordering requirement is stated here explicitly, in the spec, specifically so
  it is never "discovered" as a flaky-test mystery during build: C2 AC3's test harness boots `AppModule`, runs its
  assertions — **[AR3, S2]** now including an assertion that both the realtime bridge and the outbox audit bridge
  are populated, not only that routes don't overlap — tears it down, then boots `PlatformAppModule` and runs the
  identical assertions (routes plus observer-slot population) — never both processes' Nest contexts alive in the
  same test process at once.
- **Cost accepted (ADR trade-off).** One more internal boundary to keep honest (a shared module that both processes
  depend on, so a breaking change to it is a breaking change for both) in exchange for removing an entire class of
  "works in the tenant app, silently no-ops in the platform app (or in a job processor)" bugs.

**SD8 — [AM2, amended] Tenant-side changes are limited to what the access model needs.** 07C adds no tenant table.
It adds two roles (`kaenal_support`, `kaenal_support_reader`), a restrictive policy and audit-attribution triggers,
**[AM3] a second RESTRICTIVE policy backing the content-scope DB-level backstop (SR1) and, for dedicated tenants
only, one small local mirror table (`control.support_grant_backstop`, [AR]) that carries no tenant business data**, and — for the
content scope only — two tenant-contract routes (`POST /v1/support-view/exchange`, `POST /v1/support-view/end`), a
third authenticator inside the ONE lifecycle interceptor, and the tenant web app's support-view mode (C10). Mobile
is untouched. **[AR]** Updated inventory of tenant-side changes: the tenant API process gains the `support_viewer`
principal (C12), the principal-first support-view path and the `@ReadOnlyPost` decorator (C10 AC4), and exactly two
new credentials (`kaenal_support_reader`, `kaenal_support_gate`) — it holds **no** platform or commercial-support
credential (SD1); the two support RESTRICTIVE policies come from the redefined `apply_tenant_rls` on every tenant
table (C10 AC2a); the mirror lives in `control.support_grant_backstop` (not a tenant table), next to the
`control.database_identity` marker; `outbox.audience` is Sprint 07's (0076); still no new tenant table.

**SD9 — [AM2, NEW] Support-view hand-off across hosts.** The platform console and the tenant app live on different
hosts with host-only cookies (SD1, SD3), so a content grant reaches the tenant host through a **single-use, 60-second
exchange token carried in the URL fragment** (not sent to any server or in `Referer`), exchanged by a POST for a
host-only, `SameSite=Strict`, grant-bound `kaenal_support_view` cookie whose lifetime is the grant's. The tenant
request runs on the `kaenal_support_reader` pool, so "read-only" is a database fact, not a UI convention; the API
refuses unsafe methods first so the user sees a clean 403 rather than a database error. A browser that already
holds a member session for that workspace cannot start a support view (no mixing of a person's own identity with
platform access). Why not render tenant records inside `apps/platform`: it would re-implement every module screen in a
second app (large, and a second place for bugs), whereas the support view reuses the real screens the customer
sees — which is also what support needs to reproduce a customer's problem.

### 3.1 Data model (migrations 0078-0080; 0081 buffer)

| Migration | Object | Kind | Notes |
|---|---|---|---|
| 0078 | `control.platform_users`, `control.platform_setup_tokens`, `control.platform_mfa_recovery_codes`, `control.platform_sessions` | control | MFA-required-when-active CHECK; hashed tokens; no DELETE grant |
| 0078 | **[AM3]** `control.platform_step_up_tokens` (hashed, 5-min expiry, single-use) | control | Backs `POST /platform/v1/auth/step-up`; consumed by content-grant creation (C3) |
| 0078 | Role `kaenal_platform` (**[AR] `NOLOGIN`**) + grants on platform tables and `control.tenants` (SELECT) | role | Replaces any temptation to use `CONTROL_POOL`; credential only in the platform API process |
| 0078 | **[AR]** Guard: `RAISE EXCEPTION` if a tenant owns slug `staff` or `platform` (reserved, CX AC2a) | check | No schema object |
| 0079 | `control.support_grants` (4 h CHECK, scope `commercial` \| `content` [AM2], reference required for content) | control | One tenant per grant |
| 0079 | **[AM2]** `control.support_view_sessions`, `control.support_view_exchange_tokens` | control | Hashed tokens; never readable by `kaenal_app` / `kaenal_public` |
| 0079 | **[AM2]** Role `kaenal_support_reader`: SELECT on every tenant-owned table except the credential/secret denylist ([AM3] denylist finalization must also check for column-level secrets); INSERT on `audit_events` only; attribution trigger extended; schema test enumerating tenant tables | role / tenant tables (grants + trigger only) | RLS applies; no write privilege; every future tenant table must grant it SELECT |
| 0079 | **[AM3, reconciled AR]** RESTRICTIVE policies `support_reader_grant_active` (`TO kaenal_support_reader`, scope `content`) and `support_commercial_grant_active` (`TO kaenal_support`, scope `commercial`), both `FOR ALL` `USING` + `WITH CHECK`, on every table with `tenant_isolation` — **[AR3, D1a] except `audit_events`, which never gets `support_commercial_grant_active`** (RESTRICTIVE policies AND together, so a second one can never "supersede" it; `apply_tenant_rls()` has a named `IF tbl <> 'audit_events'` branch, not a convention) and instead gets only the two dedicated policies in the row below — backed by the one function `support_content_grant_active(expected_scope)` (SECURITY DEFINER, VOLATILE, InitPlan-wrapped; checks id, tenant, scope, not ended, `clock_timestamp() < expires_at`, platform user active + current role); `apply_tenant_rls()` redefined to create the reader policy on every table and the commercial policy on every table except `audit_events`; `control.database_identity` marker; `control.support_grant_backstop` mirror (used on dedicated databases only, and now propagated on `activation_failed` too, synchronously — [AR3, D1c]) | policy / function / control tables | DB-level backstop for both grant scopes, inherited by future tables (SR1, AR5); schema + mutation tests (C10 AC2a) |
| 0079 | **[AR]** RESTRICTIVE `support_commercial_audit_scope` on `audit_events` (`TO kaenal_support FOR SELECT`, commercial entity kinds only, **[AR3, D1b] AND a live commercial grant** — `support_content_grant_active('commercial')` — closing a read-side liveness gap the entity-kind filter alone left open) + column SELECT excluding `ip`/`user_agent`; `support_audit_write_scope` (`TO kaenal_support FOR INSERT`, C3 AC3) — together these two replace `support_commercial_grant_active` on this one table (AR3, D1a); `support_grants` `UNIQUE (id, scope)` + `end_reason`; composite `(grant_id, grant_scope)` FKs from the two support-view tables | policy / constraints | AR13, AR14, AR3 D1a/D1b |
| 0079 | **[AR]** Role `kaenal_support_gate` (`NOLOGIN`): the tenant API's narrow read of grants / view sessions / platform-user status, `used_at`, session insert + `revoked_at`, platform-audit insert | role | AR3; replaces `PLATFORM_POOL` on the tenant path |
| 0079 | `control.platform_audit_events` (append-only trigger; `outcome`) | control | Platform audit log |
| 0079 | Role `kaenal_support` + table/column grants on tenant commercial tables ([AM2] + DELETE on ended `entitlement_trials` rows, trigger-guarded); RESTRICTIVE `tenant_settings` namespace policy `TO kaenal_support`; `audit_events` support-attribution trigger | role / tenant tables (policy + trigger only) | RLS still applies; `pnpm db:check` must stay green (no new tenant table) |
| 0080 | `control.sales_inbox` (projection), `control.tenant_commercial_summary` (projection: tier, declared frameworks, effective packs) + their outbox consumers | control | Eventually consistent, idempotent upserts |
| 0080 | Write grants for `kaenal_platform` on Sprint 07's catalog, price-book, `tenant_plans` (UPDATE) and `workspace_requests` (SELECT, UPDATE `status`) | grants | Never DELETE, except draft price-book rows |

New notification kinds: none (Sprint 07 defined `plan_request_resolved`). New tenant audit actions: none
(`support_accessed`, `entitlement_changed`, `status_changed` exist; [AM2] content views reuse `support_accessed`
with `entity_kind` / `entity_id`). New platform audit actions include `tenant_content_viewed`, `audit_exported`,
`trial_reset`, `platform_user_*`, `platform_bootstrap` [AM2] and **[AM3]** `content_grant_anomaly` (SR3). New
tenant-contract routes [AM2]: `POST /v1/support-view/exchange`, `POST /v1/support-view/end` (content scope only).
New platform-contract route [AM3]: `POST /platform/v1/auth/step-up` (SR2).

### 3.4 [AR2] Architect-verified reference content, folded in from the delta-check re-review

The re-review delivered exact, build-ready lists (route enumerations, denylists, capability gaps) rather than leaving
them as commentary for the architect to re-derive. They are recorded here as the reusable spec content they are; each
AC that depends on one points back to this subsection instead of repeating it.

**R1 — the `@PlatformRoute` list with capabilities, per the SD2 matrix.** Every platform route below and the
capability it requires (SD2); `—` means every authenticated platform role (no capability check beyond a session):

| Route | Capability |
|---|---|
| `POST /platform/v1/auth/sign-in`, `/auth/mfa` | — (**[AR3, S4 — relabelled]** `@PlatformPublic`, pre-session: these routes are how a session gets created, so by definition none exists yet when they run; C2) |
| `POST /platform/v1/auth/sign-out`, `GET /platform/v1/me`, `/me/sessions`, `POST /me/sessions/:id/revoke`, `POST /auth/step-up` | — (session only, no additional capability; C2) |
| `GET /platform/v1/setup/:token`, `POST /setup/:token/password`, `/mfa/enrol`, `/mfa/activate` | — (pre-session, `@PlatformPublic`; C1) |
| `GET /platform/v1/tenants`, `/sales-inbox`, `/workspace-requests`, `GET /catalog`, `GET /price-book/versions[/:id]` | `platform:tenants:read` / `platform:catalog:read` / `platform:pricebook:read` (read-only; every role) |
| `POST /platform/v1/tenants/:id/grants` (`scope=commercial`), `GET /me/grants`, `POST /grants/:id/end` | `platform:tenant:access` (every role) |
| `POST /platform/v1/tenants/:id/grants` (`scope=content`), `POST /grants/:id/view-link` | `platform:tenant:content` (**`platform_support`, `platform_admin` only — `platform_sales` denied**) |
| `PUT /platform/v1/tenants/:id/packs/:packId`, `POST /apply-bundle`, `PUT /plan`, `POST /trials/:packId/reset` | `platform:plans:write` (**`platform_sales`, `platform_admin` — `platform_support` denied**) |
| `POST /platform/v1/tenants/:id/requests/:requestId/fulfil\|decline` | `platform:requests:resolve` (**sales, admin — support denied**) |
| `POST /platform/v1/workspace-requests/:id/decline\|spam` | `platform:workspace_requests:manage` (**sales, admin — support denied**) |
| `PUT/POST /platform/v1/catalog/*`, `POST /catalog/impact-preview` | `platform:catalog:write` (**admin only — support, sales denied**) |
| `POST/PUT/DELETE /platform/v1/price-book/*`, `/publish` | `platform:pricebook:write` (**admin only**) |
| `GET /platform/v1/audit`, `/audit/export.csv` | `platform:audit:read` (**admin only — support, sales denied**) |
| `GET /platform/v1/me/audit`, `/me/audit/export.csv` | `platform:audit:own` (every role, forced to caller) |
| `GET/POST /platform/v1/platform-users`, `/:id/resend-setup`, `PUT /:id/role`, `POST /:id/deactivate\|reactivate\|reset` | `platform:users:manage` (**admin only**) |
| `GET /platform/v1/tenants/:id`, `/:id/history`, `POST /tenants/:id/summary/refresh` (new, below) | **[AR3, S4 — fixed]** `platform:tenant:access`, grant required (not `platform:tenants:read` — these three routes all read *through* an active grant via `SupportAccess.withTenant`, exactly like the other `platform:tenant:access` row above, so they share its capability, matching C4 AC2/AC3's own wording) |

Consequence, stated as the explicit per-role denylist R5 asks for: **`platform_support`** is denied every
`platform:plans:write`, `platform:requests:resolve`, `platform:workspace_requests:manage`, `platform:catalog:write`,
`platform:pricebook:write`, `platform:audit:read` and `platform:users:manage` route — i.e. it can read everything and
open grants of either scope, and nothing else. **`platform_sales`** is denied every `platform:tenant:content`,
`platform:catalog:write`, `platform:pricebook:write`, `platform:audit:read` and `platform:users:manage` route — i.e.
it can read, open only commercial grants, and write plans/requests, and nothing else. Both denials are already
implied by SD2's matrix; this restates them as an explicit per-role list because a matrix is easy to read column-wise
and miss a row-wise gap.

**R1 (dead-button fix).** C4 AC2's tenant-directory row action **"Refresh"** (§6 dead-end audit: "Re-derives
`control.tenant_commercial_summary` for that tenant inside the active grant") had no named backing route. Fixed:
`POST /platform/v1/tenants/:id/summary/refresh` (`platform:tenant:access`, grant required) re-runs the same
`InternalProjectionHandler` derivation (SD11) synchronously inside the active grant's tenant transaction and returns
the refreshed `PlatformTenantDetailDto` summary fields. Added to C4 AC2 and to the table above.

**R4 — `kaenal_support_reader`'s denylist, table-level and column-level (C10 AC2).** Table-level (SELECT never
granted): `sessions`, `api_keys`, `webhook_endpoints`, `integrations`, `integration_events`, `outbox`, `exports`,
`notifications`, `notification_prefs`, `user_preferences`, `device_sync_status`. Column-level exclusion within an
otherwise-granted table: `invitations` — every column **except** `token_hash` (a live invitation link is a bearer
credential; the invitation's existence, recipient and status are ordinary workspace content). Confirmed clean, no
exclusion needed: `signatures` (a signature's stored fields are the signer, timestamp and a hash — no secret) and
`ai_settings` (model/provider configuration and prompts — no API key column; keys live in `integrations`, already
denylisted). This is the finalized list C10 AC2's schema test enumerates against.

**R5 — the per-support-viewer route denylist and the web-shell requirement (C12 AC4).** Beyond the `settings_read` /
`denied` split C12 AC4 already states, the full **per-user and cross-cutting** denylist (403
`SUPPORT_VIEW_NOT_AVAILABLE` or the more specific codes C10 AC4 already names): notifications list and its
unread-count route, `GET/PUT /v1/me/preferences`, `GET /v1/me/dashboard`, the workspaces list, exports (list and
download), import, the AI gateway routes, the customer/supplier portal routes, presence, collab, and device-sync
routes — **with `GET /v1/me` special-cased as allowed** (the support-view shell needs it to render the "Kaenal
support" identity and grant countdown; C10 AC4 already returns a `support_viewer`-shaped body for it). **Web-shell
requirement, tied to D-C12:** because notifications and preferences are denied server-side, `apps/web`'s shell must
not even *call* the notification-bell / unread-count / preferences endpoints while in support-view mode (calling a
denied route and swallowing the 403 would still be a wasted round trip and a console-noise risk); the shell reads
`GET /v1/me`'s `kind: 'support_viewer'` and skips mounting those components entirely, the same way it already skips
personal account-menu items (C10 AC7). **C10 AC6's test correction:** the contract-enumerating test that asserts
every GET/`@ReadOnlyPost` route resolves to 2xx/403/404 must also accept **402** as a valid outcome on a gated read
route (e.g. `graph`/`predictions`/`supplier-scorecard` reads under Sprint 07's `@RequireModule`, which a support
viewer can reach if the tenant itself lacks the pack) — a 402 there is the correct, pre-existing entitlement gate
doing its job, not a support-view defect, and the test must not treat it as an unclassified failure.

**R6 — see C10 AC2a** (InitPlan confirmation, `NULLIF` hygiene, error-or-zero-rows test acceptance — folded in there
directly, next to the mechanism it describes).

**R7 — two additional GET-routes-that-write, and the presign TTL parameter (C12 AC6).** Beyond the three already
named (`files.service.ts:261` attachment download, Sprint 07 O5's completion-on-read, the SSE stream): **`GET
/v1/exports/:id`** writes an `exported` audit event on read (`exports.service.ts:175`) and must be **denied** to
support viewers (403 `SUPPORT_VIEW_NOT_AVAILABLE` — exports are already denied wholesale per SD7's "no bulk export in
support view", so this is a confirmation the denial covers the single-record read too, not a new carve-out); and
**`GET /v1/audit-log/export`**, likewise denied (already named as denied in C12 AC4's list; restated here as a
GET-that-writes for completeness of the enumeration). **`presignGet` needs a per-call TTL parameter** (it does not
have one today): C12 AC6's `min(60 s, seconds until the grant's expires_at)` rule cannot be applied without the
attachment-download code path being able to ask for a TTL shorter than the global `S3_URL_TTL_SECONDS` default —
this is the same presigned-URL-expiry parameterisation the earlier AR7 fix already assumed exists; it is named here
explicitly as a small, concrete change to `files.service.ts`'s signing call, not left implicit.

**R8 — the member-assuming-site scope (defined by grep pattern, not a fixed count), and the migration lists (C12
AC5).** **[AR3, S6 — the spec no longer states a single fixed number anywhere.]** The authoritative definition of this
slice's scope is the grep pattern itself — every call site of `membershipOf()` / `actorIdOf()` / `currentActorId()`,
every direct `.membership`/`requireMembership()` read, and every local per-controller re-implementation of the same
pattern (e.g. `inspections.controller.ts`'s own `membership(ctx)`/`actorId(ctx)` helpers, defined at lines 175 and
180 respectively, previously uncounted) — not any number derived from running it once. Counts drift every time the
grep is re-run on a live codebase: the PO's snapshot was 195 matches/38 files for the three named helpers alone
(202/42 once direct `.membership`/`requireMembership` sites are added), and an independent re-run the same day
counted ~204/36 for a similarly-scoped query; both are given only as illustrative, approximately-labelled snapshots,
and the architect's slice plan works from a fresh run of the pattern against the real codebase at build time, never
from a number fixed in this document. **Citation correction:** `query.controller.ts:68` is inside a helper's own
definition, not a call site — the real call sites in that file are `query.controller.ts:41` and `:86`.
**[AR4] Second citation correction (the mistake S6 was supposed to have already fixed, re-verified against the
actual file): `inspections.controller.ts:176` is inside the `membership(ctx)` helper's own definition (lines
175-178), not a call site.** The real call sites of `inspections.controller.ts`'s local `membership(ctx)` helper are
at lines **56, 69, 100, 114, 129, 147 and 165** (verified against the file; `:165`, inside `complete`, was missing
from this correction's first draft and is included now). Of these, **three are on read (GET) routes** — `:56`
(`list`), `:69` (`get`), `:114` (`listOccurrences`) — and belong in the read-routes-to-migrate list below; the other
four — `:100` (`start`), `:129` (`setRecurrence`), `:147` (`assign`), `:165` (`complete`) — are on
`@RequireCapability("inspection:perform")` POST/PUT routes and are confirmed **write** paths needing no migration,
same as every other write site the grep pattern matches. **`actorId(ctx)` is reclassified from "read" to "write":**
it is called only at lines 85, 101, 130, 148 and 166 — every one of them inside a POST/PUT handler (`create`,
`start`, `setRecurrence`, `assign`, `complete`), to get the actor id for the mutation's audit record, never to make a
read/access-scope decision — so it was misfiled under read-routes-to-migrate and belongs instead with the confirmed
write paths, needing no migration. **Read-routes-to-migrate** (to `accessScopeOf(currentPrincipal())`): audits,
training, instruments, ncr, graph, members, comments, entity-links, complaints-summary, findings, search,
`entity-ref.ts`, plus the direct `requireMembership()` call sites at `query.controller.ts:41`, `:86`, and
`inspections.controller.ts`'s local `membership(ctx)` helper at its three GET-route call sites (`:56`, `:69`,
`:114`) only. **Per-user routes to deny** (throw `SUPPORT_VIEW_READ_ONLY`/`SUPPORT_VIEW_NOT_AVAILABLE`, never migrate
to a read path): exports, notifications, preferences, the workspace list, the dashboard, realtime/collab/presence,
MFA/sessions/push-tokens, and `portal.controller.ts:36`. Everything else matched by the grep pattern — including
`inspections.controller.ts`'s four write-route `membership(ctx)` call sites and all five `actorId(ctx)` call sites —
is confirmed a genuine **write** path (403, `UNAUTHENTICATED` → `SUPPORT_VIEW_READ_ONLY`, no migration needed) — the
architect's slice plan classifies each site against these two lists plus "stays a write", not from scratch, and
re-derives the exhaustive site list from the pattern rather than trusting any count given here.

**R8 (continued) — the `AccessScope` plant-filter refactor these read services need (C12 AC1, AC5).** Read services today test
plant scoping **directly and inconsistently**, e.g. `graph.service.ts:210`, `training.service.ts:103` and
`entity-ref.ts:114` each write their own `isPlantScoped(membership.role) && plantIds.length > 0` check inline against
a real `membership`. `accessScopeOf(principal)` (C12 AC1) cannot be a drop-in for a support viewer if callers keep
reaching into `membership` directly, so the refactor is: every migrated read site takes an **already-resolved plant
filter** from `AccessScope.plantIds` instead of re-deriving it from a role check — `plantIds: []` means "all plants"
uniformly, which is what today's code means by "not plant-scoped" for a real all-plant member (auditor / inspector /
admin roles) and is also exactly what C12 AC3 already specifies for a support viewer. The refactor therefore changes
**no behaviour for a real member** (an all-plant member's query still sees `[]` = unrestricted; a plant-scoped
member's query still sees their own plant ids, now sourced from `accessScopeOf` instead of an inline
`isPlantScoped` check) and is what makes a support viewer's all-plant read fall out of the same code path rather than
needing its own branch at every one of the grep-matched sites (R8). Test: for a fixture plant-scoped member and a fixture
all-plant member, the migrated services return byte-identical results before and after the refactor (a
characterisation test run once per migrated service, per DoR item R8).

---

## 4. Backend needs (per story)

| Story | Migration | Routes (platform contract + controller) | Service / job | Audit | RBAC | Isolation notes |
|---|---|---|---|---|---|---|
| C1 | 0078 | `GET /platform/v1/setup/:token`, `POST …/setup/:token/password`, `…/mfa/enrol`, `…/mfa/activate`; script `platform-bootstrap` [AM2] | `PlatformIdentityService`, `platform-bootstrap.ts` | platform | pre-session; script migrator | control only |
| C2 | 0078 | `POST /platform/v1/auth/sign-in`, `…/auth/mfa`, `…/auth/sign-out`, `GET /platform/v1/me`, `GET/POST /platform/v1/me/sessions[/:id/revoke]`, **[AM3]** `POST /platform/v1/auth/step-up` | **[AR]** `platform-main.ts` + `PlatformAppModule` + `PlatformLifecycleInterceptor`, `PlatformAuthenticator`, `PLATFORM_POOL` | platform (sign-in/out/fail/step-up) | session | host check, CIDR, host-only cookies, CSRF; no tenant scope |
| C3 | 0079 (0078 for step-up tokens) | `POST /platform/v1/tenants/:id/grants` (**[AM3]** `stepUpToken` required for `content`, rate-limited, anomaly-flagged), `POST /platform/v1/grants/:id/end`, `GET /platform/v1/me/grants` | `SupportAccess.withTenant`, `packages/core/platform-rbac.ts`, **[AM3]** Redis `RateLimiter` | tenant `support_accessed` + platform (**[AM3]** incl. `content_grant_anomaly`) | `platform:tenant:access` | `kaenal_support`, RLS, restrictive policy, audit trigger |
| C4 | 0080 | `GET /platform/v1/tenants`, `GET /platform/v1/tenants/:id`, `GET …/:id/history`, **[AR2, R1] `POST …/:id/summary/refresh`** | directory + detail services, summary projector | platform `tenant_viewed` | `platform:tenants:read`, grant for detail | directory from control plane only |
| C5 | (0080 grants; 0079 trials DELETE) | `PUT …/tenants/:id/packs/:packId`, `POST …/apply-bundle`, `PUT …/tenants/:id/plan`, [AM2] `POST …/tenants/:id/trials/:packId/reset` | `PlatformPlanService` | tenant `entitlement_changed` (support) + platform | `platform:plans:write` | via grant; realtime after commit |
| C6 | 0080 | `GET /platform/v1/sales-inbox`, `POST …/requests/:requestId/fulfil|decline`, `GET /platform/v1/workspace-requests`, `POST …/:id/decline|spam` | inbox projector, `PlatformPlanService` | tenant `status_changed` + `entitlement_changed` + platform | `platform:requests:resolve`, `platform:workspace_requests:manage` | resolution via grant |
| C7 | (0080 grants) | `GET /platform/v1/catalog`, `PUT/POST …/catalog/*`, `POST …/catalog/impact-preview` | `CatalogAdminService`, impact preview | platform | `platform:catalog:*` | control plane; reads only `control.tenant_commercial_summary` — no tenant database, no cross-tenant record counts ([AR] AR26) |
| C8 | (0080 grants) | `GET/POST/PUT/DELETE …/price-book/*`, `POST …/publish`, `POST …/preview` | `PriceBookService` | platform | `platform:pricebook:*` | control plane |
| C9 | 0079 | `GET /platform/v1/audit`, [AM2] `GET /platform/v1/audit/export.csv`, `GET /platform/v1/me/audit`, `GET /platform/v1/me/audit/export.csv` | audit reader, CSV writer | platform `audit_exported` | `platform:audit:read`; `platform:audit:own` | append-only; own-export forced to the caller |
| C10 [AM2] | 0079 | `POST /platform/v1/grants/:id/view-link`; tenant contract `POST /v1/support-view/exchange` (`@AllowAnonymous`), `POST /v1/support-view/end` | `SupportViewAuthenticator` in the lifecycle interceptor (**[AR]** principal resolved first via `SUPPORT_GATE_POOL`, then the reader pool), **[AM3/AR]** `support_content_grant_active(scope)` | tenant `support_accessed` with **[AR]** internal kinds `support_grant` / `support_view` (grant start, each detail view / attachment; never outbox or realtime) + platform per request (**[AM3]** incl. entity ids on list views) | `platform:tenant:content`; synthetic read-only `support_viewer` | `kaenal_support_reader` (no write privilege), RLS, grant-bound tenant, unsafe methods 403, **[AM3]** RESTRICTIVE-policy DB backstop on `app.grant_id` |
| C11 [AM2] | (0078) | `GET/POST /platform/v1/platform-users`, `…/:id/resend-setup`, `PUT …/:id/role`, `POST …/:id/deactivate\|reactivate\|reset` | `PlatformIdentityService`, control-plane email | platform `platform_user_*` | `platform:users:manage` | control only; last-admin and self-change guards |
| C12 [AR] | — | none new; `@ReadOnlyPost` on `POST /v1/query`, `/metric`, `/series`; route policy table over every tenant route | `packages/core` `Principal`, `accessScopeOf`, `SUPPORT_VIEWER_READ_CAPABILITIES`, `SUPPORT_VIEW_ROUTE_POLICY`; helper change + read-path migration of the member-assuming sites matched by **[AR3, S6]** the grep pattern (§3.4 R8) — no fixed count | per C10 AC5 (`support_view` on detail + download) | synthetic read-only `support_viewer`, 20 read capabilities, PO-SC10 settings reads | all-plant, grant-bound tenant; secrets/credentials routes denied |
| CX | — | — | lint rules, build-manifest test, seed-platform, env, docs | — | — | host/CSP headers |

[AM2] Gap proof for the added routes: `grep -n -i "support.view\|support_view\|platform-users\|view-link\|audit/export" packages/types/src/contract.ts` and the same over `apps/api/src/**/*.controller.ts` return nothing (2026-09-30); all are built here.

**Gap proof.** No staff, operator, grant, catalog-write or price-book route exists in `packages/types/src/contract.ts`
or any `apps/api/src/**/*.controller.ts` (grep this session: `staff|support_grant|price.?book|catalog` → only the
unrelated training competency catalog, `contract.ts:1438,1486` / `training/competencies.controller.ts`). Nothing
here is a re-description of an existing endpoint; everything is built this increment (rules 0, 10).

## 5. Design needs

**[AR2] `DESIGN-07C-staff-console.md` is stale and needs a `ui-lead-designer` re-sync pass — flagged here, not fixed
by this role.** It still references `apps/staff` (the app is `apps/platform`, per the terminology note at the top of
this file) and "C1-C11" (there are now C1-C12, and C12 has no board or state of its own); it has no board or state for
the D-C4 step-up-auth flow the [AM3] security-review pass added. This is named explicitly as a required follow-up to
be dispatched separately; design-doc edits are outside this role's remit (PO), and it does not block the delta-check
architecture re-review, only Gate 1 itself.

**Existing jsx:** none for any platform screen (§1a grep). **Every screen below needs the UI Lead Designer**, in the
existing visual language (`styles/tokens.css`, the `.k-*` component language of `Kaenal.html`), denser than the
tenant app where a data table benefits, desktop-first (1280 px) with a usable 1024 px layout; mobile layouts are not
required (internal desktop tool). Each board must cover loading, empty, error (with requestId), permission (role
without the capability: read-only, no dead buttons), expired-grant and 409 states.

| ID | Screen | Story |
|---|---|---|
| D-C1 | **Platform sign-in**: email + password, TOTP / recovery-code step, generic error, lockout notice, rate-limited, session-expired return, sign-out confirmation; environment badge (dev/staging/prod) | C2 |
| D-C2 | **Account setup** (one-time link): set password (policy hints), TOTP enrol (QR + secret), recovery codes (save/download/confirm), expired-link state | C1 |
| D-C3 | **Console shell**: left nav (Tenants, Sales inbox with count, Workspace requests with count, Catalog, Price book, Audit log, [AM2] Platform users — the last two hidden for non-admins), header (platform user name + role, env badge, account menu: My sessions, My active grants, Sign out), the global **active-grant banner** | C4, C3 |
| D-C4 | **Access-reason dialog** (reason, reference, prefilled variant from inbox), grant banner with countdown and "End access", grant-expired state; **[AM2]** scope choice (Commercial / Workspace content (read-only)) with reference required for content and a plain-language warning of what content access exposes; banner showing both grants when both are held | C3, C10 |
| D-C5 | **Tenant directory** (search, filters, table, pagination, empty) and **tenant detail** header + tabs Plan / Requests / Profile (incl. framework declaration history) / History | C4 |
| D-C6 | **Plan editing**: pack toggles, bundle apply (incl. Enterprise), self-service switch, contract + CSM form; the **change-reason confirm** with diff ("effective modules +Risk, +ECN") and the downgrade open-records variant; **[AM2]** "Trial used · ended <date>" row state with **Reset trial** and its reason confirm | C5 |
| D-C7 | **Sales inbox** (list, filters, resolve dialog: fulfil / decline with reason; "withdrawn meanwhile" state) and **Workspace requests** (list, decline / spam, provisioning-command row, provisioned link) | C6 |
| D-C8 | **Catalog**: Packs (edit form, module map editor), Frameworks & rules (framework list + per-framework module rule grid with level/clause/note), Industries (edit form incl. suggested frameworks and priors); **impact-preview confirm** with gained/lost tenant lists (no record counts) and the typed-count confirm | C7 |
| D-C9 | **Price book**: versions list (published / draft / archived), draft editor (items table), estimate preview (sample profile / tenant composition), publish confirm with diff, discard draft | C8 |
| D-C10 | **Platform audit log** (filters, table, row detail, [AM2] Export CSV incl. the over-cap message) and **My sessions / My active grants / [AM2] My activity (+ Export CSV)** panels | C9, C2, C3 |
| D-C11 | **[AM2] Platform users section**: platform user list (role, status, MFA, last sign-in), Invite platform user dialog, Resend setup email, Change role, Deactivate / Reactivate / Reset credentials with reason confirm, last-admin and self-change refusals, empty (bootstrap admin only) | C11 |
| D-C12 | **[AM2] Tenant web app — support-view mode** (`apps/web`, the tenant's visual language): `/support-view` exchange page (loading, expired/reused link, member-session-present refusal), the persistent read-only banner (reason, reference, countdown, End support view), how read-only screens look with mutating controls absent (no visual "disabled" noise), hidden personal account items, ended/expired full-page state; the tenant audit-log rows "Kaenal support opened read-only access …" and "Kaenal support viewed <record>". Desktop 1280 / 1024. **[AR]** Plus: the "Not available in support view" variant of the existing in-shell not-available state (Settings → Integrations, API keys, per-user screens — PO-SC10); the expired/ended state after the query cache is cleared (C10 AC7) | C10, C12 |

Accessibility (WCAG 2.2 AA): keyboard-complete tables and dialogs, visible focus, the typed-count confirm is a
labelled input (not a colour-only cue), countdowns are announced politely (`aria-live="polite"`), contrast on the
env badge colours verified.

## 6. Dead-end audit (every control this increment introduces)

| Control | Resolves to |
|---|---|
| Sign in / Verify code / Use a recovery code / Sign out | C2 routes |
| Setup: Set password / Enrol / Activate / Download recovery codes | C1 routes; codes shown once |
| Nav: Tenants, Sales inbox, Workspace requests, Catalog, Price book, Audit log | Real sections C4, C6, C6, C7, C8, C9 (Audit log hidden without `platform:audit:read`) |
| Account menu: My sessions (revoke), My active grants (end) | C2 / C3 routes |
| Directory: search, filters, row click, pagination | C4 route; detail |
| Tenant detail: Refresh summary | `POST /platform/v1/tenants/:id/summary/refresh` — re-derives `control.tenant_commercial_summary` for that tenant inside the active grant (C4 AC2, §3.4 R1) |
| Access dialog: Open with reason / Cancel | C3 grant / back to directory |
| Grant banner: End access | C3 end |
| Plan tab: pack toggle, Apply bundle (Core/Pro/Ent), Self-service switch, Save contract, Save CSM | C5 routes with reason confirm; hidden for `platform_support` |
| Change-reason confirm: Confirm / Cancel | C5 write / no change |
| Inbox: Resolve → Fulfil / Decline | C6 routes |
| Workspace requests: Decline / Mark as spam / Open tenant | C6 routes / C4 detail |
| Workspace requests: provisioning command (copy) | Copies text; provisioning is `provision-tenant` (Sprint 07 P8) — honest, not a dead button |
| Catalog: edit pack, move module, add/edit/retire framework, add/edit/retire industry, edit rule | C7 routes; impact preview where applicable |
| Impact preview: Apply (typed count) / Cancel | C7 write / no change |
| Price book: New draft, edit item, Preview, Publish, Discard draft | C8 routes |
| Audit log: filters, row detail, Export CSV [AM2] | C9 routes (`/platform/v1/audit`, `/platform/v1/audit/export.csv`) |
| [AM2] Nav: Platform users (admins only) | C11 section |
| [AM2] My activity: filters, Export CSV | C9 AC4 routes (own rows only) |
| [AM2] Access dialog: scope choice Commercial / Workspace content | C3 grant with that scope (content hidden for `platform_sales`) |
| [AM2] Tenant detail: View workspace (read-only) | C10 view-link → new tab → tenant `/support-view` exchange |
| [AM2] Plan tab: Reset trial (ended trials only) | C5 AC6 route with reason confirm; absent for running trials and for `platform_support` |
| [AM2] Platform users section: Invite platform user / Resend setup email / Change role / Deactivate / Reactivate / Reset credentials | C11 routes, reason confirm; self / last-admin guards render as disabled-with-explanation, never a control that 422s silently |
| [AM2] Tenant app (support view): End support view | `POST /v1/support-view/end` → ended state |
| [AM2] Tenant app (support view): every module screen | Read-only real data; mutating controls not rendered (C10 AC7 sweep); single-attachment open works and is audited |
| [AM2] Tenant app: `/support-view` page | Real exchange (C10 AC3) with expired / member-session states — not a placeholder |
| [AR] Tenant app (support view): Settings → Integrations / API keys / per-user screens | "Not available in support view" in-shell state (C12 AC4, PO-SC10) — a real permission state, not a dead control |
| [AR] Tenant app (support view): report builder / dashboards (query routes) | Work read-only via `@ReadOnlyPost` (C10 AC4); authoring controls not rendered (no `report:manage`) |
| [AR] Tenant app (support view): attachment open | Real download, link valid `min(60 s, grant remaining)` (C12 AC6), audited as `support_view` |

No "coming soon", no placeholder route, no control without a backend.

## 7. Decisions register and out of scope [AM2 — no open question remains]

**[AM2] Status: every item is DECIDED.** "→ Known issues" marks a future candidate copied to PROGRESS.md "Known
issues" at close; none blocks Gate 1, the architecture review or the security review.

**Decided by the user.**
- ~~Q-SC3 Tenant QMS-content support access and impersonation~~ → **U-SC3 (2026-09-30): full tenant-content access
  via the 4 h audited grant.** The previous SD7 was narrower (commercial only) and is rewritten: `content` grant
  scope, read-only support view of every record (C10), reference required, `platform_support`/`platform_admin` only, audited per
  record in the tenant's log and per request in the platform log. PO-decided boundaries of that access (SD7): no
  platform writes to QMS records, no per-member "view as", no bulk export, no tenant consent toggle (→ Known issues
  for each, as future candidates).

**Decided by the PO under CLAUDE.md's standing rule (smallest reasonable choice, recorded; revisitable).**
- **Q-SC1 → PO-SC1.** `pnpm platform-bootstrap` creates the first platform admin (and break-glass admins with a reason),
  mirroring `provision-tenant` / `seed-demo`; that admin creates and manages every further platform account in the
  console (C11). The multi-command `platform-user` CLI is not built (one write path).
- **Q-SC2 → PO-SC2.** Code provides the host check and an optional CIDR allowlist; the production network
  restriction (CIDR allowlist or VPN / zero-trust proxy at the ingress) is an ops runbook requirement documented in
  `apps/platform/README.md` (CX AC3), not a code gate (→ Known issues, for whoever owns production infrastructure).
- **Q-SC4 → PO-SC4.** Provisioning from the console is not built; `provision-tenant --from-request` stays the only
  provisioning path (it creates databases and roles for dedicated tenants); the workspace-request row shows the
  exact command (C6). (The lead's message grouped this label with the content-access decision; in this file it is a
  separate question, decided here.)
- **Q-SC5 → PO-SC5.** Mandatory TOTP is the bar; WebAuthn / passkeys are a future enhancement (→ Known issues).
- **Q-SC6 → PO-SC6.** Platform users (`platform_sales`, `platform_admin`) may reset a tenant's **ended** trial of a pack with a mandatory
  reason, audited in both logs like a plan change (C5 AC6); no extension of a running trial.
- **Q-SC8 → PO-SC8.** Every platform user can export their own action log as CSV; admins can export the full log
  they can already read (C9 AC4-AC5).
- **Sprint 07 Q-C12** (platform "suspend framework inclusion" override) → not built: Sprint 07 decided the honor
  system.
- Q-SC7 Price book is single-currency (`USD`) this sprint.
- Q-SC9 Offboarding/suspended tenants: listed and readable, no writes offered.
- Q-SC10 `apps/platform` duplicates a few UI primitives instead of extracting `packages/ui` (SD1 trade-off).
- Q-SC11 The tenant sees "Kaenal support" and the reason, not the platform user's name (07 §7 wording "Kaenal support
  accessed…"); the name is in Kaenal's platform audit log. Revisit if customers ask to see names.
- Q-SC12 Support-grant duration is fixed at 4 h (07 §7); extending means opening a new grant with a new reason.
- **[AR] PO-SC10 — Settings read scope for the support viewer** (architecture-review finding 7; the reviewer asked the
  PO to decide). Readable: organisational and RBAC-assignment configuration (branding, session-policy values, NCR
  validation rules, legal holds, DLP policies, cost centers and chargeback, members / plants / areas, plan, billing
  details, workspace profile, onboarding, the tenant audit log). Excluded even read-only: anything holding a secret or
  credential (the integrations / webhook-endpoint surface, API keys, any future SSO/SCIM config, invitation tokens),
  every per-user screen, bulk exports and the live stream. Reason: configuration is what support needs to reproduce a
  problem; a credential lets its holder act as the tenant outside Kaenal, which turns a read-only grant into an
  ability to act. Full list and mechanism in C12 AC4. A config-free integration-health view for support is a future
  candidate (→ Known issues).
- **[AM3] PO-SC9** (arising from the pre-build security review's SR3 finding, 2026-09-30). `content`-grant creation
  is rate-limited to **5 per platform user per rolling hour**, and a `content_grant_anomaly` platform audit event is
  flagged the first time a platform user's rolling-hour window reaches **3 distinct tenants** (C3 AC9, SD10). Both
  numbers are the PO's smallest-reasonable-choice call, not the user's or the security reviewer's; revisitable if
  real usage shows either threshold is too tight or too loose.

**[AR] Known issues recorded by this amendment** (copied to PROGRESS.md "Known issues" at close):
- **Pre-existing: emails/jobs enqueued before commit via a direct `JobProducer` call.** `auth.controller.ts:221`
  (invite) and `suppliers.controller.ts:186` call `jobs.sendEmail` inside the handler, i.e. before the interceptor's
  tenant transaction commits, so a request that rolls back after that line still sends its email. **[AR4, found
  incidentally while building SD13's exhaustive caller table]** The same pattern exists at `files.service.ts:208`
  (`jobs.scanFile`, after upload completion) and `exports/exports.service.ts:152` (`jobs.runExport`) — both enqueue
  immediately after their own inner transaction returns but still inside the outer HTTP request's tenant
  `RequestContext`, so a later failure in the same request can roll back the write while the job already fired. All
  four are direct `JobProducer` calls that bypass the shared after-commit buffer entirely (SD13 D2(v) row 1/3/4/5);
  none is changed by these sprints (outside their scope, pre-existing); the SD12/SD13 after-commit buffer mechanism
  this amendment builds is the fix when someone takes these four on, by routing them through it instead of calling
  the producer directly. **[AR2, citation correction]** `auth.controller.ts:255` is a `@Public` route with no tenant
  transaction and is not an instance of this issue.
- **[AR4] No worker-side realtime publisher for processor-originated notifications (conscious scope decision, SD13
  D2(vi)).** `notify()`'s realtime "refetch your notifications" nudge is dropped for notifications created from a job
  processor (the worker process has no Redis publisher) — email/push/in-app-row delivery works once this sprint's
  worker-producer fix lands; only the live ping doesn't fire, so an affected user sees the notification on next
  refresh rather than instantly. Adding a worker-side Redis publisher is named as a future candidate, not built this
  sprint (nothing today depends on it).
- **Support view: integration health without configuration.** PO-SC10 excludes the integrations surface because its
  config and delivery logs can hold credentials; a config-free health projection for support is a future candidate.
- **Dedicated databases: platform-user status/role not checkable locally.** C10 AC2a's dedicated branch relies on
  end-propagation (with retries) plus the primary-side application checks for deactivation/demotion; stated, not
  hidden. Revisit if a dedicated tenant needs a stronger guarantee.

**Out of scope (named).** Platform writes to tenant QMS records; "log in as" a specific tenant member; bulk export in
support view; a tenant consent setting for platform access; platform SSO; platform account self-registration;
provisioning/offboarding from the console; billing/payments (Q6); any mobile platform surface or mobile support view.
Every "→ Known issues" item above moves to PROGRESS.md "Known issues" at close.

## 8. Definition of Done

- [x] [AM2] Every §3 design decision and §7 item DECIDED (U-SC3 by the user; the rest by the PO under the standing
      rule, [AM3] incl. PO-SC9) — no decision gates the build.
- [x] [AM3] The pre-build security review's 1 High + 3 Medium findings + 1 flagged prerequisite (SR1-SR5) are
      resolved in this document (SD7's finalized DB backstop, new SD10, C10 AC2/AC2a/AC5/AC8, C3 AC8/AC9/AC10). This
      is a **document fix, not a re-run of the review** — see the next line.
- [x] [AR] The architecture review's SEND BACK (23 blocking defects, itemized AR1-AR29 in Amendment 4) is answered
      in both documents — a **document fix, not a re-review**; the `planner` re-review against DoR #4 is still open.
- [x] **[AR2]** The delta-check re-review's 5 bugs in Amendment 4's own new mechanisms (B1-B5) and its two flagged PO
      decisions (risk "open" definition; FMEA/SPC/portal scope boundary) are resolved in this document (Amendment 5:
      C3 AC2/AC3/AC6/AC7, C10 AC2/AC2a/AC4/AC6, SD5, SD7, SD11, SD12, new SD13, CX AC1/AC8, C2 AC3, C1 AC4) and the
      reviewer's R1-R9 reference material is folded into the spec as build-ready content (§3.4) rather than left as
      commentary — a **document fix**, matching the reviewer's own characterisation that a delta check, not a full
      re-review, is what the *next* pass needs. See the next line for what still requires the architect.
- [ ] **[AR2] `planner` architecture DELTA-CHECK SIGN OFF** on Amendment 5's fixes specifically — confirming B1's
      dedicated `audit_events` policy and `recordGrantStart` ordering actually close the gap, B2's narrower
      notification writer actually avoids the RETURNING permission failure, B3's `notify()` fix actually routes
      through the after-commit buffer, B4's `shared/**` layer and sequential-boot test actually stop the
      single-slot-observer clobber, and B5's claim-query fix actually stops outbox starvation — **not** a repeat of
      the full R1-R10 checklist DoR #4 already covers below, which stands as the broader re-review requirement.
- [ ] `security-reviewer` **SIGN OFF on this revised §3** (confirming SR1-SR5 are actually closed by the rewrite,
      not just claimed closed), UI Lead Designer's boards D-C1…D-C12 [AM2] approved by the user (Gate 1), and
      `planner` architecture review (shared with Sprint 07's) — all three before build starts. **A second
      `security-reviewer` pass on the built code (CX AC6) is still required before Gate 2**, specifically to verify
      SR1-SR5's fixes landed in code exactly as specified here (the RESTRICTIVE policy + backstop function actually
      block an expired/absent grant at the DB layer; step-up is actually enforced and consumed; the rate limit and
      anomaly event actually fire at the stated thresholds; list-view audit events actually carry entity ids) — not
      taken on the implementer's word.
- [ ] Sprint 07 Increment A merged (catalog, price book, plans, requests, `plan_request.changed` outbox event).
- [ ] Migrations 0078-0080 applied (0081 buffer); `pnpm db:migrate` clean on fresh and existing DBs; `pnpm db:check`
      green; `pnpm test:rls` green **including the `kaenal_support` and [AM2] `kaenal_support_reader` roles**;
      explicit grant tests for every `control.platform_*` table (**[AM3]** incl. `platform_step_up_tokens`), the
      support-view tables, `kaenal_platform`, `kaenal_support` (cannot read QMS content, restrictive namespace policy
      holds), **`kaenal_support_reader` (SELECT on every tenant table except the denylist, no write privilege but
      its audit rows — the enumerating schema test, C10 AC2)** and `kaenal_app`/`kaenal_public` (cannot read platform
      or support-view tables); **mutation tests**: widening the restrictive policy, dropping an audit-attribution
      trigger, removing a `@PlatformRoute` decorator, or [AM2] granting the reader role one write privilege / revoking one
      of its SELECTs each make a test fail — run and recorded. **[AM3]** Plus: `kaenal_support_reader` reading with
      `app.grant_id` absent, expired or ended returns zero rows / a permission error even with the application
      check bypassed (SR1, C10 AC2a/AC8), and a mutation test proves dropping the RESTRICTIVE policy or stubbing
      `support_content_grant_active()` makes that test fail.
- [ ] Every platform mutation writes a platform audit event, and every tenant-touching one also the tenant
      `actor_kind='support'` event with reason in the same tenant transaction (rule 3, SD5 ordering proven by a
      failure-injection test) — [AM2] including trial reset, and every support-view detail view / attachment
      download (C10 AC5, **[AM3]** now including entity ids on list-view reads under a content grant); optimistic
      concurrency on every write (rule 6); cursor pagination on every list. **[AM3]** Content-grant creation is
      rate-limited (5/platform user/rolling hour) and fires exactly one `content_grant_anomaly` event at the 3rd distinct
      tenant in a rolling hour, not before and not again for the same window (C3 AC9).
- [ ] Interceptor: tenant sign-in re-proved end to end (201) after the platform API process (**[AR]** C2) **and [AM2] the support-view
      authenticator** land (rule 12); mobile bearer path unchanged; cross-plane isolation tests green both ways; host
      check and CIDR tests green; [AM2] the contract-enumerating support-view test (every GET 2xx/404 read-only,
      every unsafe route 403, C10 AC6) green. **[AM3]** `content`-grant creation is refused without a valid,
      unexpired, single-use, user-matched `stepUpToken` (C3 AC8), and never requires one for `commercial` grants.
- [ ] `apps/platform`: every screen browser-verified against the approved D-C boards (there is no jsx), including all
      states, at 1280 and 1024 px; WCAG AA checks recorded. **[AM2] `apps/web` support-view mode** browser-verified
      against D-C12, and the Playwright no-enabled-mutating-control sweep (C10 AC7) green.
- [ ] Playwright (platform + tenant, one journey): tenant `globex` (request mode) requests QE → platform sales inbox →
      grant with reason → fulfil → tenant `/risk` unlocks without reload → tenant audit log shows "Kaenal support —
      <reason>"; platform admin edits an IATF rule (impact preview + typed confirm) → a test tenant's module gating
      changes on its next request; platform admin publishes a new price book → tenant `/pricing` estimate changes.
      **[AM2]** Second journey: platform `platform_support` completes step-up (**[AM3]**), opens a content grant with reason +
      reference → View workspace → Acme's NCR and PPAP pages render read-only with the banner → the tenant admin's
      audit log shows "opened read-only access" and "viewed <record>" → End support view → next request 401. Third:
      platform `platform_sales` resets an ended trial → tenant admin starts a new trial. Fourth: bootstrap admin invites a platform
      user → setup email → setup → the new member exports their own activity CSV.
- [ ] `apps/web` build contains no platform route or platform contract symbol (CX AC1); lint isolation rules green.
- [ ] Mobile: `pnpm --filter @kaenal/mobile typecheck` + tests green; `progress_mobile.md` notes "07C: no mobile
      change (internal web tool; support view is web-only; support audit events render in the existing oversight
      feed row)".
- [ ] **[AR] Process separation (AR1-AR4):** the platform API runs from `platform-main.ts` on its own port and
      deployment; the two-router enumeration test and its mutation checks green; the tenant app boots without
      `DATABASE_PLATFORM_URL` / `DATABASE_SUPPORT_URL`; `SELECT current_user` is `kaenal_support_reader` in a
      support-view handler and `kaenal_app` in a member handler; an invalid support-view cookie opens no transaction;
      `staff` / `platform` slugs rejected. **Recommended:** the import-boundary lint rule (CX AC1) fails on a planted
      violation (the architect confirms; the PO cannot verify a lint rule by reading).
- [ ] **[AR] DB enforcement (AR5, AR13-AR15, AR25, AR29):** both RESTRICTIVE grant policies present on every table
      with `tenant_isolation` and created by `apply_tenant_rls`; every C10 AC2a mutation check (drop policy, stub
      function, `now()` for `clock_timestamp()`, drop tenant / status / role predicate, redefine `apply_tenant_rls`)
      fails a test, for both support roles and the dedicated branch; the commercial audit-scope policy and column
      grants hold; composite `(grant_id, grant_scope)` FKs reject a commercial grant; the five new roles are
      `rolcanlogin = false` after `pnpm db:migrate`; grant tests for `kaenal_support_gate` and `kaenal_projector`.
- [ ] **[AR] Audit / outbox (AR9, AR10, AR22-AR24):** a detail view under a content grant writes one `support_view`
      row, no outbox row and no realtime signal; a `*`-subscribed customer webhook receives no support event and no
      internal event (`plan_request.changed`, `tenant_commercial.changed`), and no requester email appears in any
      outbox row; the sales inbox and commercial summary are populated by `InternalProjectionHandler` through
      `kaenal_projector`; query / search / graph platform events recorded; SD5 intent/outcome failure-injection test
      green; no AC claims same-transaction email and each email path enqueues after commit (rollback → no email).
- [ ] **[AR] Expiry (AR6-AR8):** `GET /v1/events` → 403 for a support viewer; a download link issued with < 60 s left
      on the grant dies with the grant; both web apps clear their caches on grant end (Playwright).
- [ ] **[AR] C12:** the 20-capability list pinned by test; every tenant route classified (unclassified = denied);
      PO-SC10's readable / denied Settings sections behave as listed; the three helpers throw 403 for a support viewer;
      C10 AC6's enumerating test (every GET and `@ReadOnlyPost` route) green.
- [ ] **[AR] Concurrency (AR15, AR19, AR20):** concurrent grant creates → one grant; concurrent fulfils → one 200 and
      one 409 with one entitlement change; concurrent drafts / publishes → one success; catalog writes get distinct
      versions and a changed impact → 409 `IMPACT_CHANGED`; demotion ends the content grant on commit.
- [ ] **[AR2] Delta-check fixes (B1-B5), each independently proven:**
      **B1** — a content-grant create always leaves exactly one tenant `support_accessed`/`support_grant` row
      readable via the tenant's own audit log before the create call returns; failure injected on the dedicated-tenant
      mirror insert or on `SupportAccess.recordGrantStart`'s insert ends the grant `activation_failed` and returns 503,
      for both scopes; `kaenal_support` cannot insert any other `action`/`entity_kind` into `audit_events` while
      holding only a content grant (mutation test on `support_audit_write_scope`).
      **B2** — `kaenal_support` can `INSERT … RETURNING id` on `notifications` but `RETURNING` any other column fails
      the permission check; C5 AC3 / C6 AC3 call `notifyMinimal()`, not `notify()`.
      **B3** — a `notify()` call inside a transaction that rolls back enqueues no delivery job; a `notify()` call whose
      transaction commits enqueues exactly one, after commit (race test against a worker polling the instant the job
      is visible); `plan_request_resolved` and the auto-fulfil notification are proven to go through this fixed path.
      **B4** — a realtime `entitlements` signal fired inside `SupportAccess.withTenant` is observed by a subscribed
      tenant browser (Playwright, proving the bridge is not silently no-op in the platform-process context); the
      two-router enumeration test boots `AppModule` and `PlatformAppModule` sequentially, never concurrently, and a
      mutation that boots them concurrently in a scratch test demonstrates the clobber the sequential ordering avoids.
      **B5** — a drain cycle on a tenant with `batchSize` held internal rows plus one real webhook row still delivers
      the real row that cycle.
- [x] **[AR3]** Amendment 6's two blocking defects (D1, D2) and six small fixes (S1-S6) are resolved in this document
      (C3 AC3/AC10, C10 AC2a, SD5, SD7, SD12, SD13, §3.4 R1/R8, C12 "Verified current state", §4 C12 row; SPRINT-07
      P4 AC5 and this file's DoR item R2) — a **document fix**, matching the reviewer's own framing that a delta check
      limited to D1, D2 and S1-S6 is enough for the *next* pass. See the next line for what still requires the
      architect.
- [ ] **[AR3] `planner` delta-check SIGN OFF on Amendment 6's fixes specifically**, each independently proven:
      **D1(a)** — the schema test asserts `audit_events` as a named exception (reader policy present, generic
      commercial policy absent, the two dedicated command-scoped policies present in its place), not merely that
      "both policies exist on every table"; planting the generic policy on `audit_events` in a scratch migration
      fails the test.
      **D1(b)** — a `kaenal_support` read of `audit_events` after `expires_at`, or while holding only a `content`
      grant, returns zero rows / a permission error even with the application check bypassed; a mutation test on
      `support_commercial_audit_scope`'s added clause fails without it.
      **D1(c)** — **[AR4] superseded, restructured as one atomic transaction (Blocking A of the 2026-10-01 delta
      check), not merely patched** — the mirror insert and the `recordGrantStart` audit-row insert are now one
      transaction, so failure injected on the audit-row insert rolls the mirror insert back with it: for a dedicated
      tenant, `control.support_grant_backstop` carries no row for that grant afterward (not a committed row with
      `ended_at` set), read directly from the table, in the same request that returns 503 with the control-plane grant
      marked `activation_failed`.
      **D2** — a processor-scope test proves a job-processor-path `notify()` call enqueues exactly one delivery job
      after that processor's own transaction commits (not the caller's HTTP request, since there is none), that
      `notifyMinimal()` goes through the identical path, and that invoking the enqueue path with no active scope at
      all (tenant, platform, or processor) throws rather than silently doing nothing.
      **S1** — `apps/api/src/shared/notifications.ts` exports `notifyMinimal()`; no file under `apps/api/src/platform/**`
      imports anything from `apps/api/src/notifications` (lint/import-boundary check).
      **S2** — `PlatformAppModule.onModuleInit` registers the same shared audit/realtime bridges `AppModule.onModuleInit`
      does; the sequential two-router test asserts both processes' observer slots are populated after boot, not only
      that their routes don't overlap.
      **S3** — SD7's R6 paragraph no longer contradicts itself (reads "two-argument, non-throwing form").
      **S4** — §3.4 R1's table gives `platform:tenant:access` for `GET /tenants/:id`, `/:id/history` and
      `POST /:id/summary/refresh`, matching C4 AC2/AC3; `sign-in`/`mfa` are labelled `@PlatformPublic`, not "session only".
      **S5** — SPRINT-07 P4 AC5 and this file's DoR item R2 no longer each point at the other as "already produced
      elsewhere"; P4 AC5 states its examples as a slice-plan input, and this file's R2 says the architect produces the
      remaining definitions from them.
      **S6** — no AC or test anywhere in either file depends on an exact member-assuming-site count; the grep pattern
      in §3.4 R8 is what the architect's slice plan is built from, re-run fresh against the real codebase.
- [x] **[AR4]** Amendment 7's two blocking defects (Blocking A, Blocking B) and four small fixes are resolved in this
      document (SD12/SD13's D2(iii)/D2(v)/D2(vi), C3 AC6/AC10, SD5, C10 AC2a, §3.4 R8; SPRINT-07 P5 AC2) — a
      **document fix**, naming two genuine pre-existing/would-be bugs (the worker's no-op producer; the over-broad
      throw rule) without building any product-code fix for them yet (that is build-phase work, tracked by the DoD
      item below and by Known issues). See the next line for what still requires the architect.
- [ ] **[AR4] `planner` delta-check SIGN OFF on Amendment 7's fixes specifically**, each independently proven:
      **Blocking A** — the exhaustive caller table (SD13 D2(v)) is re-verified row-by-row against the actual
      codebase (line numbers, file names) and found complete — no job/notification-enqueue call site exists that
      isn't one of the table's 11 rows; the scoped throw-on-no-scope rule (D2(iii)) is implemented so that a direct
      `JobProducer` call (rows 1, 3, 4, 5) and a `@Public`-route immediate enqueue (rows 2, 9) never throw, while a
      `notify()`/`notifyMinimal()` call with no scope of the three kinds open (tenant, platform, processor) does;
      `seed-demo.ts` and `notifications.test.ts` open a processor scope around their direct `notify()` calls and run
      without throwing after the fix lands.
      **Blocking B** — `apps/api/src/jobs/worker.ts` constructs `NotificationsService` with a real `BullMqProducer`
      when `JOBS_ENABLED`, matching `app.module.ts`'s own ternary, not a bare `new NotificationsService()`; the
      `entitlement-trials` processor's T-3/expiry notification, run through the actual fixed worker wiring (not a
      mock), both writes its in-app row and enqueues a real delivery job that a real `deliverNotification` processor
      consumes; no worker-side realtime publisher was added, and that omission is confirmed to be this sprint's
      conscious, named scope decision (Known issues), not an oversight.
      **D1(c) restructure** — C10 AC2a's one-transaction mirror+audit write actually lands as one transaction in the
      built code (not two calls that merely both succeed in the happy path); failure injected on the audit-row
      insert leaves zero rows in both `control.support_grant_backstop` and the tenant's `audit_events` for that grant,
      not a partially-committed pair.
      **Step-numbering fix** — SD5's ordering note, C3 AC6 and C10 AC2a all refer to the same three steps with the
      same numbers (1 = control-plane commit, 2 = the one atomic tenant-side write, 3 = the SD5 outcome row); no
      cross-reference among the three uses a different count.
      **§3.4 R8 citation fix** — `inspections.controller.ts`'s real `membership(ctx)` call sites (56, 69, 100, 114,
      129, 147, 165) and `actorId(ctx)` call sites (85, 101, 130, 148, 166) match the architect's own fresh grep
      against the file; the three GET-route `membership(ctx)` sites are the ones actually migrated, and `actorId(ctx)`
      is treated as a write-path helper, not a read-routes-to-migrate one.
- [ ] Gates green: `pnpm typecheck && pnpm lint`, `pnpm test`, `pnpm test:rls`, `pnpm db:check`.
- [ ] Demo tenant re-seeded **and** platform accounts re-seeded after the suites; **tenant sign-in 201** and **platform
      sign-in (password + TOTP) succeed**.
- [ ] CLAUDE.md Commands (`pnpm platform-bootstrap`, `pnpm --filter @kaenal/platform dev`, **[AR2] `pnpm --filter
      @kaenal/api start:platform`**), `.env.example`,
      `apps/platform/README.md` (incl. the PO-SC2 production network runbook line), PROGRESS.md ("Current status",
      Decisions log: U-D5, U-SC3, PO-SC1…PO-SC9 [AM3] and SD1-SD10 [AM3] outcomes, **[AR2] SD13 and the two Amendment
      5 PO decisions (risk "open" definition; FMEA/SPC/portal scope boundary)**; Known issues: every "→ Known
      issues" item of §7, the updated `CONTROL_POOL` note, [AM3] the pre-build security review's SR1-SR5
      findings and how each was resolved, **[AR2] the B1-B5 delta-check bugs and their fixes**, and **[AR3] Amendment
      6's D1(a)/D1(b)/D1(c)/D2 fixes and the S1-S6 small fixes**) updated in the same commit as the work.
- [ ] PO verifies every AC against code, tests and browser evidence at Gate 2; release of Sprint 07 (A+B+C)
      happens only after this passes.

---

**§3 security + architecture design: DECIDED (PO under the standing rule; SD7 widened per the user's U-SC3 decision
of 2026-09-30; [AM3] SD7 further finalized and SD10 added per the 2026-09-30 pre-build security review — see the
findings table under Amendment 3). Security review: PENDING (`security-reviewer`) — a pre-build gate, not an open
decision. [AM3] The review that produced SR1-SR5 was itself that pre-build pass on the prior draft of §3; its
findings are resolved in this text, but the reviewer has not yet re-read and signed off THIS revised §3 — that
sign-off, and the separate post-build code review (CX AC6), both remain outstanding. Nothing in this amendment
should be read as the security gate being closed.**

**[AR] Architecture review: SEND BACK (2026-09-30) — answered in this document by Amendment 4; RE-REVIEW REQUIRED.**
The 23 blocking defects are itemized and resolved in text (AR1-AR29). The PO does **not** consider the SEND BACK
closed: several resolutions are designs that only the architect can confirm are sound in this codebase (the InitPlan
shape, the principal-first interceptor path, the member-assuming-site classification [§3.4 R8, scoped by grep pattern,
not a fixed count — AR3, S6], the two-router test), and the reviewer's
own theme-15 list is carried as DoR #4. The `security-reviewer` must also re-read §3, which [AR] changed materially
(SD1, SD5, SD6, SD7, SD11, SD12, C10 AC2a, the new roles).

**[AR2] Delta-check re-review (2026-09-30) — answered in this document by Amendment 5. The reviewer characterized
this pass as narrow, over Amendment 4's own new mechanisms only, and said a delta check on Amendment 5 is enough for
the *next* pass, not a full re-review.** Five small, concrete bugs (B1-B5) found in Amendment 4's own new mechanisms
are fixed (C3 AC2/AC3/AC6/AC7 for B1/B2, SD12 for B3, new SD13 + CX AC1/C2 AC3 for B4, SD11 for B5); the two PO
decisions the reviewer flagged (risk's "open" definition; FMEA/SPC/portal's scope boundary) are decided explicitly;
the reviewer's R1-R9 reference material (route/capability lists, denylists, the confirmed AccessScope refactor) is
folded into the spec as build-ready content (§3.4) rather than left as commentary; three smaller stale-wording/naming
items are fixed (C1 AC4, SD7's un-struck paragraph, the function/policy name collision). The PO does **not** treat
this as closing the architecture gate on its own: a `planner` delta-check pass must still confirm B1-B5's fixes
actually work as specified in this codebase (DoD item, new bullet after Amendment 4's SEND BACK line), and DoR #4's
broader R1-R10 checklist (now mostly answered in text per the table above) still needs the architect's own
verification against the real controllers, schema and a fresh run of §3.4 R8's grep pattern (never a fixed site
count, AR3 S6) — a lighter pass than the original
re-review, consistent with the reviewer's own framing, but a real one. `DESIGN-07C-staff-console.md`'s staleness
(`apps/staff`, "C1-C11", no C12/step-up board) is **flagged, not fixed** here — that is `ui-lead-designer`'s job, to
be dispatched separately; it does not block this delta check, only Gate 1.

**[AR3] Delta-check re-review #2 (2026-10-01) — answered in this document by Amendment 6. The reviewer scoped this
pass explicitly to Amendment 5's own fixes and said a delta check limited to D1, D2 and S1-S6 is enough for the next
pass.** Two blocking defects (D1(a)/(b)/(c) in B1's RESTRICTIVE-policy mechanics; D2 in B3's job-processor coverage)
and six small fixes (S1-S6) are resolved: D1(a) gives `apply_tenant_rls()` a named `audit_events` exception instead of
an impossible "supersedes" claim (C10 AC2a, C3 AC3, §3.1); D1(b) adds a liveness check to
`support_commercial_audit_scope`'s USING clause (C3 AC3); D1(c) propagates `ended_at` to a dedicated tenant's mirror
row synchronously on `activation_failed` (C10 AC2a, SD5); D2 gives job processors a third after-commit scope and makes
a scope-less enqueue throw instead of silently dropping (SD12, SD13); S1 moves `notifyMinimal()` into `shared/**`
(C3/C5/C6, SD13); S2 requires `PlatformAppModule.onModuleInit` to install the shared bridges and corrects a citation
(SD13, C2 AC3); S3 fixes SD7's self-contradictory "single-argument form" wording; S4 reconciles §3.4 R1's capability
table with C4 AC2's own wording and fixes a route mislabel; S5 removes the circular reference between this file's DoR
R2 and SPRINT-07's P4 AC5; S6 replaces every fixed member-assuming-site count with the grep pattern that defines the
scope, labelling any number an illustrative snapshot. The PO does **not** treat this as closing the architecture gate:
a `planner` delta-check pass must still confirm D1/D2/S1-S6's fixes actually work as specified in this codebase (new
DoD bullet after Amendment 5's delta-check line); the broader DoR #4 R1-R10 checklist is unchanged by this amendment
and still needs the architect's own verification.

**[AR4] Delta-check re-review #3 (2026-10-01) — answered in this document by Amendment 7. The reviewer's diagnosis:
Amendment 6's D2 fix had been patched incrementally across rounds (HTTP handlers, then job processors, then
`@Public` routes, seed scripts and tests each found missing in turn); the fix is to stop patching prose and build one
exhaustive table instead.** Two blocking defects and four small fixes are resolved: **Blocking A** — D2(iii)'s
throw-on-no-scope rule, as worded, would have thrown for working code (seed scripts, test setup, and would have been
read as applying to direct `JobProducer` calls and `@Public` routes that correctly have no scope); fixed by scoping
the rule to exactly the shared after-commit buffer `notify()`/`notifyMinimal()` use, and by the new exhaustive
11-category caller table (SD13 D2(v)) that names every job/notification-enqueue call site in the codebase, its scope,
and whether the rule applies — including the fix seed scripts and test code need (open a processor scope, same as a
real job processor, rather than being silently exempted or silently broken). **Blocking B** — a genuine pre-existing
bug, found incidentally while building that table: the worker constructs `NotificationsService` with no real job
producer (`worker.ts:87`, falls back to `NoopProducer`), so every processor-originated `notify()` call enqueues
nothing today — a hard dependency of Sprint 07 P5 AC3's trial-ending/trial-ended emails, not an optional fix; resolved
by gating the worker's producer construction on `JOBS_ENABLED`, matching `app.module.ts`'s own pattern (SD13 D2(vi)),
with the DoD test pinned to Sprint 07's real `entitlement-trials` processor through the actual fixed wiring, and an
explicit, named decision to drop (not silently omit) the realtime nudge for processor-originated notifications this
sprint. **Four small fixes:** D1(c)'s mirror-clearing design is restructured into one atomic transaction (mirror
insert + tenant audit-row insert, opened once on the dedicated database) instead of a synchronous clear-up after the
fact, removing the failure window structurally rather than racing to close it (C10 AC2a, cross-referenced from SD5's
ordering note and from C3 AC6, which previously described the same mechanism without mentioning it at all); the three
places that numbered these steps (SD5, C3 AC6, C10 AC2a) now use one consistent numbering throughout; and §3.4 R8's
reference table is corrected — `inspections.controller.ts:176` is inside the `membership(ctx)` helper's own
definition, not a call site (the real sites are `:56, :69, :100, :114, :129, :147, :165`), and `actorId(ctx)` moves
from the read-routes-to-migrate list to the confirmed-write list, since its five call sites are all on POST/PUT
routes. The PO does **not** treat this as closing the architecture gate: a `planner` delta-check pass must still
confirm Blocking A/B and the four small fixes actually work as specified in this codebase (new DoD bullet after
Amendment 6's delta-check line); the broader DoR #4 R1-R10 checklist is unchanged by this amendment and still needs
the architect's own verification.

**PO use-case sign-off: SIGNED (the PO's part of SCRUM.md Gate 1 only — Gate 1 itself is NOT complete: the D-C
design boards do not exist yet), 2026-09-30; reaffirmed after Amendment 3, again after Amendment 4 [AR], again
after Amendment 5 [AR2], 2026-09-30, again after Amendment 6 [AR3], 2026-10-01, and again after Amendment 7 [AR4],
2026-10-01.** **[AR]** Verified, not assumed: **13 stories** (C1-C12, CX) — C12 (the `support_viewer` principal) is
new; its use cases (all-plant reads, PO-SC10 readable and denied Settings sections, the 403 for any member-only path)
each map to C12 ACs, a §4 row, a D-C12 state and §6 entries. Earlier count: 12 stories (C1-C11, CX). Every use case — platform bootstrap and console
platform account management, sign-in / MFA / sessions / **[AM3] step-up re-auth**, commercial and content grants (4 h, reason,
reference for content, **[AM3]** rate limit + anomaly flag, expiry, end, deactivation), the read-only support view
of all tenant records with per-record **and [AM3] per-list-view** tenant/platform audit, **[AM3]** a DB-level
backstop on every content-scope read independent of the application check, plan administration incl. trial reset,
sales inbox and workspace requests, catalog and price-book editing with impact preview, the platform audit log with
own-activity and admin CSV export, and cross-plane / cross-tenant isolation — maps to at least one objectively
testable AC with a Web (`apps/platform`, and `apps/web` for C10) / Mobile / Shared split, a §4 backend row, a §5 design
gap (unchanged by Amendment 3, Amendment 5, Amendment 6 and Amendment 7 — no new screen was introduced by any of them;
Amendment 7 only amends ACs of C3/C10/SD5/SD12/SD13/§3.4 and adds no story) and a §6 dead-end entry (Amendment 5 adds
one: the "Refresh summary" route; Amendment 6 and Amendment 7 add none). No
AC depends on an unanswered question (§7 has none — Amendment 5's two PO decisions close the reviewer's R2 flag).
**[AM3]** Story count is unchanged (no new story; SR1-SR5 amend
existing stories C2, C3, C10 and §3). **[AR2]** Story count still unchanged after Amendment 5 (B1-B5 and the R1-R9
reference content amend existing stories C1-C3, C10, C12, CX and §3; no story added or removed). **[AR3]** Story count
still unchanged after Amendment 6 (D1, D2 and S1-S6 amend existing stories C3, C5, C6, C10, C12, CX and §3/§3.4; no
story added or removed). **[AR4]** Story count still unchanged after Amendment 7 (Blocking A, Blocking B and the four
small fixes amend existing stories C3, C10 and §3/§3.4 — no new story, and SPRINT-07's P5 AC2 gains a cross-reference
only).

**Definition of Ready — what remains before build (process gates, no decisions):**
1. **Gate 1 — design.** `ui-lead-designer` produces D-C1…D-C12 in `docs/design/` (no jsx exists for any of them;
   D-C12 is in the tenant app's visual language; **[AM3]** D-C4 additionally covers the step-up prompt for the
   content scope); the user approves them. **[AR2]** Separately, `DESIGN-07C-staff-console.md` needs a `ui-lead-designer`
   re-sync pass regardless of Gate 1 timing — it still names `apps/staff` and "C1-C11" and has no board or state for
   C12 or the D-C4 step-up flow; flagged here as a required follow-up, not fixed by this role (design-doc edits are
   not the PO's).
2. **Architecture review — [AR4] now a delta-check on Amendment 7 (Blocking A, Blocking B, four small fixes), not a
   full re-review of Amendment 6's fixes, per the reviewer's own framing.** `planner` reviews 07C together with `SPRINT-07-entitlements-onboarding.md` and returns
   SIGN OFF with the slice plan, the reader-role table denylist (C10 AC2 — **[AM3] including the column-level-secret
   check this amendment adds to that AC, [AR2] now finalized as the §3.4 R4 list**), the per-user route denylist (C10 AC4) and the list of GET routes with
   write side effects (C10 AC6).
3. **Security review — CLOSED (design level), 2026-09-30.** `security-reviewer` signed off §3 (SD1-SD12 [AM3/AR]) as
   **passing, conditionally**: all 4 prior findings (SR1 High, SR2-SR4 Medium) confirmed genuinely resolved, not
   merely asserted — `support_content_grant_active()`'s checks (tenant/scope/`ended_at`/`clock_timestamp() <
   expires_at`/platform-user status+role), the two RESTRICTIVE policies wired into `apply_tenant_rls()` (auto-
   inherited by future tables), step-up re-auth's single-use 5-minute token, the 5-grants/hour + 3-tenants/hour
   rate-limit/anomaly numbers, and list-view audit coverage of `/v1/query*`/`/v1/search`/graph-explorer routes were
   each independently verified against the actual spec text. The [AR] pipeline-separation and `support_viewer`
   additions were reviewed as new surface and found to be a net security improvement (narrower blast radius, no new
   static inter-process secret) with no unaddressed new risk. Two non-blocking follow-ups carried to Gate 2, not
   blocking build start: (a) no SLA/alert on stalled dedicated-tenant `support_grant_backstop` mirror propagation
   (a defense-in-depth degradation, not a live hole, since the app-layer check still reads `control.platform_users`
   directly); (b) the trial-reset DELETE guard trigger (C5 AC6) should use `clock_timestamp()` not `now()` for
   consistency with SR1's fix elsewhere (narrow, single-tenant, low-stakes). Also confirmed as correctly disclosed,
   not silently dropped: 3 pre-existing before-commit email sites (`auth.controller.ts:221,255`,
   `suppliers.controller.ts:186`) remain unfixed, out of this sprint's scope, logged as a Known issue. The code
   review already required by CX AC6 / Definition of Ready before Gate 2 still applies — this closes the pre-build
   design gate only, not the post-build one.
4. **[AR] Architecture re-review checklist** (the reviewer's theme 15, plus what the [AR] resolutions leave for the
   architect to confirm). **[AR2] The delta-check pass (Amendment 5) has since answered R1, R3, R4, R5, R6, R7, R8 and
   R9 as concrete, build-ready spec content (§3.4, and the ACs each cross-references) — they are listed below with
   their answer, not as open work; R2 was answered by the two PO decisions in Amendment 5. R10 remains the
   architect's own re-verification job, unchanged.** Each item is a named deliverable of the `planner` re-review; none
   is silently dropped, and items marked *PO* would come back to the PO only if the architect finds they need a
   product decision.
   - **R1 — Exhaustive route lists — ANSWERED.** Every `@RequireModule` route is SPRINT-07 P3 AC2's own list (built
     there, since it is that file's decorator); every `@PlatformRoute` / `@PlatformPublic` route with its capability
     is §3.4 R1's table above. The architect's job is to verify both lists against the controllers, not to produce
     them from scratch. §3.4 R1 also fixed the one dead-button gap it found (C4 AC2's "Refresh" route).
   - **R2 — Open-record definitions — ANSWERED (PO decisions, Amendment 5).** Risk's "open" = `active` or
     `monitoring`, not `accepted` (SPRINT-07 P4 AC5, this file's C3 AC3). FMEA / SPC / the portal have **no**
     open-record concept at all (deliberate scope boundary, not an oversight) and are excluded from C3 AC3's
     column-scoped grant accordingly. **[AR3, S5 — reworded; no longer a circular reference.]** The architect's
     remaining job is to **produce** the complete per-module "open" definition for every other module (SCAR, PPAP,
     ECN, MSA) from SPRINT-07 P4 AC5's illustrative starting points (ECN stage not terminal, MSA draft, SCAR open,
     PPAP not approved/rejected), verified against each module's actual status/stage column — that list is a
     slice-plan **input** the architect produces, not something "already produced elsewhere" to merely cite, and it
     feeds directly into 0079's column-grant list (C3 AC3); *PO* only if one of those remaining definitions turns out
     ambiguous.
   - **R3 — O5 checks — ANSWERED.** SPRINT-07 O5 AC2/O5 UC name the per-task index requirement and the one gap found:
     `inspection_templates` has no column identifying the seeded example, so its completion check uses
     `audit_events_entity_idx` to find the earliest qualifying record instead (fixed in SPRINT-07 O5). The architect's
     job is to confirm the index exists for every other task's completion query, which was already a stated
     requirement.
   - **R4 — `kaenal_support_reader` denylist — ANSWERED, finalized.** Table-level and column-level lists are §3.4 R4
     / C10 AC2 above (AM3's SR5 prerequisite is thereby discharged). The architect confirms the list is complete
     against the actual schema, not that it exists.
   - **R5 — Route denylists — ANSWERED.** (a) The per-platform-role denylist is §3.4 R1's table plus its stated
     consequence for `platform_support`/`platform_sales`; (b) the support-view per-user/secrets denylist and the
     `GET /v1/me` special case are §3.4 R5 / C10 AC4 / C12 AC4, with the `apps/web` shell requirement and C10 AC6's
     402-acceptance fix folded in there too.
   - **R6 — RESTRICTIVE function performance — ANSWERED (confirmed as intended design, not a question).** The InitPlan
     shape is confirmed intended (C10 AC2a); the `NULLIF` hygiene fix and the error-or-zero-rows test-acceptance rule
     are specified there. The architect's job is only to confirm the `EXPLAIN` output on a representative query, per
     the original ask.
   - **R7 — GET routes that write — ANSWERED, two more added.** `GET /v1/exports/:id` and `GET /v1/audit-log/export`
     join the enumeration (C12 AC6, §3.4 R7), both denied to support viewers; the `presignGet` TTL-parameter change
     C12 AC6's `min(60 s, …)` rule needs is named explicitly.
   - **R8 — The member-assuming call sites, scoped by grep pattern (not a fixed count) — ANSWERED. [AR3, S6; AR4
     citation fix]** The read-vs-write classification lists (which sites migrate, which per-user routes are denied,
     confirmation everything else is a write) are §3.4 R8 / C12 AC5, which now also folds in the previously-uncounted
     `inspections.controller.ts` local-helper family and the `query.controller.ts:68` → `:41`/`:86` correction.
     **[AR4]** A second citation in the same paragraph had the identical mistake S6 was meant to have already fixed:
     `inspections.controller.ts:176` was listed as a call site but is inside the `membership(ctx)` helper's own
     definition; corrected to the real call sites (`:56, :69, :100, :114, :129, :147, :165`), of which only the three
     GET-route ones migrate, and `actorId(ctx)` (five call sites, all on write routes) moves from
     read-routes-to-migrate to confirmed-write. The `AccessScope`-carries-a-resolved-plant-filter refactor these
     migrated sites need is C12 AC1/AC5. The architect verifies the lists are exhaustive against a fresh run of the
     named grep pattern on the actual codebase, not against any count fixed in this document.
   - **R9 — Process separation mechanics — ANSWERED.** The concrete deployment/tooling deliverables (`start:platform`,
     both new Dockerfiles, the `env.ts` split, the lint-zone rule's planted-violation fixture test) are CX AC1/AC8
     (§3.4 references CX). B4's shared-layer fix (SD13) and the two-router test's sequential-boot requirement are the
     mechanics answer to "how `platform-main.ts` is built, run and deployed alongside `main.ts`". The architect
     confirms these land in code as specified, not that a design exists.
   - **R10 — Re-verify AR1-AR29** against the original findings, including the PO's four stated deviations from the
     reviewer's literal wording (Amendment 4). **[AR2]** Unchanged by the delta-check pass — still the architect's own
     job, not answerable in the document.
