# SPRINT-07C — Staff Console (Sprint 07, Increment C)

Author: Product Owner. Date: 2026-09-30. Part of the **Sprint 07 release** in `ROADMAP.md` (row 07C), split out of
`SPRINT-07-entitlements-onboarding.md` by the PO under that file's Amendment 1. Governing rules: CLAUDE.md rules 0-12
and `SCRUM.md`. Builds on Sprints 01-06 (merged) and on **Increment A of Sprint 07** (catalog, price book, plans,
requests), which must be merged first. Migration range pre-assigned: **0078-0081** (0081 buffer). Sprint 08 starts
at 0082.

**Why this file exists.** On 2026-09-30 the user decided (U-D5): *build the real staff web console now, not the
audited-CLI-only interim plan.* The user named what it must do: list/search tenants; view/edit a tenant's plan and
entitlements; view/resolve plan requests; edit the pack catalog and the price book (U-D2, U-D3); manage the
industry and framework catalogs (U-D4). Kaenal has **no** concept of a platform-level user today — every identity is
a `control.users` row that acts only through a tenant membership, and every authenticated request runs inside one
tenant's scoped transaction. A staff console therefore needs a new identity, a new session path through the request
lifecycle, a new least-privilege database role and a new app. That is a different risk profile from Increments A/B
(auth and cross-tenant access), so it has its own file, its own design gate and a mandatory security review.

**It is not deferred.** 07C ships in the same release as 07 A/B. Request-mode tenants (the default for new tenants,
U-D1) can raise plan requests after A, but only this increment can fulfil them, so **A, B and C release together and
Sprint 08 cannot open until 07C closes** (ROADMAP §4).

**APPROVAL GATE (ROADMAP §0 Q2) + SECURITY REVIEW.** §3 is a security-relevant backend design with no spec-grade
precedent in this codebase beyond two sentences of the spec (01 §3.2, 07 §7, quoted in §1a). **No build starts
until ~~(1) the user approves §3 and answers §7's [USER] items,~~ ([AM2] done — see below) (2) the UI Lead Designer's
boards for §5 are approved, and (3) the `planner` architecture review and a `security-reviewer` pass both return
SIGN OFF.**

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
| PO-SC1 | Staff accounts: a bootstrap script creates the first staff admin; that admin creates/manages further staff **in the console** | PO (lead's instruction) | C1 (narrowed), **C11 (new)**, D-C11 |
| PO-SC2 | Production network restriction is an ops runbook item (host check + optional CIDR in code) | PO (standing rule) | §7, CX AC3 |
| PO-SC4 | Provisioning from the console → not built; `provision-tenant` stays the only provisioning path | PO (standing rule) | §7, C6 |
| PO-SC5 | WebAuthn not required; mandatory TOTP is the bar | PO (as recommended) | SD4, §7 |
| PO-SC6 | Staff may reset a tenant's **ended** trial of a pack (goodwill re-trial), mandatory reason, audited like a plan change | PO (lead's instruction) | C5 AC6, D-C6 |
| PO-SC8 | Every staff member can export **their own** action log as CSV; admins can export what they can already read | PO (lead's instruction) | C9 AC4-AC5, D-C10 |

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
| SR2 | No step-up re-authentication when opening a `content` grant — the highest-privilege action gated only by an hours-old session + free-text reason | Medium | New `POST /staff/v1/auth/step-up` (C2 AC5); required on `content`-scope grant creation only (C3 new AC, UC) |
| SR3 | No rate limit or anomaly detection on `content`-grant creation — unbounded blast radius from one phished-but-past-MFA credential | Medium | Per-staff rate limit (5/rolling hour) + a flagged `content_grant_anomaly` platform audit event at 3+ distinct tenants/rolling hour (PO-SC9; C3 new AC) |
| SR4 | List/aggregate reads under a `content` grant logged only route+status+grant id — no record-level reconstruction from list views | Medium | Platform audit event for list/search endpoints under a content grant also captures returned entity ids (capped at 200, with a truncation flag) (C10 AC5) |
| SR5 (flagged, not yet a defect) | The `kaenal_support_reader` denylist is correctly unfinished pending the architect (Definition of Ready), but a table-level denylist alone misses column-level secrets mixed into an otherwise-needed table | Prerequisite | Explicit requirement added to C10 AC2: the architect must also check for column-level secrets when finalizing the list |

New decision from this pass: **PO-SC9** (§7) — the two concrete numbers in SR3's fix (5 grants/hour, 3-tenant
anomaly threshold), decided by the PO under CLAUDE.md's standing rule (smallest reasonable choice, revisitable).

---

## 0. Research grounding — the patterns this increment borrows

| # | Pattern | Who does it (publicly documented; cited from general product knowledge of their public docs) | What Kaenal takes from it | Used in |
|---|---|---|---|---|
| RC1 | **A separate operator plane.** Vendor staff administer customers from a surface that is not the customer app: its own URL, its own staff accounts, its own audit. | GitHub Enterprise Server "site admin" (stafftools) dashboard; Atlassian and Salesforce internal admin tooling | A separate app (`apps/staff`) on a separate host, a staff identity that is never a tenant member, and a platform audit log | C1-C4, CX |
| RC2 | **Customer-visible, justified staff access.** Every vendor-staff access to customer data carries a justification and appears in a log the customer can read. | Google Cloud Access Transparency (staff access logged with a justification reason, visible to the customer); Salesforce "Grant login access" (time-boxed) | The spec already mandates this (07 §7): a **time-boxed support grant (4 h) with a reason**, written to the tenant's own audit log as "Kaenal support accessed …" | C3, C4 |
| RC3 | **Just-in-time, least-privilege access.** Access is granted per target, per purpose, expiring; the credential can touch only what the purpose needs. | JIT / break-glass access patterns in cloud IAM | A dedicated `kaenal_support` DB role (01 §3.2) with table/column grants limited to commercial data, RLS still enforced, plus an API-level grant check | C3 |
| RC4 | **Prices are immutable versions.** A price is never edited in place; a new version is published and old quotes keep pointing at theirs. | Stripe Prices (a Price's amount cannot be changed; you create a new Price); CPQ price books | Price-book **draft → publish → archive** (Sprint 07 P0 schema), edited here | C8 |
| RC5 | **Blast-radius preview before a global change.** A change that affects many customers shows who is affected before it applies and requires an explicit, reasoned confirm. | Feature-flag and IAM consoles (targeting previews, change reasons) | Catalog edits that alter any tenant's effective modules show the affected tenants and require `admin` + reason + typed confirmation | C7 |

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
| **Staff `support`** | Sign in (password + mandatory TOTP); tenant directory; open a tenant (commercial grant with reason) and read its plan, packs, trials, framework inclusions, profile, requests and history; read catalog and price book; **[AM2] open a `content` grant and use the read-only support view of the tenant's workspace (C10)**; own activity log + CSV export. No commercial writes |
| **Staff `sales`** | Everything `support` has **except content grants** [AM2] (least privilege: sales work needs no QMS records), plus: change a tenant's packs / bundle (incl. Enterprise), self-service flag, contract and CSM fields; **[AM2] reset an ended trial**; fulfil / decline plan requests; triage workspace requests |
| **Staff `admin`** | Everything `support` and `sales` have (incl. content grants), plus: edit the catalog (packs' display/trialability/module map, framework rules, industries, frameworks) and the price book (draft/publish); read and export the platform audit log; **[AM2] manage staff accounts (C11)** |
| **Tenant admin** (existing tenant role) | Sees every staff access and change in Settings → Audit log as "Kaenal support — <reason>" (07 §7 transparency) — **[AM2] including "opened read-only access to your workspace" and each record viewed** ("Kaenal support viewed NCR-0042"). Gains no new control |
| **Tenant members, partners, prospects** | Unaffected. No tenant session can reach any staff route and no staff session can reach any tenant route; **[AM2]** the only staff presence on a tenant host is a grant-bound, read-only support-view session (C10), which is not a member session and cannot act as one |

**Mobile.** No staff console on mobile (no design; an internal desktop tool). The mobile app is unaffected: the only
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
| **`CONTROL_POOL` is the migrator (superuser) connection** and is already a tracked Known issue ("more reach than the API needs … should be replaced before production"). The staff surface must **not** reuse it | `apps/api/src/app.module.ts:255-262`; `PROGRESS.md:3210-3216` |
| DB roles today: `kaenal_app` (API, no BYPASSRLS), `kaenal_public` (no tenant tables), migrator. RLS policy `tenant_isolation` has **no `TO` clause** (applies to every role), so a new role is isolated by the same policy automatically | `0000_foundation.sql:44-59,151-155` |
| **Audit already supports staff actors.** `audit_events.actor_kind` allows `support`; CHECK `actor_kind <> 'support' OR reason IS NOT NULL`; action `support_accessed` exists in the action CHECK; the web audit log already renders `support` as a source | `0001_core.sql:707,727`, `0015_audit_partitioning.sql:47-55`, `0061_audits_module.sql:73-81`, `apps/web/src/features/settings/sections/audit-log.tsx:50` |
| Reusable auth primitives: argon2id hashing (OWASP floor), TOTP secret encryption, lockout constants (`LOCKOUT_DURATION_MS` 15 min), Redis `RateLimiter`, constant-time compare | `apps/api/src/auth/passwords.ts`, `mfa-crypto.ts`, `packages/core/src/auth-policy.ts:15-37`, `apps/api/src/http/rate-limit.ts` |
| Dedicated (Model B) tenants: `TenantPoolManager.poolFor(tenantId, secretRef)` opens a pool from the tenant's **app** secret ref; there is no support-role credential for dedicated databases | `apps/api/src/tenant/pool-manager.ts:38-50` |
| `apps/web` is one Next.js app whose root layout wraps every route in `NextIntlClientProvider` + the app `Providers`, with the tenant shell in the `(app)` group layout, and proxies `/api/*` to the API for same-origin cookies; no middleware. `pnpm-workspace.yaml` includes `apps/*`, so a new `apps/staff` joins the workspace with no config change | `apps/web/src/app/layout.tsx:49-50`, `apps/web/src/app/(app)/layout.tsx`, `apps/web/next.config.*:35-37`, `pnpm-workspace.yaml` |
| **No design exists for any staff screen.** Grep of every `project_brain/project/src/*.jsx` and `project_brain/mobile/src/m-*.jsx` for `staff|operator|backoffice|superadmin|impersonat|support access|kaenal support` → only shop-floor "operator" strings (`operations.jsx:586`, `trust-center.jsx:37`, `settings-extra.jsx:556`, …) | grep, this session |
| Sprint 07 A provides what this increment edits: `control.catalog_*`, `control.framework_module_rules`, `control.price_book_*`, `control.tenant_plans`, `control.workspace_requests`, tenant `entitlements` / `entitlement_trials` / `plan_requests`, the `plan_request.changed` outbox event, and the `plan_request_resolved` notification kind | `SPRINT-07-entitlements-onboarding.md` §3.1, P0, P6 AC6 |

---

## 2. Stories

Order by dependency (INVEST): C1-C3 are the security foundation (identity, session path, access model) and ship
before any screen; C4 is the first screen; C5-C8 are the commercial capabilities the user named; C9 is
accountability; **[AM2] C10 is the user-decided content access (read-only support view) and C11 staff account
management**; CX is isolation and wiring. Every story states its Web / Mobile / Shared split: **Web** here means
`apps/staff` (the tenant web app `apps/web` is untouched unless stated), **Mobile** is always "unaffected" with the
reason, **Shared** is `packages/types` (staff contract, a separate entry point), `packages/core` (staff RBAC, pure
rules), API and migrations.

### C1 — Staff identity and bootstrap (Shared foundation)

**Design:** none (data + CLI); the account-setup page is D-C2.

UC
- Happy (bootstrap, [AM2] PO-SC1 — mirrors how `provision-tenant` / `seed-demo` bootstrap the tenant side): an
  engineer with migrator access runs `pnpm staff-bootstrap --email ana@kaenal.com --name "Ana"`; the script creates
  a staff **admin** in `pending_setup` and prints a **one-time setup link** (valid 24 h) and nothing else secret.
  Ana opens it on the staff host, sets a password (tenant password policy), enrols TOTP (QR + secret), saves 10
  recovery codes, and lands signed in. From then on Ana creates and manages every further staff account in the
  console (C11).
- Break-glass: when an active staff admin already exists, `staff-bootstrap` refuses unless `--reason "…"` is given
  (e.g. every admin lost their second factor); with a reason it creates one more admin and records the break-glass
  in the platform audit log. It has no other subcommands: create / role / deactivate / reactivate / reset live only
  in the console, so there is **one** staff-management write path (the lesson of the removed `tenant-plan` CLI).
- Error: duplicate email → exit 1; an active admin exists and no `--reason` → exit 1 before touching the DB; an
  expired or used setup link → "This link has expired — ask a Kaenal admin for a new one" (no detail about whether
  the account exists).
- Separation: a staff email may also exist in `control.users` (a Kaenal employee who is also a demo-tenant member);
  the two identities never share a credential, session or MFA secret, and neither can become the other.
- Permission: the migrator-role script creates staff admins (bootstrap / break-glass); everything else is
  `staff:staff:manage` in the console (C11).

AC
1. Migration `0078_staff_identity.sql`: `control.staff_users` (`id` uuidv7, `email citext UNIQUE` ≤ 254,
   `display_name` ≤ 80, `role` CHECK `support|sales|admin`, `status` CHECK `pending_setup|active|deactivated`,
   `password_hash` NULL until setup, `mfa_secret_enc` NULL until setup, `mfa_enabled_at`, `failed_attempts int`,
   `locked_until`, `last_sign_in_at`, `lock_version`, `created_at`, `updated_at`); `control.staff_setup_tokens`
   (`token_hash` PK, `staff_user_id`, `purpose` `setup|reset`, `expires_at`, `used_at`);
   `control.staff_mfa_recovery_codes` (hashed, single-use). No tenant table references a staff id by FK.
2. `CHECK (status <> 'active' OR (password_hash IS NOT NULL AND mfa_enabled_at IS NOT NULL))` — an active staff
   account without MFA is impossible at the database level (07 §7 spirit; MFA mandatory for staff, §3 SD4).
3. **[AM2]** `packages/db/scripts/staff-bootstrap.ts` + `package.json` script `staff-bootstrap` (`--email`, `--name`,
   `--reason` required when an active admin exists), writing the creation (and, for break-glass, the reason) to
   `control.staff_audit_events` (C3) in the same transaction as the row; setup tokens stored hashed (the raw token
   only ever printed once). The earlier `staff-user create|list|set-role|deactivate|reactivate|reset` CLI is
   **not built** — those operations are C11.
4. Setup routes (staff host only, C2's lifecycle branch, no session required): `GET /staff/v1/setup/:token`
   (validity only), `POST /staff/v1/setup/:token/password`, `POST /staff/v1/setup/:token/mfa/enrol`, `POST
   /staff/v1/setup/:token/mfa/activate` (returns recovery codes once, marks the token used, sets `active`, starts a
   session). Reuses `passwords.ts` and `mfa-crypto.ts`; rate-limited per IP.
5. Tests: bootstrap → setup → active; bootstrap refused without `--reason` while an active admin exists, accepted
   and audited with one; the MFA CHECK rejects a hand-written activation without MFA; token single-use and expiry;
   a `control.users` row with the same email is unaffected by every staff operation and vice versa; grant test:
   `kaenal_app` and `kaenal_public` cannot SELECT any `control.staff_*` table.

Web (`apps/staff`): the setup page (D-C2). Mobile: unaffected (no staff surface on mobile). Shared: migration, CLI,
setup routes, Zod bodies in the staff contract.

Backend: migration 0078; bootstrap script; setup routes; audit → platform audit (C3); RBAC n/a (pre-session);
tenancy: control plane only, touches no tenant table.

### C2 — Staff authentication, sessions and the staff branch of the request lifecycle (Shared foundation)

**Design:** staff sign-in, TOTP step, lockout, expired-session states (D-C1).

UC
- Happy: on `https://staff.<root-domain>/sign-in` Ana enters email + password → TOTP code (or a recovery code) →
  lands on the tenant directory. Session: **idle 30 min, absolute 8 h** (§3 SD3), then back to sign-in with
  "Your session expired" and her target URL preserved.
- Happy: Sign out revokes the session server-side and clears the cookies.
- Error: wrong password / wrong code → one generic message ("Email, password or code is incorrect"); 5 failures →
  locked 15 min (tenant lockout constants), same generic message plus the lockout notice; per-IP rate limit on the
  credential routes → 429 with `Retry-After`; deactivated account → the same generic failure (no account-state
  leak).
- Isolation: a tenant `kaenal_session` cookie or bearer token sent to a staff route → 401; a staff cookie sent to a
  tenant route → ignored by the tenant authenticator → 401; any `/staff/v1/*` request whose `Host` is not the
  configured staff host → **404** (the route does not exist on tenant hosts); optionally, a request from outside
  `STAFF_ALLOWED_CIDRS` (when set) → 404.
- Offline: the console is online-only; network failure shows the inline retry card, never a stale write.

AC
1. `0078` adds `control.staff_sessions` (`id`, `token_hash` UNIQUE, `staff_user_id`, `created_at`, `last_seen_at`,
   `idle_expires_at`, `absolute_expires_at`, `revoked_at`, `ip inet`, `user_agent`) and **[AM3]** `control.
   staff_step_up_tokens` (`token_hash` PK, `staff_user_id`, `expires_at` = issue + 5 min, `used_at`) — the re-auth
   artifact `POST /staff/v1/auth/step-up` issues (AC5) and `content`-scope grant creation (C3) consumes — and the DB
   role **`kaenal_staff`** (LOGIN; no BYPASSRLS; `USAGE` on `control`; SELECT/INSERT/UPDATE on `control.staff_*`
   (no DELETE); SELECT on `control.tenants`; the commercial control-plane write grants of C5-C8). New env
   `DATABASE_STAFF_URL` (+ `.env.example`), a dedicated `STAFF_POOL` provider. **The staff surface never uses
   `CONTROL_POOL`** (the migrator superuser, a tracked Known issue).
2. **Lifecycle:** a new `@Staff(capability?)` class/method decorator. `RequestLifecycleInterceptor` gains a
   branch evaluated right after the `@Public` check and **before** tenant resolution: (1) host must equal
   `STAFF_HOST` else 404; (2) optional CIDR allowlist else 404; (3) `StaffAuthenticator` resolves
   `kaenal_staff_session` (cookie only; bearer refused) through `STAFF_POOL`, enforces idle/absolute expiry and
   slides `idle_expires_at`, and enforces CSRF double-submit (`kaenal_staff_csrf` / `x-staff-csrf-token`) on
   unsafe methods; (4) staff RBAC (C3); (5) the handler runs in `runWithStaffContext({ staffUserId, role,
   requestId, ip, userAgent, tx })` with a **control-plane transaction on `STAFF_POOL` — no `app.tenant_id`**.
   Tenant data is reachable only through C3's `SupportAccess.withTenant(...)`. It is still ONE interceptor (a
   settled architecture decision); the staff branch never falls through to the tenant branch and vice versa.
3. Default-deny holds for both planes: a controller under `apps/api/src/staff/**` without `@Staff` fails a guard
   test; a controller outside it with `@Staff` fails the same test; a staff route reached with only a tenant
   session → 401; a tenant route reached with only a staff session → 401.
4. Cookies: `kaenal_staff_session` (httpOnly, `Secure` in production, `SameSite=Strict`, **host-only** — no
   `Domain` attribute, so it is never sent to tenant subdomains) and `kaenal_staff_csrf`. Distinct names from the
   tenant cookies so neither authenticator can ever read the other's token.
5. Routes: `POST /staff/v1/auth/sign-in` (email + password → `mfa_required` challenge token, 5-min TTL), `POST
   /staff/v1/auth/mfa` (TOTP or recovery code → session), `POST /staff/v1/auth/sign-out`, `GET /staff/v1/me`
   (`{ id, name, email, role, capabilities }`), `GET /staff/v1/me/sessions`, `POST /staff/v1/me/sessions/:id/
   revoke`, **[AM3]** `POST /staff/v1/auth/step-up` (body `{ password }` or `{ code }`; the caller's existing
   session must already be active — this re-proves the second factor, it does not sign in) → a single-use
   `stepUpToken` valid 5 minutes, scoped to the calling staff member; wrong password/code → the same generic
   sign-in failure message and counts toward the same lockout counter (C2 AC's existing 5-failure lockout applies
   here too, so step-up cannot be used to brute-force TOTP separately from sign-in). Its only consumer this sprint
   is `content`-scope grant creation (C3). Sign-in success/failure, sign-out and step-up success/failure write
   platform audit events (C3).
6. The staff contract is a **separate ts-rest contract** `packages/types/src/staff/contract.ts`, exported only from
   the `@kaenal/types/staff` entry point, with its own OpenAPI document served only on the staff host. The tenant
   OpenAPI document and `packages/types/src/contract.ts` gain nothing.
7. Tests: sign-in happy path (password → TOTP → session); generic failures; lockout at 5; rate limit; idle expiry at
   30 min and absolute at 8 h (clock helper); CSRF required on unsafe methods; host check 404; CIDR 404 when
   configured; cross-plane cookie/bearer isolation both ways; deactivation revokes a live session on its next
   request. **[AM3]** step-up: correct password or TOTP issues a token; wrong credential → generic failure and
   counts toward lockout; the token is single-use (a second use → 422), expires at 5 min, and is rejected if
   presented by a different staff member than the one who requested it. **The tenant sign-in is re-proved end to
   end (201) for `demo@acme.test`** — the interceptor is shared (rule 12).

Web (`apps/staff`): sign-in, TOTP, expired/locked states, sign-out, "My sessions" in the account menu (D-C1).
Mobile: unaffected (the tenant bearer path is unchanged; proved by its tests). Shared: migration, interceptor
branch, staff authenticator, staff contract entry point.

Backend: migration 0078; routes above; audit → platform audit; RBAC → C3; tenancy: no tenant scope on this path by
construction.

### C3 — Staff RBAC, support-access grants, least-privilege support role, platform audit log (Shared foundation)

**Design:** the access-reason dialog, grant banner/countdown and expiry states (D-C4).

UC
- Happy: Ana (`sales`) opens tenant "Acme" → dialog "Why are you accessing Acme?" (reason ≥ 10 chars, optional
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
  <reason> (<reference>) — until <time>" and is used through the support view (C10). A staff member may hold one
  grant of each scope for the same tenant at once; each has its own 4 h clock and reason.
- **[AM3] Step-up for content access.** Choosing *Workspace content (read-only)* requires a fresh re-auth first: Ana
  gets a `stepUpToken` from `POST /staff/v1/auth/step-up` (current password or a new TOTP code, C2 AC5) and it
  travels with the grant-creation call. This mirrors 07-SECURITY-COMPLIANCE.md §2's e-signature step-up principle,
  applied to the single highest-privilege action in the console; a `commercial` grant never asks for it — it
  exposes no tenant content, so the existing session is enough.
- **[AM3] Throttled and watched.** `content`-grant creation is rate-limited per staff member, and opening grants
  across several tenants in a short window is flagged in the platform audit log for an admin to find (PO-SC9) — a
  single phished-but-past-MFA credential cannot quietly walk every tenant.
- Least privilege: a **commercial** grant reaches only commercial data — entitlements, trials, plan requests, the
  profile / onboarding / billing settings documents, tenant plan, counts — through `kaenal_support`, which cannot
  read QMS content. A **content** grant reaches every tenant record **read-only** through a separate role
  (`kaenal_support_reader`, C10) that has no write privilege on any tenant table except its own audit rows. Neither
  path can reach the other's privileges.
- Permission: commercial grants — any staff role (`support` reads only); **content grants —
  `staff:tenant:content` (`support`, `admin`; not `sales`)** [AM2]; writes per the capability matrix (§3 SD2).
- Cross-tenant: a grant is for exactly one tenant; a request carrying tenant B while holding a grant for A → 404.

AC
1. `packages/core/src/staff-rbac.ts`: `StaffRole` (`support|sales|admin`), `StaffCapability` and the matrix of §3
   SD2, `authorizeStaff(role, capability)`; unit-tested exhaustively (every role × capability), including "no
   staff capability is ever returned by tenant `authorize`" and vice versa.
2. Migration `0079_support_access.sql`: `control.support_grants` (`id`, `staff_user_id`, `tenant_id`, `reason`
   ≥ 10 chars, `reference` ≤ 120, `scope` CHECK `commercial` | `content` ([AM2]; CHECK `scope <> 'content' OR
   reference IS NOT NULL`), `granted_at`,
   `expires_at = granted_at + interval '4 hours'` (CHECK), `ended_at`), and `control.staff_audit_events`
   (append-only: `kaenal_staff` has INSERT + SELECT only; a trigger rejects UPDATE/DELETE even for owners except
   the migrator's partition maintenance; columns: `id`, `staff_user_id` NULL for CLI/system, `actor_label`,
   `action`, `tenant_id` NULL, `grant_id` NULL, `target_kind`, `target_id`, `before`, `after`, `reason`,
   `request_id`, `ip`, `user_agent`, `created_at`, `outcome` `ok|failed`).
3. `0079` creates DB role **`kaenal_support`** (LOGIN, no BYPASSRLS) for tenant-plane access, with **only**:
   SELECT/INSERT/UPDATE on `entitlements`; SELECT **and DELETE** on `entitlement_trials` ([AM2] trial reset, C5
   AC6; a trigger rejects deleting a row whose `ends_at > now()`); SELECT and UPDATE(`status`,
   `resolved_at`, `resolution_note`, `lock_version`) on `plan_requests`; SELECT on `tenant_settings` plus a
   **RESTRICTIVE** policy `TO kaenal_support USING (namespace IN ('profile','onboarding','billing'))`; column
   SELECT on the id/tenant/status columns needed for counts (`memberships`, `plants`, `suppliers`, inspector
   roles) — never a name, email or content column; INSERT on `audit_events` and `outbox`. The existing permissive
   `tenant_isolation` policy (no `TO` clause) applies to it unchanged, so RLS is never bypassed (01 §3.2).
4. A trigger on `audit_events` rejects any row inserted by `current_user = 'kaenal_support'` unless `actor_kind =
   'support'` and `reason = current_setting('app.support_reason')` — the DB proves every support write is
   attributed and justified, not just the service.
5. `SupportAccess.withTenant(grantId, fn)` is the **only** way staff code reaches tenant data: it verifies the grant
   (same staff user, not expired, not ended), resolves the tenant's pool (shared → `DATABASE_SUPPORT_URL`;
   dedicated → a **support secret ref** per dedicated tenant, §3 SD6), opens a transaction with
   `app.tenant_id`, `app.support_reason` and `app.staff_user_id` via `set_config(..., true)` (SET LOCAL), and after
   commit publishes the tenant realtime signal(s) the audit observer buffered (same after-commit rule as the
   tenant lifecycle). A guard test fails if any file under `apps/api/src/staff/**` imports `withTenant`,
   `appPool` or `CONTROL_POOL` directly.
6. Grant creation writes, atomically in the tenant tx, a tenant `audit_events` row (`actor_kind='support'`,
   `action='support_accessed'`, `entity_kind='tenant'`, `reason`) and, in the control tx, a platform audit event;
   the ordering rule of §3 SD5 guarantees no tenant change can exist without a platform record.
7. Routes: `POST /staff/v1/tenants/:tenantId/grants` (body `scope`, reason, reference, **[AM3]** `stepUpToken`
   required when `scope='content'`; `staff:tenant:access` for `commercial`, **`staff:tenant:content` for
   `content`** [AM2]; content without reference → 422), `POST /staff/v1/grants/:id/end`, `GET /staff/v1/me/grants`
   (active grants, with scope). `SupportAccess.withTenant` accepts only a `commercial` grant (a content grant there
   → 403); the content path is C10's.
8. **[AM3] Step-up re-auth for content-scope grants (SR2).** `POST /staff/v1/tenants/:tenantId/grants` with
   `scope: 'content'` requires a `stepUpToken` (from C2 AC5's `POST /staff/v1/auth/step-up`) in the body: valid,
   unexpired (5 min), unused, and issued to the same `staff_user_id` making this call. Missing, expired, reused or
   staff-mismatched → 422 `STEP_UP_REQUIRED`, and the grant is not created. The token is consumed (marked `used_at`)
   in the same transaction as the grant row, so it cannot be replayed for a second grant. `commercial`-scope
   creation never checks for or consumes a `stepUpToken`.
9. **[AM3] Rate limit and anomaly signal on content-grant creation (SR3, PO-SC9).** A per-staff-member Redis
   `RateLimiter` (the same primitive C2's sign-in lockout uses) caps `content`-scope grant creation at **5 per
   rolling hour**; the 6th attempt in the window → 429 with `Retry-After` (chosen because a legitimate support case
   rarely needs more than one or two tenants open at once, while 5/hour still covers a genuinely busy shift without
   making a fast sweep across many tenants practical). Independently of the rate limit, when a staff member's
   `content` grants opened in the trailing rolling hour span **3 or more distinct tenants**, the grant-creation
   write also inserts a platform audit event `content_grant_anomaly` (`staff_user_id`, the distinct tenant ids and
   count, the window) in the same control transaction as the grant — fired once, on the write that crosses the
   threshold, not on every subsequent grant in the same window. C9's platform audit log surfaces it via a
   **Flagged** filter/badge (D-C10) so an admin can find it without reading every row. A push/email alert to staff
   admins is a future enhancement, not built this sprint (→ Known issues); a flagged, queryable audit event is the
   minimum this finding requires.
10. Tests: grant happy path + tenant audit row visible via the tenant `GET /v1/audit…` as "support"; expiry at 4 h
    (clock helper); ended grant refuses; wrong staff user refuses; tenant mismatch → 404; `kaenal_support` **cannot**
    SELECT `ncrs`, `documents`, `suppliers.name`, `control.users.email` or any tenant_settings namespace outside the
    three (explicit grant tests, and a mutation test: widening the RESTRICTIVE policy makes a test fail); the audit
    trigger rejects a support-role insert with a missing/mismatched reason; RLS still isolates `kaenal_support`
    across tenants (`test:rls` extended with this role). **[AM2]** Plus: `sales` → 403 on a content grant; content
    grant without reference → 422; a content grant cannot be used for a commercial write (and vice versa: a
    commercial grant cannot open the support view). **[AM3]** Plus: content-grant creation without a `stepUpToken`,
    with an expired one, a reused one, or one issued to a different staff member → 422 `STEP_UP_REQUIRED` (and is
    never required for `commercial`); a 6th content grant inside the rolling hour → 429; the write that opens the
    3rd distinct tenant within the rolling hour (and only that write) inserts one `content_grant_anomaly` event,
    visible via the Flagged filter.

Web (`apps/staff`): access dialog (**[AM3]** incl. the step-up prompt for the content scope), grant banner/countdown,
expiry state, **[AM3]** the audit log's Flagged filter/badge (C9/D-C10) surfacing `content_grant_anomaly`. Mobile:
unaffected. Shared: migration, core RBAC, `SupportAccess`, platform audit writer. **Tenant web (`apps/web`):** no
code change for commercial grants — Sprint 07 X1 AC4 already renders support events ("Kaenal support — <reason>");
the content scope's tenant-web changes are C10's.

Backend: migration 0079; routes above; audit: tenant `support_accessed` + platform events (incl. **[AM3]**
`content_grant_anomaly`); RBAC matrix; tenancy: RLS enforced for the support role, restrictive namespace policy,
column-level grants. **[AM3]** Plus: the step-up route (C2, `control.staff_step_up_tokens` in 0078) and a Redis
rate limiter for content-grant creation.

### C4 — `apps/staff` shell, tenant directory and tenant detail (read)

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
- **[AM2]** The detail header carries **View workspace (read-only)** for holders of `staff:tenant:content`: it opens
  the content-scope access dialog (or reuses an active content grant) and then the support view (C10) in a new tab.
  Hidden for `sales` (never a button that would 403).
- Empty: no tenants match → empty state with "Clear filters". Loading: skeleton rows. Error: inline retry card with
  requestId.
- Permission: every staff role sees directory and detail (read). Write controls on Plan/Requests render only for
  roles holding the capability (never a button that would 403).
- Deleted/offboarding tenants: listed with their status; detail read-only; no writes offered (§7 Q-SC9).

AC
1. New app **`apps/staff`** (Next.js App Router, Tailwind, TanStack Query/Table, the same stack as `apps/web`),
   importing `packages/types` (staff entry point), `packages/core` and the tokens from
   `project_brain/project/styles/tokens.css` via the same token pipeline as `apps/web`. It **does not** import
   anything from `apps/web` (lint rule) and `apps/web` does not import the staff entry points (lint rule,
   `no-restricted-imports`). Dev: `pnpm --filter @kaenal/staff dev` on :3002, proxying `/staff-api/*` to the API
   with `Host` set to `STAFF_HOST`. Justification in §3 SD1.
2. `GET /staff/v1/tenants?q=&status=&tier=&mode=&hasOpenRequests=&framework=&cursor=` (`staff:tenants:read`;
   cursor-paginated, rule 6) reads `control.tenants` + `control.tenant_plans` + `control.sales_inbox` counts +
   a control-plane **tenant summary** (`control.tenant_commercial_summary`: tier, declared framework keys,
   effective packs, refreshed from Sprint 07's `tenant_commercial.changed` outbox event (Sprint 07 X1 AC8) — no
   tenant-scoped read needed to list). A summary older than its last event is corrected on the next event; a
   "Refresh" action on a tenant row re-derives it inside a grant.
3. `GET /staff/v1/tenants/:id` (grant required, via `SupportAccess.withTenant`) → `StaffTenantDetailDto` (plan,
   packs, trials, `modules` with reasons, contract, CSM, profile, declaration history, counts, open requests).
   `GET /staff/v1/tenants/:id/history?cursor=` (grant; cursor). Foreign/unknown id → 404.
4. Directory and detail views are platform-audited (`tenant_viewed` with the grant id), so "who looked at Acme" is
   answerable — but viewing writes nothing to the tenant (only the grant did).
5. Playwright (staff): sign in → search "acme" → open → reason dialog → Plan tab shows the same effective modules as
   the tenant's `/v1/entitlements`; a `support` user sees no write controls.

Web (`apps/staff`): shell (nav: Tenants, Sales inbox, Workspace requests, Catalog, Price book, Audit log;
header with staff name/role, environment badge, account menu), directory, detail tabs. Mobile: unaffected. Shared:
routes, DTOs in the staff contract, `control.tenant_commercial_summary` (migration 0080) and its outbox-fed
projector.

Backend: migration 0080 (summary + inbox projection); routes above; platform audit `tenant_viewed`; RBAC
`staff:tenants:read`, `staff:tenant:access`; tenancy: directory from control plane only, detail only through a
grant.

### C5 — Tenant plan administration (packs, bundle, self-service, contract, CSM)

**Design:** Plan-tab edit states and the change-reason confirm (D-C5, D-C6). Replaces the removed `pnpm
tenant-plan` flags `--bundle`, `--pack`, `--self-service`, `--contract-*`, `--csm-*`.

UC
- Happy (`sales`): inside a grant, toggle a pack on/off, apply a bundle (**including Enterprise**, which tenants can
  never self-apply), switch self-service on/off, set contract renewal / annual value / currency, set CSM name /
  email / booking URL / chat URL. Each change opens a confirm with a **change reason** and a diff ("QE: off → on;
  effective modules +Risk, +ECN"); on confirm it applies, the tenant's open browsers update without reload
  (realtime `entitlements`), and the tenant audit log shows "Kaenal support — Order form #1042".
- Downgrade: turning off a pack that would lock modules shows the same open-record impact the tenant admin sees
  (Sprint 07 P4 AC5, computed inside the grant) and requires the reason.
- Fully covered pack (framework inclusions cover every module): the toggle is still available to staff (a
  contract may include it) but the diff states "no effective change".
- **[AM2] Trial reset (PO-SC6).** A pack row whose trial has **ended** shows "Trial used · ended <date>" and a
  **Reset trial** action: confirm with a mandatory reason (e.g. "Goodwill re-trial after onboarding delay, ticket
  #881") → the tenant's trial record for that pack is removed, the tenant admin can start a new 14-day trial from
  `/pricing` (Sprint 07 P5 AC5), and both audit logs record it. A running trial shows no Reset (409 if forced); an
  extension is not offered (Sprint 07 D4).
- Error: 409 stale (someone else changed it) → reload-and-reapply dialog; invalid URL (non-https CSM link) →
  inline error; expired grant → expiry state (C3).
- Permission: `staff:plans:write` (`sales`, `admin`); `support` sees read-only.

AC
1. Routes (all `staff:plans:write`, grant required, `lockVersion`/expected-state on every write, body `reason`
   ≥ 5 chars): `PUT /staff/v1/tenants/:id/packs/:packId` `{ active }`, `POST /staff/v1/tenants/:id/apply-bundle`
   `{ tier: core|pro|ent, expectedPacks }`, `PUT /staff/v1/tenants/:id/plan` `{ selfService?, contract?, csm? }`,
   **[AM2]** `POST /staff/v1/tenants/:id/trials/:packId/reset` `{ reason, expectedEndsAt }` (AC6).
2. Tenant rows (`entitlements`) are written through `SupportAccess.withTenant` with `source='operator'` and one
   `entitlement_changed` event per changed row (`actor_kind='support'`, reason) in the same tx (rule 3); the
   `control.tenant_plans` row is written in the control tx with `updated_reason`, `updated_by_staff` and a platform
   audit event. Ordering per §3 SD5.
3. Any activation auto-fulfils the tenant's open `member_access` requests for that pack (Sprint 07 P6 rule) and
   sends `plan_request_resolved` to those requesters.
4. Realtime `entitlements` signal published to the tenant after commit (C3 AC5); the tenant-side overlay lifts
   without reload (proved in Playwright against `apps/web`).
5. Tests: each write + its two audit records; reason required (422 without); 409 on stale `lockVersion` /
   `expectedPacks`; Enterprise bundle applies; self-service switch changes the tenant's `/pricing` behaviour on the
   next request; dedicated-tenant path via the support secret ref (router fake); `support` role → 403.
6. **[AM2] Trial reset.** The route deletes the tenant's `entitlement_trials` row for the pack through
   `SupportAccess.withTenant` (commercial grant, `staff:plans:write`) only when `ends_at <= now()` and `ends_at =
   expectedEndsAt` (else 409 `TRIAL_ACTIVE` / `STALE_WRITE`; the DB trigger of C3 AC3 is the backstop); writes one
   tenant `entitlement_changed` event `{ before: { trial: { startedAt, endsAt } }, after: { trial: null, reason:
   'trial_reset' } }` (`actor_kind='support'`, reason) in the same tenant tx and a platform event (SD5 ordering);
   emits the tenant realtime `entitlements` signal and the Sprint 07 `tenant_commercial.changed` outbox event. No
   new notification kind (the tenant sees "Start 14-day trial" again on `/pricing`). Tests: reset of an ended trial
   → tenant can start one more trial → a second reset is possible only after that one ends; running trial → 409;
   reason missing → 422; `support` → 403; both audit records present.

Web (`apps/staff`): Plan-tab edit controls and confirm dialogs. **Tenant web:** no change (it already reacts to the
realtime event and renders support audit events). Mobile: unaffected (nothing mobile uses is gated). Shared:
routes, `StaffPlanService` (the one operator write path), resolver reuse.

Backend: no new migration (grants in 0080); routes above; audit: tenant `entitlement_changed` (support) +
platform; RBAC `staff:plans:write`; tenancy: via grant, RLS enforced.

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
- Permission: list — every staff role; resolve and triage — `staff:requests:resolve` / `staff:workspace_requests:
  manage` (`sales`, `admin`).

AC
1. `0080` adds `control.sales_inbox` (PK `(tenant_id, request_id)`, `kind`, `status`, `pack_id`, `tier`, `note`,
   `requester_name`, `requester_email`, `created_at`, `updated_at`) and an idempotent outbox consumer that upserts
   it from `plan_request.changed` (Sprint 07 P6 AC6), tolerant of out-of-order delivery (last `updated_at` wins).
   Grants: `kaenal_staff` SELECT; the consumer's role INSERT/UPDATE; `kaenal_app` none.
2. Routes: `GET /staff/v1/sales-inbox?status=&kind=&cursor=` (`staff:tenants:read`), `POST
   /staff/v1/tenants/:id/requests/:requestId/fulfil` and `…/decline` (`staff:requests:resolve`, grant, reason /
   resolution note, `lockVersion`) — state machine `open → fulfilled|declined`, non-open → 409
   `INVALID_TRANSITION`; `GET /staff/v1/workspace-requests?status=&cursor=`, `POST /staff/v1/workspace-requests/
   :id/decline|spam` (`staff:workspace_requests:manage`, reason; `kaenal_staff` SELECT + UPDATE(`status`) on
   `control.workspace_requests`).
3. Fulfil applies the change through `StaffPlanService` (C5) in the same tenant tx as the status change; audit
   `status_changed` + `entitlement_changed` (support, reason) + platform event; notification `plan_request_resolved`
   (kind defined in Sprint 07) enqueued in the same tx.
4. Tests: projection idempotence and ordering; fulfil applies exactly the requested change and nothing else; decline
   notifies with the reason; withdrawn-meanwhile → 409; workspace-request status transitions; `support` role → 403
   on resolve; the Sprint 07 journey "request mode (`globex`) → sales email → staff fulfils → tenant unlocks without
   reload" passes end to end.

Web (`apps/staff`): inbox, resolve dialog, workspace-request list. **Tenant web:** unchanged (Sprint 07 renders
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
  summary: "3 tenants gain FMEA; 12 tenants lose ECN" with both lists; applying requires `admin`, a reason and
  typing the number of tenants that lose access. Open-record counts are **not** computed across tenants (that would
  read tenant data without a grant); staff open an affected tenant with a grant to see its impact. Pure display edits apply with a reason and no preview.
- Guard rails: mapping a `CORE_FLOOR_GUARANTEED` module to a pack → 422 with the reason (Sprint 07 P0 AC3); a rule
  referencing an unknown module → 422; deleting anything → not offered (retire instead).
- Propagation: the tenant API enforces the edit on the next request (catalog version, Sprint 07 §3.2); tenant
  browsers pick it up on their next catalog/entitlements refetch; the public request form on its next load.
- Error: 409 when another admin edited the same row (`lock_version`) → reload-and-reapply.
- Permission: read — every staff role; write — `staff:catalog:write` (`admin`).

AC
1. Routes (`staff:catalog:write` for writes, `staff:catalog:read` for reads; `lockVersion` + `reason` on every
   write): `GET /staff/v1/catalog`, `PUT /staff/v1/catalog/packs/:packId`, `PUT /staff/v1/catalog/pack-modules/
   :moduleId` `{ packId | null }`, `POST /staff/v1/catalog/frameworks`, `PUT /staff/v1/catalog/frameworks/:key`,
   `POST /staff/v1/catalog/industries`, `PUT /staff/v1/catalog/industries/:key`, `PUT /staff/v1/catalog/
   framework-rules/:frameworkKey/:moduleId` `{ level | null, clause, note }`, `POST /staff/v1/catalog/
   impact-preview` (body = the proposed change; returns gained/lost tenants with open-record counts).
2. Validation reuses `validateCatalog` (Sprint 07 P0 AC3) on the proposed catalog before writing; keys match
   `CatalogKey`; `0080` grants `kaenal_staff` INSERT/UPDATE (never DELETE) on the catalog tables; every write bumps
   `catalog_meta.version` (trigger from 0073) and writes a platform audit event with before/after in the same tx.
3. The impact preview evaluates `effectiveModules` for each tenant from `control.tenant_commercial_summary` (C4 AC2
   — declared frameworks + effective packs), so it needs no per-tenant grant and reads no tenant database; it
   returns the gained/lost tenant lists only (no cross-tenant record counts, by design — SD7).
4. Tests: each editor write + audit; floor-guaranteed guard; typed-count confirm enforced server-side (`confirm`
   field must equal the lost-tenant count); a rule change makes a test tenant's module effective/gated on its next
   tenant API request; a new framework/industry appears in `GET /v1/public/onboarding-catalog`; retire keeps
   existing tenants' inclusions (Sprint 07 D2).

Web (`apps/staff`): Catalog section with tabs Packs, Frameworks & rules, Industries (D-C8). Tenant web: no code
change (it reads the catalog). Mobile: unaffected. Shared: routes, catalog write service, impact preview.

Backend: grants in 0080; routes above; platform audit; RBAC `staff:catalog:*`; tenancy: control plane; the
preview never reads tenant content.

### C8 — Price book editor (draft → publish → archive)

**Design:** price-book screens (D-C9). Implements U-D3.

UC
- Happy: `admin` clicks "New draft" (copies the published version), edits item amounts / labels / included units
  (e.g. QE $450 → $500), previews the estimate for a sample org profile and for a chosen real tenant's composition
  (from the summary table, no grant needed — composition only), and **Publishes** with a note; the previous
  published version becomes archived; tenant `/pricing`, estimates and new quotes use the new version on their next
  fetch; old quotes keep citing theirs.
- Draft hygiene: at most one draft at a time; "Discard draft" deletes only a draft; published and archived
  versions are read-only.
- Error: publishing a draft that fails validation (missing `core_base` or a pack item; negative amount) → 422 with
  the list; concurrent publish → 409.
- Permission: read — every staff role; draft/publish — `staff:pricebook:write` (`admin`).

AC
1. Routes: `GET /staff/v1/price-book/versions` (cursor), `GET /staff/v1/price-book/versions/:id`, `POST
   /staff/v1/price-book/drafts` (copy of published), `PUT /staff/v1/price-book/drafts/:id/items/:itemKey`,
   `DELETE /staff/v1/price-book/drafts/:id` (draft only; the only DELETE grant, on draft rows, enforced by a
   policy/trigger), `POST /staff/v1/price-book/drafts/:id/publish` `{ note, reason }`, `POST
   /staff/v1/price-book/preview` `{ versionId, composition }` → `estimateMonthly` output.
2. Publish is one control-plane transaction: draft → `published`, previous → `archived`, `catalog_meta.version`
   bump, platform audit event with the item diff. The partial unique index (Sprint 07 §3.1) makes two published
   versions impossible.
3. Currency stays `USD` this sprint (a CHECK); multi-currency is §7 Q-SC7.
4. Tests: draft lifecycle; publish atomicity and archive; validation 422; the tenant estimate and a newly generated
   quote use the new version on the next request; an earlier quote export still references its version.

Web (`apps/staff`): Price book section (D-C9). Tenant web: no code change. Mobile: unaffected. Shared: routes,
`estimateMonthly` reuse.

Backend: grants in 0080; routes above; platform audit; RBAC `staff:pricebook:*`; tenancy: control plane.

### C9 — Platform audit log and staff accountability

**Design:** audit log screen (D-C10).

UC
- Happy (`admin`): a filterable, cursor-paginated log of every staff event — sign-ins/failures/sign-outs, grants
  opened/ended/expired, tenant views, plan changes, request resolutions, catalog and price-book edits, CLI
  staff-account changes (bootstrap script and C11) — filter by staff member, tenant, action, date; each row shows reason and, for tenant actions,
  a link to the tenant.
- Happy (anyone): "My sessions" (C2) and "My active grants" (C3) in the account menu, with revoke/end.
- **[AM2] Happy (anyone): "My activity"** in the account menu — the staff member's own platform audit events
  (same columns and filters, fixed to themselves) — with **Export CSV** (PO-SC8: standard support-ops tooling; it
  exports the staff member's own actions, not tenant data).
- **[AM2] Export (admin):** Export CSV on the platform audit log exports the current filter (an admin can already
  read every row; the export adds no exposure). Both exports are a synchronous capped download (≤ 10,000 rows; above
  the cap the UI asks to narrow the date range) and are themselves platform-audited (`audit_exported`, filter,
  row count).
- Empty/error/loading states as elsewhere.
- Permission: full log and its export — `staff:audit:read` (`admin`); own activity and its export —
  `staff:audit:own` (every staff role) [AM2].

AC
1. `GET /staff/v1/audit?staffUserId=&tenantId=&action=&from=&to=&cursor=` (`staff:audit:read`).
2. Every staff route writes a platform audit event (a guard test enumerates `@Staff` write routes and asserts each
   calls the platform audit writer — mutation-style, like Sprint 07 P3 AC2).
3. Tests: filters, pagination, immutability (UPDATE/DELETE rejected for `kaenal_staff`), sign-in failure events
   recorded without the attempted password.
4. **[AM2]** `GET /staff/v1/me/audit?action=&from=&to=&cursor=` (`staff:audit:own`; server forces `staffUserId =
   caller`) and `GET /staff/v1/me/audit/export.csv?…` (same filter). `GET /staff/v1/audit/export.csv?…`
   (`staff:audit:read`). Both CSV routes: ≤ 10,000 rows else 422 `EXPORT_TOO_LARGE` with the count; RFC 4180
   quoting; **CSV-injection safe** (cells starting with `=`, `+`, `-`, `@`, tab or CR are prefixed with `'`);
   columns = the log columns minus `ip`/`user_agent` for the own-activity export (they are the caller's own, but
   add nothing to an action log); one `audit_exported` platform event per download.
5. **[AM2]** Tests: a non-admin's export contains only their own rows even when a `staffUserId` of someone else is
   passed; cap → 422; injection-prefix cases; the export event is written; `support` → 403 on the full-log export.

Web (`apps/staff`): Audit log section (+ Export CSV), **My activity panel (+ Export CSV)** [AM2]. Mobile: unaffected.
Shared: routes.

### C10 — [AM2, NEW] Support view: read-only access to all tenant content under a `content` grant

**Design:** tenant-app support-view mode (D-C12) and the content-scope access dialog (D-C4). No jsx exists. Decided
by the user (U-SC3): full tenant-content access for staff through the time-boxed, audited grant.

UC
- Happy: Ana (`support`) is handling ticket #4471 ("our PPAP approval page shows the wrong status"). In the console
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
- Expiry / end: at 4 h, on **End support view**, on the grant ended in the console, or on the staff member's
  deactivation, the next request returns 401 and the tab shows the D-C12 ended state ("Support view ended — reopen
  from the Kaenal console with a new reason"); nothing else is affected.
- Error: exchange link expired (60 s) or reused → "This support-view link has expired" with no detail; the browser
  already holds a member session for this workspace (a Kaenal employee who is also a member) → the exchange is
  refused with "Sign out of your own Acme session or use a private window" (the two sessions never mix).
- Permission: `staff:tenant:content` (`support`, `admin`); `sales` never sees the action. Cross-tenant: the
  support-view session is bound to the grant's tenant; a request carrying another tenant's host / header → 404.
- Offline: n/a (online-only, like the console).

AC
1. `0079` adds `control.support_view_sessions` (`token_hash` UNIQUE, `grant_id` → `support_grants` (scope must be
   `content`), `created_at`, `expires_at` = the grant's `expires_at`, `revoked_at`, `ip`, `user_agent`) and
   `control.support_view_exchange_tokens` (`token_hash` PK, `grant_id`, `expires_at` = issue + 60 s, `used_at`).
   Neither is readable by `kaenal_app` or `kaenal_public` (grant test); the tenant lifecycle validates them through
   `STAFF_POOL`.
2. `0079` creates DB role **`kaenal_support_reader`** (LOGIN, no BYPASSRLS; the existing `tenant_isolation` policy
   applies unchanged): SELECT on **every tenant-owned table** except a named credential/secret denylist (at minimum
   `sessions`, API-key secret material, integration secrets, MFA material, idempotency records — the architect
   finalizes the list **[AM3] — and, when finalizing it, must also check every included table for column-level
   secrets: a table that is otherwise legitimate content but mixes in a secret/credential column (e.g. a webhook
   signing secret or an API key stored alongside a supplier or integration record) needs a column-privilege grant
   or a masking view instead of a blanket table grant, so the reader never gets column access to a secret through
   an otherwise-needed table — a table-level denylist alone is not a complete answer (flagged in the pre-build
   security review, 2026-09-30; not yet a defect because the denylist itself is correctly gated behind Definition
   of Ready #2, but this check must not be missed when it is finalized)**); INSERT on `audit_events` only (the C3
   AC4 attribution trigger extended: rows from this role must be `actor_kind='support'`,
   `action='support_accessed'`, `reason = current_setting('app.support_reason')`); **no INSERT/UPDATE/DELETE on any
   other table**. A schema test enumerates every tenant-owned table and fails if one lacks reader SELECT without
   being on the denylist, or if the role holds any other write privilege — so every future migration must grant it
   (mutation test: revoking one grant or adding one write privilege fails the test). Dedicated tenants: provisioning
   / `migrate-tenants` create the role and a **support-reader secret ref** (SD6). New env
   `DATABASE_SUPPORT_READER_URL` (+ `.env.example`).
2a. **[AM3] DB-level backstop for grant validity (SR1/High finding, finalized mechanism — SD7).** In the same
    migration, every table in AC2's SELECT set also gets a second, **RESTRICTIVE** policy `support_reader_grant_active`,
    `TO kaenal_support_reader` only, ANDed with the existing permissive `tenant_isolation` policy — so a row is
    readable by this role only when *both* pass. It calls a SQL function `support_reader_grant_active()` that
    mirrors exactly how `current_tenant_id()` already works (`packages/db/migrations/0000_foundation.sql:104-155`:
    a `STABLE` function reading a session-scoped `current_setting()`, single-argument form so it throws rather than
    silently passing when unset), except this one re-derives validity from the **persisted grant row**, not from a
    value the request handler computed, so a bug or omission in `SupportViewAuthenticator` (AC4) cannot by itself
    make an expired or ended grant readable:
    - **Shared-model tenants** (control schema and tenant tables share one physical database — 01 §3.2, today's
      default): `support_reader_grant_active()` is `SECURITY DEFINER` (owned by the migrator, so
      `kaenal_support_reader` itself is granted no access to `control.support_grants` — its own privilege set stays
      exactly as small as AC2 requires) and evaluates `EXISTS (SELECT 1 FROM control.support_grants WHERE id =
      current_setting('app.grant_id')::uuid AND scope = 'content' AND expires_at > now() AND ended_at IS NULL)`.
    - **Dedicated-model tenants** (a separate physical database — Postgres cannot join across databases): the same
      function name instead checks a single-row-per-open-grant local mirror table `support_grant_backstop`
      **inside that tenant's own database** (`grant_id`, `expires_at`, `ended_at`), written by `SupportAccess` /
      `SupportViewAuthenticator` in the same request that opens or ends the control-plane grant — the control-plane
      row stays the source of truth (SD5's ordering rule: control-plane write first), the mirror is a same-request,
      best-effort local copy that exists only so the RESTRICTIVE policy has something local to check. Provisioning
      (`provision-tenant`, `migrate-tenants`) creates this table alongside the `kaenal_support_reader` role and its
      secret ref (SD6).
    `app.grant_id` is added to the `SET LOCAL` context AC4 already opens (alongside `app.tenant_id`,
    `app.support_reason`, `app.staff_user_id`). The AC2 schema test is extended to also enumerate this RESTRICTIVE
    policy per table (not just the SELECT grant): a mutation test fails if the policy is dropped, if
    `support_reader_grant_active()` is stubbed to always return true, or if a table carries the SELECT grant
    without the policy.
3. Hand-off (SD9): `POST /staff/v1/grants/:id/view-link` (`staff:tenant:content`, own active content grant) returns
   a tenant-host URL carrying a single-use exchange token **in the URL fragment** (never sent to servers or
   `Referer`); the tenant web route `/support-view` posts it to `POST /v1/support-view/exchange`
   (`@AllowAnonymous`, tenant-scoped, rate-limited), which verifies the token (unused, unexpired, grant active,
   grant tenant = request tenant), marks it used and sets a host-only `kaenal_support_view` cookie (httpOnly,
   `Secure` in production, `SameSite=Strict`, expiry = grant expiry) plus its CSRF pair. Refused with 409 when a
   `kaenal_session` cookie is present.
4. **Tenant lifecycle interceptor (the ONE interceptor, a settled decision):** in the authenticated branch, a request
   carrying `kaenal_support_view` (and no `kaenal_session`; both present → 401) is authenticated by a
   `SupportViewAuthenticator` that checks the session and its grant on every request (expired / ended / revoked /
   staff deactivated → 401), then: unsafe methods → **403 `SUPPORT_VIEW_READ_ONLY`** before any handler (except
   `POST /v1/support-view/end`); a per-user route denylist (own sessions, MFA, password, recovery codes, push
   tokens, notification preferences, API-key management) → 403; otherwise the handler runs in a tenant transaction
   opened on the **`kaenal_support_reader`** pool with `app.tenant_id`, `app.support_reason`, `app.staff_user_id`,
   **[AM3]** `app.grant_id` (SET LOCAL). RBAC treats the caller as a synthetic `support_viewer` holding every tenant
   **read** capability and no write capability; plant scope = all plants. `GET /v1/me` returns `{ kind:
   'support_viewer', displayName: 'Kaenal support', capabilities, grant: { expiresAt, reason, reference } }`. No
   realtime subscription and no notifications for the viewer (lists are refetched on navigation). **[AM3]**
   `app.grant_id` exists specifically so AC2a's RESTRICTIVE policy can re-verify the grant independently of this
   authenticator's own per-request check on every row read: this authenticator governs the request's outcome
   (401/403/200) and error messages; the RESTRICTIVE policy is the fail-safe that still holds even if this
   authenticator is buggy or bypassed.
5. **Audit:** grant start writes the tenant "opened read-only access" event (C3 AC6). Every GET whose route has an
   entity-id path parameter, and every attachment download, writes one tenant `support_accessed` event
   `{ entity_kind, entity_id, route }` with the grant's reason, in the request's transaction (the reader role's only
   write); list/aggregate GETs are recorded in the platform log with route, status, grant id **[AM3] and,
   additionally, the returned entity ids** — `entityIds: string[]`, up to **200** ids in the response's own order
   (comfortably covers one full page of any paginated tenant list endpoint at its current page-size ceiling — rule
   6's cursor pagination already keeps a single page well under this). A result larger than 200 rows (an aggregate
   or an unusually large page) records `entityIdCount` plus the first 200 ids and `truncated: true`, so a tenant
   asking "exactly what did you see" can reconstruct every record-level read from list views too, not only detail
   views — the cap is stated here and is revisitable if a list endpoint's page size ever exceeds it. Tenant web
   Settings → Audit log renders the per-record rows as "Kaenal support viewed <entity label>" and the grant-start
   row as "Kaenal support opened read-only access — <reason> (<reference>) — until <time>" (small extension of
   Sprint 07 X1 AC4's renderer); the list-view platform events are platform-log-only (not shown in the tenant's own
   audit log, same as today), reconstructable by Kaenal on request.
6. **Every tenant GET works read-only:** a contract-enumerating test calls every GET route of the tenant contract
   (and every plain-REST GET controller route) in a support-view session against a seeded tenant and asserts 2xx /
   404 — never a 5xx from a write side effect. Any GET that writes as a side effect (known example: Sprint 07 O5's
   "status → completed on read") skips that write for support viewers. Every unsafe route returns 403 (same test,
   inverse).
7. **Web (`apps/web`) support-view mode (D-C12):** the `/support-view` exchange page; the banner (reason, reference,
   live countdown announced politely, **End support view** → `POST /v1/support-view/end` → ended state); every
   mutating control hidden because the viewer holds no write capability (04 §6) — a Playwright sweep over the main
   screen of every module and every settings section asserts **no enabled mutating control is rendered**, and any
   control found that is not capability-gated is fixed to be (that is a latent 04 §6 defect, not a support-view
   special case); personal account-menu items hidden; ended / expired states. `apps/web` never imports the staff
   contract (CX AC1 still holds: the exchange and end routes are tenant-contract routes).
8. Tests: exchange single-use and 60 s expiry; fragment token never reaches server logs (the exchange is a POST
   body); cookie flags; both-cookies → 401; member-session present → 409; expiry at 4 h, End, console end and staff
   deactivation each → 401 on the next request; write attempts → 403 and, with the interceptor check bypassed in a
   test, → a database permission error (defence in depth proven); per-user denylist → 403; `sales` → 403 on
   view-link; cross-tenant host with a valid cookie → 404; tenant audit rows for detail views and attachments;
   **tenant sign-in re-proved end to end (201)** after the interceptor change (rule 12) and the mobile bearer path
   unchanged. **[AM3]** Plus (SR1/High finding, DB-level backstop): connecting directly as `kaenal_support_reader`
   (bypassing `SupportViewAuthenticator` entirely) with `app.grant_id` absent, pointing at an expired grant, or
   pointing at an ended grant asserts **zero rows / a permission error** on a representative sample of
   reader-accessible tables — independent of, and even when, the application-layer check is skipped; the same
   assertion holds for a dedicated-tenant database against its local `support_grant_backstop` mirror; a mutation
   test confirms dropping the RESTRICTIVE policy, or stubbing `support_reader_grant_active()` to always return
   true, makes this test fail. **[AM3]** Plus (SR4): a list-view request made under a content grant records the
   returned entity ids (or `entityIdCount` + a capped 200-id sample with `truncated: true`) in its platform audit
   event, verified against the endpoint's actual response body.

Web: `apps/staff` (View workspace action, content dialog variant) and **`apps/web`** (support-view mode, exchange
page, banner, audit-log renderer extension). Mobile: unaffected (no support view on mobile; the oversight feed's
generic row renders the events). Shared: migration 0079 additions, `SupportViewAuthenticator` in the lifecycle
interceptor, the two tenant-contract routes (`POST /v1/support-view/exchange`, `POST /v1/support-view/end`), the
staff route `POST /staff/v1/grants/:id/view-link`, the reader role and its schema test, **[AM3]** the
`support_reader_grant_active()` function/RESTRICTIVE policy and (dedicated tenants) the `support_grant_backstop`
mirror table.

Backend: migration 0079; routes above; audit: tenant `support_accessed` per detail view / attachment + grant start,
platform event per request (**[AM3]** incl. entity ids on list views); RBAC `staff:tenant:content` + synthetic
read-only `support_viewer`; tenancy: RLS enforced
for the reader role, grant-bound tenant, no write privilege.

### C11 — [AM2, NEW] Staff account management in the console

**Design:** Staff section (D-C11). Decided by the PO under the lead's instruction (PO-SC1).

UC
- Happy (`admin`): Staff section lists every staff account (name, email, role, status, MFA enrolled, last sign-in,
  created by). **Invite staff** (email, name, role) → the account is created `pending_setup` and a one-time setup
  link (24 h) is emailed to the invitee through the control-plane email path Sprint 07 O3 uses; the admin never sees
  the link. **Resend setup email** issues a fresh link (old one invalidated).
- Happy: **Change role**, **Deactivate** (reason; revokes every staff session, ends every active grant and
  support-view session of that person at once), **Reactivate** (reason), **Reset credentials** (reason; new setup
  link: password + TOTP re-enrolment; existing sessions revoked).
- Guard rails: an admin cannot change their own role or deactivate themselves; the **last active admin** cannot be
  demoted or deactivated (422 `LAST_ADMIN`); a duplicate email → 409; every change requires a reason.
- Error: 409 stale (`lockVersion`); email transport failure → the account exists and "Resend setup email" is offered
  (outbox retries).
- Empty: only the bootstrap admin → the list shows one row and the Invite action.
- Permission: `staff:staff:manage` (`admin`); other roles do not see the nav entry.

AC
1. Routes (`staff:staff:manage`, `lockVersion` + `reason` on writes): `GET /staff/v1/staff-users?cursor=&status=&role=`,
   `POST /staff/v1/staff-users` (`Idempotency-Key`), `POST /staff/v1/staff-users/:id/resend-setup`, `PUT
   /staff/v1/staff-users/:id/role`, `POST /staff/v1/staff-users/:id/deactivate|reactivate|reset`.
2. Each write updates `control.staff_*` in one control transaction with a platform audit event (before/after, reason);
   deactivation revokes `staff_sessions`, ends `support_grants` and revokes `support_view_sessions` in the same
   transaction.
3. Tests: invite → email in the dev sink → setup → active; resend invalidates the previous token; self-demotion /
   self-deactivation → 422; last-admin → 422; deactivation ends a live grant and a live support-view session on their
   next request; `sales` / `support` → 403; every write audited.

Web (`apps/staff`): Staff section (D-C11). Mobile: unaffected. Shared: routes, `StaffIdentityService` (shared with
C1's setup routes).

Backend: no new migration (0078 tables); routes above; platform audit; RBAC `staff:staff:manage`; tenancy: control
plane only.

### CX — Cross-cutting: isolation, deployment, seeds, docs, security review

AC
1. **Bundle/route isolation:** `apps/web`'s build output contains no staff route or staff contract (a test greps
   the Next build manifest and the client chunks for `/staff/v1` and staff contract symbols); lint rules from C4
   AC1 enforced in CI.
2. **Host isolation:** `STAFF_HOST` (e.g. `staff.kaenal.localhost` in dev, `staff.<root>` in prod) required when
   the staff module is enabled; `STAFF_ALLOWED_CIDRS` optional; `apps/staff` served only there, with a strict CSP
   (`default-src 'self'`, no third-party script), `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`,
   `frame-ancestors 'none'`.
3. **Env/docs:** `.env.example` gains `DATABASE_STAFF_URL`, `DATABASE_SUPPORT_URL`, `DATABASE_SUPPORT_READER_URL`
   [AM2], `STAFF_HOST`, `STAFF_ALLOWED_CIDRS`; CLAUDE.md "Commands" gains `pnpm staff-bootstrap …` [AM2] and `pnpm
   --filter @kaenal/staff dev` (:3002); `apps/staff/README.md` documents the security model in one page (identity,
   session, grant scopes, support view, roles, DB roles) and, **[AM2] PO-SC2**, a production runbook line: the staff
   host must sit behind a network restriction (`STAFF_ALLOWED_CIDRS` or an ingress-level VPN / zero-trust proxy)
   before production use.
4. **Seed:** a dev-only `scripts/seed-staff.ts` creates `staff-admin@kaenal.test`, `staff-sales@kaenal.test`,
   `staff-support@kaenal.test` with a known dev password and a **fixed dev TOTP secret** printed with its
   otpauth URI (dev only; the script refuses to run when `NODE_ENV=production`). It runs after `seed-demo.ts` and
   never touches tenant rows, so the tenant demo login is unaffected (rule 12).
5. **Test-suite hygiene:** the staff suites seed and clean their own `control.staff_*` rows; the serial-package
   rule holds (`--concurrency=1`). After `pnpm test` / `pnpm test:rls`, re-seed both the demo tenant and the staff
   accounts, and prove **both** sign-ins (tenant 201; staff password + TOTP → session).
6. **Security review:** a `security-reviewer` pass on the design (before build) and on the merged code
   (interceptor branches incl. the [AM2] support-view authenticator, cookies, CSRF, grants and scopes, the fragment
   hand-off, DB roles incl. `kaenal_support_reader`, audit triggers, host check) with findings resolved or recorded
   before Gate 2.
7. **PROGRESS.md:** the `CONTROL_POOL` Known issue is updated to state the staff surface does not use it (the tenant
   auth path still does; unchanged by this sprint).

---

## 3. Security + architecture design — DECIDED [AM2/AM3] (security-reviewer pass still required before build)

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

**SD1 — A separate app (`apps/staff`) on a separate host, one API process with a separate module and contract.**
- *Options.* (a) A `/staff` area inside `apps/web`. (b) A new `apps/staff` Next.js app; API routes in the existing
  NestJS process under `/staff/v1` with a host check. (c) A new app **and** a separate API process.
- *Decision proposed: (b).* Why not (a): `apps/web`'s root layout wraps every route in the tenant app's providers
  and i18n, and its route groups assume a tenant (shell, entitlements, realtime) — the console would have to
  escape all of it; tenant hosts would serve the staff routes' build
  artefacts; the tenant session cookie and CSRF token live on the same origin; and one misconfigured route guard
  would expose a cross-tenant tool on customer domains. A separate origin gives host-only cookies (a tenant-page XSS
  cannot ride a staff session, and vice versa), an independent CSP, independent deploys and a network restriction
  at the ingress. Why not (c): the API's value here is the ONE lifecycle interceptor, the audit writer, the
  resolver and the outbox — duplicating them in a second process doubles the security surface to review; the
  host check + separate contract + guard tests give the isolation at a fraction of the cost.
- *Cost accepted (ADR trade-off):* `apps/staff` builds its own small set of primitives (table, form fields,
  dialog, tabs, badge, toast) from the shared tokens rather than importing `apps/web` components — some visual
  duplication, in exchange for zero coupling to the tenant app. Extracting a shared `packages/ui` is a separate
  refactor, not done here (§7 Q-SC10).

**SD2 — Staff identity separate from `control.users`; three roles; capability matrix.**
- `control.staff_users` is a separate identity table (C1): a staff member is never a tenant member by virtue of
  being staff, never appears in any tenant member list, and a membership bug cannot mint staff access. Roles
  reuse the audit system's `actor_kind='support'` for all staff actions; the staff role is recorded in the
  platform audit log.

| Capability | support | sales | admin |
|---|---|---|---|
| `staff:tenants:read` (directory, inbox list, workspace-request list) | yes | yes | yes |
| `staff:tenant:access` (open a support grant; read tenant commercial data) | yes | yes | yes |
| `staff:plans:write` (packs, bundle incl. Enterprise, self-service, contract, CSM, [AM2] reset an ended trial) | — | yes | yes |
| `staff:requests:resolve` (fulfil / decline) | — | yes | yes |
| `staff:workspace_requests:manage` (decline / spam) | — | yes | yes |
| `staff:catalog:read` / `staff:pricebook:read` | yes | yes | yes |
| `staff:catalog:write` (packs, module map, rules, industries, frameworks) | — | — | yes |
| `staff:pricebook:write` (draft / publish) | — | — | yes |
| `staff:audit:read` (platform audit log + its CSV export) | — | — | yes |
| **[AM2]** `staff:audit:own` (own activity + its CSV export) | yes | yes | yes |
| **[AM2]** `staff:tenant:content` (open a `content` grant; read-only support view of all tenant records, C10) | yes | — | yes |
| **[AM2]** `staff:staff:manage` (invite, role, deactivate / reactivate, reset staff accounts, C11) | — | — | yes |

**SD3 — Staff sessions.** Opaque random token, stored hashed; host-only `SameSite=Strict` cookie; idle 30 min /
absolute 8 h (shorter than tenant web's 12 h absolute, because the blast radius is every tenant); CSRF
double-submit; no bearer tokens (web-only tool); sessions revocable individually and all at once on deactivation.

**SD4 — MFA mandatory (TOTP) for every staff account**, enforced by a DB CHECK on `active` (C1 AC2) and by the
sign-in flow (no session without the second factor). Reuses the tenant TOTP crypto. **[AM2] Q-SC5 DECIDED:** TOTP is
the bar this sprint; WebAuthn / passkeys are a reasonable future enhancement (no WebAuthn code exists in the
repository), not blocking (→ Known issues).

**SD5 — Two audit trails, one ordering rule.** Tenant-side: `audit_events` with `actor_kind='support'` + reason,
written atomically with the tenant change (rule 3), visible to the tenant admin (07 §7). Platform-side:
`control.staff_audit_events`, append-only, for everything (including actions with no tenant). The two live in
different transactions (and, for dedicated tenants, different databases), so the rule is: **write the platform
event first (`outcome` pending), run the tenant transaction, then mark the platform event `ok` or `failed`** — a
tenant change can therefore never exist without a platform record; a platform record with `failed` means nothing
changed in the tenant.

**SD6 — Least-privilege database roles; RLS never bypassed.** `kaenal_staff` (control plane: staff tables,
tenants read, commercial control tables write) and `kaenal_support` (tenant plane: commercial tables only,
restrictive namespace policy, column-level count grants, audit/outbox insert). Neither has BYPASSRLS; the
existing `tenant_isolation` policy applies to both. For **dedicated** tenants, provisioning must create
`kaenal_support` in the tenant database and store a **support secret ref** alongside the app secret ref;
`provision-tenant` and `migrate-tenants` gain that step, and existing dedicated tenants get it via a one-off
`migrate-tenants` run (dev has none; tested with the router fake + `dedicated-provision.test.ts`).

**SD7 — [AM2, rewritten] The support grant is the spec's "time-boxed grant (4h)", with two scopes.** One tenant,
one staff member, one reason, 4 hours, ends early on demand. **Scope `commercial`** — commercial reads and (per
role) commercial writes, via `kaenal_support`. **Scope `content`** — the user's 2026-09-30 decision (Q-SC3): a
read-only view of **every** record in the tenant's workspace, via the separate `kaenal_support_reader` role and the
tenant web app's support-view mode (C10); reference required; `support` and `admin` only. The earlier version of
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

**[AM3] DB-level backstop for content-scope reads — finalized mechanism (pre-build security review, 2026-09-30,
High finding SR1).** The application check (`SupportViewAuthenticator` verifying the grant once per request, C10
AC4) is necessary but, on its own, not the same rigor the write path already has: any tenant write under a grant is
refused by the database even if the interceptor check is bypassed (C10 AC8's mutation test), because `kaenal_support`
and `kaenal_support_reader` simply hold no write privilege — but before this amendment nothing re-verified *grant
validity itself* below the application layer, so an expired or ended grant would still be readable if
`SupportViewAuthenticator` had a bug or was skipped. The fix mirrors, deliberately and exactly, how tenant isolation
already works: `current_tenant_id()` / the permissive `tenant_isolation` policy
(`packages/db/migrations/0000_foundation.sql:104-155`) trusts a session-scoped `current_setting()` value, applied to
every role with no `TO` clause, and throws (single-argument form) rather than silently passing when unset. C10 AC2a
adds a second, **RESTRICTIVE** policy `support_reader_grant_active`, scoped `TO kaenal_support_reader` only, on
every table that role can SELECT, ANDed with `tenant_isolation` — both must pass for a row to be readable. Its
backing function re-derives validity from the **persisted** `support_grants` row on every check (shared-model
tenants: a `SECURITY DEFINER` function querying `control.support_grants` directly, same physical database;
dedicated-model tenants: the same function name checking a local `support_grant_backstop` mirror row, since
Postgres cannot join across physical databases — full mechanism in C10 AC2a), not from a value the request handler
computed and could get wrong. `app.grant_id` joins `app.tenant_id` / `app.support_reason` / `app.staff_user_id` in
the `SET LOCAL` context C10 AC4 opens. Every future tenant-table migration must carry this policy the same way it
must carry `apply_tenant_rls()` — the AC2 schema test enumerates both, and the mutation test proves the RESTRICTIVE
policy is load-bearing (dropping it, or stubbing the function to always return true, must fail a test).

**[AM3] SD10 — Content-grant creation hardening: step-up re-auth, rate limit, anomaly signal (pre-build security
review, Medium findings SR2/SR3).** Opening a `content` grant is the single highest-privilege action in the
console (SD7 above), currently gated only by the staff member's existing session plus a free-text reason — a bar no
higher than a routine `commercial` grant, despite exposing all of a tenant's workspace. Two independent guards close
this: (1) **step-up re-authentication** — 07-SECURITY-COMPLIANCE.md §2 requires re-auth at the moment of a sensitive
action (e-signatures); the same principle now applies here: `content`-grant creation requires a short-lived
`stepUpToken` from a fresh password or TOTP re-entry (`POST /staff/v1/auth/step-up`, C2 AC5), checked and consumed
server-side on the grant-creation call (C3 AC8); `commercial` grants are unaffected — they expose no tenant content,
so the existing session remains sufficient. (2) **Rate limit and anomaly signal** — nothing today throttles how many
tenants one staff member can open in sequence, so a single phished-but-past-MFA credential could otherwise walk
every tenant with no friction or alert; C3 AC9 adds a per-staff-member cap of 5 `content`-grant creations per
rolling hour (PO-SC9, a judgment call: generous enough for a busy support shift, tight enough that a sweep across
many tenants is impractical within the window) and a flagged `content_grant_anomaly` platform audit event the first
time a staff member's rolling-hour window reaches 3 distinct tenants, surfaced to admins via the platform audit
log's Flagged filter (C9/D-C10). A push/email alert is a future enhancement (→ Known issues); the flagged, queryable
event is the floor this finding requires.

**SD8 — [AM2, amended] Tenant-side changes are limited to what the access model needs.** 07C adds no tenant table.
It adds two roles (`kaenal_support`, `kaenal_support_reader`), a restrictive policy and audit-attribution triggers,
**[AM3] a second RESTRICTIVE policy backing the content-scope DB-level backstop (SR1) and, for dedicated tenants
only, one small local mirror table (`support_grant_backstop`) that carries no tenant business data**, and — for the
content scope only — two tenant-contract routes (`POST /v1/support-view/exchange`, `POST /v1/support-view/end`), a
third authenticator inside the ONE lifecycle interceptor, and the tenant web app's support-view mode (C10). Mobile
is untouched.

**SD9 — [AM2, NEW] Support-view hand-off across hosts.** The staff console and the tenant app live on different
hosts with host-only cookies (SD1, SD3), so a content grant reaches the tenant host through a **single-use, 60-second
exchange token carried in the URL fragment** (not sent to any server or in `Referer`), exchanged by a POST for a
host-only, `SameSite=Strict`, grant-bound `kaenal_support_view` cookie whose lifetime is the grant's. The tenant
request runs on the `kaenal_support_reader` pool, so "read-only" is a database fact, not a UI convention; the API
refuses unsafe methods first so the user sees a clean 403 rather than a database error. A browser that already
holds a member session for that workspace cannot start a support view (no mixing of a person's own identity with
staff access). Why not render tenant records inside `apps/staff`: it would re-implement every module screen in a
second app (large, and a second place for bugs), whereas the support view reuses the real screens the customer
sees — which is also what support needs to reproduce a customer's problem.

### 3.1 Data model (migrations 0078-0080; 0081 buffer)

| Migration | Object | Kind | Notes |
|---|---|---|---|
| 0078 | `control.staff_users`, `control.staff_setup_tokens`, `control.staff_mfa_recovery_codes`, `control.staff_sessions` | control | MFA-required-when-active CHECK; hashed tokens; no DELETE grant |
| 0078 | **[AM3]** `control.staff_step_up_tokens` (hashed, 5-min expiry, single-use) | control | Backs `POST /staff/v1/auth/step-up`; consumed by content-grant creation (C3) |
| 0078 | Role `kaenal_staff` + grants on staff tables and `control.tenants` (SELECT) | role | Replaces any temptation to use `CONTROL_POOL` |
| 0079 | `control.support_grants` (4 h CHECK, scope `commercial` \| `content` [AM2], reference required for content) | control | One tenant per grant |
| 0079 | **[AM2]** `control.support_view_sessions`, `control.support_view_exchange_tokens` | control | Hashed tokens; never readable by `kaenal_app` / `kaenal_public` |
| 0079 | **[AM2]** Role `kaenal_support_reader`: SELECT on every tenant-owned table except the credential/secret denylist ([AM3] denylist finalization must also check for column-level secrets); INSERT on `audit_events` only; attribution trigger extended; schema test enumerating tenant tables | role / tenant tables (grants + trigger only) | RLS applies; no write privilege; every future tenant table must grant it SELECT |
| 0079 | **[AM3]** Second, RESTRICTIVE policy `support_reader_grant_active` (`TO kaenal_support_reader`) on every table in the row above, backed by `support_reader_grant_active()` (SECURITY DEFINER against `control.support_grants` for shared tenants; against a local `support_grant_backstop` mirror row for dedicated tenants) | policy / function (+ one small mirror table, dedicated tenants only) | DB-level backstop for grant validity, independent of the application check (SR1/High); schema test extended |
| 0079 | `control.staff_audit_events` (append-only trigger; `outcome`) | control | Platform audit log |
| 0079 | Role `kaenal_support` + table/column grants on tenant commercial tables ([AM2] + DELETE on ended `entitlement_trials` rows, trigger-guarded); RESTRICTIVE `tenant_settings` namespace policy `TO kaenal_support`; `audit_events` support-attribution trigger | role / tenant tables (policy + trigger only) | RLS still applies; `pnpm db:check` must stay green (no new tenant table) |
| 0080 | `control.sales_inbox` (projection), `control.tenant_commercial_summary` (projection: tier, declared frameworks, effective packs) + their outbox consumers | control | Eventually consistent, idempotent upserts |
| 0080 | Write grants for `kaenal_staff` on Sprint 07's catalog, price-book, `tenant_plans` (UPDATE) and `workspace_requests` (SELECT, UPDATE `status`) | grants | Never DELETE, except draft price-book rows |

New notification kinds: none (Sprint 07 defined `plan_request_resolved`). New tenant audit actions: none
(`support_accessed`, `entitlement_changed`, `status_changed` exist; [AM2] content views reuse `support_accessed`
with `entity_kind` / `entity_id`). New platform audit actions include `tenant_content_viewed`, `audit_exported`,
`trial_reset`, `staff_user_*`, `staff_bootstrap` [AM2] and **[AM3]** `content_grant_anomaly` (SR3). New
tenant-contract routes [AM2]: `POST /v1/support-view/exchange`, `POST /v1/support-view/end` (content scope only).
New staff-contract route [AM3]: `POST /staff/v1/auth/step-up` (SR2).

---

## 4. Backend needs (per story)

| Story | Migration | Routes (staff contract + controller) | Service / job | Audit | RBAC | Isolation notes |
|---|---|---|---|---|---|---|
| C1 | 0078 | `GET /staff/v1/setup/:token`, `POST …/setup/:token/password`, `…/mfa/enrol`, `…/mfa/activate`; script `staff-bootstrap` [AM2] | `StaffIdentityService`, `staff-bootstrap.ts` | platform | pre-session; script migrator | control only |
| C2 | 0078 | `POST /staff/v1/auth/sign-in`, `…/auth/mfa`, `…/auth/sign-out`, `GET /staff/v1/me`, `GET/POST /staff/v1/me/sessions[/:id/revoke]`, **[AM3]** `POST /staff/v1/auth/step-up` | `StaffAuthenticator`, interceptor staff branch, `STAFF_POOL` | platform (sign-in/out/fail/step-up) | session | host check, CIDR, host-only cookies, CSRF; no tenant scope |
| C3 | 0079 (0078 for step-up tokens) | `POST /staff/v1/tenants/:id/grants` (**[AM3]** `stepUpToken` required for `content`, rate-limited, anomaly-flagged), `POST /staff/v1/grants/:id/end`, `GET /staff/v1/me/grants` | `SupportAccess.withTenant`, `packages/core/staff-rbac.ts`, **[AM3]** Redis `RateLimiter` | tenant `support_accessed` + platform (**[AM3]** incl. `content_grant_anomaly`) | `staff:tenant:access` | `kaenal_support`, RLS, restrictive policy, audit trigger |
| C4 | 0080 | `GET /staff/v1/tenants`, `GET /staff/v1/tenants/:id`, `GET …/:id/history` | directory + detail services, summary projector | platform `tenant_viewed` | `staff:tenants:read`, grant for detail | directory from control plane only |
| C5 | (0080 grants; 0079 trials DELETE) | `PUT …/tenants/:id/packs/:packId`, `POST …/apply-bundle`, `PUT …/tenants/:id/plan`, [AM2] `POST …/tenants/:id/trials/:packId/reset` | `StaffPlanService` | tenant `entitlement_changed` (support) + platform | `staff:plans:write` | via grant; realtime after commit |
| C6 | 0080 | `GET /staff/v1/sales-inbox`, `POST …/requests/:requestId/fulfil|decline`, `GET /staff/v1/workspace-requests`, `POST …/:id/decline|spam` | inbox projector, `StaffPlanService` | tenant `status_changed` + `entitlement_changed` + platform | `staff:requests:resolve`, `staff:workspace_requests:manage` | resolution via grant |
| C7 | (0080 grants) | `GET /staff/v1/catalog`, `PUT/POST …/catalog/*`, `POST …/catalog/impact-preview` | `CatalogAdminService`, impact preview | platform | `staff:catalog:*` | control plane; counts-only system job |
| C8 | (0080 grants) | `GET/POST/PUT/DELETE …/price-book/*`, `POST …/publish`, `POST …/preview` | `PriceBookService` | platform | `staff:pricebook:*` | control plane |
| C9 | 0079 | `GET /staff/v1/audit`, [AM2] `GET /staff/v1/audit/export.csv`, `GET /staff/v1/me/audit`, `GET /staff/v1/me/audit/export.csv` | audit reader, CSV writer | platform `audit_exported` | `staff:audit:read`; `staff:audit:own` | append-only; own-export forced to the caller |
| C10 [AM2] | 0079 | `POST /staff/v1/grants/:id/view-link`; tenant contract `POST /v1/support-view/exchange` (`@AllowAnonymous`), `POST /v1/support-view/end` | `SupportViewAuthenticator` in the lifecycle interceptor, reader pool, **[AM3]** `support_reader_grant_active()` | tenant `support_accessed` (grant start, each detail view / attachment) + platform per request (**[AM3]** incl. entity ids on list views) | `staff:tenant:content`; synthetic read-only `support_viewer` | `kaenal_support_reader` (no write privilege), RLS, grant-bound tenant, unsafe methods 403, **[AM3]** RESTRICTIVE-policy DB backstop on `app.grant_id` |
| C11 [AM2] | (0078) | `GET/POST /staff/v1/staff-users`, `…/:id/resend-setup`, `PUT …/:id/role`, `POST …/:id/deactivate\|reactivate\|reset` | `StaffIdentityService`, control-plane email | platform `staff_user_*` | `staff:staff:manage` | control only; last-admin and self-change guards |
| CX | — | — | lint rules, build-manifest test, seed-staff, env, docs | — | — | host/CSP headers |

[AM2] Gap proof for the added routes: `grep -n -i "support.view\|support_view\|staff-users\|view-link\|audit/export" packages/types/src/contract.ts` and the same over `apps/api/src/**/*.controller.ts` return nothing (2026-09-30); all are built here.

**Gap proof.** No staff, operator, grant, catalog-write or price-book route exists in `packages/types/src/contract.ts`
or any `apps/api/src/**/*.controller.ts` (grep this session: `staff|support_grant|price.?book|catalog` → only the
unrelated training competency catalog, `contract.ts:1438,1486` / `training/competencies.controller.ts`). Nothing
here is a re-description of an existing endpoint; everything is built this increment (rules 0, 10).

## 5. Design needs

**Existing jsx:** none for any staff screen (§1a grep). **Every screen below needs the UI Lead Designer**, in the
existing visual language (`styles/tokens.css`, the `.k-*` component language of `Kaenal.html`), denser than the
tenant app where a data table benefits, desktop-first (1280 px) with a usable 1024 px layout; mobile layouts are not
required (internal desktop tool). Each board must cover loading, empty, error (with requestId), permission (role
without the capability: read-only, no dead buttons), expired-grant and 409 states.

| ID | Screen | Story |
|---|---|---|
| D-C1 | **Staff sign-in**: email + password, TOTP / recovery-code step, generic error, lockout notice, rate-limited, session-expired return, sign-out confirmation; environment badge (dev/staging/prod) | C2 |
| D-C2 | **Account setup** (one-time link): set password (policy hints), TOTP enrol (QR + secret), recovery codes (save/download/confirm), expired-link state | C1 |
| D-C3 | **Console shell**: left nav (Tenants, Sales inbox with count, Workspace requests with count, Catalog, Price book, Audit log, [AM2] Staff — the last two hidden for non-admins), header (staff name + role, env badge, account menu: My sessions, My active grants, Sign out), the global **active-grant banner** | C4, C3 |
| D-C4 | **Access-reason dialog** (reason, reference, prefilled variant from inbox), grant banner with countdown and "End access", grant-expired state; **[AM2]** scope choice (Commercial / Workspace content (read-only)) with reference required for content and a plain-language warning of what content access exposes; banner showing both grants when both are held | C3, C10 |
| D-C5 | **Tenant directory** (search, filters, table, pagination, empty) and **tenant detail** header + tabs Plan / Requests / Profile (incl. framework declaration history) / History | C4 |
| D-C6 | **Plan editing**: pack toggles, bundle apply (incl. Enterprise), self-service switch, contract + CSM form; the **change-reason confirm** with diff ("effective modules +Risk, +ECN") and the downgrade open-records variant; **[AM2]** "Trial used · ended <date>" row state with **Reset trial** and its reason confirm | C5 |
| D-C7 | **Sales inbox** (list, filters, resolve dialog: fulfil / decline with reason; "withdrawn meanwhile" state) and **Workspace requests** (list, decline / spam, provisioning-command row, provisioned link) | C6 |
| D-C8 | **Catalog**: Packs (edit form, module map editor), Frameworks & rules (framework list + per-framework module rule grid with level/clause/note), Industries (edit form incl. suggested frameworks and priors); **impact-preview confirm** with gained/lost tenant lists (no record counts) and the typed-count confirm | C7 |
| D-C9 | **Price book**: versions list (published / draft / archived), draft editor (items table), estimate preview (sample profile / tenant composition), publish confirm with diff, discard draft | C8 |
| D-C10 | **Platform audit log** (filters, table, row detail, [AM2] Export CSV incl. the over-cap message) and **My sessions / My active grants / [AM2] My activity (+ Export CSV)** panels | C9, C2, C3 |
| D-C11 | **[AM2] Staff section**: staff list (role, status, MFA, last sign-in), Invite staff dialog, Resend setup email, Change role, Deactivate / Reactivate / Reset credentials with reason confirm, last-admin and self-change refusals, empty (bootstrap admin only) | C11 |
| D-C12 | **[AM2] Tenant web app — support-view mode** (`apps/web`, the tenant's visual language): `/support-view` exchange page (loading, expired/reused link, member-session-present refusal), the persistent read-only banner (reason, reference, countdown, End support view), how read-only screens look with mutating controls absent (no visual "disabled" noise), hidden personal account items, ended/expired full-page state; the tenant audit-log rows "Kaenal support opened read-only access …" and "Kaenal support viewed <record>". Desktop 1280 / 1024 | C10 |

Accessibility (WCAG 2.2 AA): keyboard-complete tables and dialogs, visible focus, the typed-count confirm is a
labelled input (not a colour-only cue), countdowns are announced politely (`aria-live="polite"`), contrast on the
env badge colours verified.

## 6. Dead-end audit (every control this increment introduces)

| Control | Resolves to |
|---|---|
| Sign in / Verify code / Use a recovery code / Sign out | C2 routes |
| Setup: Set password / Enrol / Activate / Download recovery codes | C1 routes; codes shown once |
| Nav: Tenants, Sales inbox, Workspace requests, Catalog, Price book, Audit log | Real sections C4, C6, C6, C7, C8, C9 (Audit log hidden without `staff:audit:read`) |
| Account menu: My sessions (revoke), My active grants (end) | C2 / C3 routes |
| Directory: search, filters, row click, pagination | C4 route; detail |
| Tenant detail: Refresh summary | Re-derives `control.tenant_commercial_summary` for that tenant inside the active grant (C4 AC2) |
| Access dialog: Open with reason / Cancel | C3 grant / back to directory |
| Grant banner: End access | C3 end |
| Plan tab: pack toggle, Apply bundle (Core/Pro/Ent), Self-service switch, Save contract, Save CSM | C5 routes with reason confirm; hidden for `support` |
| Change-reason confirm: Confirm / Cancel | C5 write / no change |
| Inbox: Resolve → Fulfil / Decline | C6 routes |
| Workspace requests: Decline / Mark as spam / Open tenant | C6 routes / C4 detail |
| Workspace requests: provisioning command (copy) | Copies text; provisioning is `provision-tenant` (Sprint 07 P8) — honest, not a dead button |
| Catalog: edit pack, move module, add/edit/retire framework, add/edit/retire industry, edit rule | C7 routes; impact preview where applicable |
| Impact preview: Apply (typed count) / Cancel | C7 write / no change |
| Price book: New draft, edit item, Preview, Publish, Discard draft | C8 routes |
| Audit log: filters, row detail, Export CSV [AM2] | C9 routes (`/staff/v1/audit`, `/staff/v1/audit/export.csv`) |
| [AM2] Nav: Staff (admins only) | C11 section |
| [AM2] My activity: filters, Export CSV | C9 AC4 routes (own rows only) |
| [AM2] Access dialog: scope choice Commercial / Workspace content | C3 grant with that scope (content hidden for `sales`) |
| [AM2] Tenant detail: View workspace (read-only) | C10 view-link → new tab → tenant `/support-view` exchange |
| [AM2] Plan tab: Reset trial (ended trials only) | C5 AC6 route with reason confirm; absent for running trials and for `support` |
| [AM2] Staff section: Invite staff / Resend setup email / Change role / Deactivate / Reactivate / Reset credentials | C11 routes, reason confirm; self / last-admin guards render as disabled-with-explanation, never a control that 422s silently |
| [AM2] Tenant app (support view): End support view | `POST /v1/support-view/end` → ended state |
| [AM2] Tenant app (support view): every module screen | Read-only real data; mutating controls not rendered (C10 AC7 sweep); single-attachment open works and is audited |
| [AM2] Tenant app: `/support-view` page | Real exchange (C10 AC3) with expired / member-session states — not a placeholder |

No "coming soon", no placeholder route, no control without a backend.

## 7. Decisions register and out of scope [AM2 — no open question remains]

**[AM2] Status: every item is DECIDED.** "→ Known issues" marks a future candidate copied to PROGRESS.md "Known
issues" at close; none blocks Gate 1, the architecture review or the security review.

**Decided by the user.**
- ~~Q-SC3 Tenant QMS-content support access and impersonation~~ → **U-SC3 (2026-09-30): full tenant-content access
  via the 4 h audited grant.** The previous SD7 was narrower (commercial only) and is rewritten: `content` grant
  scope, read-only support view of every record (C10), reference required, `support`/`admin` only, audited per
  record in the tenant's log and per request in the platform log. PO-decided boundaries of that access (SD7): no
  staff writes to QMS records, no per-member "view as", no bulk export, no tenant consent toggle (→ Known issues
  for each, as future candidates).

**Decided by the PO under CLAUDE.md's standing rule (smallest reasonable choice, recorded; revisitable).**
- **Q-SC1 → PO-SC1.** `pnpm staff-bootstrap` creates the first staff admin (and break-glass admins with a reason),
  mirroring `provision-tenant` / `seed-demo`; that admin creates and manages every further staff account in the
  console (C11). The multi-command `staff-user` CLI is not built (one write path).
- **Q-SC2 → PO-SC2.** Code provides the host check and an optional CIDR allowlist; the production network
  restriction (CIDR allowlist or VPN / zero-trust proxy at the ingress) is an ops runbook requirement documented in
  `apps/staff/README.md` (CX AC3), not a code gate (→ Known issues, for whoever owns production infrastructure).
- **Q-SC4 → PO-SC4.** Provisioning from the console is not built; `provision-tenant --from-request` stays the only
  provisioning path (it creates databases and roles for dedicated tenants); the workspace-request row shows the
  exact command (C6). (The lead's message grouped this label with the content-access decision; in this file it is a
  separate question, decided here.)
- **Q-SC5 → PO-SC5.** Mandatory TOTP is the bar; WebAuthn / passkeys are a future enhancement (→ Known issues).
- **Q-SC6 → PO-SC6.** Staff (`sales`, `admin`) may reset a tenant's **ended** trial of a pack with a mandatory
  reason, audited in both logs like a plan change (C5 AC6); no extension of a running trial.
- **Q-SC8 → PO-SC8.** Every staff member can export their own action log as CSV; admins can export the full log
  they can already read (C9 AC4-AC5).
- **Sprint 07 Q-C12** (staff "suspend framework inclusion" override) → not built: Sprint 07 decided the honor
  system.
- Q-SC7 Price book is single-currency (`USD`) this sprint.
- Q-SC9 Offboarding/suspended tenants: listed and readable, no writes offered.
- Q-SC10 `apps/staff` duplicates a few UI primitives instead of extracting `packages/ui` (SD1 trade-off).
- Q-SC11 The tenant sees "Kaenal support" and the reason, not the staff member's name (07 §7 wording "Kaenal support
  accessed…"); the name is in Kaenal's platform audit log. Revisit if customers ask to see names.
- Q-SC12 Support-grant duration is fixed at 4 h (07 §7); extending means opening a new grant with a new reason.
- **[AM3] PO-SC9** (arising from the pre-build security review's SR3 finding, 2026-09-30). `content`-grant creation
  is rate-limited to **5 per staff member per rolling hour**, and a `content_grant_anomaly` platform audit event is
  flagged the first time a staff member's rolling-hour window reaches **3 distinct tenants** (C3 AC9, SD10). Both
  numbers are the PO's smallest-reasonable-choice call, not the user's or the security reviewer's; revisitable if
  real usage shows either threshold is too tight or too loose.

**Out of scope (named).** Staff writes to tenant QMS records; "log in as" a specific tenant member; bulk export in
support view; a tenant consent setting for staff access; staff SSO; staff account self-registration;
provisioning/offboarding from the console; billing/payments (Q6); any mobile staff surface or mobile support view.
Every "→ Known issues" item above moves to PROGRESS.md "Known issues" at close.

## 8. Definition of Done

- [x] [AM2] Every §3 design decision and §7 item DECIDED (U-SC3 by the user; the rest by the PO under the standing
      rule, [AM3] incl. PO-SC9) — no decision gates the build.
- [x] [AM3] The pre-build security review's 1 High + 3 Medium findings + 1 flagged prerequisite (SR1-SR5) are
      resolved in this document (SD7's finalized DB backstop, new SD10, C10 AC2/AC2a/AC5/AC8, C3 AC8/AC9/AC10). This
      is a **document fix, not a re-run of the review** — see the next line.
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
      explicit grant tests for every `control.staff_*` table (**[AM3]** incl. `staff_step_up_tokens`), the
      support-view tables, `kaenal_staff`, `kaenal_support` (cannot read QMS content, restrictive namespace policy
      holds), **`kaenal_support_reader` (SELECT on every tenant table except the denylist, no write privilege but
      its audit rows — the enumerating schema test, C10 AC2)** and `kaenal_app`/`kaenal_public` (cannot read staff
      or support-view tables); **mutation tests**: widening the restrictive policy, dropping an audit-attribution
      trigger, removing a `@Staff` decorator, or [AM2] granting the reader role one write privilege / revoking one
      of its SELECTs each make a test fail — run and recorded. **[AM3]** Plus: `kaenal_support_reader` reading with
      `app.grant_id` absent, expired or ended returns zero rows / a permission error even with the application
      check bypassed (SR1, C10 AC2a/AC8), and a mutation test proves dropping the RESTRICTIVE policy or stubbing
      `support_reader_grant_active()` makes that test fail.
- [ ] Every staff mutation writes a platform audit event, and every tenant-touching one also the tenant
      `actor_kind='support'` event with reason in the same tenant transaction (rule 3, SD5 ordering proven by a
      failure-injection test) — [AM2] including trial reset, and every support-view detail view / attachment
      download (C10 AC5, **[AM3]** now including entity ids on list-view reads under a content grant); optimistic
      concurrency on every write (rule 6); cursor pagination on every list. **[AM3]** Content-grant creation is
      rate-limited (5/staff/rolling hour) and fires exactly one `content_grant_anomaly` event at the 3rd distinct
      tenant in a rolling hour, not before and not again for the same window (C3 AC9).
- [ ] Interceptor: tenant sign-in re-proved end to end (201) after the staff branch **and [AM2] the support-view
      authenticator** land (rule 12); mobile bearer path unchanged; cross-plane isolation tests green both ways; host
      check and CIDR tests green; [AM2] the contract-enumerating support-view test (every GET 2xx/404 read-only,
      every unsafe route 403, C10 AC6) green. **[AM3]** `content`-grant creation is refused without a valid,
      unexpired, single-use, staff-matched `stepUpToken` (C3 AC8), and never requires one for `commercial` grants.
- [ ] `apps/staff`: every screen browser-verified against the approved D-C boards (there is no jsx), including all
      states, at 1280 and 1024 px; WCAG AA checks recorded. **[AM2] `apps/web` support-view mode** browser-verified
      against D-C12, and the Playwright no-enabled-mutating-control sweep (C10 AC7) green.
- [ ] Playwright (staff + tenant, one journey): tenant `globex` (request mode) requests QE → staff sales inbox →
      grant with reason → fulfil → tenant `/risk` unlocks without reload → tenant audit log shows "Kaenal support —
      <reason>"; staff admin edits an IATF rule (impact preview + typed confirm) → a test tenant's module gating
      changes on its next request; staff admin publishes a new price book → tenant `/pricing` estimate changes.
      **[AM2]** Second journey: staff `support` completes step-up (**[AM3]**), opens a content grant with reason +
      reference → View workspace → Acme's NCR and PPAP pages render read-only with the banner → the tenant admin's
      audit log shows "opened read-only access" and "viewed <record>" → End support view → next request 401. Third:
      staff `sales` resets an ended trial → tenant admin starts a new trial. Fourth: bootstrap admin invites a staff
      member → setup email → setup → the new member exports their own activity CSV.
- [ ] `apps/web` build contains no staff route or staff contract symbol (CX AC1); lint isolation rules green.
- [ ] Mobile: `pnpm --filter @kaenal/mobile typecheck` + tests green; `progress_mobile.md` notes "07C: no mobile
      change (internal web tool; support view is web-only; support audit events render in the existing oversight
      feed row)".
- [ ] Gates green: `pnpm typecheck && pnpm lint`, `pnpm test`, `pnpm test:rls`, `pnpm db:check`.
- [ ] Demo tenant re-seeded **and** staff accounts re-seeded after the suites; **tenant sign-in 201** and **staff
      sign-in (password + TOTP) succeed**.
- [ ] CLAUDE.md Commands (`pnpm staff-bootstrap`, `pnpm --filter @kaenal/staff dev`), `.env.example`,
      `apps/staff/README.md` (incl. the PO-SC2 production network runbook line), PROGRESS.md ("Current status",
      Decisions log: U-D5, U-SC3, PO-SC1…PO-SC9 [AM3] and SD1-SD10 [AM3] outcomes; Known issues: every "→ Known
      issues" item of §7, the updated `CONTROL_POOL` note, and [AM3] the pre-build security review's SR1-SR5
      findings and how each was resolved) updated in the same commit as the work.
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

**PO use-case sign-off: SIGNED (= APPROVED for SCRUM.md Gate 1), 2026-09-30; reaffirmed after Amendment 3,
2026-09-30.** Verified, not assumed: **12 stories** (C1-C11, CX). Every use case — staff bootstrap and console
staff management, sign-in / MFA / sessions / **[AM3] step-up re-auth**, commercial and content grants (4 h, reason,
reference for content, **[AM3]** rate limit + anomaly flag, expiry, end, deactivation), the read-only support view
of all tenant records with per-record **and [AM3] per-list-view** tenant/platform audit, **[AM3]** a DB-level
backstop on every content-scope read independent of the application check, plan administration incl. trial reset,
sales inbox and workspace requests, catalog and price-book editing with impact preview, the platform audit log with
own-activity and admin CSV export, and cross-plane / cross-tenant isolation — maps to at least one objectively
testable AC with a Web (`apps/staff`, and `apps/web` for C10) / Mobile / Shared split, a §4 backend row, a §5 design
gap (unchanged by Amendment 3 — no new screen was introduced, only new states on D-C4) and a §6 dead-end entry. No
AC depends on an unanswered question (§7 has none). **[AM3]** Story count is unchanged (no new story; SR1-SR5 amend
existing stories C2, C3, C10 and §3).

**Definition of Ready — what remains before build (process gates, no decisions):**
1. **Gate 1 — design.** `ui-lead-designer` produces D-C1…D-C12 in `docs/design/` (no jsx exists for any of them;
   D-C12 is in the tenant app's visual language; **[AM3]** D-C4 additionally covers the step-up prompt for the
   content scope); the user approves them.
2. **Architecture review.** `planner` reviews 07C together with `SPRINT-07-entitlements-onboarding.md` and returns
   SIGN OFF with the slice plan, the reader-role table denylist (C10 AC2 — **[AM3] including the column-level-secret
   check this amendment adds to that AC**), the per-user route denylist (C10 AC4) and the list of GET routes with
   write side effects (C10 AC6).
3. **Security review.** `security-reviewer` signs off **this revised** §3 (SD1-SD10 [AM3]) before any 07C code is
   written — specifically confirming SR1-SR5 are actually closed by the rewrite, not merely asserted closed by the
   PO — and reviews the built code again before Gate 2 (CX AC6), where SR1-SR5 are checked against what actually
   shipped (the DB-level backstop genuinely blocks an expired/absent grant even with the app check bypassed; the
   step-up token is genuinely required and consumed; the rate limit and anomaly event genuinely fire at 5/hour and
   3 tenants/hour; list-view audit events genuinely carry entity ids) rather than taken on trust.
