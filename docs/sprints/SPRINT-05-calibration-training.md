# SPRINT-05 — Calibration Management + Training & Competency

Author: Product Owner. Date: 2026-09-29. Part of the multi-sprint programme in `ROADMAP.md` (Wave 5 of 13).
Governing rules: CLAUDE.md rules 0, 1-8, 9, 10, 11 and `SCRUM.md`. Design fidelity is a completion gate.
Builds on Sprints 01-04 (shell, audits, graph+predictive, risk+MSA) — all merged, not touched here except the
small, named, additive cross-cutting config edits every sprint in this programme makes (ROADMAP §8 rule 2).

**This sprint carries an APPROVAL GATE (ROADMAP §0 Q2).** Both modules' backends are `PROPOSED` (P16, P17)
with no existing `02-DATABASE`/`03-API` spec beyond the phase docs' own sketches — this sprint file's §3 is
the backend design the user must approve before any code is written. **NO BUILD MAY START until the user has
explicitly approved §3** (instrument register + calibration-event schema, the raise-NCR link, the due/overdue
math; the training-record-as-history-table schema, the mandatory-gap cell rule, the expiry math; both
due-soon/expiry job designs; the certificate/evidence attachment pattern via Files; and the one exclusion
this sprint proposes, the vendor LMS panel). This mirrors exactly how Sprint 03 gated §3B and Sprint 04 gated
§3 (through 5 amendment rounds) before those sprints' builds started.

---

## 0. Amendment (Ceremony 4 SEND BACK response, 2026-09-29)

The `planner` agent reviewed this sprint file at Ceremony 4 (architecture review — this happens **before**
Gate 1 and before the user has been asked for §3's approval; nothing here reopens an existing approval, because
none exists yet) and returned **SEND BACK** on nine blocking gaps (B1-B9) plus eight smaller corrections. This
amendment resolves all seventeen **in place** in the stories/sections below (marked `[AMENDED]` at each touched
AC/UC), adds one new story (**T5** — competency catalog editor: archive + reorder), and rewrites §3.2's
"what the user is being asked to approve" text to match exactly what will be built, including five items this
round adds to the original twelve. Summary:

| # | Gap | Resolution |
|---|---|---|
| B1 (BLOCKING) | Generated `next_due`/`expires_at` columns throw "generation expression is not immutable" on Postgres 16 — `(col \|\| ' months')::interval` casts text through the session's `DateStyle`/`IntervalStyle`, which Postgres cannot prove `IMMUTABLE` | Both rewritten with `make_interval(months => …)` — a real builtin marked `IMMUTABLE` in `pg_proc` (confirmed, not assumed: it takes only integer arguments and performs no locale-dependent parsing) — cast back to `date`. Postgres's own date+interval month arithmetic is confirmed (not asserted) to clamp an overflowing day to the target month's last valid day, e.g. `'2026-01-31'::date + make_interval(months => 1) = '2026-02-28'` (2026 is not a leap year); the AC below states this exact worked example, verified by an integration test against real Postgres 16, not a `packages/core` unit test (this is DB-generated-column arithmetic, not application code). `training_records.valid_months` is added as a real, denormalized, non-generated column (T1 AC1), copied from the competency at insert time |
| B2 (BLOCKING) | `plants`, `areas`, `ncrs`, `files` carry no `UNIQUE (tenant_id, id)` — confirmed by grep (`packages/db/migrations/0001_core.sql`): only `plants_tenant_code_uq`, `ncrs_tenant_code_uq`, `files_tenant_bucket_key_uq` exist, and `areas` has no unique constraint beyond its plain `id` PK at all — so none of them can be the target of a composite FK `(tenant_id, id)`, which every new table in this sprint needs | New migration **`0067_composite_fk_prereqs.sql`**, first in the sprint's range, adds `UNIQUE (tenant_id, id)` to all four. Every migration after it renumbers up by one — **`0068_calibration.sql`** (was `0067`), **`0069_training.sql`** (was `0068`), **`0070_calibration_training_exports.sql`** (was `0069`), buffer is now **`0071`**; Sprint 06 takes `0072` onward. `instruments` and `competencies` themselves also gain their own `UNIQUE (tenant_id, id)` (self-consistency — they are composite-FK targets too, for `calibration_events`/`training_records`) |
| B3 (BLOCKING) | A `fail` calibration event could still advance `last_calibrated`/`next_due`, making an out-of-tolerance gauge read "good" — a real IATF 7.1.5 correctness bug, not a cosmetic gap | Only `pass`/`adjusted` advance `last_calibrated`/`next_due`. A new `last_result` column on `instruments` (always the newest event's result, updated every time regardless of outcome) drives an override: `instrumentDueStatus` returns `overdue` when `last_result = 'fail'`, **regardless of the computed `next_due` date**, and the KPI's `overdue` count applies the same override (C1 AC1/AC2/AC5, C2 AC2). Flagged for the designer (§5, small follow-up, not a new board): a "failed calibration" banner state for Board 1 |
| B4 (BLOCKING) | `notifications_dedupe_uq` (`0001_core.sql:554`) is a **permanent** unique index on `(tenant_id, dedupe_key)`; a key shaped `cal-due:<id>:<threshold>` means an instrument is never reminded again after its first recalibration cycle | Dedupe keys now include the due/expiry date itself, so each calibration/training cycle gets its own key space: `cal-due:<instrumentId>:<nextDueISO>:<threshold>`, `training-expiry:<recordId>:<expiresAtISO>:<threshold>` (or a cycle marker for a `gap`, which has no date — see T4 AC1). Re-notify cadence, the threshold-0 status rule, and "whose today" are all stated as exact rules with real numbers (C5 AC1, T4 AC1), and the core due/status functions now take ISO date strings (`YYYY-MM-DD`), never JS `Date` objects, precisely because `pg` returns a `date` column as a local-midnight `Date` that silently shifts under a non-UTC server timezone — this is a **deliberate deviation** from `document-expiry.ts`'s existing `Date`-based signature (`packages/core/src/document-expiry.ts:33`), scoped to this sprint's two new modules only; that existing function's own latent exposure to the same class of bug is out of scope here and not silently fixed, logged as a Known issue (§7) |
| B5 (BLOCKING) | The cited plant-scoping precedent is wrong: `members.service.ts:35-40` is `listPlants` (the plant *picker*'s own list), not member-plant filtering — confirmed by reading the file in full; `MembersService.list` (the actual member roster) applies no plant filter at all, and `GET /v1/members` inherits that | Matrix visibility, "who counts as in the matrix," and the "Members tracked" KPI are now defined explicitly, independently of the (wrong) cited precedent, reusing only the real, confirmed primitive — `authorizePlant`'s own "empty `plantIds` = unrestricted" semantics (`packages/core/src/rbac.ts:238-285`, read in full) — as the basis for a symmetric overlap rule (T1 UC "Plant scope", T1 AC4/AC7) |
| B6 (BLOCKING) | Both instrument and training lists are cursor-paginated, so neither KPI strip has a route to compute page-level totals from | `GET /v1/instruments/summary` and `GET /v1/training/summary` added, mirroring `GET /v1/risks/summary` (Sprint 04) exactly; `q` search added to `GET /v1/instruments` and to the training matrix's member search, the latter resolved through `control.users` by name (not a denormalized column), stated explicitly (C1 AC3/AC6, T1 AC4/AC8) |
| B7 (BLOCKING) | Certificate/evidence linking had two competing mechanisms (`certificate_file_id`, a real FK, *and* the generic `files.entity_kind/entity_id` path) and `POST /v1/files/presign` carries **no capability check at all** (confirmed by reading `files.controller.ts:31-34` — no `@RequireCapability` on the route), so a `viewer` could attach a fabricated "certificate" | `certificate_file_id` is the **only** link for a calibration event — `files.entity_kind/entity_id` is informational metadata only, never read to resolve "the certificate." `certificateFileId` is accepted in the create-calibration-event body, plus a new dedicated `PUT /v1/instruments/:instrumentId/calibration-events/:eventId/certificate` route for attaching after the fact — both gated `calibration:manage`, both server-verifying the file belongs to this tenant **and** `sha256 IS NOT NULL` (fully uploaded) before accepting the link, closing the orphan-cleanup race. Training evidence for a batch submission shares **one** file across every member row via a `training_batch_id` presign target (server-generated per `POST /v1/training/records` call), not a per-member upload (C2 AC1/AC4/AC5, T2 AC2) |
| B8 (BLOCKING) | Board 9's delete/reorder controls are drawn and promised in T1 AC6 ("a tenant can edit/delete/add to") but have no AC — confirmed, no story covers them | New story **T5**: `archived_at` (never the generic soft-delete `deleted_at` — this sprint's own purge job would otherwise eventually destroy real training history tied to an archived competency), code uniqueness enforced only among non-archived rows (partial unique index), archived competencies drop out of the matrix/KPIs/gap calc/both notification jobs, an atomic `PUT /v1/competencies/order`, and the `mandatory`-flip effect stated explicitly (no backfill needed — gap state is always computed live) |
| B9 (BLOCKING) | `entityHref` (`apps/web/src/lib/entity-routes.ts`) has no case for `instrument`/`competency`/`training_record` — confirmed by reading the file in full, the sprint's own earlier claim of "doesn't touch `entity-routes.ts`" (§7) was wrong. Separately: `roleSeesRoute`/`roleSeesNavRoot` (`apps/web/src/config/rbac.ts`, read in full) currently keep `inspector` (`Set(["dashboard","inspections","ncrs","documents","notifications"])`) and `viewer` (`Set(["dashboard","documents","reports","notifications"])`) off `/calibration` and `/training` entirely, even though both roles hold the `:view` capability and can be an instrument's `owner` or a training record's subject | **Resolution (b) chosen, stated explicitly:** `inspector` and `viewer` gain real, read-only nav access to `/calibration` and `/training` (X1 AC1/AC2) — this is the only option consistent with CLAUDE.md rule 10 ("no dead controls"): (a) would ship a notification whose own link 404s/redirects for its own subject, and (c) would deny the person the notification is *about* the one thing every other recipient gets, the ability to see their own compliance state — clearly wrong for a training/calibration module whose whole point is visibility to the person being tracked. `entityHref`/`entityIcon`/`notifMeta` gain the three new cases (B9 §4, notification-bits.tsx) |
| Smaller — `exports` table name | Every `export_jobs` reference in this file corrected to the real table/constraint name, `exports`/`exports_resource_check` (confirmed: `packages/db/migrations/0011_exports.sql:17`, widened by every export-adding sprint since, most recently `0066_risk_msa_exports.sql`) | §1a, §3.2, §4 |
| Smaller — NCR raise-route precedent | `audits.controller.ts`'s own `raise-ncr` route (confirmed by reading it) carries only `@RequireCapability("audit:manage")` — it is **not** precedent for a dual-capability check. Corrected: `calibration:manage` goes on the route itself; the service separately calls `authorize(membership, "ncr:create")` — stated plainly as redundant-but-harmless defense in depth (every role holding `calibration:manage` — admin/manager/auditor — already holds `ncr:create`, confirmed in `packages/core/src/rbac.ts`), not a real independent gate (C3 AC2) |
| Smaller — Idempotency-Key | Stated explicitly on every `POST` create route in this sprint, mirroring `risk.controller.ts`'s own `@Headers("idempotency-key")` pattern (confirmed by reading it) — one key per training **batch** submission, not per member row within it (C2 AC1, T2 AC1) |
| Smaller — retired-instrument edits | Editing a retired instrument, or recording a **new** calibration event against one, now `422`s explicitly; raising an NCR from a **past** (pre-retirement) event via C3's route stays allowed — a real, testable AC, not left implicit (C4 AC4, new) |
| Smaller — append-only correction gap | Calibration events and training records are append-only by design (no delete/edit after creation) — an entry recorded against the wrong person can never be removed or corrected this sprint. Logged as **Q-T4** (new, §7), not silently accepted as fine |
| Smaller — P16 recall-on-overdue | P16's own "pull the instrument from service when overdue" concept is not covered by this sprint. Logged as **Q-C3** (new, §7), explicitly deferred, not silently dropped |
| Smaller — future-dated events | `performed_at` (calibration event) and `completedAt` (training record) in the future is `422` — a real, explicit validation AC, not implicit (C2 AC7, T2 AC4, both new) |
| Smaller — pre-existing file-download hole | Any member can currently download a file by id with no capability/plant check (pre-existing, confirmed, not introduced by this sprint) — training evidence may carry personal data, so this is logged as a **Known issue** (§7) rather than silently shipped on top of without naming it |

**The architect's direct answers to this sprint's own open questions are folded in without re-litigation:**
Board 9 is buildable now that T5's AC exists; the notification substrate genuinely needs new work for (a)
cycle-tied dedupe keys (B4), (b) a daily members × mandatory-competencies cross-join query — named in §4 as
real backend work, not a trivial index scan, and (c) a test proving the SQL-side status/gap query and the
`packages/core` pure-function version agree at every boundary condition (new DoD line, §8); `NcrSource` gains
`"calibration"` as a clean additive change with no exhaustive-consumer compile break (confirmed); migrations
`0067`-`0071` are free (`0066` is `origin/main`'s last on disk); the concurrency patterns for retire/
record-event/NCR-link are confirmed correct as originally proposed, **except**: a transfer action must
additionally check the target `area_id` actually belongs to the target `plant_id` (C4 AC2, amended), and T5's
reorder route must be a single atomic statement — one `UPDATE … FROM (VALUES …)` or an explicit transaction,
never N sequential per-row updates that could interleave (T5 AC3).

### Round 3 (Ceremony 4.2 SEND BACK AGAIN response, 2026-09-29)

A second architecture-review pass on Round 2's amendment returned **SEND BACK AGAIN** — narrower than Round 2
(3 blocking defects, down from nine, plus 10 should-fix items, down from eight). This round resolves all
thirteen **in place** in the stories/sections below (marked `[AMENDED-3]` at each touched AC/UC). Summary:

| # | Gap | Resolution |
|---|---|---|
| BLOCKING 1 | B3's fix (Round 2) left a same-day tie-break hole in C2 AC2: "newest by `performed_at`" is ambiguous on a `date` column — a same-day `fail` recorded *after* a same-day `pass` never became "newest" under a naive `performed_at >` comparison, so `last_result` stayed `pass` and the instrument kept reading "ok" (the exact bug B3 was meant to close); the reverse (fail-then-corrective-pass, same day) had the symmetric problem | "Newest event" is now defined explicitly and identically everywhere it matters: ordered by `(performed_at DESC, created_at DESC)`. A just-recorded event becomes the new "newest" — and drives `last_result` — when its `performed_at` is `>=` the current newest's, with ties broken by `created_at` (a later insert wins). Stated exactly in C2 AC2 (the only place a write actually determines "newest"), cross-referenced from C1 AC1 |
| BLOCKING 2 | B7's `training_batch_id` mechanism (Round 2) could not be built as written: the id was supposedly generated *inside* the same `POST /v1/training/records` call whose own request body must already contain a fully-uploaded `evidenceFileId` — circular/impossible sequencing — and the id itself was "not stored anywhere," so it did nothing | `training_batch_id` dropped entirely. Corrected flow (T2 AC2): client presigns with `entityKind: "training_batch"` and `entityId` **omitted** (no batch entity exists yet) → uploads → marks complete (`sha256` set) → **then** calls `POST /v1/training/records` with that file's real id as `evidenceFileId` in the body; the service writes this same file id to every row created in that call. **Also closes a real bypass**, present in both C2's certificate check and T2's evidence check as originally written: a client could presign with `entityKind` omitted (skipping the `:manage` gate on that specific `entityKind`) and then simply pass an arbitrary existing tenant file's id at link time. Both link-verification paths now additionally require the file's `entity_kind` to exactly match what's expected (`calibration_event`/`training_batch`) **and** `deleted_at IS NULL` (C2 AC4/AC5, T2 AC2) |
| BLOCKING 3 | Real rule-3 (audit) gaps: §4's C2 row meant a `fail` calibration event wrote **no audit at all**; C2 AC5 (certificate-attach) wrote no audit and named nothing to replace it | Three-way split, stated explicitly in C2 AC2/AC5 and §4's table: (a) **every** calibration-event creation, any result, writes a `created` audit on the `calibration_event` row itself; (b) the certificate-attach `PUT` route writes an `updated` audit on the `calibration_event` row; (c) the parent `instrument` row gets its own `updated` audit only when the event actually advances `last_calibrated`/`next_due` (`pass`/`adjusted` only, per B3) — a `fail`'s `last_result` write to the parent is a pure denormalized mirror of the event's own already-audited `result` and is not separately audited, so no result type is ever silently unaudited |
| SF1 | C5's `calibration-due` job only checked due-date, not a `fail` result | Explicit new trigger condition, C5 AC1: an active instrument whose newest event is `fail` notifies its `owner` immediately, regardless of `next_due` |
| SF2 | B4's timezone rule (Round 2) was stated for the notification jobs and future-date validation only, not for reads | Extended explicitly to every READ path: calibration's `dueStatus` filter, summary, detail, and export (plant timezone); training's matrix, summary, gaps, and export (tenant timezone) — same rule everywhere, stated in C1 AC3/AC6, C5 AC2, T1 AC4/AC8, T3 AC1/AC2, and centrally in §3.1 item 15 |
| SF3 | B9's nav fix (Round 2) left a residual dead link: a plant-scoped instrument owner whose own instrument is outside their `plantIds` still gets a notification linking to a page that 404s for them | Resolved as option (a): visibility rule gains "OR the caller IS the instrument's designated owner" (C1 UC "Plant scope", AC4). No existing precedent for an owner/assignee plant-scope bypass was found in this codebase (`ncr.service.ts`'s and `inspections.service.ts`'s own `assertInScope` were read in full — both strictly plant-scope with no such exception), so this is justified on its own terms: notifying someone about their own compliance state only to 404 them is strictly worse than a narrow, single-record exception scoped to exactly the instrument they own |
| SF4 | `activeCalibrationThreshold`'s value for a day-count between named thresholds (e.g. 1-6 days overdue) was undefined; its stated return type (`30 \| 7 \| 0 \| -7 \| ...`) cannot express an unbounded arithmetic sequence in TypeScript | Defined exactly, C5 AC1: for `daysOverdue >= 0`, returns `-7 * floor(daysOverdue / 7)` (the smallest/most-recent crossed 7-day mark; `0`-`6` days overdue all resolve to the already-notified `0` threshold, `7`-`13` to `-7`, and so on, uncapped). Return type corrected to plain `number \| null` |
| SF5 | C1's `q` search covers only name/code; the binding jsx's own placeholder says "Search by ID, name, area..." | `q` extended to also match the instrument's area name (`areas.name` — confirmed `areas` has no `code` column, only `name`), C1 AC3 |
| SF6 | `certificate_file_id`/`evidence_file_id` were specified as plain FKs to `files(id)`, inconsistent with every other tenant-scoped reference, and leaving migration `0067`'s own `files` `UNIQUE (tenant_id, id)` unused | Corrected to composite FKs `→ files(tenant_id, id)` (C2 AC1, T1 AC1) |
| SF7 | T5 (competency catalog) had four small gaps: no 409 on a stale reorder id-set, no stated `seq` for a new/unarchived row, ambiguous 409/422 for a code clash on unarchive, and its UC named only admin/manager for `training:manage` | All four stated explicitly: reorder route 409s if the body's id list doesn't exactly match the current non-archived set (T5 AC3); a new or just-unarchived competency gets `seq = current_max_seq + 1` (T1 AC3, T5 AC1); the code-clash case is 409 Conflict, consistently (T5 AC1); auditor added alongside admin/manager (T5 UC) |
| SF8 | T2's UC language ("members it already succeeded for") implied partial-batch success, contradicting atomicity | Corrected: a training-record batch is one all-or-nothing transaction — all rows commit together or none do, no partial-batch state ever visible (T2 AC1) |
| SF9 | Training coverage KPI's zero-mandatory-competency case was undefined | API returns `coverage: null` (T1 AC8); the web layer renders `"—"`, consistent with this sprint's own empty-case convention for percentage KPIs — corrected further by SF7 below (the API never returns the literal string) |
| SF10 | Two stale cross-references: a line still said `NcrSource`/`ncrs.source` widening was "folded into `0067`" (post-renumbering it's `0068`); Round 1's amendment (B4) claimed a document-expiry-related Known issue was logged in §7, but it was never actually added | Both corrected: C3's Web/Mobile/Shared line now says `0068`; the missing Known issue (`document-expiry.ts`'s `Date`-based signature, §1a/B4) is now added to §7 |

**Effect on §3 (the user's approval ask):** BLOCKING 1-3 change backend behaviour that is part of what §3 asks the
user to approve — the exact "newest event" tie-break rule (new, previously implicit), the corrected
evidence/certificate file-linking sequencing and its `entity_kind`/`deleted_at` double-check (replacing the
unbuildable `training_batch_id` mechanism), and the three-way audit-event split for calibration events. §3.1
items 14 and 16 and §3.2's "what the user is being asked to approve" paragraph are updated accordingly
(marked `[AMENDED-3]`) — these are not cosmetic, they are testable behavioural corrections to the same 17
decisions already on the table, not new scope.

### Round 4 (Ceremony 4.3 SEND BACK AGAIN response, 2026-09-29)

A third architecture-review pass on Round 3's amendment confirmed all three of Round 3's blocking defects are
genuinely fixed, but found **one new blocking gap** plus **nine should-fix items** during its own re-check. This
round resolves all ten **in place** in the stories/sections below (marked `[AMENDED-4]` at each touched AC/UC).
Summary:

| # | Gap | Resolution |
|---|---|---|
| BLOCKING A (new) | No read route exists for a member's own training history, even though DESIGN-05's Board 7 (member drawer: full history + evidence per competency), X1 AC5's `/training?recordId=` deep link, and T5's own promise that archiving a competency keeps existing records "visible in each member's own history" all depend on one — confirmed by reading §4/the contract: only `POST /v1/training/records` exists, and the matrix route (T1 AC4) returns just the newest record per member×competency pair via `DISTINCT ON`, over **non-archived competencies only**, so it could never serve either the drawer or T5's own promise | New **T1 AC9**: `GET /v1/training/records` (cursor, rule 6; required `memberId`, optional `competencyId`) returns a member's full history, **including rows whose competency is archived** (the one training read path that deliberately does not apply T5 AC2's `archived_at IS NULL` predicate, precisely because this route is what T5's own promise depends on), plus `GET /v1/training/records/:id` for one record/evidence lookup. Visibility stated as an explicit rule: `training:manage` sees any member's; a `training:view`-only caller (inspector/viewer) sees **only their own** (`memberId` must equal the caller's own membership id, else `403`, not 404 — an intra-tenant permission boundary, not rule 8's cross-tenant case); cross-tenant/cross-plant ids still 404 first. `CompetencyDto` gains a live `trainingRecordCount` field (`count(distinct member_id) from training_records where competency_id = :id`), which is what Board 9's archive-confirm dialog copy ("N members' existing training records against it are kept") actually reads, available before the user confirms since the catalog admin surface already loads each competency row |
| BLOCKING B | `activeCalibrationThreshold`'s approach-side logic fired "only on exactly day 30, 7, or 0," contradicting its own cited precedent — `document-expiry.ts:33-40`'s `activeExpiryThreshold` actually returns the **smallest threshold crossed on every day** inside the window, not an exact-match day; as written, a missed daily sweep or a mid-cycle entry into the window would silently skip its reminder | Approach-side corrected to **port `activeExpiryThreshold`'s real algorithm** verbatim, using `[30, 7, 0]` (largest first) in place of `EXPIRY_THRESHOLDS`: iterate the list, keep overwriting `active = t` while `daysUntilDue <= t`; the last (smallest) match wins. Concretely: any day 8-30 out returns `30`; any day 1-7 out returns `7`; day 0 (due today) returns `0`; more than 30 out returns `null`. The already-correct, floor-based overdue side (Round 3) is unchanged and still relied on to prevent duplicate notifications across days within one threshold band via the cycle-tied dedupe key (C5 AC1, T4 AC1) |
| BLOCKING C | The owner-sees-own-instrument plant-scope exception (Round 3 SF3) was stated four different, inconsistent ways: C1 AC3 applied it to the list, the UC text said it does **not** widen the list (self-contradicting), AC6 applied it "for a direct-id detail view" to the summary (wrong route), AC4 covered only the detail fetch, and the event-history sub-route was silent on it entirely | One unambiguous table, per route, now in **§3.1 item 3** (not just discussion prose) and cross-referenced everywhere: LIST — exception does **not** apply (an out-of-scope owner still cannot browse the register); SUMMARY/KPI aggregate — exception does **not** apply (an owned-but-out-of-scope instrument is not counted into the caller's own KPI numbers, which stay a pure plant-membership view); DETAIL fetch — exception **applies** (unchanged from Round 3); CALIBRATION-EVENT HISTORY sub-route — exception now **applies**, closing the Round 4 silence (an owner who can see the detail card must be able to see its history, or the detail card's own "last 5"/"View all" controls would 404); EXPORT — exception does **not** apply (an owned-but-out-of-scope instrument is excluded from the caller's own exported board-pack, consistent with the list/summary decision, since an export is a bulk view of the caller's own scope, not a single-record lookup) |
| BLOCKING D | The DoD's bypass-test description (line ~1449) had the fix backwards: it named "presign with `entityKind` omitted" as the happy path, which is literally the security bypass Round 3 closed, not the correct flow | Corrected: the happy path is "`entityId` omitted (no record/batch exists yet), `entityKind` **set** (so the capability gate has something to check)." A separate bypass-test case is added asserting a presign with `entity_kind` left NULL/omitted is either rejected outright or, if accepted as a general-purpose upload, is provably excluded from later certificate/evidence linking (since the link-time check requires an exact `entity_kind` match, AC4/AC5) |
| SF1 | Parent-instrument audit timing needed an explicit statement plus a DoD test for a backdated ("out-of-order") pass | C2 AC2 already ties the parent write to "only when E is the newest event," but the exact "out-of-order backfilled pass" scenario now has its own named DoD test case: a `pass` recorded with a `performed_at` **earlier** than an already-recorded later `fail` must not become newest (per the `(performed_at DESC, created_at DESC)` tie-break) and must not touch the parent row at all — not its `last_calibrated`/`next_due`, not `last_result`, no parent audit |
| SF2 | Newest-event parent locking needed an explicit statement, and the tie-break DoD test's same-transaction methodology was unsound (`now()` is transaction-scoped in Postgres, so two rows inserted in one transaction get identical `created_at`) | Stated explicitly: **every** event that becomes the new "newest" — including a `fail` — performs a `lockVersion`-conditional `UPDATE` on the parent instrument row to write `last_result` (the same optimistic-concurrency guard the route already applies for the whole call, C2 AC2, now named as covering this specific write too, not only the `pass`/`adjusted` due-date advance). The BLOCKING-1 tie-break DoD test is corrected to require **two separate requests/transactions** with the same `performed_at`, so their `created_at` values genuinely differ and the tie-break rule is actually exercised, not accidentally passed by two rows sharing one transaction-scoped `now()` |
| SF3 | Inline certificate upload flow needed the same `entityId`-omitted-at-presign-time statement as the training-evidence flow, plus a named code touch point | C2 AC4 now states explicitly: the inline certificate upload (within the create-calibration-event dialog) presigns with `entityKind: "calibration_event"` and `entityId` **omitted** — mirroring T2 AC2's B7/Round-3 fix — then links via `certificateFileId` once uploaded/completed. **`apps/web/src/hooks/use-files.ts:41`** is named as a real touch point: `uploadFile`'s `entity` parameter currently requires **both** `entityKind` and `entityId` together (`entity?: { entityKind: string; entityId: string }`), so it needs an entity-id-optional shape (`entityId?: string`) for this call site. The presign capability check (which `:manage` capability a given `entityKind` requires) is stated to live in `FilesService.presign`, not `FilesController` — the controller route is `@Internal()` only (confirmed: no `@RequireCapability`, `files.controller.ts:31-34`) and the specific `entityKind` being presigned is only known once the request body is parsed, which happens at the service layer |
| SF4 | `certificate_file_id`/`evidence_file_id`'s delete behaviour was unstated, leaving the files-purge job free to silently orphan a calibration/training record | C2 AC1 and T1 AC1 now state explicitly: both FKs use **`ON DELETE RESTRICT`** — the purge job can never delete a file that is still linked from a calibration event or training record; it must fail/skip that file instead, exactly like every other "this file is still referenced" case the purge job already has to handle |
| SF5 | Optional: no reference noted to this codebase's own existing "who may claim a presigned upload" pattern | Noted (not mandated) in C2 AC4/AC5 and T2 AC2 as a precedent already in this codebase for the same class of check: `apps/api/src/portal/portal.service.ts:180-191`'s `attachEvidence` requires `uploaded_by = actor` before letting a caller claim/link a file — either that exact pattern or an equally sound mechanism is acceptable |
| SF6 | `activeCalibrationThreshold`'s return type was inconsistently restated as "plain `number`" in two places (§3.1 item 15's own AC1 prose, and the DoD's SHOULD-FIX-4 bullet) despite Round 2's own fix already settling on `number \| null`, and JS's `-7 * 0 === -0` risked a spurious `toBe(0)` test failure | Every remaining "plain `number`" reference (C5 AC1's own prose, DoD line ~1465) corrected to **`number \| null`**, matching what the function signature and §4's table already state. New explicit requirement: the implementation and its tests must normalize `-0` to `0` (e.g. `Object.is(-0, 0)` awareness or a `+0`/`\|\| 0` coercion) wherever `daysOverdue` lands in `0`-`6` (`-7 * floor(0..6 / 7) = -7 * 0 = -0` in JS) |
| SF7 | T1 AC7/AC8's Coverage-KPI text implied the API itself returns the literal string `"—"`, contradicting a numeric-KPI contract | Corrected: `GET /v1/training/summary`'s `coverage` field is typed `number \| null` (null exactly when the denominator is zero); the **web** layer is what renders `"—"` for a null value — the same split every other empty-numeric-KPI in this codebase already uses, not a literal string leaving the API |
| SF8 | T5 reorder had three loose ends: no defined behaviour for a duplicate-`seq` request body, an unreconciled `lockVersion` mention in the UC text with no such field in AC3, and no stated 409 for a competency-**create** code clash (only un-archive had one) | (a) `PUT /v1/competencies/order`'s body is corrected to an **explicitly-ordered array of ids** (`{ ids: string[] }`, position = new `seq`, 0-indexed) — this removes the duplicate-`seq` question entirely, since there is no client-supplied `seq` to duplicate; a repeated id is caught by the existing "body's id set doesn't exactly match the current non-archived set" 409 (a set can't contain a duplicate, so a repeated id makes the set smaller than the array, which the exact-match check already rejects). (b) The UC's "a stale `lockVersion` on either action 409s" line is corrected to name `lockVersion` for archive/unarchive **only** — the reorder route's own concurrency guard is its 409-on-id-set-mismatch check (AC3, unchanged), not a `lockVersion` field, so the UC text no longer implies a field that doesn't exist. (c) `POST /v1/competencies` (T1 AC3) now states explicitly: a `code` clash against a non-archived competency returns `409 Conflict`, the same disposition already defined for the un-archive case (T5 AC1(c)), not a `422` |
| SF9 | The fail-triggers-notification UC/§3.1 wording said "immediately," implying real-time delivery, when the underlying job is a daily sweep; the `cal-fail` dedupe-key requirement (incorporate the newest failing event's own id) was worth confirming explicitly, not just implied | Every "immediately" describing the fail-notification trigger (C5's UC, §3.1 item 15's closing sentence) is corrected to **"on the next daily `calibration-due` sweep"** — matching this sprint's own established daily-job cadence (the DoD's own SF1 bullet already said "next sweep" correctly; the UC/§3.1 prose is now brought into line with it, not the other way around). Confirmed (already correct, no behavioural change needed): the `cal-fail` dedupe key already reads `cal-fail:<instrumentId>:<eventId>` — the newest **failing** event's own id, found via the `(performed_at DESC, created_at DESC)` tie-break (C2 AC2) — so a second, distinct fail event after a recalibration attempt already gets its own fresh key and re-notifies; this is stated here as confirmed-correct, not re-specified as new |

**Effect on §3 (the user's approval ask):** BLOCKING A adds one new pair of read routes and a capability-scoped
visibility rule to what §3 asks the user to approve — training records were already approved as a real
per-completion history table (§3.1 item 8), but this round is the first to specify how that history is actually
*read*, including who may read whose. BLOCKING B changes the exact, testable approach-side behaviour of
`activeCalibrationThreshold`, part of item 15's cycle-tied notification design. BLOCKING C does not add a new
decision but resolves the one part of item 3 (the owner-sees-own-instrument exception, Round 3 SF3) that was
never actually written into §3.1 itself — only into discussion prose — so item 3 now states it as a real,
per-route table the user is approving, not an implicit carry-over. §3.1 items 3, 8, and 15, and §3.2's "what the
user is being asked to approve" paragraph are updated accordingly (marked `[AMENDED-4]`). **None of Round 4's
should-fix items change what is being approved** — they sharpen already-approved decisions' exact, testable
behaviour (the threshold return type/value, the FK delete rule, the reorder request shape, wording precision),
the same class of non-scope-changing correction Round 3 made for its own should-fix items.

---

## 1. Goal and roles served

Replace the `/calibration` and `/training` `ModulePlaceholder`s (served today via
`PLANNED_MODULES["calibration"]`/`PLANNED_MODULES["training"]`, ledger entries `planned:calibration`/
`planned:training`) with two real, backend-complete quality-system modules:

- **Calibration management** (IATF 16949 §7.1.5, measurement-equipment control): an instrument register with
  due-date tracking, a calibration-event history per instrument, certificate attachment, an out-of-tolerance
  finding path into a real NCR, and due/overdue notifications — everything `CalibrationManagement` in
  `qms-modules.jsx` (lines 176-319, read in full) and FEATURES §12/§224 specify.
- **Training & competency** (IATF 16949 §7.2, competence): a tenant-defined competency catalog, a
  member-by-competency matrix with certified/expiring/gap/N-A cell states, per-member training history with
  evidence, mandatory-gap and expiring reports, and expiry notifications — everything `TrainingMatrix` in
  `qms-modules.jsx` (lines 1-174, read in full) and FEATURES §12/§223 specify.

Roles served: **admin, manager, auditor** (module administration: add/retire instruments, record
calibrations/training, raise NCRs, export reports); **inspector, viewer** get read-only visibility of the same
two capabilities (mirrors exactly how `risk:view`/`msa:view`/`fmea:view` are already granted broadly while the
standalone module nav stays narrower to admin/manager/auditor, §1a). No `m-*.jsx` design shows an actual
calibration-status or training-status UI control (§1a) — **mobile is unaffected by this sprint**, proven by
`pnpm --filter @kaenal/mobile typecheck` staying green on the additive shared-type changes only.

## 1a. Verified current state (grepped this session, not assumed — CLAUDE.md rule 10)

| Fact | Evidence |
|---|---|
| No `instruments`, `calibration_events`, `competencies`, or `training_records` table exists anywhere; no `apps/api/src/calibration` or `apps/api/src/training` directory exists | `grep -rn "CREATE TABLE" packages/db/migrations/*.sql` — no match; `ls apps/api/src` — 32 existing feature dirs (`risk`, `msa`, `audits`, `fmea`, `spc`, `files`, `notifications`, `jobs`, … — no `calibration`/`training`) |
| `implementation/02-DATABASE.md`/`03-API.md` define no calibration/training tables; the phase docs `phases/P16-calibration.md` and `P17-training.md` are marked `Status: Backend 🔴 PROPOSED · FE 🔴` and both name their own **open sign-off questions** (P16: warn-window days, external-lab vendor tracking, block-inspections-on-overdue-gauge; P17: catalog seeded per-tenant vs global, expiring-window days, role-requirement auto-gap) — this sprint's §3 resolves each explicitly rather than leaving them implicit | both phase files read in full this session |
| Next free migration number is **0067** — `0066_risk_msa_exports.sql` (Sprint 04) is the last one on disk; no branch (local or remote) has a migration past 0066. ROADMAP §4's guess of "05: 0047-0049" is stale (written before Sprints 02-04 landed 0061-0066) | `ls packages/db/migrations \| sort \| tail`; confirmed no gap-fill migrations exist between 0042 and 0050 either (0043-0049 were never used, also stale ROADMAP numbering, not this sprint's concern) |
| `apps/web/src/config/navigation.ts` already has real nav entries: `{ id: "training", href: "/training", icon: Award }`, `{ id: "calibration", href: "/calibration", icon: Wrench }` | `apps/web/src/config/navigation.ts:160-161` |
| `apps/web/src/config/planned-modules.ts` still lists both (`training: { title: "Training & competency", icon: Award }`, `calibration: { title: "Calibration", icon: Wrench }`); `placeholder-ledger.ts` still carries `"planned:calibration": 5` / `"planned:training": 5` (correctly pointing at this sprint) | `apps/web/src/config/planned-modules.ts:29-30`; `placeholder-ledger.ts:14-15` |
| `apps/web/src/config/rbac.ts` `ROLE_NAV`: admin = all, manager = all-minus-platform (both already cover `training`/`calibration` once built — neither id is in `PLATFORM_ROOTS`), but **auditor's explicit allow-list does not include `training` or `calibration`** (it lists `risk`/`msa`/`fmea` from Sprint 04, but not these two) — this sprint adds both, same reasoning Sprint 04 used for `risk`/`msa` (auditor is Kaenal's elevated QMS role, not a read-only reviewer) | `apps/web/src/config/rbac.ts:32-47` |
| No `calibration:view`/`calibration:manage`/`training:view`/`training:manage` capability exists in `packages/core/src/rbac.ts` | `grep -n "calibration:\|training:" packages/core/src/rbac.ts` → 0 hits |
| `plants`/`areas` are real tables (`0001_core.sql`, `plants(tenant_id, code, …)`, `areas(tenant_id, plant_id, name, …)`) with an established plant-scope pattern: `packages/core/src/rbac.ts`'s `authorizePlant`/`isPlantScoped`. **[AMENDED — B5, correction]** `apps/api/src/members/members.service.ts:35-40` is **`listPlants`** (the plant-picker's own read, unrelated to member filtering) — confirmed by reading the file in full this session; `MembersService.list` (the actual member roster `GET /v1/members` serves) applies **no** plant filter at all. This sprint therefore reuses only the real primitive, `authorizePlant`'s own "empty `plantIds` = unrestricted" semantics, and states its own symmetric overlap rule explicitly (§0/B5, T1's UC) rather than pointing at a precedent that does not exist — a free-text "area" field is still avoided (the jsx's `area: 'Pune-1 / Metrology'` string is a mock display concatenation, not a designed data-model constraint — same class of correction Sprint 04 made for `RiskCategory`/code formats), that part of the original claim holds | `packages/db/migrations/0001_core.sql:85-104`; `apps/api/src/members/members.service.ts` (read in full: `listPlants` at 35-40, `list` at 44+, neither filters by plant for the roster); `packages/core/src/rbac.ts:238-285` |
| `memberships.title text` already exists (added `0003_shared_identity.sql`) — this is exactly the free-text job-title field the training matrix's "role" column needs ("Quality Manager", "CMM Specialist"); **no new column needed** | `packages/db/migrations/0003_shared_identity.sql:109` |
| `apps/api/src/jobs/processors/document-expiry.ts` + `packages/core/src/document-expiry.ts` (`activeExpiryThreshold`, `EXPIRY_THRESHOLDS = [90,30,7]`, idempotent `dedupeKey`) is the established, direct precedent for "a daily per-tenant sweep notifies an owner at a threshold, never re-sending" — this sprint's `calibration-due`/`training-expiry` jobs are the same shape, not a new mechanism | `apps/api/src/jobs/processors/document-expiry.ts` read in full; `apps/api/src/jobs/worker.ts:225-240` (the `docs` queue's daily per-tenant enqueue) |
| `apps/api/src/audits/audits.service.ts:655-676` (`raiseNcr`) is the established, direct precedent for "an out-of-spec finding in one module creates a real NCR": loads the source row, calls `NcrsService.create(... source, sourceId, plantId)`, then one-time links the source row back (`ncr_id IS NULL` guard preventing a double-raise) | read in full this session |
| `NcrSource` enum (`packages/types/src/enums.ts:107-113`) currently has `inspection\|manual\|complaint\|audit` — no `calibration` member; `ncrs.source` carries a literal `CHECK` constraint (`0001_core.sql`), so adding `calibration` needs a migration `ALTER … DROP/ADD CONSTRAINT`, the same class of change Sprint 04 made to `entity_links`'s CHECK for `risk`/`fmea` | `packages/db/migrations/0001_core.sql` (ncrs table); `packages/types/src/enums.ts:107-113` |
| **[AMENDED — smaller correction]** `ExportResource` enum + `exports_resource_check` CHECK (on the real `exports` table, confirmed `0011_exports.sql:17` — **not** `export_jobs`, this file's own earlier naming was wrong) have been widened once per new single-module export in every sprint so far (`audit_report` S02, `predictive_forecast_pack` S03, `risk_board_pack`+`gauge_rr_aiag_report` S04, each via its own migration `ALTER`) — same pattern this sprint reuses for `calibration_audit_pack`/`skill_gap_report` | `packages/db/migrations/0011_exports.sql:17`, `0061_audits_module.sql:69`, `0062_risk_predictions.sql:70`, `0066_risk_msa_exports.sql:15` |
| `files.entity_kind`/`entity_id` are **free-text**, not constrained to `EntityKind` (only `create_wizard`'s own child table has a literal CHECK) — a certificate/evidence file can attach to `entity_kind = 'calibration_event'` or `'training_batch'` today with **no schema change to `files`**. **[AMENDED — B7, correction]** this generic field is **informational only** for this sprint's two modules — the authoritative link is always a real FK column (`certificate_file_id`, `evidence_file_id`), never a lookup by `entity_kind`/`entity_id` (§0/B7). Also confirmed this session: `POST /v1/files/presign` (`files.controller.ts:31-34`) carries **no `@RequireCapability` at all** — a real, pre-existing gap this sprint closes only for its own two new `entityKind`s (C2 AC4, T2 AC2), not universally | `packages/db/migrations/0001_core.sql:410-419` (no CHECK on `files.entity_kind`); `apps/api/src/files/files.service.ts` (accepts any string); `apps/api/src/files/files.controller.ts:31-34` (presign has no capability guard) |
| No `m-*.jsx` shows an actual calibration-status or training-status UI element. The only string hits are incidental: `m-oversight.jsx:20` is a mock **document** notification titled "Calibration schedule Q3" (a document, not a calibration-module control); `m-work.jsx:24` is a mock **inspection** titled "Monthly calibration audit"; `m-work.jsx:134/139` is inspection-checklist copy ("Torque wrench calibrated (cert current)") inside one specific inspection's own instructions — none of these render an instrument register, a due-date badge, or a training-gap indicator. ROADMAP §5's own conditional ("only if a jsx shows it") is confirmed **not met** | `grep -in "calibrat\|gauge\|instrument" project_brain/mobile/src/m-*.jsx`, all 5 hits read in context this session |
| `inspections.jsx`/`ncr.jsx` (the binding web designs for those two already-built modules) show **no** instrument-picker field, no calibration-status badge, and no training-gate control anywhere — the only hit is one mock activity-feed line, `inspections.jsx:703`, "generated Finding #2 on torque wrench calibration" (decorative comment-feed text, not a UI control) | `grep -in "calibrat\|instrument\|gauge" project_brain/project/src/inspections.jsx project_brain/project/src/ncr.jsx` |
| `qms-modules.jsx`'s calibration overdue banner (`CalibrationManagement`, lines 255-263) reads: *"Measurements with this instrument are blocked at inspection sign-off. All inspections recorded with it since {last} require traceability review."* This is a real operational claim about the **Inspections module**, which has no instrument field at all (row above) — building the actual block would mean adding an instrument-selection field and a sign-off gate to Inspections, a module this sprint does not own and which has no jsx showing that field (rule 0 "no invented scope" / rule 9 governs *this sprint's* two jsx components, not a third module's). Flagged as **Q-C1** (§7) and the banner text is corrected in this sprint's build (§3.1), not silently reproduced as a false claim | `qms-modules.jsx:255-263` read closely |
| `qms-modules.jsx`'s "Linked e-learning" card (`TrainingMatrix`, lines 147-166) shows Cornerstone and SAP SuccessFactors as already `Connected`, and Litmos/Custom-SCORM-upload with a `Connect` button. The existing `integrations` table's `provider` CHECK (`0032_integrations.sql:22`) whitelists `slack, ms_teams, ms365, google, smtp, …` — **no LMS vendor is in that list**, and no `implementation/09-INTEGRATIONS.md` section names one. Building a real Cornerstone/SuccessFactors/Litmos OAuth connector is exactly the class of external-vendor work ROADMAP Q5 defers to Sprint 13 (no vendor decision, no credentials, no spec) — flagged as **Q-T1** (§7) for exclusion this sprint, not silently faked as "Connected" (rule 10) | `qms-modules.jsx:147-166`; `packages/db/migrations/0032_integrations.sql:22` |
| `packages/core/src/spc.ts`/`risk-matrix.ts`/`gauge-rr.ts` establish the precedent this sprint follows: pure, unit-tested derivation functions in `packages/core`, never a stored "status" column computed against `now()` | read in prior sprints, confirmed still the pattern |

---

## 2. Stories

### C1 — Instrument register: schema, list, detail

**Design:** `CalibrationManagement` (`qms-modules.jsx:190-310`) — KPI strip, instrument register table with
search/segmented filter, detail card (overdue banner, field grid, history table).

UC
- Happy: open `/calibration` → KPI strip (real counts), register table (search by ID/name/area, filter
  All/Due soon/Overdue), clicking a row selects it and populates the detail card (fields, last-5 history).
- Overdue: an overdue instrument's detail card shows the warning banner with days-overdue and last-calibrated
  date — text corrected per §1a/Q-C1 (no false "blocked at inspection sign-off" claim).
- **[AMENDED — B3, new; AMENDED-3] Failed calibration:** an instrument whose newest event is `fail` (per C2
  AC2's exact tie-break rule, BLOCKING 1) shows as `overdue` (AC2's override) regardless of its computed
  `next_due` — the detail card's banner must not show the same
  "overdue N days, last calibrated on X" copy for this case (a `fail` instrument may not be date-overdue at
  all yet, so "N days overdue" would be false or nonsensical); a distinct **"failed calibration" banner
  state** is flagged for the designer (§5, small follow-up to Board 1, not a new board), reading something
  like "Failed its last calibration on {performed_at} — out of service until recalibrated," exact copy left to
  the designer.
- Empty: tenant has zero instruments → register/KPI strip show a real empty state ("0" everywhere, "No
  instruments yet — Add instrument"), not the jsx's populated mock.
- Permission: `calibration:view` required for the page; a role without it never sees the nav entry (curated,
  §4) and a direct deep-link 403s (server-side, for `partner`) or is client-blocked (inspector/viewer, mirrors
  X1's risk/msa precedent exactly).
- Plant scope: **[AMENDED — B5, corrects the wrong cited precedent]** `inspector`/`viewer` (the two
  `isPlantScoped` roles, `packages/core/src/rbac.ts:235`) see only instruments whose `plant_id` is in their own
  `membership.plantIds` — **not** `members.service.ts:35-40`, which is `listPlants` (the plant-picker's own
  list), confirmed by reading it in full; `MembersService.list` (the real roster) filters by plant not at all.
  The real, confirmed primitive this reuses is `authorizePlant`'s own semantics (`rbac.ts:238-285`): an empty
  `membership.plantIds` means "unrestricted," and a non-plant-scoped role (`admin`/`manager`/`auditor`) is never
  filtered regardless of what `plantIds` holds.
  **[AMENDED-4 — BLOCKING C, single unambiguous rule per route]** Round 3's owner-sees-own-instrument exception
  (SF3) was previously stated four different, inconsistent ways across C1/C2's routes. It is now **one table**,
  restated in full in §3.1 item 3 (the actual approval text, not just this UC's prose) and applied identically
  everywhere:
  | Route | Owner-exception applies? |
  |---|---|
  | **LIST** (`GET /v1/instruments`, AC3) | **No.** An out-of-scope owner's own instrument does **not** appear in the list either — plant-overlap is the only visibility rule here, with zero exception (they still reach it via the notification's deep link straight to DETAIL, which does carry the exception). |
  | **SUMMARY/KPI aggregate** (`GET /v1/instruments/summary`, AC6) | **No.** An owned-but-out-of-scope instrument does not count toward the caller's own KPI numbers — the summary stays a pure plant-membership view, consistent with the list decision. |
  | **DETAIL fetch** (`GET /v1/instruments/:id`, AC4) | **Yes** (unchanged from Round 3). |
  | **CALIBRATION-EVENT HISTORY** (`GET /v1/instruments/:id/calibration-events`, C2 AC3) | **Yes**, newly closed this round — an owner who can see the detail card must be able to see its history, or the card's own "last 5"/"View all" controls would 404 for exactly the person the module means to keep informed. |
  | **EXPORT** (`calibration_audit_pack`, C5 AC2) | **No.** An owned-but-out-of-scope instrument is excluded from the caller's own exported board-pack, consistent with the list/summary decision — an export is a bulk view of the caller's own scope, not a single-record lookup. |

  No existing precedent for an owner/assignee plant-scope bypass exists in this codebase (`ncr.service.ts`'s and
  `inspections.service.ts`'s own `assertInScope` were read in full for this amendment — both strictly
  plant-scope with no such exception), so DETAIL and HISTORY's "yes" is justified on its own terms, not a cited
  precedent: C5's `calibration-due` job notifies an instrument's `owner` regardless of that person's own plant
  scope (B9, X1), so without this narrow, single-record carve-out the exact person a notification is *about*
  would get a detail-card link that 404s for them, and a history sub-view that 404s underneath it — a dead
  control either way (rule 10). LIST/SUMMARY/EXPORT stay a pure plant-membership view because widening any of
  them would let an out-of-scope owner enumerate or aggregate over instruments beyond the one they were
  notified about, which the notification's own deep link never requires.
- Error/offline: list fetch fails → retry affordance; offline banner disables Add/Record/Retire/Transfer
  mutations (reuse S1-5 infrastructure).

AC
1. **[AMENDED — B1/B2/B3]** Migration `0068_calibration.sql` (**renumbered from `0067`** — B2 inserts a new
   `0067_composite_fk_prereqs.sql` first, see §0): `instruments` — `tenant_id`, `id`, `code` (`CAL-YYYY-NNNN`
   via `codes.ts`'s `counters` mechanism — the jsx's `CAL-001` mock format is corrected to the one established
   `PREFIX-YYYY-NNNN` pattern, exactly as Sprint 04 corrected `R-NNN`/`MSA-NNN`; `CodeKind` gains
   `"instrument"` → prefix `CAL`), `name`, `type` enum (`cmm|comparator|profilometer|ndt|caliper|torque|
   laser_tracker` — the 7 distinct types the jsx's `INSTRUMENTS` fixture actually uses), `plant_id` (composite
   FK → `plants(tenant_id,id)`, NOT NULL — every physical instrument belongs to one plant; **this composite FK
   can only be created once `0067` adds `UNIQUE (tenant_id, id)` to `plants`, B2**), `area_id` (composite FK →
   `areas(tenant_id,id)`, NULL — optional finer location, must belong to `plant_id` when set, checked in the
   service not the DB; **same `0067` dependency for `areas`**), `method` text NOT NULL (free text — "Internal —
   ISO 10360", "External — NABL accredited"; not an enum, since accreditation-body names are open-ended and the
   jsx never caps the set), `tolerance` text NOT NULL (free text display string, e.g. "±1.7μm" — not a numeric
   column, since units vary by instrument type and no calculation ever reads it, unlike MSA's numeric
   `tolerance`), `interval_months` int NOT NULL CHECK > 0, `last_calibrated` date NULL, `next_due` date
   **[AMENDED — B1] GENERATED ALWAYS AS ((last_calibrated + make_interval(months => interval_months))::date)
   STORED** — corrected from the original `(last_calibrated + (interval_months || ' months')::interval)`
   form, which throws "generation expression is not immutable" on Postgres 16 (casting text to `interval`
   depends on session `DateStyle`/`IntervalStyle`, so Postgres cannot prove it `IMMUTABLE`); `make_interval`
   takes only integer arguments and is genuinely `IMMUTABLE`. NULL when `last_calibrated` is NULL — a
   never-calibrated new instrument has no due date yet, see C6. **Month-end rule, stated explicitly and
   confirmed (not asserted) as Postgres's real behaviour:** adding a month-valued interval to a `date` clamps
   an overflowing day to the target month's last valid day — `'2026-01-31'::date + make_interval(months => 1)
   = '2026-02-28'` (2026 not a leap year), `'2028-01-31'::date + make_interval(months => 1) = '2028-02-29'`
   (2028 is). Both worked examples are asserted in an integration test against a real Postgres 16 instance
   (this is DB-generated-column arithmetic, not a `packages/core` pure function, so it cannot be unit-tested in
   isolation from Postgres). `owner` (composite member FK), `status` enum (`active|retired`) DEFAULT `active`
   (the register's own lifecycle status — distinct from the *due-status* `ok|warn|overdue|unscheduled`, which
   is never stored, see AC2), **[AMENDED — B3, new; AMENDED-3 — BLOCKING 1] `last_result` enum NULL
   (`pass|adjusted|fail`) — always the result of the instrument's newest calibration event, written in the
   same transaction as every C2 event-recording call regardless of outcome (unlike `last_calibrated`, which
   only advances on `pass`/`adjusted` — see C2 AC2). "Newest event" is defined exactly, with a same-day
   tie-break, in C2 AC2 — ordered by `(performed_at DESC, created_at DESC)`, never a bare `performed_at >`
   comparison (which silently fails to detect a same-day `fail` recorded after a same-day `pass`, the exact
   bug this column exists to close) — this is what lets AC2's due-status function detect "newest event is a
   fail" without a live subquery on every read**, `lock_version`, standard audit columns. Forced RLS, leading
   `tenant_id` index, unique `(tenant_id, code)`, **[AMENDED — B2] `UNIQUE (tenant_id, id)`** (self-consistency
   — `instruments` is itself a composite-FK target for `calibration_events`, C2 AC1).
2. **[AMENDED — B3/B4]** `packages/core/calibration.ts` (pure): `instrumentDueStatus(input: { nextDue: string
   | null; lastResult: "pass" | "adjusted" | "fail" | null; today: string }):
   "ok"|"warn"|"overdue"|"unscheduled"` — **takes ISO date strings (`YYYY-MM-DD`), never JS `Date` objects**
   (B4 — `pg` returns a `date` column as a local-midnight `Date`, which silently shifts under a non-UTC server
   timezone; this is a deliberate deviation from `document-expiry.ts`'s existing `Date`-based signature,
   scoped to this sprint's new modules, §0). Rule, in priority order: **`last_result = 'fail'` → `overdue`,
   unconditionally, regardless of `nextDue`** (B3 — a failed check means the instrument is not fit for use
   right now, no matter what the computed due date says); else `unscheduled` when `nextDue` is null (never
   calibrated); else `overdue` when `nextDue < today`; else `warn` when `nextDue` is within the warn window
   (**30 days**, §3.1 — resolves P16's own open "warn-window days" question) **or `nextDue = today`** (the
   due-day itself reads `warn`, not `overdue` — B4(b); "overdue" means strictly past due); else `ok`.
   Unit-tested including the boundary days and the `last_result = 'fail'` override with a `nextDue` far in the
   future (proving the override truly ignores the date).
3. **[AMENDED — B6; AMENDED-3 — SHOULD-FIX 2, 5]** `GET /v1/instruments` (cursor, rule 6; filters
   `type`/`status`/`dueStatus`(`due_soon`|`overdue`)/`plantId`/**`q` (new — free-text search over
   `instruments.name`/`instruments.code` **and, `[AMENDED-3]` extended per the jsx's own "Search by ID, name,
   area..." placeholder, the instrument's `areas.name`** — `areas` has no `code` column (confirmed by reading
   `0001_core.sql`, only `name`), so the area side of `q` matches on `name` alone; `ILIKE`-matched, joined, B6
   / SF5)**; plant-scoped for a plant-scoped role per T1's corrected §0/B5 rule — **[AMENDED-4 — BLOCKING C]**
   the LIST route does **not** carry the owner-sees-own-instrument exception (that applies only to DETAIL and
   HISTORY, per the single table in C1's UC "Plant scope" / §3.1 item 3) — a pure plant-overlap filter, no
   exception), `POST /v1/instruments` (`calibration:manage`), `GET
   /v1/instruments/:id` (`calibration:view`), `PATCH /v1/instruments/:id` (`lockVersion`, `calibration:manage`
   — edits name/type/plant/area/method/tolerance/interval/owner; never `last_calibrated`/`next_due`/
   `last_result` directly, those only change via C2's calibration-event route; **[AMENDED — C4, new] 422 if the
   instrument's `status = 'retired'`** — see C4 AC4). All mutations `withAudit` in the same transaction
   (rule 3). **[AMENDED — smaller correction]** `POST /v1/instruments` takes an `Idempotency-Key` header,
   mirroring `risk.controller.ts`'s pattern exactly (same as every other `POST` create route in this sprint,
   §0). **[AMENDED-3 — SHOULD-FIX 2]** `dueStatus`'s `warn`/`overdue` classification, and every other read in
   this route, computes "today" in the **instrument's own plant's timezone** (`plants.timezone`) — the same
   rule C5 AC1's job uses (B4(c)) — never the server's or the tenant's, applied consistently so the SQL-side
   filter and the `packages/core` pure function never disagree at a boundary.
4. **[AMENDED-3 — SHOULD-FIX 3; AMENDED-4 — BLOCKING C]** Cross-tenant instrument id → 404, not 403 (rule 8);
   cross-plant (for a plant-scoped role) → 404, not 403 **unless the caller is that instrument's own `owner`, in
   which case the detail fetch succeeds** (mirrors the `assertEntityVisible` plant-scope pattern, §1a — this is
   the DETAIL row of the single owner-exception table in C1's UC "Plant scope" / §3.1 item 3; LIST, SUMMARY, and
   EXPORT do **not** get this exception), both mutation-tested against RLS, including a case proving an
   out-of-scope owner can fetch their own instrument by id but still cannot list other out-of-scope instruments,
   and does not see it counted in the summary/export.
5. **[AMENDED — B3]** KPI strip, exact formulas (mirrors Sprint 04 R1 AC6's precedent of stating every
   formula, not eyeballing):
   - **Instruments tracked** = `count(*) where status='active'`.
   - **Due < 30 days** = `count(*) where status='active' and instrumentDueStatus(...) = 'warn'`.
   - **Overdue** = `count(*) where status='active' and instrumentDueStatus(...) = 'overdue'` — **this now
     includes every instrument whose newest event is `fail`, regardless of its computed `next_due`** (B3's
     override, AC2), so "Overdue" is no longer purely a date comparison.
   - **Out-of-tol findings (YTD)** = `count(*) from calibration_events where result in ('adjusted','fail') and
     performed_at in the tenant's current calendar year` (an "out-of-tolerance finding" is any event where the
     instrument was found out of tolerance at check time — `adjusted` means it was out of tolerance and then
     corrected, `fail` means it remains out of tolerance; `pass` never counts). Sub-stat "N led to NCR" =
     `count(*) from calibration_events where result in ('adjusted','fail') and ncr_id is not null and
     performed_at in the current calendar year` (C3).
6. **[AMENDED — B6, new; AMENDED-3 — SHOULD-FIX 2; AMENDED-4 — BLOCKING C]** `GET /v1/instruments/summary`
   (`calibration:view`) — returns the four KPI numbers above precomputed server-side in one round trip,
   plant-scoped identically to the list route, and — like the list route — **does not** carry the owner-exception
   (an owned-but-out-of-scope instrument does not count toward the caller's own KPI numbers; the summary is a
   pure plant-membership aggregate, per the single table in C1's UC "Plant scope" / §3.1 item 3), mirroring
   `GET /v1/risks/summary` (Sprint 04) exactly; this is what the web KPI strip actually reads from, since the
   list route alone (cursor-paginated) cannot compute a tenant-wide total client-side. Uses the **same
   instrument-plant-timezone "today" rule as AC3's `dueStatus` filter and C5 AC1's job** (SF2) — the summary's
   `overdue`/`warn` counts and the list's filter can never disagree at a day boundary because both derive
   "today" the same way, per tenant plant.

**Web/Mobile/Shared**
- **Web:** `apps/web/src/features/calibration/` — `CalibrationPage` (KPI strip **[AMENDED — B6, now reads
  `GET /v1/instruments/summary`]**, register table w/ search **[AMENDED — B6, real `q` param, not client-side
  filtering]** + segmented filter, detail card w/ overdue banner (corrected text) + **[AMENDED — B3, new]**
  failed-calibration banner state, field grid, history table (last 5, "View all" → C4's full list)), empty/
  loading/error/permission/offline states, deep-link `/calibration?id=<uuid>`.
- **Mobile:** not built — no `m-*.jsx` design (confirmed §1a); no route, no nav entry;
  `pnpm --filter @kaenal/mobile typecheck` must stay green on the additive shared-type changes only.
- **Shared:** migration `0068` **[AMENDED — B2, renumbered from `0067`]** (instruments table, depends on
  `0067`'s composite-FK prereqs); `InstrumentDto`/`InstrumentListQuery`/`CreateInstrumentBody`/
  `UpdateInstrumentBody` + `InstrumentType`/`InstrumentLifecycleStatus`/**[AMENDED — B3, new]
  `CalibrationResult`** enums in `packages/types`; `packages/core/calibration.ts` (pure, unit-tested, ISO-date
  signature per B4); `calibration:view`/`calibration:manage` in `packages/core/src/rbac.ts`; `CodeKind` gains
  `"instrument"`.

### C2 — Record a calibration event + certificate attachment

**Design:** `qms-modules.jsx:300-301` "Record calibration" / "Upload cert" buttons (`kToast` only in the
prototype); history table (`qms-modules.jsx:283-296`).

UC
- Happy: "Record calibration" opens a dialog (result: pass/adjusted/fail, performed-by, notes, optional
  certificate upload) → creates a real `calibration_events` row; **[AMENDED — B3]** a `pass`/`adjusted` result
  advances `last_calibrated`/`next_due` on the instrument, a `fail` result never does (it only updates
  `last_result`); the detail card's history table shows the new row immediately.
- Certificate: **[AMENDED — B7; AMENDED-3 — BLOCKING 2]** "Upload cert" uploads via the existing Files
  presign→PUT→complete pipeline, then links the resulting file as the event's `certificate_file_id` — either
  inline (the `certificateFileId` field in the same create-calibration-event call) or, for an already-recorded
  event, via the new dedicated attach route (AC5). `certificate_file_id` is the **only** thing a UI or API
  consumer reads to find "the certificate" — never a `files.entity_kind='calibration_event'` lookup, though the
  server *does* verify that value matches at link time (plus `deleted_at IS NULL`) before accepting the link —
  see AC4/AC5's exact double-check. AV-scan-gated for download exactly like every other evidence upload in this
  codebase.
- Permission: `calibration:manage` to record and to attach/replace a certificate; `calibration:view` to read
  history + download a clean certificate.
- Offline: recording/upload disabled by the offline banner (S1-5).
- **[AMENDED — smaller correction, new] Future-dated entry:** `performed_at` in the future is rejected, `422`
  (AC7) — a calibration cannot be "performed" tomorrow.

AC
1. **[AMENDED — B2/B7]** Migration `0068` (renumbered, §0) also creates `calibration_events`: `tenant_id`,
   `id`, `instrument_id` (composite FK → `instruments(tenant_id, id)` ON DELETE CASCADE), `performed_at` date
   NOT NULL, `result` enum (`pass|adjusted|fail`), `performed_by` text NOT NULL (free text — the jsx shows
   external lab names like "A2LA Cal Labs", not always an internal member; an internal calibration can still
   name the technician as free text, consistent with "method" being free text on the parent), `notes` text NOT
   NULL DEFAULT '', `certificate_file_id` (nullable **[AMENDED-3 — SHOULD-FIX 6] composite FK → `files(tenant_id,
   id)`** — corrected from a plain FK to `files(id)`, consistent with every other tenant-scoped reference in
   this codebase and with the fact migration `0067` already adds `UNIQUE (tenant_id, id)` to `files` for
   exactly this purpose (otherwise that constraint is added and never used) — **[AMENDED — B7] this is the sole,
   authoritative link to a certificate; `files.entity_kind`/`entity_id` may still be set on the underlying
   `files` row for the generic files browser's own display, but nothing in this sprint reads it to resolve an
   event's certificate**. **[AMENDED-4 — SHOULD-FIX 4] `ON DELETE RESTRICT`** — the files-purge job must never be
   able to silently orphan a calibration event by deleting a file this column still links to; it fails/skips that
   file's deletion instead, exactly like every other "still referenced" case the purge job already handles),
   `ncr_id` (nullable FK → `ncrs(tenant_id, id)`, set by C3 only), standard audit
   columns. Forced RLS, leading `tenant_id` index (mirrors `msa_measurements`'/`risk_controls`' child-table
   precedent).
2. **[AMENDED — B3; AMENDED-3 — BLOCKING 1 & 3, full rewrite]** `POST /v1/instruments/:id/calibration-events`
   (`calibration:manage`, `lockVersion` on the parent instrument, 409 on stale — same optimistic-concurrency
   rule every mutation in this programme follows, rule 6) creates the event row and, in the same transaction:
   - **Always writes a `created` audit event on the `calibration_event` row itself** — for every result
     (`pass`, `adjusted`, **and `fail`**), unconditionally. This closes a real rule-3 gap (BLOCKING 3(a)):
     previously a `fail` result wrote no audit at all.
   - **Exact "newest event" tie-break (BLOCKING 1)** — closes a same-day ordering hole in the original B3 fix:
     "newest event" for an instrument is ordered by `(performed_at DESC, created_at DESC)`. The just-created
     event E becomes the new "newest" — and therefore drives `last_result` — when `E.performed_at >
     current_newest.performed_at`, OR `E.performed_at = current_newest.performed_at AND E.created_at >
     current_newest.created_at` (always true for a brand-new insert, since nothing else can share both its
     `performed_at` and a later `created_at`). Concretely: a same-day `fail` recorded *after* a same-day `pass`
     correctly becomes newest and flips `last_result` to `fail` (a bare `performed_at >` comparison would
     instead leave the stale `pass` "newest," reopening the exact bug B3 was meant to close — the instrument
     would keep reading "ok"); a same-day corrective `pass`/`adjusted` recorded after a same-day `fail`
     likewise becomes newest and correctly clears the fail override. **`last_result` is always written to this
     newest event's `result`** when E is newest, regardless of outcome — but this write is **not itself
     separately audited on the instrument row**: `last_result` is a pure denormalized mirror of the newest
     event's own `result`, and that fact is already fully captured by the event's own `created` audit above;
     a second, redundant `updated` audit on the instrument for a value that only ever mirrors an
     already-audited event would record no new information. **[AMENDED-4 — SHOULD-FIX 2, newest-event locking,
     stated explicitly]** This `last_result` write, including for a `fail` (which writes no parent audit), still
     runs as part of the **same `lockVersion`-conditional `UPDATE`** on the parent instrument row that the route
     already guards the whole call with — a `fail` is not exempt from optimistic concurrency just because it
     writes no audit; the 409-on-stale-`lockVersion` behaviour named at the top of this AC covers this write too,
     not only the `pass`/`adjusted` due-date advance below.
   - **[AMENDED-4 — SHOULD-FIX 1, parent-audit timing stated explicitly]** Only when `result` is `pass` or
     `adjusted` — never `fail` — additionally sets `last_calibrated =
     performed_at` (again, **only when E is the newest event by the tie-break rule above** — this is the one
     condition that gates the parent write: a backdated `pass` entered after a later `fail` is never "newest," so
     it never regresses the due date and never touches the parent row at all — no `last_calibrated`/`next_due`
     change, no `last_result` change, no parent audit) and lets `next_due` recompute (the generated column follows
     automatically). **This is the one case that writes a separate `updated` audit event on the parent
     `instrument` row** (BLOCKING 3(c)) — `last_calibrated`/`next_due` are genuinely new, forward-looking
     scheduling facts, not a mirror of something the event's own audit already states. A `fail` result
     therefore never advances the due date (closing B3's original IATF 7.1.5 correctness bug) and writes no
     parent audit at all — its own event-level `created` audit is the complete record.
   - **Summary (three-way split, so no result type is ever silently unaudited):** (a) every event, any result,
     gets its own `created` audit on the `calibration_event` row; (b) `pass`/`adjusted` additionally gets an
     `updated` audit on the parent `instrument` row (due-date advance); (c) `fail` gets no parent audit — its
     `created` event audit is sufficient, and its `last_result` write to the parent is a non-audited
     denormalized mirror.
   - **[AMENDED — C4, new]** `422` if the instrument's `status = 'retired'` — no new calibration event may be
     recorded against a retired instrument (C4 AC4).
3. **[AMENDED-4 — BLOCKING C]** `GET /v1/instruments/:id/calibration-events` (cursor, rule 6) — the full history;
   the detail card's "last 5" is this same route with `limit=5`, not a separate endpoint. Carries the **same**
   plant-scope visibility as the parent instrument's DETAIL fetch (C1 AC4) — including the owner-sees-own-
   instrument exception — closing a Round 4 gap: previously this route was silent on the exception entirely, so
   an owner who could see their own out-of-scope instrument's detail card would still 404 on its history
   sub-view underneath it, a dead control (rule 10).
4. **[AMENDED — B7; AMENDED-3 — BLOCKING 2; AMENDED-4 — SHOULD-FIX 3]** Certificate upload reuses the existing
   `POST /v1/files/presign` → PUT → `POST /v1/files/:id/complete` flow (no schema change to `files`), but linking
   that uploaded file as an event's certificate is done **exclusively** by writing
   `calibration_events.certificate_file_id` — either inline via `certificateFileId` in this route's own create
   body, or via AC5's dedicated attach route. **The inline flow presigns with `entityKind: "calibration_event"`
   and `entityId` omitted** (there is no `calibration_events` row yet — nothing is created until this route's own
   create call), mirroring T2 AC2's evidence-upload sequencing (presign → upload → complete → reference the
   file's real id in the create body) rather than inventing a second pattern for certificates. Before accepting
   either the inline `certificateFileId` or AC5's attach-route body, the server verifies the referenced file (i)
   **belongs to this tenant**, (ii) has **`sha256 IS NOT NULL`** (fully uploaded/complete, not a dangling
   presigned-but-never-uploaded row) — closing the race where the orphan-cleanup job's `DELETE` on an incomplete
   upload could otherwise leave `certificate_file_id` pointing at a row that gets deleted out from under it —
   (iii) **[NEW] has `entity_kind = 'calibration_event'` exactly**, and (iv) **[NEW] has `deleted_at IS NULL`**.
   Checks (iii)/(iv) close a real bypass: without them, a client could presign a file with `entityKind`
   **omitted** (skipping the `calibration:manage` gate this same AC puts on `entityKind: "calibration_event"`,
   below) and then simply pass that arbitrary existing tenant file's id as `certificateFileId` here — the
   presign-time capability gate would be decorative, since linking never actually required going through it. A
   not-yet-clean (AV pending/failed) certificate cannot be downloaded, reusing the existing gate. `POST
   /v1/files/presign` itself, for `entityKind: "calibration_event"`, now requires `calibration:manage` —
   **[AMENDED — B7]** closing the general gap that presign otherwise carries **no capability check at all**
   (confirmed: `files.controller.ts` has no `@RequireCapability` on `presign`), scoped to this one `entityKind`
   (the same universal gap for every other existing `entityKind` is pre-existing and out of scope here, logged as
   a related note in §7's Known issue). **[AMENDED-4 — SHOULD-FIX 3, where this check actually lives]** This
   capability check is enforced **inside `FilesService.presign`**, not `FilesController` — the controller route
   is `@Internal()`-only, carries no `@RequireCapability` decorator today (confirmed, `files.controller.ts:31-
   34`), and the specific `entityKind` being presigned is only known once the request body is parsed, which
   happens at the service layer, not from the route path. `apps/web/src/hooks/use-files.ts:41`'s `uploadFile`
   helper is a named touch point: its `entity` parameter currently requires **both** `entityKind` and `entityId`
   together (`entity?: { entityKind: string; entityId: string }`), so it needs an entity-id-**optional** shape
   (`entityId?: string`) to support this inline certificate call site (and T2 AC2's evidence call site) presigning
   with `entityKind` set and `entityId` omitted. **[AMENDED-4 — SHOULD-FIX 5, optional reference]** This
   codebase already has a precedent for the adjacent "who may claim this presigned upload" question:
   `apps/api/src/portal/portal.service.ts:180-191`'s `attachEvidence` requires `uploaded_by = actor` before a
   caller can link a file — noted here as a reference pattern, not mandated, since the `entity_kind`/`deleted_at`
   check above is what this AC actually relies on; either mechanism, or an equally sound one, is acceptable.
5. **[AMENDED — B7, new; AMENDED-3 — BLOCKING 2 & 3(b)]** `PUT
   /v1/instruments/:instrumentId/calibration-events/:eventId/certificate` (`calibration:manage`) — attaches or
   replaces the named event's `certificate_file_id` after the fact (the "Upload cert" flow when it runs as its
   own step, not inline with recording the event). Before accepting the link, the server runs the **same
   four-part verification as AC4**: tenant match, `sha256 IS NOT NULL`, `entity_kind = 'calibration_event'`,
   and `deleted_at IS NULL` (the last two close the identical presign-bypass hole named in AC4). **Writes a
   real `updated` audit event on the `calibration_event` row itself** (closing the previous gap where this
   action wrote no audit at all) — this action never touches the parent instrument's
   `last_calibrated`/`next_due`/`last_result`, so it never writes a parent `updated` audit (only the event
   row's `certificate_file_id` changes — no due-date recomputation needed).
6. **[AMENDED — smaller correction, new]** Every `POST` create route in this story (`.../calibration-events`)
   takes an `Idempotency-Key` header, mirroring `risk.controller.ts`'s existing `@Headers("idempotency-key")`
   pattern exactly.
7. **[AMENDED — smaller correction, new]** `performed_at` in the future (`> today`, instrument's plant
   timezone — B4(c)) is rejected with `422`.

**Web/Mobile/Shared:** Web (`apps/web/src/features/calibration/` — Record-calibration dialog + certificate
upload, no jsx precedent for the dialog itself, flagged §5). Mobile: unaffected. Shared: table addition to
C1's migration; `CalibrationEventDto`/`CreateCalibrationEventBody`/`CalibrationResult` in `packages/types`; no
new capability (reuses `calibration:view`/`calibration:manage`).

### C3 — Out-of-tolerance calibration → raise a real NCR

**Design:** the KPI's own "N led to NCR" sub-stat (`qms-modules.jsx:212`, "2 led to NCR") names a real
capability the mock never shows a button for, but which must be real for that number to be honest (rule 10 —
an un-backed KPI count is exactly the class of defect Sprint 04's R2 (Controls block) was written to close).

UC
- Happy: on an `adjusted`/`fail` calibration event with no NCR yet, an admin/manager/auditor can "Raise NCR"
  → creates a real NCR (`source: "calibration"`, `sourceId: <event id>`, pre-filled title, `plantId` from the
  instrument), and links it back to the event (`ncr_id`), one-time only (mirrors `audits.service.ts`'s
  `raiseNcr` exactly — loads the event, 409/CONFLICT if already linked, creates the NCR, `UPDATE … WHERE
  ncr_id IS NULL` guard against a concurrent double-raise).
- Already linked: the button is replaced by a real link to the existing NCR (`entityHref("ncr", id)`), never a
  second "Raise NCR" affordance once one exists.
- Permission: **[AMENDED — smaller correction]** `calibration:manage` on the route itself — see AC2's
  corrected reasoning below (the "dual capability check" framing was wrong: the cited audit-finding raise-NCR
  route carries only `audit:manage`, confirmed by reading `audits.controller.ts`, not a real precedent for a
  second gate).
- Retired instrument: **[AMENDED — smaller correction, new]** raising an NCR from a **past** (pre-retirement)
  calibration event stays allowed even after the instrument itself is later retired — this route only inspects
  the named event, not the instrument's current `status` (C4 AC4 only blocks *editing* the instrument or
  recording a *new* event against a retired one).

AC
1. `NcrSource` gains `"calibration"` (`packages/types/src/enums.ts`); `ncrs.source` CHECK constraint widened
   (migration `0068`, **[AMENDED — B2, renumbered]** mirrors Sprint 04's `entity_links` CHECK-widening pattern
   for a new enum member). Confirmed additive and safe: no exhaustive `NcrSource` consumer breaks (unlike
   `EntityKind`'s own widening risk elsewhere in the codebase).
2. **[AMENDED — smaller correction]** `POST /v1/instruments/:instrumentId/calibration-events/:eventId/raise-ncr`
   carries `@RequireCapability("calibration:manage")` on the route itself; `InstrumentsService.raiseNcr`
   separately calls `authorize(membership, "ncr:create")` before creating the NCR. **Stated plainly:** this is
   redundant-but-harmless defense in depth, not a real independent gate — every role holding
   `calibration:manage` (admin/manager/auditor) already holds `ncr:create` (confirmed in
   `packages/core/src/rbac.ts`), so the second check can never actually deny a caller the first one let
   through; it exists only so a future capability-matrix change to one doesn't silently widen the other without
   review. 422 if the event's `result = 'pass'` (only an out-of-tolerance finding can raise an NCR — never a
   fabricated finding from a passing check), 409/CONFLICT if `ncr_id` is already set, else creates the NCR via
   `NcrsService.create` and links it, audited (the NCR's own `created` event; the event row's `UPDATE` is part
   of the same transaction, no separate audit action needed, same as the audit precedent).
3. Cross-tenant event/instrument id → 404 (rule 8).

**Web/Mobile/Shared:** Web (a real "Raise NCR" action on a qualifying history row, replacing nothing in the
jsx — this is new, honest backing for an existing KPI number, not a UI change to the mock). Mobile: unaffected.
Shared: `NcrSource` enum + `ncrs.source` CHECK widening (**[AMENDED-3 — SHOULD-FIX 10]** folded into `0068`,
corrected from a stale `0067` reference left over from before the B2 migration renumbering — `0067` is the
composite-FK-prereqs migration only, per §3.2); no new capability.

### C4 — Instrument lifecycle: retire, transfer, full history

**Design:** `qms-modules.jsx:302` the register row/detail-card "⋯" button (`kToast('Instrument options —
history, retire, transfer')` — three named actions, dead in the prototype).

UC
- Happy: the "⋯" menu offers exactly the three actions the mock's own toast text names — **View full
  history** (opens C2's full `GET /v1/instruments/:id/calibration-events` list, unpaged in the mock's "last
  5" but real cursor-paginated here), **Retire** (a real status transition, `active → retired`, audited
  `status_changed`, `lockVersion`-guarded, 409 on stale — retired instruments drop out of the due-tracking KPI
  strip and the default register filter, but stay readable for history), **Transfer** (opens the same edit
  surface as C1's `PATCH`, focused on `plant_id`/`area_id` — not a new backend concept, the existing edit
  route with those two fields pre-focused, exactly how Sprint 04 R1's "Re-score" was the same `PATCH` as
  "Edit" with different fields pre-focused).
- Retired instrument re-activation: **[flagged §7 Q-C2]** the mock names no "un-retire" action; this sprint
  does not build one (a genuinely retired instrument is assumed permanently out of service) — if wanted, a
  future story adds a symmetric `active` transition.

AC
1. `PATCH /v1/instruments/:id/retire` (`calibration:manage`, `lockVersion`, 409 on stale) — `active → retired`
   only; retiring an already-`retired` instrument is 422 (no-op transition, mirrors Sprint 04's reopen/complete
   precedent for one-way status routes). Audited `status_changed`, not generic `updated`.
2. **[AMENDED — architect's confirmed exception]** Transfer is `PATCH /v1/instruments/:id` (C1 AC3) with only
   `plantId`/`areaId` in the body — no new route. **The service must additionally verify, when both fields are
   present in the same call, that the target `area_id` actually belongs to the target `plant_id`** (not the
   instrument's *current* plant) — `422` if it does not. When only `plantId` changes and the instrument
   currently has a non-null `area_id` that does not belong to the new plant, the service clears `area_id` to
   `NULL` rather than leaving a now-inconsistent area reference (the same "must belong to `plant_id` when set"
   rule C1 AC1 already states, enforced here at the one place it can actually be violated).
3. Retired instruments are excluded from C1 AC5's KPI formulas and from the default `GET /v1/instruments`
   filter (a `status=retired` filter value still finds them, for history/audit purposes).
4. **[AMENDED — smaller correction, new]** A retired instrument cannot be edited or have a new calibration
   event recorded against it: `PATCH /v1/instruments/:id` (C1 AC3, including the transfer form of it, AC2
   above) and `POST /v1/instruments/:id/calibration-events` (C2 AC2) both return `422` when the instrument's
   `status = 'retired'` — "retire" is a terminal state for this sprint (Q-C2), so nothing about a retired
   instrument's record changes further except its own `status` (via a future un-retire story, if ever built).
   Raising an NCR from one of its **past** (pre-retirement) events (C3) is explicitly **not** blocked by this
   rule (C3's own UC/AC, amended).

**Web/Mobile/Shared:** Web (the "⋯" menu, wired to the three real actions — no jsx precedent for the menu
itself beyond its toast text, flagged §5). Mobile: unaffected. Shared: none beyond C1's schema/types.

### C5 — Calibration due/overdue notifications + audit-pack export

**Design:** `qms-modules.jsx:201` "Audit pack" button (`kToast('Export started — calibration-audit-pack.pdf')`
— dead in the prototype); the KPI strip's "Due < 30 days"/"Overdue" tiles imply the underlying due/overdue
state must actually notify someone, per P16's own feature-scope line ("Due-soon / overdue emphasis").

UC
- Happy (job): each active instrument that has crossed the 30-day warn window or gone overdue notifies its
  `owner` once per threshold **per due-date cycle** (never re-sent on the next day's sweep for the *same* due
  date, but a new notification cycle starts the moment the instrument is recalibrated and gets a new
  `next_due` — B4), exactly like `document-expiry`'s existing dedupe-by-threshold behaviour, extended to be
  cycle-aware.
- **[AMENDED-3 — SHOULD-FIX 1, new; AMENDED-4 — SHOULD-FIX 9, wording]** Happy (failed calibration): an active
  instrument whose newest event is `fail` notifies its `owner` **on the next daily `calibration-due` sweep**
  (corrected from "immediately" — the job is a daily cron, not a real-time trigger), regardless of `next_due`
  (which may still be far in the future) — a failed gauge is exactly the kind of thing an owner needs to know
  about without waiting for a date-driven threshold to also catch it, but the delivery mechanism is still the
  same daily sweep every other calibration reminder in this sprint uses, not a push fired at write time.
- Happy (export): "Audit pack" → real export enqueued via the existing `reports.export`/`run-export.ts`
  pipeline (same UX as `audit_report`/`risk_board_pack`): progress toast → notification → download.

AC
1. **[AMENDED — B3/B4, full rewrite; AMENDED-3 — SHOULD-FIX 1 & 4]** New daily per-tenant job `calibration-due`
   (mirrors `document-expiry`'s overall shape — one daily sweep per active tenant, no audit event written for
   the notification itself), with the following corrected, exact design:
   - `packages/core/calibration.ts` exports `activeCalibrationThreshold(input: { nextDue: string; today: string
     }): number | null` — **[AMENDED-3 — SHOULD-FIX 4; AMENDED-4 — SHOULD-FIX 6]** return type is **`number |
     null`** (a `30 | 7 | 0 | -7 | ...` literal union cannot express an unbounded arithmetic sequence in
     TypeScript, since the overdue escalation below is uncapped — every remaining reference to a plain `number`
     return type in this file, including this AC's own earlier prose and the DoD, is corrected to `number |
     null`) — **takes ISO date strings, not JS `Date` objects** (B4(c) — same reasoning as C1 AC2).
     **[AMENDED-4 — BLOCKING B, approach-side corrected to match `document-expiry.ts`'s real behaviour]** The
     approach-to-due side is **not** an exact-day match — Round 3's own text claiming it fires "only on exactly
     day 30, 7, or 0" was wrong, and wrongly cited `document-expiry.ts:33-40` as precedent for that behaviour,
     when that function actually does the opposite: it returns the **smallest threshold crossed on every day**
     inside the window, so a missed daily sweep or a mid-cycle entry never silently skips its reminder. Corrected
     to port that exact algorithm, using `[30, 7, 0]` (largest first) in place of `EXPIRY_THRESHOLDS`: let
     `daysUntilDue = nextDue - today` (in whole days); iterate the list, keep overwriting `active = t` while
     `daysUntilDue <= t`; the last (smallest) match wins. Concretely — any day **8-30** out returns `30`; any day
     **1-7** out returns `7`; day **0** (due today) returns `0`; more than 30 out returns `null`. The cycle-tied
     dedupe key (below) is what prevents a duplicate notification across the multiple days inside one threshold
     band, exactly as it already does for `document-expiry`'s own `[90,30,7]` list. Once `today > nextDue` (genuinely
     overdue, matching AC2's `overdue` status boundary), the function returns the **re-notify window**, and
     **[AMENDED-3 — SHOULD-FIX 4, previously-undefined between-threshold value now defined]** for any
     `daysOverdue >= 0` the exact value is **`-7 * floor(daysOverdue / 7)`** — the smallest (most recently
     crossed) 7-day mark: `daysOverdue` `0`-`6` all resolve to `0` (already notified on the due day itself, so
     days 1-6 correctly produce no *new* notification under the dedupe key below), `7`-`13` resolve to `-7`,
     `14`-`20` to `-14`, and so on, uncapped — an out-of-calibration measurement instrument is a standing
     nonconformance until recalibrated, unlike a document that typically renews before lapsing long, so this
     sprint deliberately does not cap the escalation the way `document-expiry`'s own fixed `[90,30,7]` list
     implicitly does by simply stopping. **[AMENDED-4 — SHOULD-FIX 6, `-0` normalization]** JavaScript's
     `-7 * 0` evaluates to `-0`, which `Object.is`/a strict `toBe(0)` test assertion would fail even though
     `-0 === 0`; the implementation and its tests must normalize any `daysOverdue` in `0`-`6` to a plain `0`
     (e.g. `Object.is(result, -0) ? 0 : result`, or coercing with `result + 0` before comparing/returning) so
     this is never a spurious test failure. Returns `null` when more than 30 days from `next_due` and not yet
     overdue, or when `nextDue` is unset (`unscheduled` instruments are not notified via this path — nothing to
     remind about via a date — but see the next bullet for the `fail` case, which is date-independent).
   - **[AMENDED-3 — SHOULD-FIX 1, new; AMENDED-4 — SHOULD-FIX 9, wording] Failed-calibration trigger, independent
     of the date-threshold function above:** any active instrument whose `last_result = 'fail'` notifies its
     `owner` **on the next daily `calibration-due` sweep** (corrected from "immediately"/"every daily sweep until
     superseded" — the job is a daily cron, not a real-time trigger, matching this sprint's own established job
     cadence) — this fires **regardless of what `activeCalibrationThreshold` returns for `next_due`** (an
     instrument can fail a check today while its `next_due` is still months away, and must still be notified
     about on the very next sweep). Deduped by
     `dedupeKey: "cal-fail:<instrumentId>:<eventId>"` (the failing event's own id, not a date — a fail has no
     "cycle" to key off other than the specific event that caused it), so exactly one notification is sent per
     failing event, not re-sent daily while it remains the newest, but a **new** fail event (even same-day, per
     BLOCKING 1) gets its own fresh key and its own notification.
   - The job queries active instruments whose `next_due` is non-null and has entered a reminder window (via
     the threshold function above), **or** whose `last_result = 'fail'` (the bullet above), notifies `owner`
     (skip if null, mirrors `document-expiry`'s own "no one to remind" skip). **[AMENDED-3 — SHOULD-FIX 2]**
     **"Today" is computed in the instrument's own plant's timezone** (`plants.timezone`, B4(c) — the column
     already exists, no schema change needed), not the server's or the tenant's, since a physical instrument's
     due date is a plant-floor fact — **and this is the same plant-timezone rule every calibration READ path
     uses** (C1 AC3's `dueStatus` filter, C1 AC6's summary, the detail view, and AC2's export below, all
     consistently — SF2), not a job-only rule, since the SQL-vs-core-function agreement test (§4/§8) depends on
     it being identical everywhere.
   - **[AMENDED — B4, cycle-tied dedupe key]** `dedupeKey: "cal-due:<instrumentId>:<nextDue>:<threshold>"` —
     including `next_due` in the key (not just the instrument id) is what makes each recalibration cycle get
     its own key space; `notifications_dedupe_uq` (`0001_core.sql:554`) is a **permanent** unique index, so
     without the due date embedded, an instrument would never be reminded again after its very first
     recalibration cycle (the exact bug this AC closes). `entityKind: "instrument"`, `entityId: <instrument
     id>` (B9 — this is what makes the notification's click-through resolve, see X1).
   - Registered on the existing `docs` queue's daily sweep (or an equally-shaped new `calibration` queue — an
     implementation-time choice, not a design difference).
2. **[AMENDED — smaller correction; AMENDED-3 — SHOULD-FIX 2; AMENDED-4 — BLOCKING C]** `ExportResource` gains
   `"calibration_audit_pack"`; `run-export.ts` gains a branch rendering the register (KPI strip + full
   instrument table + each instrument's last calibration date/result) to PDF, scoped to the caller's tenant
   (and plant scope, if plant-scoped) — **does not** carry the owner-sees-own-instrument exception (the EXPORT
   row of the single table in C1's UC "Plant scope" / §3.1 item 3): an owned-but-out-of-scope instrument is
   excluded from the caller's own board-pack, consistent with the list/summary decision, since a board-pack is a
   bulk view of the caller's own scope, not a single-record lookup — computing every instrument's `dueStatus`
   using the **same
   instrument-plant-timezone "today" rule** as every other calibration read path (C1 AC3/AC6, this story's AC1
   job), so an exported PDF's due/overdue classification can never disagree with what the live UI shows for the
   same instrument on the same day. **The widened constraint is `exports_resource_check` on the real `exports`
   table** — corrected from this file's earlier, wrong `export_jobs` naming (confirmed:
   `packages/db/migrations/0011_exports.sql:17`).
3. `calibration:view` required to request the export (mirrors `risk_board_pack`'s "viewing is enough to
   export" precedent, not the stricter `:manage`).

**Web/Mobile/Shared:** Shared (job + export resource + `run-export.ts` branch) + Web (wire the button).

### C6 — Add instrument via a dedicated create form

**Design:** `qms-modules.jsx:202` "Add instrument" button (`kToast('New instrument form opened — enter asset
tag to begin')` — dead in the prototype).

UC
- Happy: "Add instrument" opens a form (name, type, plant, area, method, tolerance, interval-months, owner) →
  creates a real instrument with `last_calibrated = NULL`/`next_due = NULL` (a brand-new instrument has never
  been calibrated yet — `instrumentDueStatus` returns `unscheduled`, not a fabricated "ok"), navigates to the
  new instrument's detail card.
- **Not** the shared CreateWizard (**design decision, logged, not gated**): the wizard's 4-step Type/Details/
  Assignees/Review shape doesn't fit an 8-field single-entity form with a plant→area cascade the wizard's
  generic Details step doesn't support, and — unlike risk (Sprint 04 R4), which *was* folded into the wizard —
  an instrument's fields don't reduce to the wizard's flat-field model without inventing a plant/area
  cascading-select primitive the wizard doesn't have. This mirrors the same reasoning Q1 already accepted for
  CAPA's own dialog and Sprint 04 M2's own MSA-study wizard: smallest-reasonable-choice, a small dedicated
  form, not a wizard extension.

AC
1. `POST /v1/instruments` (C1 AC3) — no new route, this story just wires the form to the already-specified
   create route.
2. Created instrument gets a real `CAL-YYYY-NNNN` code (C1 AC1), sequence-generated via `codes.ts` + `counters`.
3. `status` defaults to `active`; `last_calibrated`/`next_due` are `NULL` until the first C2 event.

**Web/Mobile/Shared:** Web only (`apps/web/src/features/calibration/` — a small dedicated form, no jsx
precedent, flagged §5). Mobile: unaffected. Shared: none beyond C1.

### T1 — Competency catalog + training-record history + the matrix

**Design:** `TrainingMatrix` full component (`qms-modules.jsx:30-170`) — KPI strip, competency matrix
(members × competencies, sticky first column, Legend), "Expiring & overdue" list.

UC
- Happy: open `/training` → KPI strip (real counts), competency matrix (members rows × competency columns,
  cell states **Certified (green ok) / Expiring (amber warn) / Overdue-or-gap (red fail) / N-A (gray —)**,
  filter by name/role, segmented All/Mandatory-only/Gaps), clicking a cell shows that member's history for
  that competency. **[AMENDED-4]** For a `training:view`-only caller, only cells in their OWN row are
  clickable (matches AC9's read rule exactly, so no click ever produces a 403) — other members' cells still
  render their real state (so the matrix's aggregate picture stays honest and useful) but are visually
  non-interactive (no hover/click affordance, `aria-disabled`), the smallest-reasonable-choice resolution
  rather than adding a new denied-state board for a control that should simply not invite the click. A
  `training:manage` caller's cells are all clickable, unchanged.
- Cell-state derivation (**the one real design decision this sprint's §3 needs sign-off on**, resolving P17's
  own open question about mandatory-gap semantics): for each (member, competency) pair —
  - no training record **and** `competency.mandatory = true` → **gap** (red — a required certification never
    taken is exactly the "mandatory-gap highlighting" P17's own feature-scope line names);
  - no training record **and** `competency.mandatory = false` → **N/A** (gray — never assigned, not required);
  - a record exists and `expires_at < today` → **overdue** (red);
  - a record exists and `expires_at` is within the warn window (**30 days**, matching the KPI tile) →
    **expiring** (amber);
  - a record exists and `expires_at` is null or beyond the warn window → **ok** (green).
  This is a correction, flagged and reasoned in §3.1, of an apparent inconsistency in the jsx's own fixture
  data (one mock row shows a mandatory competency as "—" for one member) — treated as mock-data coincidence,
  the same class of correction Sprint 04 made repeatedly (residual-score judgment call, KPI bands, verdict
  color).
- Empty: a brand-new tenant with no competency catalog seeded yet → matrix shows "No competencies defined —
  add one" (never the jsx's 9-column mock), and zero members → "No members tracked yet."
- Permission: `training:view` required for the page; role-without curated identically to risk/msa (§4).
- Plant scope: **[AMENDED — B5, corrects the wrong cited precedent]** the matrix's member rows are filtered
  for `inspector`/`viewer` (the `isPlantScoped` roles) by the **same real rule C1's instrument list now uses**
  — `membership.plantIds` overlap with the caller's own — **not** `GET /v1/members`, which (confirmed by
  reading `members.service.ts` in full) applies no plant filter at all today. Exact rule, stated because no
  correct precedent exists to point to: a caller sees a member row when **either** side's `plantIds` is empty
  (unrestricted, matching `authorizePlant`'s own "empty = unrestricted" semantics — an admin/manager tracked in
  the matrix has no plant restriction and is visible to every plant-scoped viewer) **or** the two `plantIds`
  arrays intersect. `admin`/`manager`/`auditor` callers are never filtered (not `isPlantScoped` roles).
- **[AMENDED — B5, new] Who is "in" the matrix:** only **active** memberships (`status = 'active'`); a
  suspended/offboarded membership row is excluded. **`partner`** is excluded regardless of status — X1 AC1
  grants `partner` neither `training:view` nor `training:manage`, so a partner is never a tracked subject of
  this module (consistent with partners being external, supplier-scoped users, not tenant employees with
  competency requirements).

AC
1. **[AMENDED — B1/B2/B8]** Migration `0069_training.sql` (**renumbered from `0068`**, §0): `competencies` —
   `tenant_id`, `id`, `code` text NOT NULL (a short tenant-chosen slug, e.g. `iatf`/`fmea`/`msa` — **not** a
   `counters`-sequenced code; a competency catalog entry is authored once by an admin, not incident-sequenced
   like an NCR, so this mirrors how `inspection_templates`/`sla_configs` already use a plain author-supplied
   identifier, not `codes.ts`), `name` text NOT NULL, `mandatory` bool NOT NULL DEFAULT false, `valid_months`
   int NULL (NULL = never expires — some competencies, like a one-time awareness course, may have no renewal
   cadence; the jsx's own catalog always sets one, but the column must allow none for a competency type the
   jsx doesn't happen to show), `seq` int (matrix column order), **[AMENDED — B8, new] `archived_at`
   timestamptz NULL** (T5 — never the generic soft-delete `deleted_at`, since this sprint's own purge job would
   otherwise eventually destroy real training history tied to an archived competency), `lock_version`, standard
   audit columns. Forced RLS, **[AMENDED — B8] partial unique index `CREATE UNIQUE INDEX … ON competencies
   (tenant_id, code) WHERE archived_at IS NULL`** (not a blanket `unique(tenant_id, code)` — an archived
   competency's code can be reused by a new one, T5), **[AMENDED — B2] `UNIQUE (tenant_id, id)`**
   (self-consistency — `competencies` is itself a composite-FK target for `training_records`, below).
   `training_records` — `tenant_id`, `id`, `member_id` (composite FK → `memberships(tenant_id, user_id)`),
   `competency_id` (composite FK → `competencies(tenant_id, id)`), `completed_at` date NOT NULL,
   **[AMENDED — B1, new] `valid_months` int NULL** — a **real, denormalized, stored column** (not generated),
   copied from `competencies.valid_months` by the service at insert time, never client-supplied (the service
   reads the competency row in the same transaction and copies the value) — this is what `expires_at` below is
   actually generated from, since a generated column cannot reference another table; the copy is intentional
   (a later change to the catalog's `valid_months` must not retroactively reinterpret a past completion's
   expiry — the record captures the rule in effect when it was recorded, correct historical behaviour, not a
   shortcut). `expires_at` date **[AMENDED — B1] GENERATED ALWAYS AS (CASE WHEN valid_months IS NULL THEN NULL
   ELSE (completed_at + make_interval(months => valid_months))::date END) STORED** — corrected from the
   original text-cast form for the same `IMMUTABLE` reason as C1 AC1's `next_due` (§0/B1); same confirmed
   month-end clamping behaviour (`make_interval`), same integration-test requirement (not a `packages/core`
   unit test). `evidence_file_id` (nullable **[AMENDED-3 — SHOULD-FIX 6] composite FK → `files(tenant_id, id)`**
   — corrected from a plain FK to `files(id)`, same reasoning as C2 AC1's `certificate_file_id` correction:
   consistent with every other tenant-scoped reference in this codebase, and what migration `0067`'s
   `UNIQUE (tenant_id, id)` on `files` was added for — **[AMENDED — B7] see T2 AC2 for how one file is
   shared across a batch submission**. **[AMENDED-4 — SHOULD-FIX 4] `ON DELETE RESTRICT`**, same reasoning as
   `certificate_file_id`: the files-purge job must never silently orphan a training record by deleting evidence
   still linked to it), standard audit columns. Forced RLS, leading `tenant_id` index, **no**
   unique `(tenant_id, member_id, competency_id)` constraint — **[deviation from P16's own draft, flagged §3.1
   for sign-off]**: this sprint proposes a real per-completion history table (one row per recorded training
   event, newest = current), not P17's own draft "unique latest row, history in `audit_events`" — because the
   FE spec's own "member drawer (records + evidence)" needs multiple historical rows with their own evidence
   files, which generic `audit_events` diffs cannot reconstruct (they hold before/after field diffs, not a
   structured evidence-file reference per past event); this also matches `calibration_events`' own precedent
   in this same sprint (a real history table, not a single mutable row).
2. **[AMENDED — B4]** `packages/core/competency.ts` (pure): `competencyCellState(input: { expiresAt: string |
   null; hasRecord: boolean; mandatory: boolean; today: string }): "ok"|"warn"|"overdue"|"gap"|"na"` —
   **takes ISO date strings, not JS `Date` objects** (B4(c), same reasoning as `calibration.ts`), implementing
   the exact rule stated above in this story's own "Cell-state derivation" UC — unit-tested for all five
   outcomes plus the warn-window boundary (including `expiresAt = today` reading `warn`, matching
   `instrumentDueStatus`'s own due-day rule, B4(b), for consistency across both modules).
3. **[AMENDED-3 — SHOULD-FIX 7(b)]** `GET /v1/competencies` (cursor, rule 6; `training:view`/`training:manage`
   — **[correction — see X1 AC1, capability is `training:view`/`training:manage`, not a separate
   `competency:*` pair]** — **[AMENDED — B8] excludes archived rows by default; a `status=archived` filter
   value still finds them, mirrors C4 AC3's pattern for retired instruments; see T5**), `POST /v1/competencies`
   (`training:manage`, `Idempotency-Key` header — smaller correction; **the new row's `seq` is set to
   `current_max_seq(non-archived) + 1` — appended to the end of the catalog's own order, stated explicitly per
   Round 3's review; see T5 AC1(b) for the equivalent rule on un-archiving**. **[AMENDED-4 — SHOULD-FIX 8(c)]** a
   `code` clash against a non-archived competency returns **`409 Conflict`**, the same disposition T5 AC1(c)
   already defines for the un-archive case, not a `422`), `GET/PATCH /v1/competencies/:id` (`lockVersion`).
4. **[AMENDED — B5/B6/B8; AMENDED-3 — SHOULD-FIX 2]** `GET /v1/training/matrix` (cursor over **members**, not
   competencies — a tenant's competency count is small and bounded, members are the potentially-large axis;
   filters `mandatoryOnly`/`gapsOnly`/**`q` (new, B6 — see below)**) — computes each cell live via a
   `DISTINCT ON (member_id, competency_id) … ORDER BY completed_at DESC` join per member page against
   **non-archived competencies only** (`WHERE archived_at IS NULL`, B8/T5), applying AC2's pure function per
   cell using **"today" computed in the tenant's own timezone** (`control.tenants.timezone`) — the same rule
   T4's job uses (B4(c)), applied here consistently to every training read (SF2: also AC8's summary, T3 AC1's
   gaps, T3 AC2's export), never the server's local time; plant-scoped per this story's own corrected UC rule
   above (not `GET /v1/members`'s precedent, which does not exist). **`q`** is a free-text name search: since a
   member's display name lives in `control.users`, outside RLS (the same trust boundary `MembersService`'s own
   doc comment already names, confirmed by reading it), the service resolves `q` by querying `control.users` on
   the control pool for matching names, intersecting the returned `user_id`s with the tenant's own `memberships`
   before filtering the matrix — **never** a denormalized name column on `memberships` or `training_records`
   (rule 8's cross-tenant-invisibility spirit: a name is only ever exposed for a person already confirmed to be
   a member of this tenant).
5. Cross-tenant / cross-plant competency or member id → 404, not 403 (rule 8).
6. **Catalog seeding (resolves P17's own "seeded per-tenant or global template?" open question):** the catalog
   is **tenant-owned** (each tenant's admin authors their own `competencies` rows; RLS-scoped like every other
   tenant table) — `provision-tenant` seeds the jsx's own 9 example rows (`COMPETENCIES`, `qms-modules.jsx:8-
   18`) as **starting defaults** a tenant can edit/**archive**/add to — **[AMENDED — B8] "delete" here means
   archive (T5), never a hard delete or the generic `deleted_at` pattern** — exactly like the demo-seed pattern
   other catalogs (inspection templates, SLA configs) already use. No cross-tenant shared/global template table
   is built (that would be new multi-tenant-shared-catalog infrastructure with no spec anywhere).
7. **[AMENDED — B5/B8; AMENDED-3 — SHOULD-FIX 9]** KPI strip, exact formulas: **Members tracked** =
   `count(distinct member_id)` among **active, non-partner** memberships visible to the caller (plant-scoped
   per this story's UC rule above — B5's own explicit definition, not a wrong precedent); **Coverage** =
   `100 × (count of (member, mandatory-and-non-archived-competency) pairs in state 'ok'+'warn') / count of all
   (member, mandatory-and-non-archived-competency) pairs` (the jsx's "of mandatory certs" label, read
   literally — only mandatory, non-archived competencies count toward the denominator, B8; a
   "warn"/expiring-but-not-yet-lapsed cert still counts as covered, only `overdue`/`gap` do not) —
   **[AMENDED-3 — SHOULD-FIX 9] when the denominator is zero (no mandatory, non-archived competencies exist for
   the tenant, or none apply to any visible member), Coverage reads `"—"`**, never a divide-by-zero and never a
   misleading `100%`/`0%`, consistent with this sprint's own established empty-case convention for percentage
   KPIs (Sprint 04's "reviewed this quarter %" empty case); **Expiring < 30 days** = `count(*) where cell
   state = 'warn'` across all (member, non-archived-competency) pairs, not mandatory-only (the jsx's own KPI
   card carries no "mandatory" qualifier, unlike Coverage's); **Overdue** = `count(*) where cell state in
   ('overdue','gap')` over non-archived competencies (blocking, matches the jsx's "blocked from sign-off"
   sub-label — see Q-C1/§7 for why the *blocking* itself is not enforced elsewhere this sprint; the **count**
   is real, the cross-module enforcement is not).
8. **[AMENDED — B6, new; AMENDED-3 — SHOULD-FIX 2; AMENDED-4 — SHOULD-FIX 7]** `GET /v1/training/summary`
   (`training:view`) — returns the four KPI numbers above precomputed server-side in one round trip, plant-scoped
   identically to the matrix route, mirroring `GET /v1/risks/summary` (Sprint 04) and this sprint's own
   `GET /v1/instruments/summary` (C1 AC6) exactly. Uses the **same tenant-timezone "today" rule as AC4's matrix**
   (SF2) — the summary's Coverage/Expiring/Overdue counts can never disagree with the matrix's own cell states at
   a day boundary. `coverage` is typed **`number | null`** (null exactly when the denominator — mandatory,
   non-archived competency pairs — is zero, AC7); the API never emits the literal string `"—"` itself, that
   rendering is the **web** layer's job for a null value, consistent with this codebase's other empty-numeric-KPI
   fields.
9. **[AMENDED-4 — BLOCKING A, new] Per-member training history + single-record lookup.** Resolves a real gap
   Round 4 found: DESIGN-05's Board 7 (member drawer showing full history + evidence per competency), X1 AC5's
   `/training?recordId=<uuid>` deep link, and T5's own promise that archiving a competency keeps existing
   records "visible in each member's own history" (T5 UC) all depend on a read route that did not exist — the
   matrix (AC4) returns only the newest record per (member, competency) pair via `DISTINCT ON`, over
   **non-archived** competencies only, so it can serve neither the drawer nor T5's own promise.
   - `GET /v1/training/records` (cursor, rule 6; **required** `memberId`, optional `competencyId`) — every
     `training_records` row for that member, newest first, **including rows whose `competency_id` points at a
     now-archived competency** — this is the **one** training read path that deliberately does **not** apply
     T5 AC2's `archived_at IS NULL` predicate, precisely because this route is what T5's own history-preservation
     promise depends on. This is the member drawer's (Board 7) data source.
   - `GET /v1/training/records/:id` — one record (including its `evidence_file_id`), for the recordId deep link
     (X1 AC5) and the drawer's own row expansion. `evidence_file_id`, if set, still requires the file's own
     clean/AV-scan gate to download (unchanged, existing Files rule).
   - **Visibility, stated as a real decision (Round 4 required one, not an implicit default):** a `training:
     manage` holder (admin/manager/auditor, X1 AC1) may fetch **any** member's history or single record —
     training administration inherently requires seeing who has/hasn't completed what. A `training:view`-only
     holder (inspector/viewer) may fetch **only their own** — the request's `memberId` (or the record's own
     `member_id`, for the single-record route) must equal the caller's own membership id, else **`403
     FORBIDDEN`** (not `404` — this is an intra-tenant permission boundary, not rule 8's cross-tenant-existence
     case; the member being asked about is not a secret from the tenant's own roster, only their individual
     completion dates/notes/evidence are). A `training:view`-only caller still sees the matrix's own aggregate
     cell state for every in-scope member (AC4, unchanged — a computed status carries no personal detail beyond
     it), just not another member's individual record rows. Cross-tenant/cross-plant `memberId` or record id →
     `404` (rule 8), checked **before** the capability rule above (an out-of-tenant/out-of-plant id is invisible
     regardless of role).
   - `CompetencyDto` (`GET /v1/competencies`, AC3) gains a live **`trainingRecordCount`** field —
     `count(distinct member_id) from training_records where competency_id = :id`, computed on every read, never
     stored — which is what Board 9's archive-confirm dialog copy ("N members' existing training records against
     it are kept," T5 UC) actually reads, available **before** the user confirms since the catalog admin surface
     already loads each competency row to render its own ▲/▼ reorder controls.

**Web/Mobile/Shared**
- **Web:** `apps/web/src/features/training/` — `TrainingMatrixPage` (KPI strip **[AMENDED — B6, now reads
  `GET /v1/training/summary`]**, matrix grid w/ sticky column + Legend + search **[AMENDED — B6, real `q`
  param resolved via `control.users`]** + segmented filter, member drawer on cell/row click **[AMENDED-4 —
  BLOCKING A, now reads `GET /v1/training/records`/`GET /v1/training/records/:id`]**), empty/loading/
  error/permission/offline states.
- **Mobile:** not built — no `m-*.jsx` design (confirmed §1a); `pnpm --filter @kaenal/mobile typecheck` stays
  green on the additive shared-type changes only.
- **Shared:** migration `0069` **[AMENDED — B2, renumbered from `0068`]** (`competencies`, `training_records`,
  depends on `0067`'s composite-FK prereqs); `CompetencyDto` (**[AMENDED-4 — BLOCKING A, new]** gains
  `trainingRecordCount`)/`TrainingRecordDto`/`TrainingMatrixQuery`/`TrainingRecordHistoryQuery` (new)/
  `CreateCompetencyBody`/`CreateTrainingRecordBody` in `packages/types`; `packages/core/competency.ts` (pure,
  unit-tested, ISO-date signature per B4); `training:view`/`training:manage` in `packages/core/src/rbac.ts`.

### T2 — Record training (assign + complete) + evidence

**Design:** `qms-modules.jsx:39` "Assign training" button (`kToast('Training assignment drafted — pick
employees & course')`); `qms-modules.jsx:140` per-row "Schedule" button on the Expiring & overdue list
(`kToast('Refresher scheduled…')`) — both dead in the prototype.

UC
- Happy: "Assign training" opens the **same** record-training dialog (pick member(s) + competency + completion
  date + evidence) the jsx's own toast text describes ("pick employees & course") — **[resolved interpretation,
  flagged for sign-off §3.1]** this sprint does not build a separate "assigned, not yet completed" pending
  state (no jsx cell shows a fifth visual state for it); "Assign training" and completing it are the same
  action — a manager who wants to *track* an upcoming requirement without a completion date yet is not
  supported this sprint (see §7 Q-T2).
- "Schedule" (on an expiring/overdue row): opens the same dialog pre-filled with that member+competency, for
  recording the refresher.
- Permission: `training:manage` to record; `training:view` to read.
- **[AMENDED — smaller correction, new] Future-dated entry:** `completedAt` in the future is rejected, `422`
  (AC4) — a training cannot be "completed" tomorrow.

AC
1. **[AMENDED — smaller correction; AMENDED-3 — SHOULD-FIX 8]** `POST /v1/training/records` (`training:manage`,
   `Idempotency-Key` header — **one key per batch submission**, not per member row within it, mirroring
   `risk.controller.ts`'s pattern) — body `{ memberIds: string[], competencyId, completedAt, evidenceFileId? }`,
   creates one new history row per `memberId` (T1 AC1), each copying `competencies.valid_months` at insert time
   (T1 AC1); each member gets its own row and its own audit event (not batched into one, since these are
   genuinely independent facts about different people, unlike MSA's single-study measurement batch).
   **[AMENDED-3 — SHOULD-FIX 8] The whole batch submission is one all-or-nothing database transaction:** either
   every `memberId`'s row (and its audit event) commits, or none do — standard transactional semantics, no
   partial-batch state is ever visible to a reader. This corrects the previous UC wording ("members it already
   succeeded for"), which wrongly implied a first attempt could partially succeed; the **request itself** is
   additionally idempotency-keyed by one `Idempotency-Key`, so a *retried* call (after a prior successful
   commit) never double-creates rows — that is a retry-safety property, not evidence that a single call can
   itself leave a partial result.
2. **[AMENDED — B7; AMENDED-3 — BLOCKING 2, full rewrite]** Evidence attach reuses the existing Files
   presign→upload→complete flow, with the **`training_batch_id` concept dropped entirely** — as originally
   specified it could not actually be built: it was supposedly generated *inside* this same
   `POST /v1/training/records` call, whose own request body must already contain a fully-uploaded
   `evidenceFileId` (a circular/impossible sequencing), and the id itself was "not stored anywhere," so it did
   nothing. **Corrected flow, sharing one evidence file across a batch submission (B7's original intent, now
   actually buildable):**
   1. The client presigns a file upload with `entityKind: "training_batch"` and **`entityId` omitted** (there
      is no batch entity to reference yet — nothing is created until step 4).
   2. The client uploads the file to the presigned target.
   3. The client marks it complete (`POST /v1/files/:id/complete`, setting `sha256`).
   4. The client then calls this route (`POST /v1/training/records`) with that file's real id as
      `evidenceFileId` in the request body. The service writes this **same** file id to every `training_records`
      row created in that one call — so the file is genuinely shared (one upload, referenced by every sibling
      row), not duplicated per member, while each row's own `evidence_file_id` FK stays the authoritative, real
      link (mirroring C2's `certificate_file_id` philosophy: a real FK is the source of truth, `files.
      entity_kind/entity_id` is informational only).
   - Before accepting `evidenceFileId`, the server verifies the referenced file (i) belongs to this tenant,
     (ii) has `sha256 IS NOT NULL` (fully uploaded), (iii) **[NEW — BLOCKING 2]** has
     `entity_kind = 'training_batch'` exactly, and (iv) **[NEW — BLOCKING 2]** has `deleted_at IS NULL` — the
     last two close the identical bypass named in C2 AC4/AC5: a client could otherwise presign with
     `entityKind` omitted (skipping the `training:manage` gate below) and then simply pass an arbitrary
     existing tenant file's id as `evidenceFileId`; without checking the file's own `entity_kind`, that gate
     would be decorative.
   - `POST /v1/files/presign` for `entityKind: "training_batch"` requires `training:manage` (closing the same
     general presign-capability gap B7 closes for `calibration_event`, §0). **[AMENDED-4 — SHOULD-FIX 3]** This
     check, like C2 AC4's, is enforced inside `FilesService.presign`, not `FilesController` — the controller
     route is `@Internal()`-only with no `@RequireCapability` (confirmed, `files.controller.ts:31-34`), and
     `entityKind` is only known once the body is parsed at the service layer.
3. Cross-tenant/cross-plant member or competency id → 404 (rule 8).
4. **[AMENDED — smaller correction, new]** `completedAt` in the future (`> today`, tenant timezone — B4(c)) is
   rejected with `422`.

**Web/Mobile/Shared:** Web (Record-training dialog, no jsx precedent for the dialog itself, flagged §5).
Mobile: unaffected. Shared: none beyond T1.

### T3 — Gaps/expiring view + skill-gap report export

**Design:** `qms-modules.jsx:120-145` "Expiring & overdue" card; `qms-modules.jsx:38` "Skill gap report"
button (`kToast('Export started — skill-gap-report.pdf')` — dead in the prototype).

UC
- Happy: the "Expiring & overdue" card lists real gap/overdue/expiring rows (member, competency, days-left or
  "BLOCKED"), sourced from the same `GET /v1/training/gaps` the matrix's Gaps filter uses — not a separately
  hard-coded top-5 like the jsx's fixed mock list.
- Happy (export): "Skill gap report" → real export (existing pipeline), rendering every mandatory gap +
  every expiring-within-30-days record, tenant/plant-scoped to the caller.

AC
1. **[AMENDED — B8; AMENDED-3 — SHOULD-FIX 2]** `GET /v1/training/gaps` (cursor, rule 6; `training:view`) —
   returns every (member, **non-archived** competency) pair in state `gap`, `overdue`, or `warn`, sorted
   worst-first (`gap`/`overdue` before `warn`, then soonest-expiring first) — this is the same query T1 AC4's
   matrix uses with the equivalent filter, exposed as its own route because the "Expiring & overdue" card and
   the export both need it without paginating the full matrix. Uses the **same tenant-timezone "today" rule**
   as T1 AC4/AC8 and T4's job (SF2) — a member/competency pair can never appear on the gaps list in a different
   state than the matrix shows for it on the same day.
2. **[AMENDED — smaller correction; AMENDED-3 — SHOULD-FIX 2]** `ExportResource` gains `"skill_gap_report"`;
   `run-export.ts` gains a branch rendering AC1's full result set to PDF, using the **same tenant-timezone
   "today" rule** as every other training read path. The widened constraint is `exports_resource_check` on the
   real `exports` table (corrected `export_jobs` naming, same as C5 AC2).
3. `training:view` required to request the export (mirrors `risk_board_pack`, not the stricter `:manage`).

**Web/Mobile/Shared:** Shared (route + export resource + `run-export.ts` branch) + Web (wire both).

### T4 — Training expiry notifications

**Design:** implied by P17's feature scope ("Expiry-driven warnings") and the KPI/gap-list's own real-time
framing — no dedicated jsx button, this is the job side of T1/T3's read surfaces.

UC
- Happy (job): each `warn`/`overdue`/`gap` cell (T1 AC2) notifies the affected **member** once per threshold
  **per cycle** (30/7/0 days before/at expiry for a record that has one, cycle-tied to that record's own
  `expires_at` — B4; a `gap` — never trained on a mandatory, non-archived competency, B8 — notifies once, then
  re-notified once per calendar month while it persists, mirroring the "escalating reminder that doesn't spam"
  shape `document-expiry` already establishes, adapted since a gap has no date to count down from).

AC
1. **[AMENDED — B4/B5/B8, full rewrite]** New daily per-tenant job `training-expiry` (same overall shape as
   `calibration-due`, C5 AC1 — one daily sweep per active tenant, no audit event for the notification itself),
   with the following corrected, exact design:
   - Iterates each tenant's `(member, mandatory-or-recorded, non-archived competency)` pairs among **active,
     non-partner** memberships (B5/B8 — matching T1's own corrected "who is in the matrix" rule, not a
     separately-invented one) — this is a genuine daily cross-join over members × mandatory competencies, named
     here explicitly as real backend work (§4), not a trivial index scan.
   - Computes state via `competencyCellState` (T1 AC2, ISO-date-string signature per B4), with **"today"
     computed in the tenant's own timezone** (`control.tenants.timezone`, B4(c) — the column already exists,
     no schema change needed; training is a tenant-wide HR-adjacent concept, not tied to a single plant the
     way an instrument is).
   - Notifies the affected member (not an "owner" — training is about the individual).
   - **[AMENDED — B4, cycle-tied dedupe key]** For a record with an `expires_at`: `dedupeKey:
     "training-expiry:<recordId>:<expiresAt>:<threshold>"` (embeds the record's own `expires_at`, so a
     refresher that produces a *new* record with a *new* `expires_at` gets a fresh key space — the same fix as
     C5's `cal-due` key, B4), `threshold` computed the same way as `calibration.ts`'s
     `activeCalibrationThreshold` — **[AMENDED-3 — SHOULD-FIX 4; AMENDED-4 — BLOCKING B/SHOULD-FIX 6]** `number |
     null` return type (`-0` normalized to `0`), the approach side using the **same smallest-threshold-crossed-
     on-every-day algorithm** as C5 AC1's corrected rule (any day 8-30 out returns `30`, 1-7 out returns `7`, day
     0 returns `0` — not an exact-match-day rule), `-7 * floor(daysOverdue / 7)` for the overdue side, same exact
     formula and between-mark values as C5 AC1 — for consistency between the two modules, `entityKind:
     "training_record"`, `entityId: <record id>`.
   - For a pure `gap` (no record exists at all): `dedupeKey: "training-expiry:<memberId>:<competencyId>:gap:
     <YYYY-MM>"` — a calendar-month bucket in the tenant's own timezone, since there is no expiry date to
     derive a cycle from; this re-notifies **once per calendar month** while the gap persists (the "re-notify
     window" B4(a) asks to be stated as a real number — one calendar month, roughly 30 days, chosen because a
     standing gap with no specific date driving it warrants a less urgent cadence than a dated, lapsing
     certificate), `entityKind: "competency"`, `entityId: <competency id>` (no record to point at — B9's
     `entityHref` case for `competency` is what makes this notification's click-through resolve).

**Web/Mobile/Shared:** Shared only (job + notification wiring); no new web surface beyond T1/T3 reading the
same underlying state.

### T5 — Competency catalog editor: archive + reorder **[AMENDED — B8, new story]**

**Design:** Board 9 (the competency catalog admin surface named in the architecture review) draws delete and
reorder controls for the catalog; T1 AC6 already promises "a tenant can edit/delete/add to" without a story
behind delete or reorder. No `qms-modules.jsx` screen shows this admin surface at all — the jsx only ever shows
the resulting matrix, never the catalog author's own editing screen — so, like C2/C4/C6's own dialogs, this is
flagged for the designer as **NO existing jsx** (§5).

UC
- Happy (archive): **[AMENDED-3 — SHOULD-FIX 7(d)]** from the catalog admin surface, an admin/manager/**auditor**
  archives a competency they no longer want authored against (its use has ended, or it was a mistake) —
  auditor is corrected in, mirroring the Sprint 04 pattern of auditor holding every elevated QMS-manage
  capability (this sprint's own X1 AC1 already grants auditor `training:manage`; this UC's earlier
  "admin/manager" wording was simply not updated to match) — the competency stops appearing anywhere live
  (matrix columns, KPI denominators, the gaps list, both notification jobs) but every historical
  `training_records` row that references it is untouched and still readable (a member's own history still
  shows "completed Forklift Safety on 2024-03-01" even after that competency is archived) — **[AMENDED-4 —
  BLOCKING A]** concretely, via T1 AC9's `GET /v1/training/records?memberId=...` route, which is the one
  training read path that deliberately keeps returning archived-competency rows for exactly this reason (no
  route existed for this before Round 4; this promise was previously unbuildable) — this is exactly why
  `archived_at` is a dedicated column, not the generic `deleted_at` soft-delete pattern this codebase's purge job
  eventually acts on. The confirm dialog's own "N members' existing training records against it are kept" copy
  reads `CompetencyDto.trainingRecordCount` (T1 AC9), computed live before the archive action is even confirmed.
- Happy (reorder): the ▲/▼ controls reorder the catalog's `seq` (matrix column order) — a real, atomic change,
  not a client-side-only reorder that silently reverts on refresh.
- Happy (mandatory flip): flipping `mandatory` from `false` to `true` on an existing competency does not
  retroactively rewrite any `training_records` row — the very next matrix render and the very next
  `training-expiry` sweep (T4) simply compute `gap` for every active, non-partner member who has no record for
  it, because cell state is always derived live (T1 AC2), never cached. No backfill migration or job is needed;
  this is stated explicitly so it is not silently assumed away.
- Empty: a catalog reduced to zero non-archived competencies behaves exactly like T1's own "no competencies
  defined" empty state.
- Permission: archiving, un-archiving (see AC1(c)), and reordering all require `training:manage`; `training:
  view` can read the catalog (including which rows are archived, via the explicit filter, AC1's `GET
  /v1/competencies?status=archived`).
- Error/offline: reorder/archive disabled by the offline banner (S1-5). **[AMENDED-4 — SHOULD-FIX 8(b)]** A
  stale `lockVersion` on **archive/unarchive** 409s, never silently overwrites a concurrent edit — reorder has no
  `lockVersion` field (it never did; the UC's earlier wording implying one was simply not reconciled with AC3)
  and instead uses its own equivalent concurrency guard, AC3's exact-id-set-match 409: a client whose copy of the
  catalog is stale (a competency archived or created since it loaded) gets a `409` there instead.

AC
1. `PATCH /v1/competencies/:id/archive` (`training:manage`, `lockVersion`, 409 on stale) — sets `archived_at =
   now()`; archiving an already-archived competency is `422` (no-op transition, mirrors C4 AC1's retire
   precedent). (b) `PATCH /v1/competencies/:id/unarchive` (`training:manage`, `lockVersion`) — clears
   `archived_at`; `422` if not currently archived; **[AMENDED-3 — SHOULD-FIX 7(b)] the un-archived row's `seq`
   is reset to `current_max_seq(non-archived) + 1`** — appended to the end of the catalog's current order, the
   same rule T1 AC3 states for a brand-new competency, stated explicitly here since an archived row's old `seq`
   may now collide with or fall in the middle of rows created/reordered while it was archived. Both audited
   `status_changed`, not generic `updated`. (c) **[AMENDED-3 — SHOULD-FIX 7(c)] Code uniqueness is enforced only
   among non-archived rows** — the partial unique index from T1 AC1 means an un-archive can conflict if another
   row has since taken the same `code` while this one was archived; that conflict is **`409 Conflict`,
   consistently** (a state-conflict, not a validation failure — corrected from an earlier ambiguous 409/422
   framing) — the service surfaces it as a real conflict, not a silent rename.
2. Archived competencies are excluded, by the same `archived_at IS NULL` predicate everywhere: `GET
   /v1/training/matrix` (T1 AC4), `GET /v1/training/summary` (T1 AC8), `GET /v1/training/gaps` (T3 AC1), the
   `training-expiry` job (T4 AC1), and `GET /v1/competencies`'s default listing (T1 AC3) — one predicate,
   applied in every one of these five places, not reimplemented five different ways; a shared query helper in
   `TrainingService`/`CompetenciesService` is the single source of truth for it.
3. **[Architect's confirmed correction; AMENDED-3 — SHOULD-FIX 7(a); AMENDED-4 — SHOULD-FIX 8(a), body shape
   corrected]** `PUT /v1/competencies/order` (`training:manage`) — body: **`{ ids: string[] }`, an explicitly-
   ordered array of every non-archived competency's id, position in the array is its new `seq`** (0-indexed) —
   corrected from an earlier `{ id, seq }[]`-pairs shape, which left an undefined behaviour for a request
   carrying duplicate `seq` values. An ordered-id-array body removes that question entirely: there is no
   client-supplied `seq` to duplicate, and a repeated id is already caught by the very next sentence's
   exact-set-match check (a set cannot contain a duplicate, so an array with a repeated id is shorter, as a set,
   than the current non-archived set, which the check below already rejects). **Returns `409 Conflict` if the
   body's id list does not exactly match the current set of non-archived competency ids** (a different set, a
   missing id, an extra id, or a duplicate id) — this prevents a stale client from silently reordering a
   different set than it thinks it's reordering (e.g. a competency was archived or a new one created since the
   client loaded its copy of the catalog); this exact-set-match check is also the reorder route's own
   concurrency guard (no separate `lockVersion` field — see this story's UC "Error/offline," SHOULD-FIX 8(b)).
   **Must be a single atomic statement** — one `UPDATE competencies SET seq = v.ord FROM (VALUES …) AS v(id, ord)
   WHERE competencies.id = v.id AND competencies.tenant_id = $tenantId` (or an explicit transaction wrapping
   equivalent per-row updates with no intervening commit) — never N sequential single-row `UPDATE`s, which could
   interleave with a concurrent
   reorder and leave two competencies sharing a `seq` or a gap in the sequence. Audited `updated` once for the
   whole reorder, not once per row.
4. `mandatory` remains a plain `PATCH /v1/competencies/:id` field edit (T1 AC3's existing route) — no new
   route for it; flipping it takes effect on the next live read of matrix/gaps/KPI/notification state (this
   story's UC "mandatory flip" case above), never a backfill.
5. Cross-tenant competency id → 404, not 403 (rule 8).

**Web/Mobile/Shared**
- **Web:** the competency catalog admin surface (▲/▼ reorder controls, an "Archive"/"Un-archive" action with a
  confirm dialog) — **no jsx precedent**, flagged for the designer (§5); exact archive-button copy and
  confirm-dialog wording are a small follow-up for the designer to confirm once Board 9 exists, not a new
  board.
- **Mobile:** not built — no `m-*.jsx` design; unaffected.
- **Shared:** `archived_at` column + partial unique index (folded into T1's migration `0069`); `PATCH
  /v1/competencies/:id/archive`/`/unarchive`, `PUT /v1/competencies/order` in `packages/types`'s contract; no
  new capability (reuses `training:view`/`training:manage`).

### X1 — Cross-cutting: nav retirement, capability wiring, placeholder ledger

UC
- `/calibration` and `/training` resolve to the real modules for `admin`/`manager`/`auditor`. `inspector` and
  `viewer` hold `calibration:view`/`training:view` (AC1's grant matrix) — a direct deep-link from either role
  does **not** 403 at the API. **[AMENDED — B9]** Unlike Sprint 04's `risk`/`msa` (which never send a
  notification to an `inspector`/`viewer`, so the nav gap there is dormant), this sprint's own `calibration-due`
  (C5) and `training-expiry` (T4) jobs notify an instrument's `owner` and a training record's subject
  respectively — either of whom can genuinely be an `inspector` or `viewer` (both are ordinary composite member
  FKs, not role-restricted). Confirmed by reading `apps/web/src/config/rbac.ts` in full: `inspector`'s and
  `viewer`'s `ROLE_NAV` sets do not include `calibration`/`training` today, which would mean the very person a
  notification is *about* gets a link that 404s/redirects for them — a dead control, disallowed by CLAUDE.md
  rule 10. **Resolution chosen: option (b)** — `inspector` and `viewer` gain real, read-only nav access to both
  routes (AC2 below), matching the fact they already hold the `:view` capability at the API layer; this is not
  a security boundary change (the API already allowed them in), it closes a UI-curation gap this sprint's own
  notifications newly expose. `partner` holds neither capability, so a partner deep-link **does** 403
  server-side.
- **[AMENDED — B9, new]** A calibration-due or training-expiry notification's row is a real, clickable link
  for every role that receives one, including `inspector`/`viewer` (resolved above) — `entityHref` gains the
  `instrument`/`competency`/`training_record` cases (AC5, new).

AC
1. `packages/core/src/rbac.ts` gains `calibration:view`, `calibration:manage`, `training:view`,
   `training:manage`. Grant matrix (mirrors `risk`/`msa`'s exact distribution, §2 X1 AC1 of Sprint 04, for the
   same reasoning): **admin** all four; **manager** all four; **auditor** all four (elevated QMS role, same
   precedent); **inspector** `calibration:view`, `training:view` only; **viewer** `calibration:view`,
   `training:view` only; **partner** neither.
2. **[AMENDED — B9]** `apps/web/src/config/rbac.ts` `ROLE_NAV`: `calibration` and `training` added to
   auditor's explicit `Set` (admin/manager already cover both structurally) — same reasoning Sprint 04 used to
   add `risk`/`msa` there. **Additionally, `calibration` and `training` are added to `inspector`'s and
   `viewer`'s explicit `Set`s** (both currently `Set(["dashboard","inspections","ncrs","documents",
   "notifications"])` and `Set(["dashboard","documents","reports","notifications"])` respectively, confirmed by
   reading the file) — read-only in practice, since neither role holds `calibration:manage`/`training:manage`,
   so every mutation control on either page is already hidden/disabled for them by the existing capability-gated
   UI pattern every other module in this codebase uses; this is the resolution to B9 stated in the UC above.
3. `InstrumentsController`/`CalibrationEventsController`/`CompetenciesController`/`TrainingController` routes
   carry `@RequireCapability` per §4's table — **[AMENDED — T5, new]** including `CompetenciesController`'s new
   `archive`/`unarchive`/`order` routes.
4. Placeholder ledger entries `"planned:calibration"`/`"planned:training"` removed from `PLACEHOLDER_LEDGER`,
   and `calibration`/`training` removed from `PLANNED_MODULES`.
5. **[AMENDED — B9, new]** `apps/web/src/lib/entity-routes.ts`'s `entityHref`/`entityIcon`/`entityLabel` gain:
   `instrument` → `/calibration?id=<uuid>` (icon: `Wrench`, matching `navigation.ts`'s existing calibration nav
   glyph); `competency` → `/training?competencyId=<uuid>` (icon: `Award`, matching `navigation.ts`'s existing
   training nav glyph — highlights that competency's column/gap on the matrix, a small additive query-param
   this sprint's own `TrainingMatrixPage` must support); `training_record` → `/training?recordId=<uuid>` (same
   icon — opens the member drawer scrolled to that record). `apps/web/src/features/notifications/
   notification-bits.tsx`'s `notifMeta` gains cases for the new notification `kind`s: `"instrument_calibration_
   due"` (icon `Wrench`, color `#d97706` amber — mirrors `document_expiring`'s treatment, category `"alert"`),
   `"training_expiring"` (icon `Award`, color `#d97706` amber, category `"alert"`), `"training_gap"` (icon
   `Award`, color `#dc2626` red — a mandatory certification never taken is more severe than a lapsing one,
   category `"alert"`) — without these, all three fall through to the generic `Bell`/`"system"` default, which
   is not wrong but loses the at-a-glance distinction every other alert-shaped notification in this app already
   has.

**Web/Mobile/Shared:** Web + Shared (capability + nav config + entity-routes + notifMeta). Mobile unaffected.

---

## 3. Backend design — PROPOSED, NEEDS EXPLICIT USER SIGN-OFF (P16 + P17)

*(This is the section to extract and present alone for approval, per ROADMAP §0 Q2. NO code for either module
is written until this is approved.)*

### 3.1 The real design decisions in this sprint, each resolving a phase doc's own open question

1. **Calibration warn window = 30 days** (resolves P16 §5's "warn-window days" question) — matches the jsx's
   own "Due < 30 days" KPI label exactly; not a number this sprint invented.
2. **Instrument `plant_id` (required) / `area_id` (optional), reusing the real `plants`/`areas` tables**, not
   a free-text "area" string — the jsx's display string is a UI concatenation of two real fields the codebase
   already models structurally (§1a); this also makes plant-scoped visibility (item 3) possible without a new
   mechanism.
3. **[AMENDED — B5] Instruments and the training matrix are plant-scoped for plant-scoped roles**, reusing
   `authorizePlant`'s real, confirmed "empty `plantIds` = unrestricted" semantics — **not** `members.
   service.ts`'s `list` method, which (confirmed by reading it in full) applies no plant filter at all; the
   file's `listPlants` method (lines 35-40) is the plant-*picker*'s own list, an unrelated read path. The
   overlap/visibility rule is stated explicitly in C1's and T1's own UC text (§0/B5) rather than pointed at a
   precedent that turned out not to exist. **[AMENDED-4 — BLOCKING C, the owner-sees-own-instrument exception,
   stated once, unambiguously, per route]** An instrument's designated `owner` may always see that **one**
   instrument's DETAIL fetch and its calibration-event HISTORY sub-route, even when it is outside their own
   `plantIds` — this is the only loosening of plant scope this sprint proposes, so it is stated here, in the
   approval text itself, not only in discussion prose:
   | Route | Owner-exception applies? |
   |---|---|
   | LIST (`GET /v1/instruments`) | No — pure plant-overlap filter |
   | SUMMARY/KPI aggregate (`GET /v1/instruments/summary`) | No — pure plant-membership aggregate |
   | DETAIL fetch (`GET /v1/instruments/:id`) | **Yes** |
   | CALIBRATION-EVENT HISTORY (`GET /v1/instruments/:id/calibration-events`) | **Yes** |
   | EXPORT (`calibration_audit_pack`) | No — bulk view of the caller's own scope |

   Justification: C5's `calibration-due` job notifies an instrument's `owner` regardless of that owner's own
   plant scope (B9, X1), so without this narrow, two-route carve-out the exact person a notification is *about*
   would get a detail-card link — and the history sub-view beneath it — that 404s for them, a dead control (rule
   10). No existing precedent for an owner/assignee plant-scope bypass exists elsewhere in this codebase
   (`ncr.service.ts`/`inspections.service.ts`'s own `assertInScope`, both read in full, are strictly plant-scope
   with no such exception), so this is approved on its own stated terms, not as an extension of an existing
   pattern. LIST, SUMMARY, and EXPORT are deliberately excluded from the exception — widening any of them would
   let an out-of-scope owner enumerate or aggregate over instruments beyond the single one they were notified
   about, which the notification's own deep link never requires.
4. **External-lab vendor tracking** (P16 §5's other open question) — resolved as: `method` stays free text
   (e.g. "External — A2LA"); no structured vendor/accreditation-body table is proposed (no spec names one, and
   the jsx never filters or reports by vendor identity, only displays the string).
5. **Calibration due/overdue does NOT block Inspections sign-off this sprint** (resolves P16 §5's third open
   question, and closes Q-C1 from §1a) — no jsx for the Inspections module shows an instrument-picker or a
   sign-off gate, and building one would be new scope on a module this sprint does not own. The calibration
   module's own overdue banner text is corrected from the jsx's literal claim to an accurate one: *"Out of
   calibration — overdue N days. Review any inspections that may have used this instrument since it was last
   in calibration."* (a call to action, not a claim of an enforced block that doesn't exist). Named as a
   follow-up (§7 Q-C1) for a future sprint that would add an `instrument_id` field to Inspections and a real
   sign-off gate — exactly the same treatment Sprint 04 gave MSA's `instrument_id`-to-calibration FK (its own
   named Q22 follow-up, now itself informed by this sprint actually shipping `instruments`).
6. **Training catalog is tenant-owned, seeded with the jsx's 9 example competencies as editable defaults**
   (resolves P17 §5's "seeded per-tenant or global template?" question) — no shared/global cross-tenant
   catalog table is proposed.
7. **Mandatory-gap cell rule** (resolves P17 §5's "mandatory-gap" ambiguity and corrects an apparent
   inconsistency in the jsx's own mock data, §2 T1): no record + mandatory → **gap** (red); no record +
   optional → **N/A** (gray); this is the literal, honest reading of the single `mandatory` boolean the schema
   carries — **no per-role required-competency mapping is built** (P17 §5's "link competencies to role
   requirements" question is left open, §7 Q-T3, since no spec defines what a role even requires per
   competency).
8. **`training_records` is a real per-completion history table**, not P17's own draft "unique latest row, +
   `audit_events` for history" — reasoning in §2 T1 AC1. This is the one genuine schema deviation from the
   phase doc's own draft, and is flagged here for explicit approval the same way Sprint 04 flagged `gauge_
   label` as text-not-FK. **[AMENDED-4]** This history is real and readable, not just stored: `GET
   /v1/training/records` (filtered by `memberId`, cursor-paginated, INCLUDES archived-competency rows so T5's
   "existing records are kept" promise is actually visible) and `GET /v1/training/records/:id` (single-record +
   evidence lookup) both exist (T1 AC9, §4). Visibility: a `training:manage` holder sees any member's records; a
   `training:view`-only caller sees only their own (403 on any other `memberId`, checked after a 404 tenant
   check) — this is training/evidence data about a specific person, not a general quality record, so it does not
   follow the module's own broader view-capability by default.
9. **[AMENDED — B7; AMENDED-3 — superseded detail, see item 16] Certificate/evidence attachment reuses the
   existing Files *upload* pipeline unchanged** (`entity_kind` is free-text, §1a, no new upload mechanism, no
   new `files` schema) — but the **link** from a calibration event to its certificate is corrected to be the
   real `certificate_file_id` FK exclusively, never a `files.entity_kind/entity_id` lookup (which this sprint's
   original draft proposed as a second, competing mechanism); training evidence for a batch submission shares
   one uploaded file across every member row by presigning with `entityKind: "training_batch"` and `entityId`
   omitted, then referencing that uploaded file's real id as `evidenceFileId` in the batch-create call —
   **[AMENDED-3]** corrected from an earlier, unbuildable `training_batch_id` presign-target design; see item
   16 for the full corrected mechanism (C2 AC1/AC4/AC5, T2 AC2, §0).
10. **Training does NOT block NCR/other actions this sprint** — same reasoning and disposition as item 5;
    the KPI/gap counts (T1 AC7, "BLOCKED" sub-label) are real numbers, the enforcement itself is not built.
11. **The "Linked e-learning" vendor panel (Cornerstone/SAP SuccessFactors/Litmos/Custom SCORM) is EXCLUDED
    this sprint** (§1a Q-T1) — no vendor decision, no credentials, no spec; the existing `integrations` table's
    provider whitelist has no LMS entry. **Proposed:** the panel is simply not built (omitted from the page,
    not shown with a fake "Connected"/"Available" state per rule 10) — this is the one designed panel this
    sprint does not reproduce, named here for explicit approval rather than silently dropped (mirrors how
    Sprint 04 named the MSA "Nested"/"Attribute (kappa)" methods as an honest, flagged exclusion rather than a
    silent one). If the user wants a placeholder acknowledging the gap instead of an omission, that is a
    one-line change at build time, but this sprint proposes omission as the cleaner, more honest default.
12. **Code formats corrected to the established pattern**: `CAL-YYYY-NNNN` for instruments (via `codes.ts`/
    `counters`, mirrors Sprint 04's `RISK-YYYY-NNNN`/`MSA-YYYY-NNNN` correction of the jsx's `CAL-001`/`R-NNN`
    mocks); competency `code` stays a plain author-chosen slug (not sequence-generated — item 6's reasoning).
13. **[AMENDED — B1, new] Generated-column arithmetic uses `make_interval`, not text-cast intervals** — the
    originally-proposed `(col || ' months')::interval` form throws "generation expression is not immutable" on
    Postgres 16 (the cast is not provably `IMMUTABLE`); `make_interval(months => …)` is the real,
    `IMMUTABLE`-marked fix, confirmed (not assumed) to be what Postgres's own date+interval month arithmetic
    already does with day-of-month overflow: it clamps to the target month's last valid day (`'2026-01-31' + 1
    month = 2026-02-28`; `'2028-01-31' + 1 month = 2028-02-29`, 2028 being a leap year) — both examples are
    asserted in a real integration test, not a `packages/core` unit test, since this is DB-side generated-column
    arithmetic (C1 AC1, T1 AC1).
14. **[AMENDED — B3, new; AMENDED-3 — BLOCKING 1 & 3] A `fail` calibration result never advances an
    instrument's due date, and every calibration event is audited regardless of result** — only
    `pass`/`adjusted` advance `last_calibrated`/`next_due`; a new `last_result` column drives an unconditional
    `overdue` override in `instrumentDueStatus` when the newest event is `fail`, closing a real IATF 7.1.5
    correctness bug the original draft had (an out-of-tolerance gauge could otherwise read "good"). **"Newest
    event" is now defined exactly** — ordered by `(performed_at DESC, created_at DESC)`, not a bare
    `performed_at >` comparison — closing a same-day tie-break hole where a same-day `fail` recorded after a
    same-day `pass` could fail to update `last_result` at all (Round 3 BLOCKING 1). **Every calibration event,
    any result, now writes its own `created` audit on the event row**; only `pass`/`adjusted` additionally
    write an `updated` audit on the parent instrument (the due-date advance); a `fail`'s `last_result` write to
    the parent is a non-audited denormalized mirror of the event's own already-audited result — no result type
    is ever silently unaudited (Round 3 BLOCKING 3) (C1 AC1/AC2, C2 AC2/AC5).
15. **[AMENDED — B4, new; AMENDED-3 — SHOULD-FIX 1 & 2] Due/expiry reminders are cycle-tied and take ISO date
    strings, never JS `Date` objects** — dedupe keys embed the due/expiry date itself
    (`cal-due:<id>:<nextDue>:<threshold>`, `training-expiry:<recordId>:<expiresAt>:<threshold>`), since
    `notifications_dedupe_uq` is a permanent index and the original key shape would have meant an
    instrument/record is only ever reminded through its first cycle. "Today" is computed in the **instrument's
    plant's timezone** for calibration and the **tenant's timezone** for training (both columns already exist,
    no schema change) — **[AMENDED-3] applied consistently to every READ path, not job-only**: the calibration
    list's `dueStatus` filter, its summary, its detail view, and its export all use the plant-timezone rule
    (C1 AC3/AC6, C5 AC2); the training matrix, its summary, its gaps list, and its export all use the
    tenant-timezone rule (T1 AC4/AC8, T3 AC1/AC2) — the same rule everywhere, since the SQL-vs-core-function
    agreement test (§4/§8) depends on it. **[AMENDED-4 — BLOCKING B]** The approach-to-due side is the
    **smallest threshold crossed on every day** inside the window — `[30, 7, 0]`, largest-first, same algorithm
    as `document-expiry.ts`'s real `activeExpiryThreshold` (any day 8-30 out returns `30`, 1-7 out returns `7`,
    day 0 returns `0`, corrected from an earlier, wrong "fires only on an exact-match day" statement that also
    wrongly cited `document-expiry.ts` as its own precedent). The re-notify cadence while overdue/lapsed is
    **every 7 days, uncapped** (exact formula, `-7 * floor(daysOverdue / 7)`, SHOULD-FIX 4, return type
    `number | null` — **[AMENDED-4 — SHOULD-FIX 6]** normalizing the `-0` JavaScript produces for `daysOverdue`
    `0`-`6` to a plain `0`), and a pure `gap` (no record at all) re-notifies **once per calendar month**;
    **[AMENDED-3, new; AMENDED-4 — SHOULD-FIX 9, wording]** an instrument whose newest event is `fail`
    additionally notifies its owner **on the next daily sweep**, independent of the date-threshold schedule
    (C5 AC1, T4 AC1).
16. **[AMENDED — B7, new; AMENDED-3 — BLOCKING 2, revised] `certificate_file_id`/`evidence_file_id` are the
    sole, authoritative links** — `files.entity_kind/entity_id` is informational only and never read to resolve
    "the certificate"/"the evidence"; both are now **composite FKs → `files(tenant_id, id)`** (SF6, corrected
    from a plain FK). Both write paths verify the file (i) belongs to this tenant, (ii) is fully uploaded
    (`sha256 IS NOT NULL`), (iii) **has `entity_kind` exactly matching what's expected**
    (`calibration_event`/`training_batch`), and (iv) **has `deleted_at IS NULL`** before accepting the link —
    (iii)/(iv) are new in Round 3, closing a real bypass where a client could presign with `entityKind` omitted
    (skipping the capability gate below) and then simply reuse an arbitrary existing tenant file's id at link
    time. `POST /v1/files/presign` requires the matching `:manage` capability for the two new `entityKind`s
    this sprint introduces — **[AMENDED-4 — SHOULD-FIX 3]** enforced inside `FilesService.presign` itself, not
    the (`@Internal()`-only, no-`@RequireCapability`) controller, since only the parsed body reveals which
    `entityKind` is being presigned. The inline calibration-certificate upload presigns the same way as training
    evidence — `entityKind` set, `entityId` **omitted** — closing the same class of bypass for both modules'
    inline flows (C2 AC4). **The unbuildable `training_batch_id` mechanism (Round 2) is dropped entirely** —
    training evidence for a batch is now shared by presigning with `entityKind: "training_batch"` and
    `entityId` **omitted**, uploading, completing (`sha256` set), and only then calling
    `POST /v1/training/records` with that file's real id as `evidenceFileId`, which the service copies to every
    row the call creates (C2 AC1/AC4/AC5, T2 AC2). **[AMENDED-4 — SHOULD-FIX 4]** Both FKs use
    **`ON DELETE RESTRICT`** — the files-purge job can never delete a file either column still references; it
    must fail/skip that file instead.
17. **[AMENDED — B8, new] Competency archival uses a dedicated `archived_at` column, never the generic
    `deleted_at` soft-delete pattern** — this sprint's own soft-delete purge job would otherwise eventually
    destroy real training history tied to an archived competency; code uniqueness is enforced only among
    non-archived rows (partial unique index), and archived competencies drop out of the matrix, KPIs, gap
    calculations, and both notification jobs everywhere, via one shared predicate (T1 AC1, T5).

### 3.2 Schema recap (full detail already in §2's ACs; not repeated verbatim here)

**[AMENDED — B2, renumbered]** `plants`/`areas`/`ncrs`/`files` carry no `UNIQUE (tenant_id, id)` today
(confirmed by grep), so nothing in this sprint could create the composite FKs it needs to them until that is
fixed — this shifts every migration number in the sprint's reserved range up by one:

- New prerequisite migration `0067_composite_fk_prereqs.sql`: `UNIQUE (tenant_id, id)` on `plants`, `areas`,
  `ncrs`, `files` (B2) — no other schema change.
- `instruments` (C1 AC1), `calibration_events` (C2 AC1) — migration `0068_calibration.sql`. Plus, in the same
  migration: `ncrs.source` CHECK widened to add `"calibration"` (C3 AC1), `NcrSource` enum gains it.
- `competencies`, `training_records` (T1 AC1, T5's `archived_at`) — migration `0069_training.sql`.
- `exports_resource_check` (on the real `exports` table, not `export_jobs`) widened to add
  `"calibration_audit_pack"`/`"skill_gap_report"` — migration `0070_calibration_training_exports.sql` (mirrors
  Sprint 04's combined `0066_risk_msa_exports.sql` pattern).
- Migration `0071` held as buffer for a build-time correction (mirrors Sprint 04's own buffer practice);
  Sprint 06 takes `0072` onward.

**What the user is being asked to approve:** all 17 decisions in §3.1 above — the 30-day warn window; the
plant/area FK design and its corrected, self-contained plant-scoping rule (no longer pointing at a precedent
that doesn't exist, and now, **[AMENDED-4 — BLOCKING C]** stated as one unambiguous per-route table — LIST/
SUMMARY/EXPORT excluded, DETAIL/HISTORY included — rather than the four inconsistent statements Round 3 left
behind); free-text vendor/method tracking; the deliberate non-enforcement of calibration/training gates
elsewhere in the product, with the corrected banner text; the tenant-owned seeded catalog; the mandatory-gap
cell rule; **[AMENDED-4 — BLOCKING A]** the per-completion history table for training, **now including the two
read routes that actually make that history reachable** (`GET /v1/training/records`/`GET
/v1/training/records/:id`, T1 AC9 — including archived-competency rows) and their capability-scoped visibility
rule (`training:manage` sees any member's, `training:view`-only sees only their own); **[AMENDED-3]** the
corrected Files-linking design (`certificate_file_id`/`evidence_file_id` as the sole authoritative links, now
composite FKs to `files(tenant_id, id)` with **[AMENDED-4 — SHOULD-FIX 4] `ON DELETE RESTRICT`**, presign
capability-checked for the two new entity kinds **[AMENDED-4 — SHOULD-FIX 3] inside `FilesService`**, and
link-time verified against the file's own `entity_kind`/`deleted_at`, with the unbuildable `training_batch_id`
mechanism replaced by an omitted-`entityId` presign + `evidenceFileId` sequencing, **now applied identically to
the inline calibration-certificate flow too**); the exclusion of the LMS vendor panel; the `CAL-YYYY-NNNN` code
correction; the `make_interval`-based generated columns and their confirmed month-end behaviour; **[AMENDED-3]**
the `fail`-never-advances-due-date correctness rule, now with an exact same-day "newest event" tie-break and a
three-way calibration-event/instrument audit split (created on every event, updated on the parent only for
pass/adjusted, updated on the event itself for a certificate re-attach); **[AMENDED-3; AMENDED-4 — BLOCKING B]**
the cycle-tied, timezone-explicit notification design, extended to every read path (not job-only), **now with
the approach-side threshold correctly returning the smallest threshold crossed on every day in the window
(matching `document-expiry.ts`'s real behaviour, not an exact-match-day rule)**, and a fail-triggered owner
notification delivered on the next daily sweep; and the `archived_at`-based competency-archival pattern (story
T5, now including its reorder/unarchive edge cases and **[AMENDED-4 — SHOULD-FIX 8(a)]** the reorder route's
corrected ordered-id-array body shape) — together with the full schemas in §2's ACs and the renumbered migration
range `0067`-`0071`, which will be built exactly as specified, never adjusted for cosmetic effect. **BLOCKING A
is the one genuinely new decision this round adds** — the training-history read routes and their visibility rule
did not exist in any prior round to approve. **None of Round 4's should-fix items, and none of Round 3's own
corrections, add further new decisions to approve** — they sharpen the exact, testable behaviour of decisions
already on the table (14, 15, 16 from Round 3; 3, 8, and 15 again from this round), never widen scope beyond
what this section already asks the user to approve.

---

## 4. Backend needs

| Story | Migration | Contract / REST route | Service | Audit events | RBAC | Tenant isolation |
|---|---|---|---|---|---|---|
| **B2 prereq** | **`0067_composite_fk_prereqs.sql`** — `UNIQUE (tenant_id, id)` on `plants`/`areas`/`ncrs`/`files` | none | none | none | n/a | forced RLS already exists on all four; this only adds a constraint |
| C1 | `0068_calibration.sql` (`instruments`, incl. `last_result`) | `GET/POST /v1/instruments` (+`q` search over name/code/**area name**, SF5), `GET/PATCH /v1/instruments/:id`, `GET /v1/instruments/summary` | `InstrumentsService` + `packages/core/calibration.ts` (pure, ISO-date signature) | `created`/`updated`, in-tx | `calibration:view` / `calibration:manage` | forced RLS; plant-scope filter (B5's own stated rule) **with the owner-sees-own-instrument exception applying to DETAIL and CALIBRATION-EVENT HISTORY only, not LIST/SUMMARY/EXPORT — see §2 C1 UC's per-route table [AMENDED-4, BLOCKING C]**; cross-tenant/plant id → 404; **all reads use the instrument's plant timezone for "today" (SF2)** |
| C2 | `0068` also (`calibration_events`) | `POST/GET /v1/instruments/:id/calibration-events`, `PUT /v1/instruments/:instrumentId/calibration-events/:eventId/certificate` | `InstrumentsService.recordCalibration`/`attachCertificate` | **[AMENDED-3]** `created` on the `calibration_event` row, every result, unconditionally; `updated` on the parent instrument only for `pass`/`adjusted` (due-date advance, B3); `updated` on the event row itself when a certificate is attached/replaced (AC5) — three-way split, in-tx | `calibration:manage` (write, incl. presign for `entityKind:"calibration_event"`) / `calibration:view` (read) | forced RLS, cascades with parent; tenant+`sha256`+**`entity_kind='calibration_event'`+`deleted_at IS NULL`** check before linking a certificate (BLOCKING 2); "newest event" ordered by `(performed_at DESC, created_at DESC)` (BLOCKING 1) |
| C3 | `0068` also (`ncrs.source` CHECK widened; `NcrSource` gains `calibration`) | `POST /v1/instruments/:instrumentId/calibration-events/:eventId/raise-ncr` | `InstrumentsService.raiseNcr` (mirrors `audits.service.ts:raiseNcr`) + `NcrsService.create` | `created` (new NCR), in-tx | `calibration:manage` (route gate) + `ncr:create` (service, redundant-but-harmless — §0) | forced RLS; cross-tenant id → 404; one-time-link guard |
| C4 | none | `PATCH /v1/instruments/:id/retire`, `PATCH /v1/instruments/:id` (transfer = existing edit route) | `InstrumentsService.retire`/`transfer` (area↔plant consistency check — architect's confirmed exception) | `status_changed` (retire) / `updated` (transfer) | `calibration:manage` | forced RLS |
| C5 | none (job + `exports_resource_check` widened in `0070`) | `ExportResource` gains `"calibration_audit_pack"` | `run-export.ts` new branch (same plant-timezone rule, SF2); new `calibration-due` job processor (cycle-tied dedupe, plant-timezone "today" — B4; **[AMENDED-3] plus a date-independent notification, sent on the next daily sweep (not real-time), for any instrument whose `last_result = 'fail'`, SF1 — [AMENDED-4] dedupe key includes the newest failing event's own id, found via the C2 AC2 tie-break rule; `activeCalibrationThreshold` returns `number \| null` (30/7/0/null approach-side per document-expiry.ts's real behavior — [AMENDED-4] BLOCKING B, not exact-day-only), `-7 * floor(daysOverdue/7)` on the overdue side, normalized so `-0` reads as `0`, SF4/SF6**) | existing export-created event; notifications write no audit event (mirrors `document-expiry`) | `calibration:view` (export) | scoped to caller's tenant/plant before enqueue |
| C6 | none | reuses C1's `POST /v1/instruments` | `InstrumentsService.create` (shared with C1) | `created` | `calibration:manage` | forced RLS |
| T1 | `0069_training.sql` (`competencies` incl. `archived_at`, `training_records` incl. `valid_months`) | `GET/POST /v1/competencies` (create sets `seq = max+1`, SF7(b); **[AMENDED-4 — SHOULD-FIX 8(c)]** 409 on code clash), `GET/PATCH /v1/competencies/:id`, `GET /v1/training/matrix` (+`q` search via `control.users`), `GET /v1/training/summary` (`coverage: number \| null`, "—" rendered by web, SF7), **[AMENDED-4 — BLOCKING A, new]** `GET /v1/training/records` (required `memberId`, includes archived-competency rows), `GET /v1/training/records/:id` | `CompetenciesService`, `TrainingService` + `packages/core/competency.ts` (pure, ISO-date signature) | `created`/`updated`, in-tx | `training:view` / `training:manage` — **[AMENDED-4] the two new history routes: `training:manage` sees any member's, `training:view`-only sees only their own (403 otherwise)** | forced RLS; plant-scope filter on matrix members (B5's own stated rule); cross-tenant/plant id → 404; **all reads use tenant timezone for "today" (SF2)** |
| T2 | none | `POST /v1/training/records` | `TrainingService.recordTraining` — **[AMENDED-3]** shared evidence via a presign with `entityKind:"training_batch"` and `entityId` omitted, uploaded/completed first, then referenced as `evidenceFileId` in this call (`training_batch_id` dropped, BLOCKING 2); one all-or-nothing transaction for the whole batch (SF8) | `created` per member row, in-tx | `training:manage` (write, incl. presign for `entityKind:"training_batch"`) / `training:view` (read) | forced RLS; tenant+`sha256`+**`entity_kind='training_batch'`+`deleted_at IS NULL`** check before linking evidence (BLOCKING 2) |
| T3 | none (`exports_resource_check` widened in `0070`) | `GET /v1/training/gaps`; `ExportResource` gains `"skill_gap_report"` | `TrainingService.gaps`; `run-export.ts` new branch (same tenant-timezone rule, SF2) | read-only / existing export-created event | `training:view` | RLS + plant-scoped |
| T4 | none | none (job only) | new `training-expiry` job processor — **a genuine daily members × mandatory-competencies cross-join, named here as real backend work, not a trivial index scan** (architect's confirmed note); tenant-timezone "today", cycle-tied dedupe (B4); threshold function returns plain `number \| null` (SF4) | notifications write no audit event (mirrors `document-expiry`) | n/a | scoped per tenant, excludes archived competencies/partner/inactive members |
| **T5** | `0069` also (`archived_at`, partial unique index) | `PATCH /v1/competencies/:id/archive`, `PATCH /v1/competencies/:id/unarchive` (resets `seq = max+1`, 409 on code clash, SF7(b)/(c)), `PUT /v1/competencies/order` (**[AMENDED-4 — SHOULD-FIX 8(a)]** body `{ ids: string[] }`, position = new `seq`; single atomic statement — architect's confirmed exception; **409 if the id set doesn't exactly match current non-archived ids, SF7(a)** — this is the route's own concurrency guard, no separate `lockVersion` field, SHOULD-FIX 8(b)); **[AMENDED-4 — SHOULD-FIX 8(c)]** `POST /v1/competencies` also 409s on a `code` clash | `CompetenciesService.archive`/`unarchive`/`reorder`/`create` | `status_changed` (archive/unarchive) / `updated` (reorder, once for the whole batch) / `created` (competency) | `training:manage` | forced RLS; `lockVersion` on archive/unarchive |
| X1 | none | `@RequireCapability` on all four controllers, incl. T5's new routes | none | none | `calibration:view`/`calibration:manage`/`training:view`/`training:manage` added to `packages/core/src/rbac.ts` per §2 X1 AC1; `calibration`/`training` added to auditor's, `inspector`'s, and `viewer`'s web `ROLE_NAV` `Set`s (B9) | n/a |

Every mutation runs inside `withAudit` in the same transaction (rule 3); both list/matrix endpoints are
cursor-paginated (rule 6); all new Zod schemas live in `packages/types` (rule 4); calibration and competency
status-derivation math are `packages/core` pure functions (rule 5), taking ISO date strings not JS `Date`
objects (B4), never computed in a controller or a React component. `POST` create routes carry an
`Idempotency-Key` header (one per training batch, not per member row). A dedicated test proves the SQL-side
matrix/gaps query and the `packages/core` pure-function version of `competencyCellState`/`instrumentDueStatus`
agree at every boundary condition (warn/overdue crossovers, the `fail`-override, the due-day-reads-`warn` rule,
**[AMENDED-3] the "newest event" `(performed_at DESC, created_at DESC)` tie-break, and the plant/tenant
timezone rule applied identically across every read path, SF2**) — named here explicitly per the architect's
own confirmed note, not assumed to follow automatically from "both implement the same rule." **Reserved
migration range for this sprint: `0067`-`0071`** (**[AMENDED — B2,
renumbered]** 0067 composite-FK prereqs on `plants`/`areas`/`ncrs`/`files`, 0068 instruments + calibration_
events + NcrSource widening, 0069 competencies + training_records + T5's `archived_at`, 0070 `exports_
resource_check` widening, 0071 held as buffer — Sprint 06 takes `0072` onward).

## 5. Design needs

**Existing binding jsx — designer audits these against the built screens, does not redraw them:**
- `CalibrationManagement` (KPI strip, register table, detail card w/ overdue banner and history) —
  `qms-modules.jsx` lines 176-319.
- `TrainingMatrix` (KPI strip, competency matrix w/ Legend, Expiring & overdue card) — `qms-modules.jsx`
  lines 1-174, **minus** the "Linked e-learning" card (§3.1 item 11, excluded this sprint).

**NO existing jsx — designer must draw these, in the existing visual language, before Gate 1:**
1. **Record-calibration dialog** (C2) — result/performed-by/notes/certificate-upload form; no jsx shows any
   data-entry surface for calibration, only pre-computed display.
2. **Add-instrument form** (C6) — name/type/plant/area(cascading)/method/tolerance/interval/owner fields.
3. **Instrument "⋯" menu** (C4) — three real actions (View full history / Retire / Transfer), plus a confirm
   step for Retire (a real, if reversible-by-future-story, lifecycle change).
4. **Record-training dialog** (T2) — member picker (multi-select for "Assign training"), competency picker,
   completion date, evidence upload.
5. **Training matrix cell/member drawer** (T1) — the jsx never shows a click-through state for a matrix cell
   or a member's own history list; needs a design pass in the existing detail-drawer visual language.
   **[AMENDED-4 — BLOCKING A]** This is Board 7 named by the architecture review — the drawer now has a real
   data source (`GET /v1/training/records`, T1 AC9), including rows against an archived competency (shown, not
   hidden, per T5's own promise) and each row's evidence-download affordance. **[AMENDED-4, resolved]** A
   `training:view`-only caller's matrix cells outside their own row are non-interactive (T1 UC), so this drawer
   is never opened against someone else's data from the matrix itself — no permission-denied state needs
   designing. The drawer's own error state (network/loading failure) still applies as normal.
6. **Calibration/training empty states** (C1/T1) — zero-instrument and zero-competency states, consistent with
   Sprint 02/03/04's own empty-state precedent.
7. **Corrected overdue-banner copy** (§3.1 item 5) — same visual treatment as the jsx's banner, new text; a
   one-line copy edit for the designer to carry into the board.
8. **[AMENDED — B3, new] Failed-calibration banner state** (Board 1, C1) — a small follow-up, not a new board:
   a distinct visual treatment for an instrument whose newest event is `fail` (AC2's override), so it does not
   look identical to a merely date-overdue instrument; suggested copy in C1's UC, exact wording left to the
   designer.
9. **[AMENDED — B8, new] Competency catalog admin surface (Board 9)** (T5) — the ▲/▼ reorder controls and an
   Archive/Un-archive action with a confirm dialog; no jsx shows this screen at all (only the resulting
   matrix), so it is a genuinely new board, not an edit to an existing one. **Small follow-up once drawn:**
   confirm the exact archive-button copy and confirmation-dialog wording (e.g. does it warn that historical
   training records referencing this competency remain, unaffected, per T5's own UC) — this is a copy
   confirmation, not a design-from-scratch ask. **[AMENDED-4 — BLOCKING A]** the dialog's own "N members'
   existing training records against it are kept" copy now has a real number to bind to
   (`CompetencyDto.trainingRecordCount`, T1 AC9) — the designer's copy confirmation is now confirming wording
   around a real, live count, not a placeholder number.

## 6. Dead-end audit

| Control | Current state | This sprint |
|---|---|---|
| Sidebar "Calibration" (`/calibration`) | `PLANNED_MODULES["calibration"]` placeholder | Real register + detail (C1) |
| Sidebar "Training & competency" (`/training`) | `PLANNED_MODULES["training"]` placeholder | Real matrix (T1) |
| `CalibrationManagement` "Add instrument" button | `kToast` only | Real create form (C6) |
| `CalibrationManagement` "Audit pack" button | `kToast` only | Real export (C5) |
| `CalibrationManagement` "Record calibration" button | `kToast` only | Real dialog + event (C2) |
| `CalibrationManagement` "Upload cert" button | `kToast` only | Real Files-pipeline upload (C2) |
| `CalibrationManagement` "⋯" menu | `kToast` only | Real View history / Retire / Transfer (C4) |
| `CalibrationManagement` out-of-tol KPI's implied "N led to NCR" | No button anywhere; an un-backed number | Real "Raise NCR" action + real count (C3) |
| `TrainingMatrix` "Assign training" button | `kToast` only | Real record-training dialog (T2) |
| `TrainingMatrix` "Skill gap report" button | `kToast` only | Real export (T3) |
| `TrainingMatrix` "Schedule" button (Expiring & overdue row) | `kToast` only | Real pre-filled record-training dialog (T2) |
| `TrainingMatrix` "Connect" buttons (Litmos, Custom SCORM) | `kToast` only, fake "Connected" badges on the other two | **NOT built** — panel excluded this sprint (§3.1 item 11), named not faked |
| **[AMENDED — B8, new]** Competency catalog admin: Archive/Un-archive action | No such control exists in any jsx or prior draft | Real `PATCH /v1/competencies/:id/archive`/`/unarchive` (T5) |
| **[AMENDED — B8, new]** Competency catalog admin: ▲/▼ reorder | Drawn on Board 9, promised in T1 AC6, no AC until this amendment | Real atomic `PUT /v1/competencies/order` (T5) |
| **[AMENDED — B7, new]** Calibration event's "attach certificate after the fact" affordance | Not previously distinguished from the inline record-calibration upload | Real `PUT /v1/instruments/:instrumentId/calibration-events/:eventId/certificate` (C2 AC5) |
| **[AMENDED — B9, new]** A calibration-due/training-expiry notification row's click-through | `entityHref` had no case for `instrument`/`competency`/`training_record` — would have rendered as a non-navigating row | Real deep links (`/calibration?id=`, `/training?competencyId=`/`?recordId=`), reachable by every role that receives the notification (X1 AC2/AC5) |
| **[AMENDED-4 — BLOCKING A, new]** Training matrix cell → member drawer / `/training?recordId=` deep link | No read route existed to serve either one — the matrix route returns only the newest, non-archived-competency record per pair, so the drawer and the `recordId` deep link would both have rendered as dead/empty controls | Real `GET /v1/training/records`/`GET /v1/training/records/:id` (T1 AC9), including archived-competency rows, with a stated `training:manage`-vs-`training:view` visibility rule |

No new "coming soon" text, no new dead button beyond the one named exclusion (the LMS panel), which is omitted
entirely rather than left selectable-but-broken — CLAUDE.md rule 10 is "never stub," not "never say no,"
exactly Sprint 04's own closing note for its one exclusion (Nested/Attribute-kappa MSA).

## 7. Out of scope / open questions

- **Q-C1 (new).** Calibration's "auto-block measurement use" / "blocked at inspection sign-off" claim (the
  jsx's own banner text) is not enforced anywhere this sprint — no Inspections jsx shows an instrument field
  or a sign-off gate. The banner text is corrected (§3.1 item 5) rather than reproduced as a false claim.
  Wiring a real block (an `instrument_id` field on inspections + a sign-off-time check) is a named future
  story on the Inspections module, not started or silently dropped here.
- **Q-C2 (new).** No "un-retire" action is built for `instruments` (C4) — the mock names no such control. A
  future story can add a symmetric `retired → active` transition if wanted.
- **Q-T1 (new).** The "Linked e-learning" vendor panel (Cornerstone/SAP SuccessFactors/Litmos/Custom SCORM) is
  excluded this sprint (§3.1 item 11) — no vendor decision, no credentials, no spec, same class of deferral as
  ROADMAP Q5's SSO/SCIM/BYOK. Revisit at a future wave once a vendor is chosen.
- **Q-T2 (new).** "Assign training" and "record a completion" are the same action this sprint (§2 T2) — there
  is no "assigned, not yet completed, tracked as upcoming" pending state, since no jsx cell shows a fifth
  visual state for it. If a real assignment-tracking workflow (distinct from a completion record) is wanted,
  it needs its own design pass and its own sign-off.
- **Q-T3 (new).** No per-role required-competency mapping is built (P17's own open question, §3.1 item 7) — a
  competency's `mandatory` flag applies tenant-wide, not per role/position. Auto-deriving "this role needs
  these certs" is a future story once a role-requirements model is designed.
- **[AMENDED — smaller correction] Q-T4 (new).** Calibration events and training records are append-only by
  design this sprint (no delete/edit route after creation, §2 C2/T1/T2) — an entry recorded against the wrong
  person, or with a typo'd result/date, can never be removed or corrected. This is a real, named gap, not
  silently accepted as fine: a future story would need either a "supersede with a correction entry, keep the
  original for audit" pattern or a narrowly-scoped admin-only correction route with its own audit trail. Not
  built this sprint because no spec names either shape and inventing one now would be scope creep.
- **[AMENDED — smaller correction] Q-C3 (new).** P16's own "recall on overdue" concept — pulling an instrument
  from service (blocking its further use) the moment it goes overdue, not just flagging it — is not covered by
  this sprint. `instruments.status` only ever reflects `active`/`retired` (a manual lifecycle choice), never an
  automatic transition driven by `next_due`/`last_result`. Explicitly deferred, not silently dropped: a future
  story would need to define what "recall" actually blocks (this sprint already declines to block Inspections
  sign-off, Q-C1) and how an instrument returns to service after recalibration.
- **[AMENDED — smaller correction, new] Known issue — pre-existing file-download hole.** Any authenticated
  member can currently download a file by id with no capability or plant check (confirmed pre-existing,
  `files.controller.ts`'s download route; not introduced by this sprint). Training evidence (C2/T2) and
  calibration certificates may carry personal data (a member's name, signature, or health/fitness-to-work
  information incidental to a training record), so this sprint is not silently shipping more sensitive content
  on top of an existing, unaddressed hole without naming it. Fixing the general download-authorization gap
  across every `entity_kind` is out of scope for this sprint (a cross-cutting Files-module fix, not specific to
  calibration/training) — logged here so it is not lost, not treated as this sprint's own defect to fix.
- **[AMENDED-3 — SHOULD-FIX 10, new] Known issue — `document-expiry.ts`'s `Date`-based signature.** Round 1's
  amendment (B4, §0) stated that `document-expiry.ts`'s existing `Date`-based function signature
  (`packages/core/src/document-expiry.ts:33`) carries the same latent exposure to the local-midnight/timezone
  bug this sprint's own ISO-date-string signatures (`instrumentDueStatus`, `competencyCellState`,
  `activeCalibrationThreshold`) are deliberately written to avoid — `pg` returns a `date` column as a
  local-midnight JS `Date`, which can silently shift under a non-UTC server timezone. Round 1's own text
  claimed this was "logged as a Known issue" here in §7, but on review that entry was never actually added —
  this bullet is that missing entry, added now (Round 3, SF10). It remains explicitly out of scope for this
  sprint to fix (`document-expiry.ts` belongs to the existing document-expiry module, not calibration/training,
  and this sprint does not touch it) — a future story should migrate it to the same ISO-date-string signature
  this sprint establishes as the pattern for date-driven due/expiry logic.
- **Sprint 04's own follow-up, now informed by this sprint:** Sprint 04's Q22 named `msa_studies.gauge_label`
  as free text pending a real `instrument_id` FK once calibration ships. **This sprint does not add that FK
  or backfill** — it is explicitly deferred again, one sprint further, to a small follow-up story that adds
  `msa_studies.instrument_id` (composite FK → `instruments(tenant_id, id)`, nullable to preserve existing
  free-text-only studies) plus a best-effort backfill matching existing `gauge_label` strings to instrument
  names where they coincide. Reason for not folding it into this sprint: MSA is Sprint 04's own closed module
  and touching its schema here would reopen a sprint already Gate-2-accepted and merged (PR #34); a dedicated
  small follow-up keeps that boundary clean. **Not silently dropped** — logged here as the direct continuation
  of Q22, to be scheduled explicitly (a future mini-sprint or folded into Sprint 06's kickoff), not assumed.
- Mobile: confirmed no `m-*.jsx` designs either module (§1a); both stay fully unaffected this sprint (no
  route, no nav, `pnpm --filter @kaenal/mobile typecheck` must stay green on the additive shared-type changes
  only).
- **Merge-conflict hot spots (ROADMAP §4):** this sprint touches `packages/types/src/contract.ts`,
  `packages/types/src/enums.ts` (`NcrSource`, `ExportResource`, new `InstrumentType`/`CalibrationResult`
  enums — no `EntityKind` change, since neither module becomes an `entity_links`-linkable kind), `planned-
  modules.ts`, `placeholder-ledger.ts`, and `apps/web/src/config/rbac.ts` — one owner, rebase before PR, per
  the standing rule. `navigation.ts` needs no structural change (both ids already exist, §1a).
  **[AMENDED — B9, correction]** This sprint's earlier claim that it "does not touch `entity-routes.ts`" was
  **wrong** — confirmed by reading the file in full, it has no case for `instrument`/`competency`/
  `training_record` today, and this sprint's own new notifications need one (X1 AC5); `entity-routes.ts` and
  `notification-bits.tsx` are now real touch points, named here so a concurrent sprint editing either file
  knows to rebase. This sprint still does **not** touch `entity-ref.ts` or `graph-kinds.ts` (neither module
  becomes an `entity_links`-linkable kind or a graph-explorer node), so it does not intersect Sprint 04's own
  touch-points there.
- **Existing unpushed branches:** `git branch -a`/`git log --all` confirm **`feat/partner-invite-mfa`** and
  **`feat/webhook-config-form`** are **already merged** (both appear only as merge-commit messages into
  `integration/sprint-01-phase-a`, already on `main`'s history) — ROADMAP §4's mention of them as "still
  unpushed" is **stale**; no caution needed, this sprint does not intersect either area
  (`sections/integrations.tsx`, portal contacts) regardless.

## 8. Definition of Done

- [x] **User has explicitly approved §3** (all **17** named decisions in §3.1 — **[AMENDED — B1-B9;
      AMENDED-3 — items 14/16 sharpened; AMENDED-4 — items 3/8/15 sharpened (the owner-exception table, the
      training-history read routes, and the corrected approach-side threshold algorithm), no new decision
      count]**, plus the full schemas in §2's ACs) — **approved 2026-09-29, as proposed, no changes.** Build
      unblocked.
- [ ] **[AMENDED — B2, renumbered]** Migrations `0067_composite_fk_prereqs.sql`, `0068_calibration.sql`,
      `0069_training.sql`, `0070_calibration_training_exports.sql` applied, in that order (`0067` before the
      others — it is a real dependency, not just numbering); `pnpm db:check` green; `pnpm test:rls` green
      including all four new tables plus the four widened ones.
- [ ] **[AMENDED — B1]** An integration test against real Postgres 16 asserts the `next_due`/`expires_at`
      generated columns compute correctly, including the exact month-end worked examples (`2026-01-31` + 1
      month `= 2026-02-28`; `2028-01-31` + 1 month `= 2028-02-29`) — not merely that the migration applies
      without error.
- [ ] `packages/core/calibration.ts` and `packages/core/competency.ts` unit-tested (status/cell-state
      derivation, all boundary days, all five training cell states, **[AMENDED — B3] the `last_result='fail'`
      override with a far-future `nextDue`, proving it truly ignores the date, [AMENDED — B4] both functions'
      ISO-date-string signature**).
- [ ] **[AMENDED — B4, new]** A test proves the SQL-side matrix/gaps query and the `packages/core` pure-function
      version of `competencyCellState`/`instrumentDueStatus` agree at every boundary condition (architect's
      confirmed note, §0/§4) — not assumed to follow automatically from both "implementing the same rule."
- [ ] `packages/core/src/codes.ts` gains `"instrument"` → `CAL`, unit-tested; created instruments get real
      `CAL-YYYY-NNNN` codes via the `counters` table.
- [ ] Contract gains all routes in §4 (**[AMENDED — B6/B7/B8, new]** including both `/summary` routes, the
      certificate-attach `PUT` route, and T5's `archive`/`unarchive`/`order` routes);
      `calibration:view`/`calibration:manage`/`training:view`/`training:manage` enforced via
      `@RequireCapability`; RBAC grant matrix matches §2 X1 AC1 exactly.
- [ ] **[AMENDED — B7, new; AMENDED-4 — SHOULD-FIX 3]** `POST /v1/files/presign` requires
      `calibration:manage`/`training:manage` for `entityKind` `"calibration_event"`/`"training_batch"`
      respectively, **enforced in `FilesService.presign`, not `FilesController`** (the controller stays
      `@Internal()`-only with no `@RequireCapability`, confirmed by reading it); a `viewer`-role presign attempt
      for either returns 403, browser/integration-tested. `apps/web/src/hooks/use-files.ts`'s `uploadFile` accepts
      an entity-id-**optional** `entity` shape and is exercised by both the inline certificate and evidence call
      sites presigning with `entityKind` set and `entityId` omitted.
- [ ] **[AMENDED-4 — BLOCKING A, new]** `GET /v1/training/records` (required `memberId`, optional
      `competencyId`) and `GET /v1/training/records/:id` exist, cursor-paginated, and **include rows whose
      competency is archived** — integration-tested by archiving a competency with existing records and
      confirming they still appear in this route's response (not just absent from the matrix). A `training:
      manage` caller can fetch any member's records; a `training:view`-only caller fetching a `memberId` other
      than their own gets `403`; fetching their own succeeds; a cross-tenant/cross-plant id gets `404` before the
      capability check is even reached — all four cases browser/integration-verified. `CompetencyDto`'s live
      `trainingRecordCount` field is verified against a seeded fixture with a known number of distinct members
      trained on that competency.
- [ ] Web `/calibration` fully real: KPI strip (real formulas, §2 C1 AC5, **[AMENDED — B6] read from
      `GET /v1/instruments/summary`**), register table w/ search **[AMENDED — B6, real `q`]** + segmented
      filter, detail card w/ corrected overdue banner + **[AMENDED — B3, new]** failed-calibration banner state
      + Record-calibration dialog + certificate upload (inline and via the new attach-after-the-fact route) +
      Raise-NCR action + "⋯" menu (history/retire/transfer), Add-instrument form, audit-pack export, all
      empty/error/offline/permission states — browser-verified side-by-side against `qms-modules.jsx`'s
      `CalibrationManagement` (minus the corrected banner text, named and reasoned in §3.1).
- [ ] Web `/training` fully real: KPI strip (real formulas, §2 T1 AC7, **[AMENDED — B6] read from
      `GET /v1/training/summary`**), competency matrix w/ Legend + sticky column + search **[AMENDED — B6,
      real `q` resolved via `control.users`]** + segmented filter + member drawer, Expiring & overdue card
      sourced from the real gaps route, Record-training dialog (assign + schedule), **[AMENDED — B8, new]** the
      competency catalog admin surface (archive/un-archive + atomic reorder, T5), skill-gap-report export, all
      empty/error/offline/permission states — browser-verified against `TrainingMatrix` (minus the excluded
      "Linked e-learning" card, named and reasoned in §3.1 item 11).
- [ ] An out-of-tolerance calibration event's "Raise NCR" action creates a real NCR with `source: "calibration"`
      and round-trips to it; a second raise attempt on the same event is rejected (409), browser-verified.
      **[AMENDED — smaller correction]** Raising an NCR from a past event on a since-retired instrument still
      succeeds; editing that instrument or recording a new event against it returns 422 — both browser-verified.
- [ ] **[AMENDED — B3, new]** A `fail` calibration event does not advance `last_calibrated`/`next_due`; the
      instrument reads `overdue` via `last_result`, verified against a real instrument whose `next_due` is
      still far in the future — browser/integration-verified, not just unit-tested in isolation.
- [ ] **[AMENDED — B4, full rewrite]** `calibration-due` and `training-expiry` jobs fire real notifications at
      the 30/7/0-day thresholds and the 7-day (calibration/training-with-a-date) or monthly (training `gap`)
      re-notify cadence thereafter, idempotent per cycle (dedupe key embeds the due/expiry date), tested against
      seeded fixtures including a fixture that recalibrates/re-trains and proves a **new** cycle notifies again
      (the exact bug B4 closes — a test that only proves "no duplicate within one cycle" is not sufficient).
- [ ] **[AMENDED — B9, new]** `entity-routes.ts`'s `entityHref` resolves `instrument`/`competency`/
      `training_record` to real, working pages; `notification-bits.tsx`'s `notifMeta` has real entries for the
      three new notification kinds (not the generic `Bell`/`"system"` fallback); an `inspector`/`viewer`
      account that is a notification's own subject can click through to it, browser-verified.
- [ ] **[AMENDED — B8, new]** Archiving a competency removes it from the matrix/KPIs/gaps/both jobs on the next
      read/sweep without touching any existing `training_records` row that references it (browser/integration-
      verified: archive, then confirm the member's own history for that competency is unchanged); un-archiving
      restores it (`seq = max+1`, SF7(b)); the reorder route is proven atomic under a concurrent-write test
      (architect's confirmed requirement), not just correct in the single-caller case; **[AMENDED-3 — SF7(a)/(c)]**
      the reorder route returns `409` when its body's id list doesn't exactly match the current non-archived
      set, and an un-archive that collides with a live competency's code returns `409` consistently — both
      integration-tested.
- [ ] **[AMENDED-3 — BLOCKING 1, new; AMENDED-4 — SHOULD-FIX 2, methodology corrected]** A same-day tie-break
      test proves: (a) a same-day `fail` recorded *after* a same-day `pass` correctly flips `last_result` to
      `fail` (the instrument reads `overdue`); (b) a same-day corrective `pass`/`adjusted` recorded *after* a
      same-day `fail` correctly clears the override — both against real inserted rows with identical
      `performed_at`, distinguished only by insertion order (`created_at`). **The two rows must come from two
      separate requests/transactions**, not two inserts in one transaction — Postgres's `now()` is
      transaction-scoped, so two rows inserted together would get an identical `created_at` and never actually
      exercise the tie-break rule. (c) **[AMENDED-4 — SHOULD-FIX 2, new]** The `fail` case's parent-row write
      (`last_result`) is proven to go through the same `lockVersion`-conditional `UPDATE` as the `pass`/`adjusted`
      case — a concurrent stale-`lockVersion` request recording a `fail` gets `409`, exactly like a concurrent
      `pass`/`adjusted` would. (d) **[AMENDED-4 — SHOULD-FIX 1, new]** A backdated ("out-of-order") test: a `pass`
      recorded with a `performed_at` earlier than an already-recorded later `fail` does not become newest (per
      the tie-break rule) and touches **no** field on the parent instrument row — not `last_calibrated`,
      `next_due`, nor `last_result` — and writes no parent audit.
- [ ] **[AMENDED-3 — BLOCKING 3, new]** An audit-trail test proves the three-way split: every calibration event
      (pass, adjusted, **and fail**) writes a `created` audit on the `calibration_event` row; only pass/adjusted
      additionally write an `updated` audit on the parent `instrument`; a `fail` writes no parent audit; the
      certificate-attach `PUT` route writes an `updated` audit on the `calibration_event` row and never on the
      parent instrument — integration-tested against real audit-log rows, not asserted from the AC text alone.
- [ ] **[AMENDED-3 — BLOCKING 2, new; AMENDED-4 — BLOCKING D, corrected]** The corrected evidence/certificate
      flow is proven end-to-end: **the happy path presigns with `entityId` omitted (no record/batch exists yet)
      and `entityKind` set** (`"calibration_event"`/`"training_batch"`, so the capability gate has something to
      check) → upload → complete → create/attach call referencing that file's id succeeds (calibration and
      training both) — corrected from an earlier, backwards DoD description that named "`entityKind` omitted" as
      the happy path, which is literally the security bypass this item closes, not the correct flow. **Two
      separate bypass tests**, not one: (i) presigning with `entityKind` **set** and then attempting to link an
      **unrelated** existing tenant file (wrong `entity_kind`, or one with `deleted_at` set) as a
      certificate/evidence file is rejected, for both C2 (AC4/AC5) and T2 (AC2); (ii) presigning with
      `entity_kind` left **NULL/omitted** is either rejected outright, or, if accepted as a general-purpose
      upload, is proven **excluded from later certificate/evidence linking** (the link-time `entity_kind`-exact-
      match check rejects it) — this second test is the actual security property this item exists to prove, not
      the happy path.
- [ ] **[AMENDED-3 — SHOULD-FIX 1, new]** An instrument whose newest event is `fail` notifies its owner on the
      very next `calibration-due` sweep even when `next_due` is far in the future, integration-tested against a
      seeded fixture.
- [ ] **[AMENDED-3 — SHOULD-FIX 2, new]** A test proves the calibration list's `dueStatus` filter, its summary,
      its detail view, and its export agree on the same instrument's status on the same day (plant timezone);
      the equivalent test for training's matrix, summary, gaps, and export (tenant timezone).
- [ ] **[AMENDED-3 — SHOULD-FIX 3, new; AMENDED-4 — BLOCKING C, extended to every route]** An `inspector`/
      `viewer` whose own `plantIds` excludes their own designated instrument's plant can still fetch that one
      instrument by id (200, not 404) via DETAIL and its calibration-event HISTORY sub-route, and click through
      to a notification about it, while still 404ing on every *other* out-of-scope instrument. The **same owner**
      does **not** see that instrument counted in the LIST route, the SUMMARY/KPI numbers, or an exported
      `calibration_audit_pack` — all five routes (LIST/SUMMARY/DETAIL/HISTORY/EXPORT) tested against the single
      table in §3.1 item 3, not just DETAIL in isolation — browser/integration-verified.
- [ ] **[AMENDED-3 — SHOULD-FIX 4, new; AMENDED-4 — BLOCKING B & SHOULD-FIX 6]** `activeCalibrationThreshold`
      unit-tested across every `daysUntilDue` value from `31` down through every `daysOverdue` value `0`-`20`
      (not just the named marks): **the approach side returns the smallest threshold crossed on every day** — `30`
      for every day 8-30 out, `7` for every day 1-7 out, `0` on the due day itself, `null` beyond 30 out (matching
      `document-expiry.ts`'s real `activeExpiryThreshold` behaviour, not an exact-match-day rule) — and **the
      overdue side** proves the `-7 * floor(daysOverdue/7)` formula for every in-between value (1-6, 8-13, etc.),
      **with `-0` normalized to `0`** so `daysOverdue` `0`-`6` never fails a strict `toBe(0)` assertion. Return
      type is asserted as `number | null` (not plain `number`) throughout.
- [ ] **[AMENDED-3 — SHOULD-FIX 5, new]** `GET /v1/instruments?q=` matches an instrument by its area's name,
      not only by instrument name/code, integration-tested.
- [ ] **[AMENDED-3 — SHOULD-FIX 6, new; AMENDED-4 — SHOULD-FIX 4]** `pnpm db:check`/RLS tests confirm
      `certificate_file_id` and `evidence_file_id` are composite FKs to `files(tenant_id, id)`, not plain FKs to
      `files(id)`, **and that both use `ON DELETE RESTRICT`** — an integration test attempting to purge/delete a
      file still linked from a calibration event or training record fails/is skipped, rather than silently
      orphaning the referencing row.
- [ ] **[AMENDED-3 — SHOULD-FIX 8, new]** A simulated mid-batch failure in `POST /v1/training/records` (e.g. a
      constraint violation on one `memberId` row) rolls back the entire batch — no partial set of rows is ever
      visible to a subsequent read, integration-tested.
- [ ] **[AMENDED-3 — SHOULD-FIX 9, new; AMENDED-4 — SHOULD-FIX 7, API/web split corrected]**
      `GET /v1/training/summary`'s `coverage` field is `null` (typed `number | null`, never the literal string
      `"—"` at the API), and the **web** KPI tile renders `"—"` for that null value, when the tenant (or the
      caller's plant-scoped view) has zero mandatory, non-archived competencies — never `0%`/`100%`/an error —
      browser/integration-verified at both layers.
- [ ] **[AMENDED-4 — SHOULD-FIX 8, new]** `PUT /v1/competencies/order` accepts an **ordered array of ids**
      (`{ ids: string[] }`, position = new `seq`); a body with a repeated id, a missing id, or an extra id (versus
      the current non-archived set) returns `409`, integration-tested for each case. A stale `lockVersion` on
      **archive/unarchive** returns `409`; reorder has no `lockVersion` field and relies solely on its own
      id-set-match check (verified by a concurrent-reorder test that races two clients, one with a stale copy of
      the catalog). `POST /v1/competencies` returns `409` (not `422`) on a `code` clash against a non-archived
      competency, integration-tested alongside the existing un-archive `409` case.
- [ ] Placeholder ledger entries `"planned:calibration"`/`"planned:training"` removed; both removed from
      `PLANNED_MODULES`.
- [ ] Auditor's, **[AMENDED — B9]** inspector's, and viewer's web nav include `calibration`/`training`;
      browser-verified for all three roles.
- [ ] Full gate green: `pnpm typecheck && pnpm lint`, `pnpm test`, `pnpm test:rls`, `pnpm db:check`.
- [ ] Demo login re-seeded and proven 201 after the suite run (rule 12).
- [ ] `PROGRESS.md` updated (Current status + Decisions log: the mandatory-gap cell rule, the training-history-
      table deviation from P17's draft, the plant/area FK design, the LMS-panel exclusion, the corrected
      overdue-banner copy, the `CAL-YYYY-NNNN` code format, the deferred MSA `instrument_id` follow-up,
      **[AMENDED — new]** the `make_interval` generated-column fix, the `fail`-never-advances-due-date rule,
      the cycle-tied notification dedupe design, the `certificate_file_id`/`evidence_file_id` Files-linking
      correction, the `archived_at` competency-archival pattern and new T5 story, and the migration
      renumbering `0067`-`0071`, **[AMENDED-3, new]** the exact "newest event" tie-break rule, the three-way
      calibration-event audit split, the dropped `training_batch_id` mechanism and its replacement flow, the
      `entity_kind`/`deleted_at` file-link double-check, and the composite-FK correction on
      `certificate_file_id`/`evidence_file_id`, **[AMENDED-4, new]** the training-history read routes and their
      `training:manage`-vs-`training:view` visibility rule, the corrected smallest-threshold-crossed approach-side
      algorithm, the single per-route owner-exception table, the `ON DELETE RESTRICT` file-FK rule, and the
      reorder route's ordered-id-array body shape) and `progress_mobile.md` gets an explicit "Sprint 05 — mobile
      unaffected" line (per Sprint 02/03/04's own DoD lesson, not silently skipped).

## 9. Out-of-scope confirmation

No scope beyond P16/P17 + FEATURES §12/§223/§224 + `qms-modules.jsx`'s `CalibrationManagement`/
`TrainingMatrix` components is introduced, with two named, reasoned exceptions this sprint does **not** build
(§3.1 items 5/10/11, §7 Q-C1/Q-T1): the cross-module Inspections/NCR enforcement the jsx's copy implies, and
the LMS vendor panel. `CustomerComplaints`/`ECNWorkbench` (the other two components in the same `qms-modules.
jsx` file) are Sprint 06's scope and are not touched here. No change to Sprints 01-04's own modules beyond the
standing, named cross-cutting config edits (nav/rbac/placeholder-ledger) every sprint in this programme makes.

---

**PO use-case sign-off: PENDING — Ceremony 4 SEND BACK AGAIN (Round 4) amendment issued. Round 4's own
architecture-review pass confirmed all three of Round 3's blocking defects are genuinely fixed, then found one
new blocking gap (no read route for a member's own training history, closed by T1 AC9) plus nine should-fix
items, all resolved in place in this pass (§0/Round 4). Awaiting the planner's re-confirmation, the UI Lead
Designer's audit (Gate 1 — Round 4 adds no new boards; Board 9's admin surface and the failed-calibration banner
state, both from Round 2, remain the only new boards), and the user's explicit approval of the corrected §3
(now including the training-history routes/visibility rule, the corrected approach-side threshold algorithm,
and the single per-route owner-exception table) before any build work starts.**

Every use case (happy/error/empty/permission/offline/cross-tenant/plant-scope) across C1-C6, T1-T5, and X1 now
maps to a story with testable acceptance criteria and an explicit Web/Mobile/Shared split; the dead-end audit
(§6) accounts for every control the jsx introduces plus every new control Round 2's amendment added (T5's
archive/reorder, C2's certificate-attach route, the three new notification click-throughs) and Round 4's own
newly-closed member-drawer/recordId-deep-link gap (BLOCKING A), with the one honestly excluded panel (Q-T1, LMS
vendors) named rather than faked, and two previously-undetected gaps closed by Round 2 — the calibration KPI's
un-backed "N led to NCR" number (C3, unchanged from the original draft) and Board 9's delete/reorder controls
(T5, B8) — rather than leaving them promised-but-unbuilt. Round 3 closed a same-day audit/tie-break hole in C2's
write logic (BLOCKING 1), replaced an unbuildable file-linking mechanism with one that actually works and closed
a real capability-check bypass in both modules' Files-linking (BLOCKING 2), and closed a genuine rule-3 audit gap
for `fail` calibration events and certificate re-attachment (BLOCKING 3), plus ten smaller corrections. **Round 4
adds no new stories, boards, or scope beyond one new pair of read routes on the already-approved training-history
table (T1 AC9)** — it closes the training-history read gap (BLOCKING A), corrects the approach-side threshold
algorithm to actually match its own cited precedent (BLOCKING B), collapses four inconsistent statements of the
owner-sees-own-instrument exception into one unambiguous per-route table (BLOCKING C), fixes a backwards DoD
bypass-test description that named the security hole itself as the happy path (BLOCKING D), and closes nine
smaller, all now-testable gaps (parent-audit timing and its own DoD test, newest-event parent locking and a
corrected tie-break test methodology, the inline-certificate presign sequencing and its named code touch point,
an explicit file-FK delete rule, an optional precedent note, a threshold return-type/`-0` correction, an
API/web split for the Coverage KPI's empty case, three T5 reorder edge cases, and a wording correction from
"immediately" to "on the next daily sweep"). Five new open questions remain logged from Round 2, not silently
dropped (Q-T4, Q-C3, plus the three already-named Q-C1/Q-C2/Q-T1/Q-T2/Q-T3 from the original draft), and two
pre-existing, unrelated Known issues are named rather than compounded silently (the file-download hole, and
`document-expiry.ts`'s `Date`-based signature). This file itself introduces no product code and spawns no other
agent, per this
ceremony's instructions — the next steps are the planner's re-review of this Round 4 amendment, the
`ui-lead-designer` audit, and the user's §3 approval.
