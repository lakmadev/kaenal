# SPRINT-06 — Customer Complaints + Engineering Change Notices (ECN)

Author: Product Owner. Date: 2026-09-30. Part of the multi-sprint programme in `ROADMAP.md` (Wave 6 of 13).
Governing rules: CLAUDE.md rules 0, 1-8, 9, 10, 11 and `SCRUM.md`. Design fidelity is a completion gate.
Builds on Sprints 01-05 (shell, audits, graph+predictive, risk+MSA, calibration+training) — all merged, not
touched here except the small, named, additive cross-cutting config edits every sprint in this programme makes
(ROADMAP §8 rule 2).

**This sprint carries an APPROVAL GATE (ROADMAP §0 Q2).** Both modules' backends are `PROPOSED` (P18, P19)
with no `02-DATABASE`/`03-API` spec beyond the phase docs' own sketches, and both phase docs name their own
open sign-off questions. This sprint file's §3 is the backend design the user must approve before any code is
written. **NO BUILD MAY START until the user has explicitly approved §3** — complaint schema + SLA design +
convert-to-NCR/8D/CAPA mechanism; ECN schema + the canonical stage/approval machine (which corrects two real
inconsistencies found between the jsx's own `ECNList` and `ECNKanban` mocks, detailed in §3.2); and the
document auto-revision mechanism. This mirrors exactly how Sprints 03/04/05 gated their own §3/§3B before
those sprints' builds started. **§0 records a Ceremony 4 SEND BACK on the version the user had already
approved — several of §0's fixes change what §3 says, so the corrected §3 needs a fresh, explicit
re-approval before build starts (see §0's own DELTAS block for exactly which parts).**

---

## 0. Amendment (Ceremony 4 SEND BACK response, 2026-09-30)

The `planner` agent reviewed this sprint file at Ceremony 4 (architecture review, before any code exists yet)
and returned **SEND BACK** on eight blocking gaps (B1-B8) plus nine should-fix items (S1-S9). This section
resolves every one, verified against the actual codebase this session (not taken on the reviewer's word — every
file:line citation below was re-read before its fix was written in), mirroring Sprint 05's own multi-round
amendment discipline. §2 (stories/AC), §3 (backend design), §4 (backend-needs table), §6 (dead-end audit) and
§7 (open questions) are updated in place to carry these fixes; this table is the scannable index of what changed
and why.

### Blocking (all resolved)

| # | Defect (verified) | Fix |
|---|---|---|
| B1 | The approve/reject route (old E4 AC2) only accepted the 4 gated stages and required `:stage == ecns.stage` — nothing could drive `draft→feasibility`, `implementation→closed`, or `draft→rejected`. X1 AC7 also self-contradicted: "notifies approvers at creation for feasibility" vs. `stage` defaulting to `draft` at creation (E1 AC1) | Added `POST /v1/ecns/:id/submit` (`draft→feasibility`, `ecn:manage`, audited `status_changed`) and `POST /v1/ecns/:id/close` (`implementation→closed`, `ecn:manage`, audited `status_changed`). Added `POST /v1/ecns/:id/withdraw` (`draft→rejected`, `ecn:manage`, audited `status_changed`) — named "withdraw," not "reject," because no `ecn_approvals` row exists for `draft` (E4 AC1 pre-creates only the 4 gated rows) so there is no four-eyes decision to make; withdrawing your own draft is an author action, not an approval. Kanban drag action named for every column (E2, revised). Approvers are now notified when `submit` actually lands the ECN on `feasibility` (X1 AC7, contradiction closed) — never at creation |
| B2 | `PATCH /v1/ecns/:id` could change `owner` at any stage (old E1 AC3), so a creator could reassign ownership then approve their own ECN. `documentMachine`'s own `forbidsSelfApproval` (`packages/core/src/state-machines/document.ts:44-54`, read in full) only guards `to === "approved"` — it does **not** block self-*rejection* — so "mirrors documentMachine exactly" was an inaccurate claim for a stronger rule | `owner` frozen the instant `stage` leaves `draft` — `PATCH` 422s on an `owner` change once `stage !== 'draft'` (E1 AC3, revised). Four-eyes made **explicitly stricter than documents, stated as such, not claimed as an exact mirror**: an approve/reject/submit/close/withdraw actor must be `≠ ecns.owner` **and** `≠ ecns.created_by` (both checked; `created_by` is one of the "standard audit columns" every table already carries, confirmed `packages/db/migrations/0001_core.sql:33-34`) — for **both** decisions, approve and reject, unlike `documentMachine`'s narrower approve-only guard (E4 AC2, revised) |
| B3 | Read `documents.service.ts`'s `newVersion` (`apps/api/src/documents/documents.service.ts:358-409`, confirmed in full): (a) line 402 sets `file_id = body.fileId ?? null` — the old E5 spec passed `fileId: null`, which detaches the document's live file; (b) line 399 sets `owner_id = actorId` unconditionally — the approver would silently become owner of every revised document; (c) `newVersion` throws `INVALID_TRANSITION` (not-approved, line 371), `CONFLICT` (version exists, line 376), or a 409 stale-write (line 405) — none of these can be allowed to abort the whole ECN transition; (d) the skip list was only ever returned in the HTTP response, never persisted | (a) Auto-revise now passes `fileId: row.file_id` (the document's **current** file, read before the call), never `null`. (b) `DocumentsService.newVersion` gains one **small, additive, optional** parameter — `ownerId?: string` on `NewDocumentVersionBody` — documented as a signature change, not silently "no signature change": when omitted (every existing caller, `documents.controller.ts`'s own route), behaviour is unchanged (`owner_id = actorId`, exactly as today); ECN's auto-revise always passes it explicitly as the document's own **current** `owner_id` (read before the call), so a document's owner never changes as a side effect of an ECN reaching `implementation` — decided explicitly, not left ambiguous. (c) Each document's revision attempt runs inside its own `SAVEPOINT` (precedent: `apps/api/src/jobs/processors/purge-soft-deleted.ts`'s `purgeRow`, lines 152-190, confirmed real — `SAVEPOINT`, attempt, `RELEASE` on success / `ROLLBACK TO SAVEPOINT` + `RELEASE` on failure); "not currently approved" and "version already exists" are pre-checked by reading the document row before calling `newVersion` (named skip reasons `not_approved`/`version_exists`, never relying on catching those two specific errors), while the stale-write 409 (a genuine race — the row changed between the pre-check read and the call) is still caught inside the `SAVEPOINT` as a third skip reason (`concurrent_modification`) since it cannot be pre-checked away. The ECN's own `implementation` transition commits regardless of any document's outcome. (e) The skip/revise list is now **persisted**, not just returned once: a new `ecns.auto_revise_result jsonb NULL` column (migration `0072`) is set in the same transaction and also written into the `status_changed` audit event's `after` payload; `GET /v1/ecns/:id` (`EcnDto`) exposes it as `autoRevise: { revised: string[]; skipped: { documentId: string; reason: "not_approved" \| "version_exists" \| "concurrent_modification" }[] } \| null` so the detail view can show it after the fact, not only in the one-time approval response (E5, revised). Exact `entity_links` scope stated: `WHERE from_kind = 'ecn' AND to_kind = 'document' AND from_id = :ecnId` |
| B4 | Read `entity-links.service.ts`'s `assertEntityVisible`/`LABEL_CONFIG` (`apps/api/src/collab/entity-links.service.ts:28-47`) and `entity-ref.ts`'s `assertEntityVisible` (`apps/api/src/collab/entity-ref.ts:88-97`, confirmed in full): it checks only tenant/plant scope, never a capability. `entity-links.controller.ts`/`comments.controller.ts` (both read in full) carry **no** `@RequireCapability` at all — safe only because, today, every internal role already holds every one of the 11 existing `EntityKind`s' own `:view` capability (confirmed against `packages/core/src/rbac.ts`'s full grant lists) and `partner` is excluded entirely by `@Internal()`. `comments.service.ts` (`apps/api/src/collab/comments.service.ts:104,135`, confirmed) calls `assertEntityVisible` **without even a `membership` argument** — no plant-scope check at all today. `EntityKind` gaining `complaint`/`ecn` is the **first** case where a real internal role (`inspector`, by this sprint's own §1 decision) lacks a kind's `:view` — so the historical "safe by coincidence" argument stops holding the moment this sprint ships. No ECN-specific unlink route existed, so anyone with the generic `entity-links` delete could strip an ECN→document link after `implementation`, bypassing E5's stage-freeze | `assertEntityVisible` (`entity-ref.ts`) now also requires the caller's capability: `ENTITY_TABLES` becomes a table of `{ table, capability }` (reusing the exact capability strings `LABEL_CONFIG` already carries per kind, so no new capability is invented), and `assertEntityVisible` 404s (never 403, rule 8) when the caller lacks it. This is a **zero-behaviour-change** fix for the 11 existing kinds (every internal role already holds their `:view`, confirmed above) and is what actually closes the new inspector-facing gap for `complaint`/`ecn`. `comments.controller.ts` now passes `membershipOf()` through to `comments.service.ts`'s `list`/`create` (mirroring `entity-links.service.ts`'s existing pattern), so comments get both the capability check and the plant-scope check comments never had. **New:** `POST /v1/ecns/:id/links/:linkId/delete` (`ecn:manage` **and** `stage` strictly before `implementation`, else 422), audited `unlinked` (existing action enum value, `packages/types/src/enums.ts:422`, confirmed — no new enum needed) — the real ECN-specific guard the generic route can't provide (E5, revised) |
| B5 | Read `search.service.ts`'s `KINDS`/`queryKind` (`apps/api/src/search/search.service.ts:19-24,85`, confirmed in full): `search()` has no per-kind capability check (only the special-cased `AUDIT_HIDDEN_ROLES` nav-hiding rule), and `queryKind`'s SQL hard-codes `SELECT id, code, title, ...` — a literal `title` column. Complaints' real title-bearing column is `subject` (C1 AC1), which would error at runtime | `KindConfig` gains two fields: `capability: Capability` (checked in `search()` before a kind is queried at all — skips kinds the caller can't view, closing the same class of gap as B4) and `titleColumn: string` (defaults to `"title"` for every existing kind, unchanged; `complaint: { table: "complaints", plantScoped: false, capability: "complaint:view", titleColumn: "subject" }`, `ecn: { table: "ecns", plantScoped: false, capability: "ecn:view", titleColumn: "title" }`); `queryKind`'s SQL interpolates `titleColumn` (still safe — the map is hard-coded, never user input, same security note as today) and aliases it back to `title` in the result so `SearchResultDto`'s shape is unchanged (X1 AC5, revised) |
| B6 | Read `audits.service.ts`'s `raiseNcr`/`raiseCapa` (`apps/api/src/audits/audits.service.ts:655-706,708-740`, confirmed in full) and `packages/core/src/rbac.ts`'s `auditor`/`CreateNcrBody`/`CreateCapaBody`/`CreateEightDBody`/`NcrPriority`/`CapaType`/`WizardPriority` (`packages/types/src/dto.ts:315-338,435-449,822-840`, `packages/types/src/enums.ts:121-122,218-219,499-500`, all confirmed): (a) two concurrent converts race on an `IS NULL` guard read at different times; (b) converting an already-closed complaint was unspecified; (c) UC prose said converting a `capa`-status complaint to NCR "is rejected" while AC2 said it's created and linked — self-contradicting — plus a stray "the **ECN's** existing progress" typo at line 274 (this section is about complaints, not ECN); (d) AC2 only audited the complaint when `status` changed, so a second convert to a different target (status unchanged) wrote **no** audit event on the complaint — the exact Sprint-05 bug class (bare mutation escaping `withAudit`); (e) `raiseCapa`'s own link-back (`audits.service.ts:734-738`) is a **bare `tx.query` UPDATE outside `withAudit`** — confirmed, a real pre-existing unaudited mutation, NOT fixed when `raiseNcr` was fixed in Sprint 05; (f) auditor holds `ncr:create` (not `ncr:manage`) and `capa:view` (not `capa:manage`) — confirmed against the full `auditor` grant list — while 8D creation requires `ncr:manage` (`eight-d.controller.ts:53`) and CAPA creation requires `capa:manage` (`capa.controller.ts:56`), so an auditor genuinely **cannot** convert to 8D or CAPA, contradicting the old "redundant-but-harmless" framing; (g) `NcrPriority` has 3 values (`minor\|major\|critical`), complaint `severity` has 4 (`critical\|high\|medium\|low`), `CapaType` (`corrective\|preventive`) has no complaint analog at all, and `CreateEightDBody`'s `priority` field is typed `WizardPriority` (4 values, matching severity 1:1) — three different shapes, not one; (h) `eight_ds.source`/`source_id` client-settability was unstated | (a) `POST /v1/complaints/:id/convert` now requires `lockVersion` in the body; the service `SELECT ... FOR UPDATE`s the complaint row first, computes the new status from the **locked** row (never the pre-lock read), and the `UPDATE` statement carries `WHERE lock_version = $lockVersion` (409 on mismatch) **and** an explicit `status <> 'closed'` guard (422, not silently reopening a close that landed first — locking alone makes the race impossible, and the explicit guard makes the "already closed" case a named, tested outcome rather than an implicit one). (b) Converting an already-`closed` complaint → 422 (`COMPLAINT_CLOSED`), stated explicitly. (c) UC prose corrected to match AC2's real, kept behaviour: converting to a chronologically-earlier target is **allowed** — it creates and links the target record without moving `status` backward (a complaint can carry multiple linked records) — and the "ECN's" typo is fixed to "the complaint's." (d) The complaint now gets an audit event on **every** successful convert: `updated` when `status` doesn't change, `status_changed` when it does — no more silent, unaudited link-only writes. (e) `audits.service.ts`'s `raiseCapa` link-back is fixed in this sprint (small, named, adjacent fix, same file/class of bug as the already-fixed `raiseNcr`) to use `withAudit` exactly like `raiseNcr` already does — the convert route's own complaint-audit logic is specified to follow `raiseNcr`'s (the fixed one's) pattern, never `raiseCapa`'s old one. (f) The convert route now performs a **real, enforced** per-target capability check — `ncr:create` for NCR, `ncr:manage` for 8D, `capa:manage` for CAPA — a caller lacking the target's capability gets a real 403 (no bypass, no silent escalation), and §5's convert-target picker is filtered client-side to only the targets the caller actually holds. (g) The convert body is now a **discriminated union keyed on `target`**: `{ target: "ncr"; title?: string }` (priority derived, not accepted from the client — see mapping below), `{ target: "eight_d"; title?: string }`, `{ target: "capa"; title?: string; type: CapaType }` (CAPA's `type` has no complaint analog, so the caller must supply it — the one field this sprint's discriminated union requires beyond what severity can derive). An explicit severity→priority mapping table is defined (below) rather than left to be invented at build time. Also decided: if a complaint already has `ncr_id` set and 8D/CAPA is requested next, the new 8D/CAPA links to the **existing** NCR (`ncrId` passed through to `EightDService.create`/`CapasService.create`'s own `ncrId`/`sourceId`), not a fresh one — if that NCR already has its own 8D, a second 8D request 409s (`CONFLICT`, mirrors `raiseNcr`'s "already has an NCR" precedent) rather than silently reusing or duplicating. (h) Stated plainly: `eight_ds.source`/`source_id` (and NCR's `source`/`sourceId`, CAPA's `sourceKind`/`sourceId`) are **always set internally by `ComplaintsService.convert`**, never accepted as convert-body fields from the client — consistent with how `raiseNcr`/`raiseCapa` already set them today (§2 C4, revised) |
| B7 | Read `job-types.ts` (`apps/api/src/jobs/job-types.ts:140`, confirmed: `SLA_SWEEP_CRON = "*/5 * * * *"`, every 5 minutes) and `packages/core/src/sla.ts` (confirmed in full, 217 lines): (a) a once-daily job cannot serve a 1h/4h ack target; (b) closing a complaint before it's ever acknowledged would leave `complaintSlaState` computing forever against a moving `now`; (c) changing `severity` via `PATCH` wasn't stated to re-derive SLA targets; (d) `AT_RISK_THRESHOLD = 0.8` (confirmed at `sla.ts:163`, not 75%), and §1a claimed "reuses the business-hours machinery" while §3.1 said the ack-clock is "a plain elapsed-hours comparison, not routed through `computeDueAt`" — both true of different pieces, stated as if contradictory | (a) The complaint SLA check rides the **existing** 5-minute `sla.sweep` cadence (`SLA_SWEEP_CRON`) — no new daily job. (b) `complaintSlaState` freezes its computation at `closedAt` when set (a closed complaint's SLA state is fixed at closing time, never recomputed against a later `now`) — stated as an explicit input/rule, not left implicit. (c) `PATCH /v1/complaints/:id` changing `severity` re-derives and overwrites `sla_target_hours`/`sla_close_target_days` from the SLA matrix in the same transaction, audited as part of the existing `updated` event (C1 AC2, revised) — stated as required behaviour, not assumed. (d) `complaintSlaState`'s at-risk threshold is corrected to use the **existing** `AT_RISK_THRESHOLD` (0.8) imported from `packages/core/src/sla.ts`, not a second, inconsistent 75% constant. §1a's own text is corrected to stop claiming the business-hours *machinery* (`computeDueAt`/`addBusinessHours`) is reused — only the `SlaState` **type** and the general on_track/at_risk/breached philosophy are reused; `computeDueAt` is confirmed (by reading it) to be inherently business-hours-aware with no plain-elapsed-hours mode, so the complaint ack-clock correctly does **not** call it at all, exactly as §3.1 already said — §1a is restated to agree, not contradict |
| B8 | Re-read `qms-modules.jsx`'s `ECNList` (lines 549-591) and `CustomerComplaints` (lines 332-475) in full again: (a) `ECNList` has a real "Affected" column (`{e.eff} docs`, line 576 — e.g. "18 docs") never captured by the old `EcnDto`/E1 AC; (b) row `ECN-2026-0180` (line 562) is shown at `s: 'ppap', stl: 'PPAP', step: 4, of: 6` — a stage name that appears **nowhere** in the canonical machine — and the list's own row order places `ECN-2026-0182` ("Doc revision," step 5, line 560) **before** `ECN-2026-0181` ("Pilot run," step 6, line 561), i.e. documents-before-pilot, while the approved §3.2 fires auto-revise **after** pilot (`pilot→implementation`); (c) the complaint row's button reads exactly **"Link / Create NCR"** (`qms-modules.jsx:413`, confirmed verbatim) — implying link-to-existing as a real second capability, which the old C4 built as "create new and link" only, with the existing-NCR half silently dropped; (d) every `COMPLAINTS` fixture row (lines 325-329) carries at most **one** `linked` value — the jsx never shows what a multi-linked row would display | (a) `EcnDto`/`GET /v1/ecns` gain a computed `linkedDocumentCount: number` field (`count(*)` over `entity_links WHERE from_kind='ecn' AND to_kind='document' AND from_id=:id`), rendered as the list's "Affected" column (E1 AC1/AC3, revised). (b) **Not resolved here** — written up as new §3.2a, explicit deltas for the user, per the review's own instruction not to silently resolve jsx questions a second time. (c) "Link to an existing NCR" is added back as a real, explicit story addition: `POST /v1/complaints/:id/convert` gains a fourth discriminated-union variant, `{ target: "ncr"; existingNcrId: string }` (`ncr:view`-visible via `assertEntityVisible`, tenant-scoped, 404 not 403 on a foreign id) — links the complaint to that NCR (same `WHERE ncr_id IS NULL` guard, same audit rule) without creating a new NCR (C4, revised; §5 UI gains a "link existing" affordance next to "create new" in the convert picker). (d) The "Linked" column's rule is now explicit: since a complaint can accumulate more than one link this sprint (once "link existing" ships), the column shows the **single most-advanced** linked record by `complaintMachine`'s own rank order (`capa` > `eight_d` > `ncr` — the same rank C4 AC2 already defines for status-advance), never "most recent" or a comma-joined list (C1 AC1, revised) |

**Severity → priority mapping (B6g), stated explicitly:**

| Complaint `severity` | → NCR/CAPA `priority` (`NcrPriority`: minor/major/critical) | → 8D `priority` (`WizardPriority`: low/medium/high/critical) |
|---|---|---|
| `critical` | `critical` | `critical` |
| `high` | `major` | `high` |
| `medium` | `minor` | `medium` |
| `low` | `minor` | `low` |

### Should-fix (all resolved)

| # | Item (verified) | Fix |
|---|---|---|
| S1 | `ncrs` already has `UNIQUE (tenant_id, id)` (`ncrs_tenant_id_uq`, added by `packages/db/migrations/0067_composite_fk_prereqs.sql:29-30`, and consumed by a real composite FK at `0068_calibration.sql:158` — both confirmed) — composite-FK-ready, per this codebase's established pattern (Postgres FK checks bypass RLS; a plain FK is only safe when ids are server-generated, never client-supplied). `eight_ds`/`capas` confirmed to have **only** `UNIQUE (tenant_id, code)` (`0001_core.sql:285,371`), no `UNIQUE (tenant_id, id)` yet. B8(c)'s "link to an existing NCR" variant accepts a **client-supplied** `existingNcrId` — a plain FK is no longer safe once RLS can't be trusted to have already scoped that id (the classic composite-FK trigger condition) | The complaint↔NCR/8D/CAPA link columns switch from plain FK to **composite** FK (`(tenant_id, ncr_id) REFERENCES ncrs(tenant_id, id)`, etc. — mirrors `0067`'s pattern exactly), now **required**, not optional, because of B8(c). Migration `0071` additions: `ALTER TABLE eight_ds ADD CONSTRAINT eight_ds_tenant_id_uq UNIQUE (tenant_id, id)` and `ALTER TABLE capas ADD CONSTRAINT capas_tenant_id_uq UNIQUE (tenant_id, id)` (both confirmed missing today) before `complaints.ncr_id`/`eight_d_id`/`capa_id` are declared as composite FKs (C1 AC1, revised) |
| S2 | The approve/reject route's internal statement order wasn't specified precisely; E5's own link route had no concurrency guard against a stage-advance racing a link-add; linking had no stated stage ceiling | E4 AC2 now states the exact order: (1) `UPDATE ecns ... WHERE lock_version=$v AND stage=$s` (optimistic concurrency + stage guard in one statement, 409/422 respectively on no match — the two failure modes are told apart by a follow-up read, mirroring this codebase's existing stale-write-error pattern); (2) update the matching `ecn_approvals` row `WHERE decision='pending'`; (3) run E5's auto-revise only on the specific transition that needs it (`pilot→implementation`). `POST /v1/ecns/:id/link` (E5) now takes `SELECT ... FOR SHARE` on the parent `ecns` row first (prevents a concurrent approve from advancing the stage mid-link); linking is restricted to stages `draft` through `pilot` only (422 once `stage` has reached `implementation`, `closed`, or `rejected` — tightened from "422 once past pilot" to name every terminal/post-pilot stage explicitly) |
| S3 | Read `document-detail.tsx` (confirmed: its own local `ENTITY_ROUTE`/`ENTITY_LABEL`, `Record<EntityKind,...>` maps at lines 53/78) and `capa-detail.tsx` (own local `ENTITY_ROUTE`/`ENTITY_LABEL` at lines 51/69) — both **separate** from `apps/web/src/lib/entity-routes.ts`'s shared helpers, both force-widened by `EntityKind` gaining `complaint`/`ecn`, and both missed by the old X1 AC3 (which only touched the shared `entity-routes.ts`). `chat.ts`'s `ENTITY_SPECS.label` (confirmed, `apps/api/src/ai/chat.ts:25-45`) is literally the DB column name to select | X1 AC3 (revised) now also lists `document-detail.tsx`'s and `capa-detail.tsx`'s own local `ENTITY_ROUTE`/`ENTITY_LABEL` maps as places `complaint: "/complaints?id="` / `ecn: "/ecn?id="` and their display labels must be added. X1 AC4 (revised) states `chat.ts`'s `ENTITY_SPECS` gains `complaint: { table: "complaints", label: "subject", plantScoped: false, view: "complaint:view" }` and `ecn: { table: "ecns", label: "title", plantScoped: false, view: "ecn:view" }` — `label: "subject"`, the real column (matches B5's fix) |
| S4 | ECN's post-`closed`/`rejected` editability, complaint's post-`closed` editability, and `owner` reassignability were all left implicit | Stated explicitly: ECN is **not** editable via `PATCH` once `stage` is `closed` or `rejected` (422, both fields and `owner`) — fully frozen (E1 AC3, revised). A `closed` complaint remains editable only via `PATCH`'s existing field set (`customer`/`contact`/`channel`/`severity`/`subject`/`description`/`batchRef`/`cost`) — closing a complaint does not freeze it the way ECN's terminal stages do, since P18 names no such freeze and a closed complaint's cost is often only known after closing (C1 AC1's own `cost_usd` rationale); `status`/`ncr_id`/`eight_d_id`/`capa_id`/timestamps stay non-`PATCH`able regardless, as already stated. Complaint `owner`: **not** reassignable this sprint (no route exists to change it after creation) — stated as a deliberate decision, not an oversight; a future sprint can add reassignment if a real use case names one (§7) |
| S5 | No uniqueness constraint on `complaint_attachments`, no named audit event for adding one, and "attachments after intake" was unstated | `UNIQUE (tenant_id, complaint_id, file_id)` added to `complaint_attachments` (migration `0071`, C1 AC1, revised) — prevents a duplicate attachment row. Attachments can be added **only at creation** this sprint (via `attachmentFileIds` in `POST /v1/complaints`, C2 AC1) — no separate "add attachment later" route is built (P18/the jsx name no such control); each insertion is covered by the complaint's own `created` audit event (no separate per-attachment event needed, since attachments are created in the same transaction as the complaint, not as an independent later mutation) — stated explicitly, not left to be assumed either way |
| S6 | `customer_color` was specified as a **stored** column — a derived, display-only value, which this codebase's own established norm (`packages/core/src/rbac.ts`'s carried-over Sprint 05 C1a comment: "pure, unit-tested derivation functions..., never a stored 'status' column computed against `now()`," and more directly, the same "computed on read" norm applies to any cheap display derivation) says should be computed, not persisted | `complaints.customer_color` **column removed** from migration `0071` (C1 AC1, revised). `customerColor(name: string): string` (`packages/core/customer-color.ts`, unchanged, still pure/unit-tested) is now called **on read**, in `toComplaintDto`, never stored — `ComplaintDto.customerColor` is a computed response field, not a persisted one |
| S7 | The ECN approval-pending broadcast (old X1 AC7) notified "everyone with `ecn:approve`," which would include the ECN's own `owner`/`created_by` if either happened to hold that capability | X1 AC7 (revised) excludes the ECN's own `owner` and `created_by` from the approval-pending notification broadcast — they should not be told their own ECN needs someone else's sign-off |
| S8 | `ecn_approvals.role_required` (old E4 AC1) is stored as the literal constant `"admin_or_manager"` for every row, but the actual gate (old E4 AC2 step (c)) hard-codes the admin/manager check in code — no service method reads the column's value at all; confirmed no other table anywhere in this codebase has a `role_required` column to mirror | `role_required` **removed** from `ecn_approvals` (migration `0072`, E4 AC1, revised) — a dead field this sprint has no use for; the fixed, uniform admin/manager-only rule (Q30, unchanged) is enforced entirely in `ecnMachine`'s guard, with nothing left to configure that a stored-but-unread column would imply |
| S9 | `documentMachine` allows `rejected → draft` (resubmission); the ECN machine treats `rejected` as fully terminal with no resubmission path — an asymmetry the old spec picked an answer to silently | **Not resolved here** — logged as new open question **Q33** in §7, explicitly for the user/PO to decide, not silently answered either way |

### DELTAS TO THE ALREADY-APPROVED §3 — need the user's re-approval

*(The rest of this amendment — B4-B6's RBAC/search/audit corrections, B7's SLA cadence/threshold fixes, S1-S8 — are corrections and clarifications within the spirit of what §3 already said, not new decisions. These four are different: they change a schema, a workflow rule, or a mechanism's signature that the user already signed off on 2026-09-30, or put a genuinely new decision in front of the user for the first time. Relay exactly these to the user.)*

1. **New ECN routes (B1):** `submit` (draft→feasibility), `close` (implementation→closed), `withdraw` (draft→rejected) — three routes that don't exist in the approved §3 at all, changing the ECN lifecycle from "4 gated transitions only" to "4 gated + 3 author-driven."
2. **ECN `owner` frozen after `draft`, and four-eyes widened to `owner` OR `created_by`, for both approve and reject (B2):** the approved §3 let `owner` be edited at any time and only blocked self-*approval* (mirroring documents); this is now a stricter, ECN-specific rule.
3. **`DocumentsService.newVersion` gains an optional `ownerId` parameter (B3b):** a real signature change to existing, shipped code outside this sprint's new modules, even though it's additive and behaviour-preserving for every existing caller.
4. **Complaint SLA sweep rides the existing 5-minute job, not a new daily one; `AT_RISK_THRESHOLD` is 0.8, reusing the existing constant, not a new 75% one (B7):** both numbers/mechanisms differ from what §3.1 originally said the user approved.
5. **jsx-fidelity questions, genuinely new, not silently resolved (B8b) — see §3.2a below:** is "PPAP" a real distinct stage the canonical machine should add, or is it `ECNList`'s own mock error (like "Doc revision" already was)? Does the jsx's documents-before-pilot row ordering mean auto-revise should fire earlier in the pipeline (e.g., on `cab_approval→pilot`) rather than on `pilot→implementation` as approved?
6. **"Link to an existing NCR" added back as a real capability (B8c):** the jsx's button always said "Link / **Create** NCR" (both verbs); the approved §3 only built "create new," silently dropping half of what the button promises — now added back, which is new schema (composite FK, S1) and a new discriminated-union body shape.
7. **`Q33` (S9):** should ECN allow `rejected → draft` resubmission the way documents do? Left open, not decided by this amendment.

---

## 0b. Amendment 2 — the three remaining open deltas, now decided by the user (2026-09-30)

The user has explicitly decided the three items §0 (and §3.2a/§7) left open for them: §3.2a's "PPAP" question,
§3.2a's auto-revise-timing question, and Q33 (ECN resubmission). Each decision is cascaded through every
downstream section it touches below (schema, machine, routes, RBAC, design needs, dead-end audit, DoD) — this
table is the scannable index; §2/§3/§4/§5/§6/§7/§8 are edited in place to carry these through, exactly as §0
did for the first amendment round.

| # | Decision | What it changes |
|---|---|---|
| D1 | **PPAP is a real 7th pipeline stage, not a mock error.** Placed `risk_review → ppap → cab_approval` (the smallest-reasonable slot: PPAP — Production Part Approval Process, a real IATF 16949 production-readiness confirmation — logically precedes the Change Approval Board's own sign-off, and this is specifically the row for the Material/supplier-change ECN that already justified adding `material` to `change_type`, §3.2, so a PPAP checkpoint on exactly that class of change is coherent, not arbitrary). Verified this does not contradict P19 (P19 names no fixed stage count, only asks "fixed vs configurable," §3.2) or the rest of the jsx (`ECNKanban`'s 7 columns already omitted "Doc revision" — a mock gap the same file already got wrong once — so a missing "PPAP" column there is no stronger evidence against PPAP being real than that omission is against auto-revise itself). `ppap` is a 5th human-approval gate — its own `ecn_approvals` row, `admin`/`manager`, four-eyes — treated exactly like the other 4, not a special case. | `ECN_STAGE_ORDER` (7 entries, not 6); `ecns.stage` enum (+`ppap`); `ecn_approvals.stage` enum (+`ppap`, 5 gated values); the approve/reject route's accepted-stage list (5, not 4); the Kanban's column list (9 total, not 8); the approval tracker's row count (5, not 4); §5 design follow-up (Kanban + tracker board need one more column/row); RBAC unchanged (`ecn:approve`, admin/manager, same as every other gate) |
| D2 | **Auto-revise timing stays exactly as originally approved — fires on `pilot→implementation`, never earlier.** The jsx's documents-before-pilot row ordering (`ECNList`'s "Doc revision" row sorted before its "Pilot run" row) is confirmed to be another instance of the same mock inaccuracy already found and corrected once in this sprint (the "Doc revision" label itself, and now this row-ordering artifact) — not a real sequencing signal. §3.2a's second question is now **resolved, not open**. | No mechanism change (§3.2's `pilot→implementation` trigger is unchanged); §3.2a and §7 Q34 updated from "open" to "resolved, decided (a)" |
| D3 | **ECN allows `rejected → draft` resubmission**, modelled on `documentMachine`'s own real `rejected → draft` transition (`packages/core/src/state-machines/document.ts:17`, read in full this session — a plain, unguarded transition in the map; `documents.service.ts`'s `transition` method, `document:manage`-gated, carries no owner restriction and no four-eyes guard for this specific `to`, since `requiresApproverRole`/`forbidsSelfApproval` only fire when `to === "approved"` or `"rejected"`, confirmed by reading `document.ts:32-54`). ECN mirrors this shape, not a new one: (a) **who can trigger** — any `ecn:manage` holder (same as create/edit), not owner-restricted — matches documents' own precedent exactly, which is *not* further restricted either. (b) **What resets** — every `ecn_approvals` row for that ECN reverts to `decision='pending'`/`approver=NULL`/`decided_at=NULL`/`comment=NULL` in the same transaction (a resubmitted ECN needs fresh sign-off at every gate; it never keeps a stale approval from before the rejection), audited as the resubmission's own `status_changed` event (the reset is recorded in that event's `after` payload, mirroring E5's established precedent of folding a fan-out side effect into the triggering event's own payload rather than one row-level event per approval row). (c) **`owner` unfreezes on resubmission** — yes: the existing `PATCH` rule ("`owner` PATCHable only while `stage = 'draft'`") is stage-based, not a one-way ratchet, so the moment resubmission returns `stage` to `draft`, `owner` is genuinely editable again, for the same reason it was editable the first time the ECN was in `draft` — stated explicitly here, not left to be inferred from the pre-existing rule's wording. | New `packages/core/src/state-machines/ecn.ts` transition `rejected: ["draft"]` (no additional guard, matching documents' own unguarded precedent); new `POST /v1/ecns/:id/resubmit` route (§2 E4 AC6, §4 E4 row); Q33 closed, decided, in §7 |

---

## 1. Goal and roles served

Replace the `/complaints` and `/ecn` `ModulePlaceholder`s (served today via `PLANNED_MODULES["complaints"]`/
`PLANNED_MODULES["ecn"]`, ledger entries `planned:complaints`/`planned:ecn`) with two real, backend-complete
quality-system modules:

- **Customer complaints** (IATF 16949 §9.1.2/§10.2.1, customer satisfaction & feedback): an OEM-facing
  intake record with severity/SLA tracking, and a real conversion path into NCR/8D/CAPA — everything
  `CustomerComplaints`/`IntakeForm` in `qms-modules.jsx` (lines 322-523, read in full) and FEATURES §12/P18
  specify.
- **Engineering Change Notices (ECN)** (IATF 16949 §8.5.6, change control): a design/process/tooling/material
  change record with a real multi-stage approval workflow (four-eyes, forward-only through its 7 ordered stages
  including a real PPAP gate, with one explicit, named backward path — `rejected → draft` resubmission, §0b D3
  — audited) and a genuine "auto-revises affected documents" mechanism on implementation — everything
  `ECNWorkbench`/`ECNList`/`ECNKanban` in `qms-modules.jsx` (lines 526-635, read in full) and FEATURES §12/P19
  specify.

Roles served: **admin, manager, auditor** (module administration: log/triage/convert complaints, author and
manage ECNs); **admin, manager only** additionally hold **ECN approval authority** (`ecn:approve` — mirrors
`document:approve`, which is also admin/manager-only, not auditor, confirmed by reading `packages/core/src/
rbac.ts` in full this session); **viewer** gets read-only visibility of both (broad-oversight precedent,
matches viewer's existing grant for every other module); **inspector does NOT get either module this sprint**
— unlike calibration/training (Sprint 05 B9), no jsx or phase doc makes an inspector an owner, approver, or
subject of a complaint or ECN, so the "a notification about you must not 404 for you" forcing function that
justified inspector's calibration/training access does not apply here; this is a deliberate, reasoned
decision, not an oversight (§7). No `m-*.jsx` design shows any complaints or ECN screen (§1a) — **mobile is
unaffected by this sprint**, proven by `pnpm --filter @kaenal/mobile typecheck` staying green on the additive
shared-type changes only.

## 1a. Verified current state (grepped this session, not assumed — CLAUDE.md rule 10)

| Fact | Evidence |
|---|---|
| No `complaints`, `ecns`, or `ecn_approvals` table exists anywhere; no `apps/api/src/complaints` or `apps/api/src/ecn` directory exists | `grep -rn "CREATE TABLE" packages/db/migrations/*.sql` — no match; `ls apps/api/src` — 33 existing feature dirs, no `complaints`/`ecn` |
| `implementation/phases/P18-complaints.md` and `P19-ecn.md` exist, both marked `Backend 🔴 PROPOSED · FE 🔴`, and both name their own open sign-off questions: P18 — "email/EDI auto-intake in scope now or manual-only first? SLA clock on complaints?"; P19 — "number/identity of approval stages (fixed vs configurable)? is document auto-revision in scope for v1 or link-only?" — this sprint's §3 resolves each explicitly | both files read in full this session |
| Next free migration number is **0071** — `0070_calibration_training_exports.sql` (Sprint 05) is the last file on disk; no file numbered 0071 exists despite Sprint 05's own text reserving it as a "buffer" (it was never actually created). ROADMAP §4's guess of "06: 0050-0052" is stale (written before Sprints 02-05 landed 0061-0070) | `ls packages/db/migrations \| sort \| tail` |
| **Composite-FK prereq check (explicitly performed, per this sprint's own instructions): NOT NEEDED.** This sprint's real cross-references (complaint → NCR/8D/CAPA) reuse the exact **plain-FK, loosely-typed "source" pattern** `audit_findings.ncr_id`/`audit_findings.capa_id` already establish (`uuid REFERENCES ncrs(id) ON DELETE RESTRICT`, `uuid REFERENCES capas(id) ON DELETE RESTRICT` — confirmed by reading `0001_core.sql` lines 333-334 and the whole `audit_findings` table definition) — a plain, non-composite FK to the target's bare `id`, relying on RLS (not a composite key) to keep it tenant-safe, exactly like `raiseNcr`/`raiseCapa` in `audits.service.ts` already do. **No new table this sprint needs to reference `ncrs`/`documents`/`capas`/`files` via a *composite* `(tenant_id, id)` FK** — the one place a composite FK genuinely is needed (`complaint_attachments.file_id` → `files(tenant_id, id)`) already has its prerequisite: `files` gained `UNIQUE (tenant_id, id)` in Sprint 05's `0067_composite_fk_prereqs.sql` (confirmed: `grep -n "files_tenant_id_uq" packages/db/migrations/0067*.sql` → present). `complaints`/`ecns` themselves get their own `UNIQUE (tenant_id, id)` in their own new migrations (self-consistency, same as every prior sprint's new parent tables) so `complaint_attachments`/`ecn_approvals` can composite-FK into them without a separate prereq step | `packages/db/migrations/0001_core.sql:242-260,333-341`; `packages/db/migrations/0067_composite_fk_prereqs.sql:33` |
| `NcrSource` (`packages/types/src/enums.ts:107-118`) **already includes `"complaint"`** (present since the original schema, `0001_core.sql`'s `ncrs.source` CHECK already allows `'complaint'`) — unlike Sprint 05's `calibration` addition, **no migration or enum widening is needed** for complaint→NCR conversion's `source` value | `packages/types/src/enums.ts:107-118`; `packages/db/migrations/0001_core.sql:199-200` (`ncrs.source` CHECK) |
| `apps/api/src/audits/audits.service.ts` `raiseNcr` (line 655) and `raiseCapa` (line 708) are the established, direct, twice-proven precedent for "convert a source record into a real NCR/CAPA": load the source, call the target module's own `.create()` with `source`/`sourceId` (NCR) or `sourceKind`/`sourceId` (CAPA), then one-time-link the source row back with a `WHERE <fk> IS NULL` guard preventing a double-raise. This sprint's complaint→NCR/8D/CAPA conversion reuses this exact mechanism (not a new one) — extended to a **third** target, 8D, since no prior sprint's "raise" flow has targeted `eight_ds` directly yet | both methods read in full this session |
| `apps/api/src/documents/documents.service.ts` `documentMachine` (`packages/core/src/state-machines/document.ts`, read in full) is a **single-stage** `draft → pending → approved|rejected` machine with a four-eyes guard (`forbidsSelfApproval`) restricting approval to `admin`/`manager` only (`requiresApproverRole`) — **this is NOT a multi-stage approval engine**, confirmed by reading the whole file: there is no concept of "stage" anywhere in it. ROADMAP §5's phrase "reusing the documents approval engine" is corrected here: this sprint reuses the **pattern** (`defineMachine`, a role-gated four-eyes guard, forward-only transitions, `status_changed` audit action) for ECN's own new, genuinely multi-stage machine — it does not, and cannot, reuse the single-stage `documentMachine` object itself, which has no stage dimension to extend | `packages/core/src/state-machines/document.ts` (full file, 79 lines) |
| `documents.service.ts`'s `newVersion` method (lines 358-409) is a real, working, callable mechanism: given an `approved` document, it opens a new draft version (`document_versions` insert + `documents.status/version` update), audited `updated`. **This is the real backend ECN's "auto-revises affected documents" reuses** — confirmed callable, not aspirational; its own guard (`row.status !== "approved"` → `INVALID_TRANSITION`) is a real constraint this sprint's auto-revise call must handle per-document (§3.2), not ignore | `apps/api/src/documents/documents.service.ts:358-409` |
| `EntityKind` (`packages/types/src/enums.ts:375-391`) has 11 members (`inspection, ncr, eight_d, audit, capa, document, supplier, scar, finding, risk, fmea`) — no `complaint`, no `ecn`, no `part` (there is **no `parts` table or `EntityKind` anywhere in this codebase**, confirmed by reading the full `ENTITY_TABLES` map in `entity-ref.ts` — P19's "affected parts" linking is therefore **not buildable** this sprint; only affected documents/suppliers are real, existing link targets) | `packages/types/src/enums.ts:375-391`; `apps/api/src/collab/entity-ref.ts:16-27` (full `ENTITY_TABLES` map) |
| `entity_links_from_kind_check`/`_to_kind_check` (widened again in `0064`) do not include `complaint` or `ecn` | `packages/db/migrations/0064_risk_register.sql:131-139` |
| Three **total** `Record<EntityKind, …>` maps that TypeScript will force to widen the moment `EntityKind` gains two members: `ENTITY_TABLES` (`entity-ref.ts`), `ENTITY_SPECS` (`chat.ts`), `GRAPH_KINDS` (`apps/web/src/features/graph/graph-kinds.ts`) — confirmed by reading all three in full. `apps/api/src/graph/graph.service.ts` keeps its own separate, literal `GRAPH_KINDS: readonly EntityKind[]` render array that Sprint 04 (R3/Q27) deliberately did **not** widen for `risk`/`fmea` either — this sprint makes the same judgment call for `complaint`/`ecn` (§7, mirrors Q27, not a new gap) | `apps/api/src/collab/entity-ref.ts`, `apps/api/src/ai/chat.ts:25-46`, `apps/web/src/features/graph/graph-kinds.ts` (all read in full) |
| `SearchEntityKind` (`packages/types/src/dto.ts:676`) still has only its original 5 members (`inspection, ncr, capa, document, audit`) — **Sprints 04 and 05 did not add `risk`/`msa`/`instrument`/`competency` to search**, confirmed by grep. This sprint makes its own judgment call (§3.1/§4) to add `complaint`/`ecn` (free-text subject/title search is a real, named use case for both — "search complaints/ECNs by keyword" — unlike the more numeric/tabular risk/MSA/calibration/training records), not a retroactive fix of the prior sprints' choice | `packages/types/src/dto.ts:676-677`; `apps/api/src/search/search.service.ts:19-24` (current `KINDS` map, full) |
| `RealtimeTopic` (`packages/types/src/realtime.ts:16-36`) and `ENTITY_TOPIC` (`apps/api/src/realtime/audit-signal.ts`) likewise were **not** widened by Sprints 04/05 for their own new modules (no `risk`/`msa`/`calibration`/`training` topic exists) — confirmed by grep. This sprint wires its own two new modules in (§4), since the audit-signal bridge is explicitly documented as "free" (any audited mutation gets a signal for no extra service code) and both new modules are genuinely multi-person, collaborative workflows (a second approver's screen should refresh when the first approves an ECN stage) — not a retroactive fix of Sprints 04/05's own choice | `packages/types/src/realtime.ts`; `apps/api/src/realtime/audit-signal.ts` (`ENTITY_TOPIC` map, full) |
| `apps/web/src/config/navigation.ts` already has real nav entries: `{ id: "complaints", label: "Customer complaints", href: "/complaints", icon: MessageSquare }`, `{ id: "ecn", label: "Engineering changes", href: "/ecn", icon: GitBranch }`; `planned-modules.ts` and `placeholder-ledger.ts` ("planned:complaints": 6, "planned:ecn": 6) already correctly point at this sprint | `apps/web/src/config/navigation.ts:162-163`; `planned-modules.ts:28-29`; `placeholder-ledger.ts:15-16` |
| `apps/web/src/config/rbac.ts` `ROLE_NAV`: admin = all, manager = all-minus-platform (both already cover `complaints`/`ecn` once built). Auditor's explicit `Set` does not include `complaints`/`ecn` (it does include `risk`/`msa`/`fmea`/`calibration`/`training` from Sprints 04/05) — this sprint adds both. Inspector's and viewer's `Set`s also don't include them yet; per this sprint's §1/role decision, **viewer** gains both, **inspector** gains neither | `apps/web/src/config/rbac.ts:32-68` (full file read this session) |
| No `complaint:view`/`complaint:manage`/`ecn:view`/`ecn:manage`/`ecn:approve` capability exists in `packages/core/src/rbac.ts`. `document:approve` **does** exist and is granted to admin/manager only, not auditor (confirmed lines 140-142, 179) — the direct, real precedent this sprint's `ecn:approve` grant mirrors | `grep -n "complaint:\|ecn:" packages/core/src/rbac.ts` → 0 hits; `packages/core/src/rbac.ts:140-142,179` |
| No `m-*.jsx` mentions a complaints or ECN screen at all (0 hits for "complaint"/"ECN"/"change notice") | `grep -il "complaint\|ecn\b\|change notice" project_brain/mobile/src/m-*.jsx` → no matches |
| `qms-modules.jsx`'s `ECNList` and `ECNKanban` **disagree with each other and with P19's own status enum** — a real, provable mock inconsistency this sprint's §3.2 resolves with one canonical machine (not silently reproduced as two contradictory views): `ECNList` names 4 distinct labeled stages ("Risk review" step 3/6, "CAB approval" step 4/6, "Doc revision" step 5/6, "Pilot run" step 6/6) against a flat "of 6" counter; `ECNKanban` names 7 columns (draft, feasibility, risk-review, cab, pilot, impl, closed) with no "Doc revision" column and no "rejected" column at all despite the header text's own claim of a "multi-stage approval workflow" (which implies a reject path must exist somewhere); P19 §2 separately proposes a 5-value `status` enum (`draft\|under_review\|approved\|rejected\|implemented`) that matches neither jsx view | `qms-modules.jsx:549-633` read closely; `P19-ecn.md` §2 |
| `qms-modules.jsx`'s `ECNList` mock's `tp` (type) column uses **4** distinct values across its 5 rows — Design, Process, Process, Tooling, **Material** (`ECN-2026-0180`, a supplier-change ECN) — but P19 §2 proposes only 3 `change_type` values (`design\|process\|tooling`), omitting `material` entirely. P19 §5 itself separately lists "Relates to: P08 (supplier change — `linkedEcns`)" as a real dependency, confirming supplier/material-change ECNs are genuinely in scope, not a mock-only fixture coincidence | `qms-modules.jsx:558-562`; `P19-ecn.md` §2, §5 |
| `qms-modules.jsx`'s `CustomerComplaints` `IntakeForm` (the actual drawn create dialog, lines 477-523) captures **customer, severity, batch/serial, subject, detail, attachments** — it does **not** capture **contact** or **channel**, even though P18 §1 explicitly lists both as fields the intake flow must capture, and the list view's own columns display both (`c.contact`, `c.via`) for every row. A real, provable gap between what the drawn dialog collects and what the list/filters/P18 need it to have collected | `qms-modules.jsx:477-523` (full `IntakeForm`, no contact/channel field anywhere) vs `qms-modules.jsx:325-330` (`COMPLAINTS` fixture, both fields populated) and `P18-complaints.md` §1 |
| `qms-modules.jsx`'s `CustomerComplaints` "Intake channels" card (5 external channels: public web form, customer portal/EDI, email parser, phone, customer extranet API, all shown `Active` with volumes) and its "Public intake form" header button (`kToast` link-copy) are the **exact** subject of P18's own open sign-off question ("email/EDI auto-intake in scope now or manual-only first?") — none of the 5 channels has a real integration, parser, or public-facing unauthenticated endpoint anywhere in this codebase; ROADMAP's own instruction for this sprint ("portal intake channel ONLY if the jsx shows it as a real screen") is not met — the jsx shows a decorative status card and a link-copy button, not a working public screen | `qms-modules.jsx:349,422-443` read closely; confirmed no `apps/api/src/portal` route or `apps/web` page implements customer-facing complaint intake (`grep -rn "complaint" apps/api/src/portal` → 0 hits) |
| `qms-modules.jsx`'s complaint list rows carry `style={{ cursor: 'pointer' }}` with **no `onClick` handler anywhere** — a genuine dead affordance in the mock itself (rule 10 applies even to what the mock already got wrong): clicking a row does nothing. No complaint-detail board/drawer is drawn anywhere in the file | `qms-modules.jsx:383` (`<tr key={c.id} style={{ cursor: 'pointer' }}>`, no `onClick`) |
| `ECNWorkbench`'s "New ECN" button and `CustomerComplaints`'s row click each have no drawn create/detail dialog (ECN) or detail board (both) — unlike Sprint 04's risk (which got a CreateWizard extension) or Sprint 05's instrument (dedicated small form, `qms-modules.jsx:202`'s own kToast at least named the fields to ask for). Flagged in §5 for the UI Lead Designer, not invented here | `qms-modules.jsx:538` (New ECN, bare kToast, no field list at all, unlike the instrument precedent) |
| `packages/core/src/sla.ts`'s `computeDueAt`/`SlaConfigByPriority`/`BusinessHours` (business-hours-aware due-date math, used by NCR's respond/resolve SLA) and `packages/types`'s `SlaState` (`on_track\|at_risk\|breached`, confirmed generic — not an NCR-only type, `import type { ..., SlaState } from "@kaenal/types"` in `sla.ts` itself) are the established, direct, reusable precedent for complaint SLA tracking — this sprint reuses the type and the business-hours machinery, not a new mechanism (§3.1) | `packages/core/src/sla.ts` (full file read this session) |
| `packages/core/src/rbac.ts`'s own comment (Sprint 05's C1a note, carried over) states the established design norm this codebase already follows: "pure, unit-tested derivation functions in `packages/core`, never a stored 'status' column computed against `now()`" (`scoreBand`, `instrumentDueStatus`, `competencyCellState` are the cited precedents) — this sprint's `sla_state`/`ecnStageIndex` follow the same norm: computed on read, never stored, unlike `ncrs.sla_state`'s own pre-existing stored column (a different, earlier design choice this sprint does not disturb or imitate) | prior-sprint precedent, re-confirmed this session |

---

## 2. Stories

### C1 — Complaint register: schema, list, KPI strip, tabs

**Design:** `CustomerComplaints` (`qms-modules.jsx:332-475`) — KPI strip (5 tiles), 4 filter tabs, register
table, "Intake channels"/"SLA matrix" reference cards.

UC
- Happy: open `/complaints` → KPI strip (real counts/percentages, not the jsx's static 84/4/92%/18d/$4,280),
  4 tabs with real counts in their own labels (`All (N open)`, `Critical (N)`, `Not linked to NCR (N)`,
  `Mine (N)`), register table sorted by `received_at` desc, each row's customer chip colored deterministically
  from the customer name (never a user-picked color — P18 defines no `customers` master table, §3.1).
- Empty: tenant has zero complaints → KPI strip and tabs show `0`/`—` (never a fabricated percentage or a
  division-by-zero `NaN`), table shows "No complaints logged yet."
- Permission: `complaint:view` required for the page; a role without it never sees the nav entry (curated,
  §4) and a direct deep-link 403s server-side (partner) or is client-blocked (nothing else lacks the
  capability per §1/role decision — inspector holds neither `:view` nor `:manage` this sprint, so `/complaints`
  is both nav-hidden and server-403'd for inspector, unlike calibration/training's view-only inspector grant).
- Error/offline: list/summary fetch fails → retry affordance; offline banner disables Log complaint/
  Acknowledge/Convert/Close mutations (reuse S1-5 infrastructure).

AC
1. Migration `0071_complaints.sql`: `complaints` — `tenant_id`, `id`, `code` (`COM-YYYY-NNNN` via `codes.ts`'s
   `counters` mechanism; `CodeKind` gains `"complaint"` → prefix `COM`), `customer` text NOT NULL (free text —
   P18 §2 defines no customer master table; a customer is whatever string the loggist types) — **no
   `customer_color` column (§0 S6)**: a new pure `packages/core/src/customer-color.ts`
   `customerColor(name: string): string` deterministically hashes `customer` to one of a fixed 10-color
   palette (the jsx's own 5 literal hex values — `#003c64`, `#1c1c1c`, `#cc0000`, `#0066b1`, `#0a8541` — plus 5
   more chosen for WCAG-AA contrast against white text, all as literal design tokens per `design-rules.md`'s
   per-entity-kind-color convention) is called **on every read**, in `toComplaintDto` — `ComplaintDto.
   customerColor` is a computed response field, never persisted (unit-tested for determinism, not randomness;
   matches this codebase's own norm of never storing a cheap, derivable display value), `contact` text NOT NULL (single free-text
   field, e.g. "Magnus Eriksson · Quality Manager" — matches the list's own display format exactly; **not**
   split into name/title columns, since nothing in the jsx or P18 shows them as separate fields — see §3.1 for
   why this field exists at all despite not being in the drawn `IntakeForm`), `channel` enum (`portal\|
   email_parsed\|web_form\|edi\|phone` — the jsx's own 5 `via` display values, exactly; see §3.1 for why this
   field is captured via a form field the drawn `IntakeForm` doesn't show), `severity` enum (`critical\|high\|
   medium\|low`), `status` enum (`triage\|investigation\|8d\|capa\|closed`) DEFAULT `triage`, `subject` text
   NOT NULL, `description` text NOT NULL DEFAULT `''` (the drawn "Detail" textarea), `batch_ref` text NULL
   (free text — the jsx's own `'multiple'` value for one row proves this isn't a single-batch identifier
   format), `received_at` timestamptz NOT NULL DEFAULT `now()`, `acknowledged_at` timestamptz NULL,
   `closed_at` timestamptz NULL, `cost_usd` numeric(12,2) NULL CHECK (`cost_usd IS NULL OR cost_usd >= 0`) —
   captured later via edit, never at intake (no cost field is drawn in `IntakeForm`, and real cost is rarely
   known at the moment a complaint is logged), `sla_target_hours` int NOT NULL, `sla_close_target_days` int NOT
   NULL — **both denormalized at creation from the severity's SLA-matrix config at that moment** (mirrors
   Sprint 05 T1 AC1's `training_records.valid_months` denormalization precedent exactly — a later change to the
   SLA matrix must never retroactively alter an existing complaint's own due dates), `owner` (composite member
   FK, NOT NULL, defaults to the creating actor — **frozen: no route reassigns it this sprint, §0 S4**),
   `ncr_id` uuid, `eight_d_id` uuid, `capa_id` uuid, all NULL — **composite FKs, not plain (§0 S1, superseding
   the original `audit_findings.ncr_id`/`capa_id` plain-FK precedent)**: `(tenant_id, ncr_id) REFERENCES
   ncrs(tenant_id, id) ON DELETE RESTRICT`, `(tenant_id, eight_d_id) REFERENCES eight_ds(tenant_id, id) ON
   DELETE RESTRICT`, `(tenant_id, capa_id) REFERENCES capas(tenant_id, id) ON DELETE RESTRICT` — required now
   that C4's "link to an existing NCR" (§0 B8c) accepts a client-supplied id, which a plain FK can't safely
   trust (Postgres FK checks bypass RLS). `0071` first adds the missing prerequisites, confirmed absent today:
   `ALTER TABLE eight_ds ADD CONSTRAINT eight_ds_tenant_id_uq UNIQUE (tenant_id, id)` and `ALTER TABLE capas ADD
   CONSTRAINT capas_tenant_id_uq UNIQUE (tenant_id, id)` (`ncrs` already has this, `0067_composite_fk_prereqs.
   sql:29-30`),
   `search_vector` generated tsvector over `subject`/`description`/`customer` (mirrors `0008_search_vectors.sql`
   exactly), `lock_version`, standard audit columns. Forced RLS, leading `tenant_id` index, unique
   `(tenant_id, code)`, `UNIQUE (tenant_id, id)` (self-consistency — target for `complaint_attachments`' composite
   FK, C2 AC1). Also in `0071`: `complaint_attachments` (`tenant_id`, `id`, `complaint_id` composite FK →
   `complaints(tenant_id, id)` ON DELETE CASCADE, `file_id` composite FK → `files(tenant_id, id)` ON DELETE
   RESTRICT — `files` already has this unique constraint from Sprint 05's `0067`, §1a — `created_by`,
   `created_at`, **`UNIQUE (tenant_id, complaint_id, file_id)` (§0 S5 — no duplicate attachment rows)**).
   `EntityKind` gains `"complaint"`; `entity_links_from_kind_check`/`_to_kind_check` widened
   (mirrors `0064`'s pattern).
2. `GET /v1/complaints` (cursor, rule 6; filters `status`/`severity`/`channel`/`owner`/`unlinked`(bool, `ncr_id
   IS NULL`)/`q` free-text over `search_vector`), `POST /v1/complaints` (`complaint:manage`, `Idempotency-Key`
   header, mirrors every other sprint's create-route pattern), `GET /v1/complaints/:id` (`complaint:view`),
   `PATCH /v1/complaints/:id` (`lockVersion`, `complaint:manage` — edits customer/contact/channel/severity/
   subject/description/batch/cost, **remains editable after `closed` too (§0 S4 — closing a complaint does not
   freeze it, unlike ECN's terminal stages)**; never `status`/`ncr_id`/`eight_d_id`/`capa_id`/`acknowledged_at`/
   `closed_at` directly — those change only via C3/C4/C5's own dedicated actions. **Changing `severity` re-
   derives and overwrites `sla_target_hours`/`sla_close_target_days` from the SLA matrix in the same
   transaction (§0 B7c)** — stated as required behavior, not assumed. `owner` is never `PATCH`able this sprint
   (§0 S4 — not reassignable, no route exists). Not plant-scoped (no
   `plant_id` column — a customer complaint is not tied to one physical plant, mirrors document/capa/supplier
   precedent). All mutations `withAudit` in the same transaction (rule 3).
3. `GET /v1/complaints/summary` (`complaint:view`) — one round trip returning every KPI/tab count below,
   mirroring the `GET /v1/risks/summary`/`GET /v1/instruments/summary` precedent exactly (cursor-paginated
   lists can't compute tenant-wide totals client-side):
   - **Open** = `count(*) where status <> 'closed'`.
   - **Critical** = `count(*) where status <> 'closed' and severity = 'critical'`.
   - **< 24h response %** — a cohort metric, not a lifetime average: over complaints whose `received_at` falls
     in the trailing 30 days (tenant timezone, "now" computed server-side) **and** are old enough to judge
     (either already acknowledged, or `received_at <= now() - interval '24 hours'` — a complaint received 3
     hours ago that hasn't been acknowledged yet is excluded from both numerator and denominator, not counted
     as a failure prematurely): numerator = acknowledged within 24h of receipt; denominator = every judgeable
     complaint in the cohort. Returns `null` (renders "—") when the denominator is 0, never `NaN` or `0%`.
   - **Avg time to close (days)** = `avg(extract(epoch from (closed_at - received_at)) / 86400)` over every
     complaint ever closed (all-time, not quarter-scoped — the jsx's own tile carries no time-window label);
     `null` (renders "—") when zero complaints have ever been closed.
   - **Avg cost / complaint** = `avg(cost_usd)` over complaints where `cost_usd IS NOT NULL` (all-time);
     `null` (renders "—", never "$0") when zero complaints carry a recorded cost.
   - **Tab counts**: `all` = Open (above); `critical` = Critical (above); `no-link` = `count(*) where status <>
     'closed' and ncr_id IS NULL` (matches the tab's own literal label, "Not linked to **NCR**" — deliberately
     not also checking `eight_d_id`/`capa_id`, since the drawn label names NCR specifically); `mine` =
     `count(*) where status <> 'closed' and owner = <caller's membership id>`.
4. Cross-tenant complaint id → 404, not 403 (rule 8), mutation-tested against RLS.
5. `sla_state` (`SlaState` — reused type, `on_track\|at_risk\|breached`, §1a) is **computed on every read**,
   never stored, via a new pure `packages/core/src/complaint-sla.ts` `complaintSlaState(input: { slaTargetHours:
   number; receivedAt: string; acknowledgedAt: string | null; closedAt: string | null; now: string }): SlaState`:
   **if `closedAt` is set, the state is frozen at whichever it resolved to at closing time — never recomputed
   against a later `now` (§0 B7b, explicit input/rule, not left implicit)**; otherwise, if `acknowledgedAt` is
   set, the state is fixed forever at whichever it resolved to at that moment (`on_track` if acknowledged
   within `slaTargetHours` of receipt, else `breached` — a late first response stays permanently `breached`
   for this leg, regardless of what happens after); if not yet acknowledged, `breached` when elapsed hours
   exceed `slaTargetHours`, `at_risk` when elapsed hours are ≥ `packages/core/src/sla.ts`'s existing
   `AT_RISK_THRESHOLD` (**0.8, confirmed at `sla.ts:163` — reused, not a second, inconsistent 75% constant, §0
   B7d**) fraction of `slaTargetHours`, else `on_track`. Takes ISO strings, never JS `Date` objects (mirrors
   Sprint 05 B4's deliberate deviation for the same `pg` timezone-shift reason). Unit-tested including the
   0.8 boundary and both the "acknowledged late, stays breached forever" and "frozen at close" rules. **Runs on
   the existing 5-minute `sla.sweep` cadence (`SLA_SWEEP_CRON`, `job-types.ts:140`, confirmed) — no new daily
   job (§0 B7a)**, since a once-daily check cannot serve a 1h/4h acknowledge target.

6. **"Linked" column rule, stated explicitly (§0 B8d):** once a complaint can carry more than one linked record
   (C4, once "link existing NCR" ships), the register's "Linked" column shows the **single most-advanced**
   linked record by `complaintMachine`'s own rank order (`capa` > `eight_d` > `ncr` — the same rank C4 AC2
   already uses for status-advance) — never "most recent" and never a comma-joined list.

**Web/Mobile/Shared**
- **Web:** `apps/web/src/features/complaints/` — `ComplaintsPage` (KPI strip, 4 tabs w/ real counts, register
  table w/ customer color chip/severity badge/status chip/linked-record link (AC6's most-advanced-wins rule) or
  "Convert" affordance/received relative-time, "Intake channels"/"SLA matrix" reference cards reproduced as
  static reference content — see §3.1 for why these two cards are real but non-interactive this sprint),
  empty/loading/error/offline states.
- **Mobile:** not built — no `m-*.jsx` design (confirmed §1a); no route, no nav entry; `pnpm --filter
  @kaenal/mobile typecheck` must stay green on the additive shared-type changes only.
- **Shared:** migration `0071` (`complaints`, `complaint_attachments`, `EntityKind`/`entity_links` widening);
  `ComplaintDto`/`ComplaintListQuery`/`CreateComplaintBody`/`UpdateComplaintBody`/`ComplaintSummaryDto` +
  `ComplaintChannel`/`ComplaintSeverity`/`ComplaintStatus` enums in `packages/types`;
  `packages/core/customer-color.ts` + `packages/core/complaint-sla.ts` (pure, unit-tested);
  `complaint:view`/`complaint:manage` in `packages/core/src/rbac.ts`.

### C2 — Log a complaint (IntakeForm) + attachments

**Design:** `IntakeForm` (`qms-modules.jsx:477-523`) — the fully drawn intake dialog.

UC
- Happy: "Log complaint" opens the drawn dialog (Customer, Severity, Batch/serial, Subject, Detail,
  Attachments) **plus two necessary additions, flagged, not invented decoration** — Contact and Channel (§1a
  gap: the drawn dialog is missing fields the list/filters require it to have captured) — submitting creates a
  real complaint at `status: 'triage'`, `received_at: now()`, the severity's SLA targets denormalized in
  (C1 AC1), navigates to the new complaint's detail panel (C3).
- Attachments: the drop-zone accepts multiple files (photos, customer emails, 8D PDFs — matches the drawn
  copy exactly); each is presigned with `entityKind: "complaint"` and `entityId` **omitted** (no complaint
  exists yet at presign time), uploaded, then linked via `attachmentFileIds: string[]` in the `POST
  /v1/complaints` body once the complaint is created — mirrors Sprint 05's Round-3 fix for training evidence
  exactly (B7/BLOCKING-2, `entity_kind` set at presign, `entityId` omitted, linked after the fact), including
  its closed bypass: the link-time check requires the file's `entity_kind` to exactly equal `"complaint"` and
  `deleted_at IS NULL` before accepting it.
- Empty/error: a submission with zero attachments is valid (attachments are optional, matching the drawn
  dialog showing no "required" marker on that field); an upload failure keeps the dialog open with a retry
  affordance, never silently drops the file from the submission.
- Permission: `complaint:manage` required to open the dialog.

AC
1. `POST /v1/complaints` (C1 AC2) accepts `{ customer, contact, channel, severity, subject, description,
   batchRef?, attachmentFileIds?: string[] }`. Each id in `attachmentFileIds` is server-verified: belongs to
   this tenant, `entity_kind = 'complaint'`, `deleted_at IS NULL`, `sha256 IS NOT NULL` (fully uploaded) —
   exactly the double-check Sprint 05 closed its own presign-bypass gap with (B7/Round-3). A `complaint_
   attachments` row is inserted per verified id, in the same transaction as the complaint insert.
2. `Idempotency-Key` header required, same pattern as every other sprint's create route.
3. Created complaint gets a real `COM-YYYY-NNNN` code, sequence-generated via `codes.ts` + `counters`, never
   client-supplied.
4. Future-dated `receivedAt` is not accepted as a client input at all — `received_at` is always server-set to
   `now()` at creation (the drawn form has no date field; a complaint is always logged as received "now,"
   matching the jsx's own relative-time display convention — "2 hours ago," never a picked date).

**Web/Mobile/Shared:** Web (`IntakeForm`-derived dialog, contact/channel fields added per §1a, attachment
drop-zone wired to the files pipeline). Mobile: unaffected. Shared: none beyond C1's types + the files
pipeline's existing `entityKind` capability-check extension (`complaint` added to whatever allow-list `POST
/v1/files/presign` uses per `FilesService.presign`, mirroring Sprint 05's own extension of that same
mechanism for `calibration_event`/`training_batch`).

### C3 — Complaint detail panel: view, Acknowledge, edit, Close

**Design:** **No jsx board exists for this** — the mock's list rows are clickable but wired to nothing (§1a).
Flagged for the UI Lead Designer (§5); this story's AC describe the real backend + an interim detail panel
reusing this codebase's established `KvField`/detail-card visual language (the same pattern Sprint 04's risk
detail card and Sprint 05's instrument detail card already use), not a newly invented layout.

UC
- Happy: clicking a complaint row opens a detail panel showing every field the list's own `COMPLAINTS` object
  already carries (customer, contact, channel, severity, status, subject, description, batch, received/
  acknowledged/closed timestamps, SLA state chip, cost if set, attachments list, owner) plus real actions:
  Edit, Acknowledge (only while `acknowledged_at IS NULL`), Convert to NCR/8D/CAPA (C4), Close.
- Acknowledge: sets `acknowledged_at = now()` once; a second attempt 422s ("already acknowledged"), never
  silently overwrites the timestamp (an SLA response-time record must not be re-writable after the fact).
- Close: an explicit action, allowed from any non-`closed` status (a complaint can be closed with or without
  ever being converted — the jsx's own `COM-2026-0080` example closes *after* being linked to an NCR, proving
  closing isn't gated on having converted first); sets `closed_at = now()`, `status = 'closed'`; 422 if already
  closed.
- Permission: `complaint:view` reads the panel; `complaint:manage` for Edit/Acknowledge/Convert/Close.
- Offline: all four actions disabled under the offline banner (S1-5 infrastructure).

AC
1. `POST /v1/complaints/:id/acknowledge` (`complaint:manage`, `lockVersion`) — 422 if `acknowledged_at` is
   already set; audited `updated`.
2. `POST /v1/complaints/:id/close` (`complaint:manage`, `lockVersion`) — 422 if `status = 'closed'` already;
   sets `status = 'closed'`, `closed_at = now()`; audited `status_changed` (a real status transition, matching
   the CAPA/NCR/SCAR/8D/audits/inspections/MSA/document precedent for status transitions specifically, not
   `PATCH`'s generic `updated`).
3. Both routes 409 on a stale `lockVersion` (rule 6), mirroring every other mutation in this sprint's design.
4. Cross-tenant complaint id on either sub-route → 404, not 403 (rule 8).

**Web/Mobile/Shared:** Web (interim detail panel, flagged §5, reusing the existing `KvField`/detail-card
visual pattern). Mobile: unaffected. Shared: none beyond C1's types.

### C4 — Convert a complaint to NCR / 8D / CAPA

**Design:** `qms-modules.jsx:411-413` — the "Link / Create NCR" button (currently `kToast('NCR drafted from
complaint — review & submit')`, dead in the prototype) and the "→ NCR-2026-0140" linked-record display for
already-converted rows.

UC
- Happy: from an unconverted complaint (any of `ncr_id`/`eight_d_id`/`capa_id` still NULL for the chosen
  target), "Convert to NCR" (or 8D, or CAPA) creates a real target record, links it back, and advances
  `status` forward (never backward — a complaint already at `8d` that converts to CAPA moves to `capa`; one
  already at `capa` that "converts to NCR" is rejected, since NCR is chronologically upstream of the ECN's
  existing progress — see AC2's exact rule). Matches the jsx's own fixture directly: `COM-2026-0082` (status
  `8d`) and `COM-2026-0081` (status `capa`) each show only **one** linked record despite plausibly having
  passed through an earlier stage — proving a complaint need not visibly retain every intermediate link, and
  confirming direct triage→8D or triage→CAPA conversion (skipping NCR entirely) is a real, intended path, not
  a gap.
- Already converted: a target that's already linked (e.g., `ncr_id` already set) can't be converted to that
  same target again — 409, with the existing linked record's id in the error payload (mirrors `raiseNcr`'s
  own "That finding already has an NCR" 409 exactly).
- Permission: `complaint:manage` to convert (the parallel `ncr:create`/whichever target capability is also
  checked, defense-in-depth, mirroring Sprint 05 C3's own stated pattern — every role holding `complaint:
  manage` already holds `ncr:create`/`capa:manage`, so this is redundant-but-harmless, not an independent
  gate).

UC (revised, §0 B6c) — converting to a target chronologically *behind* the complaint's current status (e.g.,
"convert to NCR" on a complaint already at `8d`) is **allowed**: it creates the NCR and links it (a complaint
can carry more than one linked record for traceability) but does not move `status` backward, exactly as AC2
below states — the earlier UC text calling this "rejected" was a self-contradiction against its own AC and is
corrected here, not the AC.

AC
1. **Discriminated union body, keyed on `target` (§0 B6f/g/h), replacing the old flat body:**
   - `{ target: "ncr"; title?: string } ` — derives `priority` from severity (mapping table, §0). Requires
     `ncr:create`.
   - `{ target: "ncr"; existingNcrId: string }` — **link to an existing NCR (§0 B8c, added back)**: the jsx's
     own button reads "Link / Create NCR," implying both; `existingNcrId` must be `ncr:view`-visible to the
     caller (`assertEntityVisible`, tenant-scoped, 404 not 403 on a foreign id) — no new NCR is created.
   - `{ target: "eight_d"; title?: string }` — derives `priority` (`WizardPriority`) from severity. Requires
     `ncr:manage` (8D's own real creation capability, confirmed `eight-d.controller.ts:53`). If the complaint
     already has `ncr_id` set, the 8D links to that **existing** NCR (passed as `ncrId`), not a fresh one; if
     that NCR already has its own 8D, this 409s (`CONFLICT`, mirrors `raiseNcr`'s "already has an NCR" pattern)
     rather than silently reusing or duplicating.
   - `{ target: "capa"; title?: string; type: CapaType }` — derives `priority` from severity; `type` has no
     complaint analog, so the caller must supply it (the CAPA variant's one extra required field). Requires
     `capa:manage` (confirmed `capa.controller.ts:56`).
   - Every variant reuses `NcrsService.create`/`EightDService.create`/`CapasService.create` directly (not a new
     parallel creation path). `source`/`sourceId` (NCR), `sourceKind`/`sourceId` (CAPA), and 8D's new
     `source`/`source_id` (migration `0071`: `eight_ds.source text NULL`, `eight_ds.source_id uuid NULL`,
     unconstrained, matching `ncrs.source_id`/`capas.source_id`'s loose pattern) are **always set internally by
     `ComplaintsService.convert`** — never accepted as client body fields (§0 B6h, consistent with how
     `raiseNcr`/`raiseCapa` already set them today).
   - **Real, enforced per-target capability gate (§0 B6f):** the caller must actually hold the target's own
     creation capability (`ncr:create` / `ncr:manage` / `capa:manage`) — a caller lacking it (e.g., an auditor,
     who holds `complaint:manage` but only `ncr:create`/`capa:view`, confirmed against `rbac.ts`'s full
     `auditor` grant) gets a real 403, not a silent bypass; §5's convert-target picker is filtered client-side
     to only the targets the caller actually holds.
2. **Race-safe status advance and locking (§0 B6a/b):** `POST /v1/complaints/:id/convert` requires `lockVersion`
   in the body. The service `SELECT ... FOR UPDATE`s the complaint row **first**, then computes the new status
   from the **locked** row (never a pre-lock read) using `complaintMachine` (new,
   `packages/core/src/state-machines/complaint.ts`, rank `triage=0, investigation=1, 8d=2, capa=3, closed=4`,
   terminal): converting to `ncr`/existing-NCR sets `status = max(current, investigation)`; to `eight_d` sets
   `status = max(current, "8d")`; to `capa` sets `status = max(current, "capa")` — status only ever advances or
   stays put. The `UPDATE` carries `WHERE lock_version = $lockVersion AND status <> 'closed'` (409 on a
   `lockVersion` mismatch; **422, `COMPLAINT_CLOSED`, if the complaint is already `closed`, stated explicitly
   §0 B6b** — locking the row first already makes a convert-racing-a-close unable to silently reopen it; the
   explicit `status <> 'closed'` guard turns that into a named, tested outcome rather than an implicit one of
   the lock alone). **The complaint is audited on every successful convert, with no exception (§0 B6d):**
   `status_changed` when `status` actually moves, `updated` when it doesn't (e.g., a second convert to a
   different target after the first already advanced status) — never a silent, unaudited link-only write. The
   NCR/8D/CAPA creation itself is always separately audited `created` on the new record via its own `withAudit`
   call (rule 3). **`audits.service.ts`'s `raiseCapa` link-back is fixed in this same sprint (§0 B6e, small,
   named, adjacent fix)** — its bare `tx.query` UPDATE (`audits.service.ts:734-738`, confirmed unaudited) is
   rewritten to use `withAudit`, exactly like `raiseNcr`'s already-fixed pattern; the convert route's own
   complaint-audit logic follows `raiseNcr`'s pattern, never `raiseCapa`'s old one.
3. Cross-tenant complaint id (or `existingNcrId`) → 404, not 403 (rule 8); RLS mutation-tested for the
   double-convert race (two concurrent converts to the same target, `SELECT ... FOR UPDATE` serializes them —
   exactly one wins with 200, the other gets 409 on the now-stale `lockVersion`, never a lost-update overwrite).

**Web/Mobile/Shared:** Web (Convert action in C3's detail panel + the register table's inline "Link / Create
NCR" affordance for unconverted rows — now a real 4-way choice: create NCR / link existing NCR / create 8D /
create CAPA, each shown only if the caller holds its capability, §0 B6f). Mobile: unaffected. Shared: migration
`0071`'s `eight_ds.source`/`source_id` addition, `eight_ds_tenant_id_uq`/`capas_tenant_id_uq` (§0 S1), and the
composite-FK conversion of `complaints.ncr_id`/`eight_d_id`/`capa_id` (§0 S1, moved from C1); a small, named,
adjacent fix to `apps/api/src/audits/audits.service.ts`'s `raiseCapa` (§0 B6e); `ComplaintConvertBody`
(discriminated union) in `packages/types`; `packages/core/state-machines/complaint.ts` (pure, unit-tested
against every status-rank transition including the "converts backward, status doesn't move" case).

### E1 — ECN schema, canonical stage machine, List view

**Design:** `ECNWorkbench`/`ECNList` (`qms-modules.jsx:528-591`) — segmented List/Kanban toggle, list table.
**See §3.2 for the canonical stage machine this AC implements — the jsx's own two views disagree with each
other and with P19, and §3.2 resolves the conflict; this is part of what needs sign-off.**

UC
- Happy: open `/ecn` (List view, the default) → table of ECNs with type chip, a progress bar reading "step X
  of 7" against the canonical 7-stage pipeline, now including the real `ppap` gate (§3.2, §0b D1), risk chip,
  owner avatar, target (effective) date — real data, not the jsx's 5 static rows.
- Empty: zero ECNs → "No engineering change notices yet — New ECN."
- Permission: `ecn:view` required for the page; nav-curated (§4), server-403 for a role without it.
- Error/offline: list fetch fails → retry; offline banner disables New ECN/approve/reject/link mutations.

AC
1. Migration `0072_ecn.sql`: `ecns` — `tenant_id`, `id`, `code` (`ECN-YYYY-NNNN`; `CodeKind` gains `"ecn"` →
   prefix `ECN`), `title`, `change_type` enum (`design\|process\|tooling\|material` — **4 values, corrected
   from P19's proposed 3** to match the jsx's own `ECNList` fixture's real 4th value and P19 §5's own
   confirmed supplier-change dependency, §1a), `description` text NOT NULL DEFAULT `''`, `change_risk` enum
   (`low\|medium\|high` — the jsx's `risk` field; captured at creation, editable via `PATCH` **only while
   `stage = 'draft'`**, frozen once the approval pipeline begins — a change's risk assessment shouldn't shift
   after reviewers have started signing off against it), `stage` enum (`draft\|feasibility\|risk_review\|
   ppap\|cab_approval\|pilot\|implementation\|closed\|rejected` — **9 values, `ppap` added as a real 5th
   approval gate between `risk_review` and `cab_approval`, §0b D1** — the canonical machine, §3.2) DEFAULT
   `draft`, `owner` (composite member FK, NOT NULL, defaults to the creating actor, **PATCHable only while
   `stage = 'draft'` — §0 B2 — which includes a `draft` reached again via resubmission (§0b D3): resubmitting a
   `rejected` ECN genuinely re-opens `owner` editability, it is not a one-way freeze**), `effective_date` date
   NULL, `linkedDocumentCount` (**not a
   column — computed on read, §0 B8a**: `count(*)` over `entity_links WHERE from_kind='ecn' AND
   to_kind='document' AND from_id=ecns.id`, the jsx's own "Affected" column, `qms-modules.jsx:576`), **
   `auto_revise_result jsonb NULL` (§0 B3e — set on the `pilot→implementation` transition, persists E5's
   revise/skip outcome for later reads, never only a one-time API response)**,
   `search_vector` generated tsvector over `title`/`description` (mirrors `0008_search_vectors.sql`),
   `lock_version`, standard audit columns. Forced RLS, leading `tenant_id` index, unique `(tenant_id, code)`,
   `UNIQUE (tenant_id, id)` (self — target for `ecn_approvals`' composite FK). Not plant-scoped (no `plant_id`
   — an engineering change is tenant-wide, mirrors document/capa precedent). `EntityKind` gains `"ecn"`;
   `entity_links` CHECK constraints widened.
2. `packages/core/src/state-machines/ecn.ts` (pure): `ECN_STAGE_ORDER = ["draft", "feasibility",
   "risk_review", "ppap", "cab_approval", "pilot", "implementation"]` (**7 entries, `ppap` added between
   `risk_review` and `cab_approval`, §0b D1** — `closed`/`rejected` are terminal, excluded from the "of 7"
   count); `ecnStageIndex(stage): number | null` returns 1-7 for the 7 ordered stages, `null` for
   `closed`/`rejected`. `ecnMachine` (`defineMachine`) transitions: `draft → [feasibility, rejected]`,
   `feasibility → [risk_review, rejected]`, `risk_review → [ppap, rejected]`, `ppap → [cab_approval, rejected]`,
   `cab_approval → [pilot, rejected]`, `pilot → [implementation, rejected]`, `implementation → [closed]`,
   `closed → []`, **`rejected → [draft]` (§0b D3 — resubmission, modelled on `documentMachine`'s own
   `rejected → draft` transition, no additional guard, matching that precedent's own unguarded shape)** — every
   pre-implementation stage can be rejected (closing the jsx's own missing "Rejected" Kanban column, §1a/§3.2),
   and a `rejected` ECN can be resubmitted back to `draft` exactly once per resubmission (nothing stops a
   second rejection cycle after that — the loop is real, not one-shot). **The four transitions out of `draft`/
   `rejected` and into a terminal/next-of-7 stage are driven by four different, explicitly named routes, not one
   generic "approve" call (§0 B1, §0b D3):** `draft→feasibility` by `POST /v1/ecns/:id/submit`; `draft→rejected`
   by `POST /v1/ecns/:id/withdraw` (an author action — no `ecn_approvals` row exists for `draft`, so there is no
   four-eyes decision to make here); **`rejected→draft` by `POST /v1/ecns/:id/resubmit` (§0b D3 — also an
   author-style action, `ecn:manage`, not owner-restricted, not a four-eyes decision, mirroring `withdraw`'s own
   "no `ecn_approvals` row is being decided" reasoning)**; the 5 gated stages' `→next-or-rejected` by E4's
   approve/reject route; `implementation→closed` by `POST /v1/ecns/:id/close`. Guards mirror `documentMachine`'s
   `requiresApproverRole` (only `admin`/`manager` may approve/reject any of the 5 gated stages, §3.2) but
   **`forbidsSelfApproval` is made explicitly stricter than `documentMachine`'s (§0 B2)**: the actor must be
   `≠ ecns.owner` **and** `≠ ecns.created_by`, checked for **both** approve and reject (`documentMachine`'s own
   version, confirmed by reading `document.ts:44-54`, only blocks self-*approval* — this ECN-specific rule is a
   deliberate, stated divergence, not a claimed exact mirror). The new `rejected→draft` transition carries **no**
   four-eyes guard at all (§0b D3a) — matching `documentMachine`'s own precedent exactly (`document.ts:17`'s
   `rejected: ["draft"]` entry has no guard restricting it either), so any `ecn:manage` holder, including the
   ECN's own `owner` or `created_by`, may resubmit.
3. `GET /v1/ecns` (cursor, rule 6; filters `changeType`/`stage`/`changeRisk`/`owner`/`q` over `search_vector`;
   response includes `linkedDocumentCount`/`autoReviseResult`, §0 B8a/B3e), `POST /v1/ecns` (`ecn:manage`,
   `Idempotency-Key`), `GET /v1/ecns/:id` (`ecn:view`), `PATCH /v1/ecns/:id`
   (`lockVersion`, `ecn:manage` — edits `title`/`description`/`effectiveDate` always; `changeType`/
   `changeRisk` only while `stage = 'draft'`, 422 otherwise; **`owner` only while `stage = 'draft'`, 422
   otherwise (§0 B2, revised from "always") — including a `draft` reached again via resubmission (§0b D3)**;
   **rejected entirely (422) once `stage` is `closed` or `rejected` — `closed` is fully and permanently frozen;
   `rejected` is frozen for `PATCH` purposes specifically, but is not a dead end for the record as a whole — the
   dedicated `resubmit` route (§0b D3, not `PATCH`) is the one way out of `rejected`, and once it moves `stage`
   back to `draft`, ordinary `PATCH` editability (incl. `owner`) resumes**; never `stage` directly, which only
   changes via E4's approval route or the `submit`/`withdraw`/`close`/`resubmit` routes, §0 B1/§0b D3). All
   mutations `withAudit` in the same transaction (rule 3).
4. Cross-tenant ECN id → 404, not 403 (rule 8), mutation-tested against RLS.

**Web/Mobile/Shared**
- **Web:** `apps/web/src/features/ecn/` — `EcnListPage` (segmented toggle default `list`, table w/ type chip,
  progress bar, risk chip, owner avatar, effective date, **"Affected" column showing `linkedDocumentCount`,
  §0 B8a**), empty/loading/error/offline states.
- **Mobile:** not built — no `m-*.jsx` design; unaffected; `pnpm --filter @kaenal/mobile typecheck` stays
  green.
- **Shared:** migration `0072` (`ecns` incl. `auto_revise_result`, `EntityKind`/`entity_links` widening);
  `EcnDto` (incl. `linkedDocumentCount`, `autoReviseResult`)/`EcnListQuery`/
  `CreateEcnBody`/`UpdateEcnBody` + `EcnChangeType`/`EcnChangeRisk`/`EcnStage` enums in `packages/types`
  (`EcnStage` now 9 values incl. `ppap`, §0b D1); `packages/core/state-machines/ecn.ts` (pure, unit-tested —
  every legal/illegal transition incl. the 5 gated stages and the new `rejected→draft` resubmission edge, the
  stricter owner-or-created_by four-eyes guard on both approve and reject, the admin/manager-only guard);
  `ecn:view`/`ecn:manage`/`ecn:approve` in `packages/core/src/rbac.ts` (unchanged — no new capability: `ppap`'s
  gate and `resubmit` both reuse the existing 5, §0b D1/D3).

### E2 — Kanban view

**Design:** `ECNKanban` (`qms-modules.jsx:593-633`) — 7 columns, drag-to-advance implied by the header's "CAB
approval" progress-bar concept. **Corrected to 9 columns** (adds "Rejected," §1a/§3.2, and "PPAP," §0b D1).

UC
- Happy: Kanban view shows 9 columns (Draft, Feasibility, Risk review, PPAP, CAB approval, Pilot,
  Implementation, Closed, Rejected) with real per-column counts and cards. **Drag action named per column (§0
  B1, §0b D3, no column left undefined):** dragging a **Draft** card to **Feasibility** calls `submit`
  (`ecn:manage`); dragging a **Draft** card to **Rejected** calls `withdraw` (`ecn:manage`); dragging a card
  from any of the 5 gated columns (**Feasibility/Risk review/PPAP/CAB approval/Pilot**) to its immediately-next
  column calls E4's approve action (`ecn:approve`); dragging one of those 5 to **Rejected** (with the reject
  confirmation, comment required) calls E4's reject action (`ecn:approve`); dragging an **Implementation** card
  to **Closed** calls `close` (`ecn:manage`); **dragging a Rejected card back to Draft calls `resubmit`
  (`ecn:manage`, §0b D3)** — **Closed** is the board's only fully terminal column, no outgoing drag from it ever;
  **Rejected** allows exactly this one outgoing drag, back to **Draft**, and none other. Dragging to any
  non-adjacent column (including any drag out of Rejected other than to Draft) is rejected client-side before
  any API call (the API is the real guard regardless, via `ecnMachine`).
- Permission: viewing the board needs `ecn:view`; dragging out of **Draft**, **Implementation**, or **Rejected**
  needs `ecn:manage`; dragging out of any of the 5 gated columns needs `ecn:approve` — a caller lacking the
  needed capability for a given column sees no drag handle on its cards at all (rule 10, no control that looks
  interactive but silently 403s), not a visually-disabled one.
- Empty: a column with zero cards renders its header with `0` and no card list, never omitted entirely (all 9
  columns always render, matching the jsx's own "closed: []" empty-array precedent for its own mock).

AC
1. No new route for the 5 gated columns' drag-to-advance — it calls the same `POST /v1/ecns/:id/approvals/:stage`
   route E4 defines, `lockVersion`-guarded exactly as a click-to-approve would be. Draft/Implementation drags
   call E1's `submit`/`withdraw`/`close` routes (`ecn:manage`, §0 B1); **a Rejected→Draft drag calls the new
   `resubmit` route (`ecn:manage`, §0b D3)** — same `lockVersion` guard on every one. Any 409 (stale
   `lockVersion` — someone else moved it first) snaps the card back to its server-confirmed column with a
   toast, never leaves it optimistically misplaced.
2. Column counts come from `GET /v1/ecns/summary` (new, `ecn:view`) — `count(*) group by stage`, all 9 values
   always present (0 for an empty stage, incl. `ppap`), mirroring the KPI-summary precedent every prior sprint's
   module uses for the same "cursor list can't total itself" reason.

**Web/Mobile/Shared:** Web (`EcnKanbanPage`, drag-and-drop reusing whatever DnD primitive the codebase already
uses elsewhere — none currently exists for a kanban board in this app; if no existing DnD library is already a
dependency, this sprint adds one, capability-gated per column so a caller without that column's capability sees
a real, non-interactive card, not a broken drag handle). Mobile: unaffected. Shared: `EcnSummaryDto` in
`packages/types` (9 stage keys, incl. `ppap`).

### E3 — Create an ECN via the CreateWizard

**Design:** ROADMAP §0 Q1 ("CreateWizard replaces the create dialogs everywhere; CAPA keeps its dialog");
`qms-modules.jsx:538` "New ECN" button (bare `kToast`, no field list drawn at all — unlike risk's precedent,
which at least implied its fields via other evidence; ECN's Details-step fields below are inferred entirely
from `ecns`' own schema, §5 flags the board as needed).

UC
- Happy: "New ECN" opens `/create/ecn` (Type pre-selected → Details → Review, a 3-step branch — ECN's single
  `owner` column doesn't fit the shared multi-role Assignees step, exactly mirroring risk's R4 precedent) →
  creates a real ECN at `stage: 'draft'`, navigates to `/ecn?id=<uuid>`.
- Not a dedicated wizard (unlike MSA's or the instrument form's exception, §1a of Sprints 04/05): ECN's fields
  (`title`, `changeType`, `description`, `changeRisk`, `effectiveDate`, `owner`) are flat, single-entity, no
  cascading-select — the exact shape that already fit CreateWizard for risk (Sprint 04 R4). No blocking reason
  exists to make ECN an exception the way MSA/instrument were.

AC
1. Details-step fields: `changeType` (required select, 4 values), `title` (required text), `description`
   (textarea, optional at create, defaults `''`), `changeRisk` (required select, 3 values), `effectiveDate`
   (optional date picker), `owner` (single-select, captured in this same step — skips the shared Assignees
   step, mirroring risk's R4 precedent exactly for the same reason: a single-column `owner`, not a multi-role
   assignee set).
2. `ecn` is a real entry in `packages/core/src/create-wizard.ts`'s `WizardType` union, `WIZARD_TYPE_ORDER`, and
   `WIZARD_TYPES` map (capability `ecn:manage`, `hasPriorityAndDue: false`, `templates: []`) — a real 6th
   option in both the global quick-create menu and the Type-step card grid (mirrors risk's exact precedent).
   `WIZARD_ICON`/`WIZARD_COLOR` gain a 6th entry — icon `GitBranch` (matches `navigation.ts`'s existing ECN nav
   glyph) and a color from the existing wizard palette, distinct from the other 5 cards.
3. Created ECN gets a real `ECN-YYYY-NNNN` code, sequence-generated via `codes.ts` + `counters`.

**Web/Mobile/Shared:** Web only (wizard extension, Details-step fields, 3-step branch for `ecn`). Mobile:
unaffected. Shared: none beyond E1's types (`WizardType` union lives in `packages/core` but has no mobile
consumer this sprint).

### E4 — Full lifecycle: submit, multi-stage approval, close, withdraw, resubmit, four-eyes

**Design:** the "multi-stage approval workflow" the `ECNWorkbench` header text names; the progress bar in
`ECNList`; the implied but undrawn detail view P19 §3 itself calls for ("ECN detail: multi-stage approval
tracker, affected-records via entity-links"). **No jsx board exists for this detail view** — flagged §5,
mirrors C3's exact situation. **Revised end to end per §0 B1/B2/S2 and §0b D1/D3** — the pre-amendment version
only covered 4 gated stages with no `draft`/`closed`/`rejected` routes at all; this version covers 5 gated
stages (adding `ppap`) and a real `rejected→draft` resubmission loop.

UC
- **Submit (§0 B1):** an ECN's author (`ecn:manage`) submits a `draft` ECN, moving `stage` to `feasibility` —
  this is the moment every member holding `ecn:approve` (except the ECN's own `owner`/`created_by`, §0 S7) is
  notified that approval is pending, **not at creation** (X1 AC7's old "at creation" contradiction, closed).
- **Withdraw (§0 B1):** an ECN's author (`ecn:manage`) withdraws a `draft` ECN, moving `stage` to `rejected` —
  no four-eyes decision applies here (no `ecn_approvals` row exists for `draft`); this is a self-service cancel,
  not an approval.
- Happy: an ECN at one of its 5 gated stages (`feasibility`/`risk_review`/`ppap`/`cab_approval`/`pilot`, §0b
  D1) shows an approval tracker (5 rows: stage name, decision, approver, decided-at) in its detail view; an
  `admin`/`manager` who is not the ECN's `owner` **or `created_by`** approves the current stage, advancing
  `stage` to the next one in `ECN_STAGE_ORDER` (§3.2) — reaching `implementation` (from `pilot`) triggers E5's
  auto-revise mechanism in the same transaction. (`ppap`'s own gate has no side effect of its own — it is a
  plain fifth approval like `feasibility`/`risk_review`/`cab_approval`, §0b D1.)
- Reject: any of the 5 gated stages can be rejected instead of approved, moving `stage` to `rejected` — the
  ECN's Kanban card lands in the "Rejected" column (E2's correction), from where it can be resubmitted (below).
- **Close (§0 B1):** an ECN at `implementation` is closed (`ecn:manage`) by anyone with manage access — not a
  four-eyes decision (closing formalizes that the change is fully rolled out, it isn't a second sign-off).
- **Resubmit (new, §0b D3):** an ECN's author (`ecn:manage`, not owner-restricted — matches
  `documentMachine`'s own unrestricted `rejected→draft` precedent) resubmits a `rejected` ECN, moving `stage`
  back to `draft`. In the same transaction, every one of the ECN's 5 `ecn_approvals` rows resets to
  `decision='pending'`/`approver=NULL`/`decided_at=NULL`/`comment=NULL` (a resubmitted ECN needs fresh sign-off
  at every gate — it never carries forward a stale pre-rejection approval), and `owner` becomes `PATCH`able
  again (E1 AC3) — genuinely back in `draft`, not a partially-reopened state. Not a four-eyes decision (no
  `ecn_approvals` row exists for `draft`, same reasoning as `withdraw`).
- Self-approval/rejection blocked, both, not just approval (§0 B2): the ECN's own `owner` **or `created_by`**
  attempting to approve **or reject** any of the 5 gated stages gets 403 (four-eyes, deliberately stricter than
  `documentMachine`'s own approve-only guard, stated as such) — this guard does **not** apply to `resubmit`
  (§0b D3a, matching `documentMachine`'s own unguarded `rejected→draft`).
- Wrong stage: approving/rejecting a stage that isn't the ECN's *current* stage 422s ("stage X is not the
  current pending stage") — you cannot approve stage 4 while the ECN sits at stage 3, and cannot re-approve an
  already-decided stage; resubmitting an ECN that isn't currently `rejected` 422s the same way.
- Permission: `ecn:approve` required for approve/reject (admin/manager only — mirrors `document:approve`'s
  exact grant, §1a); `submit`/`withdraw`/`close`/`resubmit` need only `ecn:manage`; `ecn:manage` alone
  (auditor) can view the tracker but gets 403 attempting to approve/reject, matching how auditor holds
  `document:view` but not `document:approve` today.

AC
1. `ecn_approvals` (migration `0072`): `tenant_id`, `id`, `ecn_id` composite FK → `ecns(tenant_id, id)` ON
   DELETE CASCADE, `stage` enum (**the 5 gated values — `feasibility\|risk_review\|ppap\|cab_approval\|pilot`,
   §0b D1**), **no `role_required` column (§0 S8 — dead field: no service method anywhere reads a stored value
   for this; confirmed no other table in this codebase has a `role_required` column at all)** — the fixed,
   uniform admin/manager-only rule (Q30, unchanged) is enforced entirely in `ecnMachine`'s guard, `decision`
   enum (`pending\|approved\|rejected`) DEFAULT `pending`, `approver` (composite member FK, NULL until
   decided), `decided_at` timestamptz NULL, `comment` text NULL, standard audit columns. Forced RLS, leading
   `tenant_id` index, unique `(tenant_id, ecn_id, stage)`. All **5** rows are pre-created (all `pending`) in the
   same transaction as `POST /v1/ecns` (E3), so "what stage is this ECN on" is always answerable by joining
   `ecns.stage` to its matching row.
2. **Exact statement order (§0 S2):** `POST /v1/ecns/:id/approvals/:stage` (`ecn:approve`) body
   `{ decision: "approve" | "reject", comment? }`, and `lockVersion`. Guards, in order: (a) actor ≠
   `ecns.owner` **and** actor ≠ `ecns.created_by` (403 — four-eyes, both directions, §0 B2); (b) actor role ∈
   {`admin`,`manager`} (403 otherwise). Then, in one statement: `UPDATE ecns SET stage = $next WHERE id = $1 AND
   lock_version = $lockVersion AND stage = $currentGatedStage` (optimistic concurrency + "is this really the
   current stage" guard together; no matching row → a follow-up read distinguishes 409 stale-lockVersion from
   422 wrong-stage). Then: `UPDATE ecn_approvals SET decision=$d, approver=$actor, decided_at=now(), comment=$c
   WHERE ecn_id=$1 AND stage=$stage AND decision='pending'`. Then, only on the specific `pilot→implementation`
   transition: E5's auto-revise runs (unaffected by `ppap`'s insertion earlier in the pipeline — `ppap` sits
   between `risk_review` and `cab_approval`, nowhere near the `pilot→implementation` edge, §0b D2). On `reject`:
   `comment` is required (a rejection must carry a reason); `ecns.stage` moves to `rejected` instead of the
   next value. Both `status_changed` on the `ecns` row (the stage transition) **and** `updated` on the
   `ecn_approvals` row (the decision itself) are audited — a real two-entity audit split, not a single
   ambiguous event.
3. `POST /v1/ecns/:id/submit` (`ecn:manage`, `lockVersion`) — `UPDATE ecns SET stage= 'feasibility' WHERE id=$1
   AND lock_version=$v AND stage='draft'` (422 if not currently `draft`), audited `status_changed`; the same
   transaction notifies every `ecn:approve` holder except `owner`/`created_by` (§0 S7). `POST
   /v1/ecns/:id/withdraw` (`ecn:manage`, `lockVersion`) — same shape, `draft→rejected`, audited
   `status_changed`. `POST /v1/ecns/:id/close` (`ecn:manage`, `lockVersion`) — `implementation→closed`, audited
   `status_changed`.
4. **New (§0b D3):** `POST /v1/ecns/:id/resubmit` (`ecn:manage`, `lockVersion`) — in one transaction: `UPDATE
   ecns SET stage='draft' WHERE id=$1 AND lock_version=$v AND stage='rejected'` (422 if not currently
   `rejected`, 409 on stale `lockVersion`), then `UPDATE ecn_approvals SET decision='pending', approver=NULL,
   decided_at=NULL, comment=NULL WHERE ecn_id=$1` (all 5 rows, unconditional — every gate needs fresh sign-off,
   §0b D3b). Audited as a single `status_changed` event on the `ecns` row, whose `after` payload records the
   reset (the ids of the 5 `ecn_approvals` rows it cleared) — mirroring E5's own established precedent of
   folding a fan-out side effect into the triggering event's own payload rather than emitting one audit row per
   affected child row. No four-eyes guard (§0b D3a) — any `ecn:manage` holder, including the ECN's own `owner`
   or `created_by`, may call it.
5. 409 on a stale `lockVersion` (rule 6, every route in this story); cross-tenant ECN id → 404, not 403
   (rule 8).
6. `GET /v1/ecns/:id/approvals` (`ecn:view`) — the 5-row tracker, read-only, for the detail view.

**Web/Mobile/Shared:** Web (interim ECN detail view w/ 5-row approval tracker, flagged §5; submit/approve/
reject/close/withdraw/resubmit actions, capability-gated visibly not just server-side). Mobile: unaffected.
Shared: migration `0072`'s `ecn_approvals` table (5 gated `stage` values, no `role_required` column);
`EcnApprovalDto`/`DecideEcnApprovalBody` in `packages/types`.

### E5 — Affected documents/suppliers + real auto-revision on implementation

**Design:** `ECNWorkbench` header text, "auto-revises affected documents"; `ECNList`'s `eff` column ("18
docs," etc. — an affected-record count). **Timing decided, not open (§0b D2):** auto-revise fires exactly where
§3.2 originally specified — on `pilot→implementation`, never earlier — the jsx's own documents-before-pilot row
ordering is confirmed to be another mock inaccuracy, not a real sequencing signal; `ppap`'s insertion elsewhere
in the pipeline (between `risk_review` and `cab_approval`, §0b D1) has no bearing on this trigger point.

UC
- Happy: an ECN's detail view lets an author (`ecn:manage`, only while `stage` is `draft` through `pilot`,
  **tightened from "pre-implementation," §0 S2** — every terminal/post-pilot stage named explicitly) link
  affected documents and suppliers via the existing `entity_links` mechanism (reuses R3's `LinkPicker`
  component from Sprint 04, generic over `kind`, scoped here to `document`/`supplier` — **not** `part`, since
  no `parts` table/`EntityKind` exists anywhere in this codebase, §1a; "affected parts" is not buildable this
  sprint and is not silently faked as a picker that links to nothing real).
- **Unlink (new, §0 B4):** the same author can remove a link, but only through a dedicated ECN route, gated the
  same way as adding one (`ecn:manage` + stage `draft`-`pilot`) — the generic `/v1/entity-links/:id/delete`
  route cannot be used to strip an ECN→document link after `implementation`, closing a real bypass of E5's own
  stage-freeze.
- Auto-revise, real mechanism (not hand-waved, CLAUDE.md rule 0/10): the moment E4's approval route advances
  an ECN's `stage` to `implementation` (from `pilot`, the last gated stage), in the **same transaction**, for
  every `document`-kind `entity_links` row attached to this ECN (exact scope, §0 B3e: `WHERE from_kind='ecn'
  AND to_kind='document' AND from_id=:ecnId`), the service calls `DocumentsService.newVersion` for real (the
  existing, confirmed-callable method, §1a) — **`fileId: <the document's own current file_id>`, read before the
  call, never `null` (§0 B3a — the old spec's `fileId: null` would have detached the document's live file)**,
  **`ownerId: <the document's own current owner_id>`, read before the call, passed via `newVersion`'s new
  optional `ownerId` parameter (§0 B3b — without it, `newVersion` defaults to `owner_id = actorId`, which would
  silently hand every revised document's ownership to whichever approver triggered `implementation`; this
  sprint explicitly preserves the document's existing owner instead)**, `nextVersion` computed by a new pure
  `packages/core/src/version-bump.ts`
  `bumpMinorVersion(version: string): string` (parses a numeric-dot `"X.Y"` string and increments `Y` by 1 —
  unit-tested, including the malformed-input case below), `changelog: "Auto-revised by ${ecn.code}
  implementation"`.
- Partial-failure honesty (rule 0/10 — never a silent partial success), **each attempt isolated (§0 B3c)**: for
  each linked document, "not currently approved" and "version already exists" are **pre-checked by reading the
  row first** (named skips `not_approved`/`version_exists`, never relying on catching those specific errors);
  the actual `newVersion` call then runs inside its own `SAVEPOINT` (precedent: `purgeRow` in
  `apps/api/src/jobs/processors/purge-soft-deleted.ts:152-190`, confirmed real), so a genuine race (the
  document changed between the pre-check read and the call, surfacing as `newVersion`'s stale-write 409) rolls
  back only that document's attempt (`ROLLBACK TO SAVEPOINT` + `RELEASE`, skip reason `concurrent_modification`)
  — never the whole ECN transaction. `bumpMinorVersion` rejecting a malformed `"X.Y"` version string is also a
  named pre-check skip (`bad_version_format`). The ECN's own `stage` advance to `implementation` **always**
  commits regardless of any document's outcome; the full revised/skipped list is surfaced as a real, visible
  warning ("2 of 3 affected documents were auto-revised; 1 was skipped — Document DOC-2026-0031 is not
  currently approved, revise it manually"), never silently dropped, and **persisted** (below), not just
  returned once.
- Permission: linking/unlinking needs `ecn:manage`; the auto-revise itself runs as a side effect of E4's
  `ecn:approve` action, not a separately callable route.

AC
1. `POST /v1/ecns/:id/link` (`ecn:manage`) body `{ kind: "document" | "supplier", targetId }` — takes
   `SELECT ... FOR SHARE` on the parent `ecns` row first (§0 S2 — prevents a concurrent approve from advancing
   the stage mid-link), writes a real `entity_links` row (`from_kind='ecn'`, `to_kind=kind`), audited `linked`
   (existing action, no new enum value). 422 once `stage` is `implementation`, `closed`, or `rejected`
   (tightened from "past pilot" to name every terminal/post-pilot stage explicitly, §0 S2) — the affected-set is
   frozen at the moment auto-revision fires, so a link added after the fact can't retroactively claim to have
   been auto-revised.
2. **New (§0 B4):** `POST /v1/ecns/:id/links/:linkId/delete` (`ecn:manage` **and** `stage` ∈ `draft`..`pilot`,
   else 422) — removes the `entity_links` row, audited `unlinked` (existing action enum value, confirmed
   `packages/types/src/enums.ts:422`). This is the *only* way to remove an ECN's own link — the generic
   `/v1/entity-links/:id/delete` route no longer suffices for this stage-freeze guarantee.
3. `GET /v1/ecns/:id/links` (`ecn:view`) — the affected-records list, reusing the existing `entity_links` read
   pattern + label resolution (Sprint 04 R3's `label` field).
4. The `implementation`-transition auto-revise logic lives in `EcnService`, calling `DocumentsService.
   newVersion` directly (real reuse, not a reimplementation, with its new optional `ownerId` param, §0 B3b) for
   each linked document, each attempt in its own `SAVEPOINT` (§0 B3c). Each outcome (`revised` /
   `not_approved` / `version_exists` / `bad_version_format` / `concurrent_modification`) is collected into
   `autoRevise: { revised: string[]; skipped: { documentId: string; reason: string }[] }`, **written to
   `ecns.auto_revise_result` (§0 B3d) and into the `status_changed` audit event's `after` payload in the same
   transaction** — not only returned in the one-time approval HTTP response. `GET /v1/ecns/:id` (`EcnDto.
   autoReviseResult`) exposes it afterward, so the detail view can show it on any later visit, not just the
   moment it happened.
5. Cross-tenant target id on `POST /v1/ecns/:id/link`(`/links/:linkId/delete`) → 404, not 403 (rule 8) — the
   existing `assertEntityVisible` pattern, unchanged.

**Web/Mobile/Shared:** Web (`LinkPicker` reused at a new ECN call site, scoped to `document`/`supplier`, with a
real remove affordance calling the new unlink route; the persisted `autoReviseResult` rendered as a real
banner in the ECN detail view, not swallowed, in addition to the one-time approval toast). Mobile: unaffected.
Shared: `packages/core/version-bump.ts` (pure, unit-tested); a small, additive, optional `ownerId` parameter on
`documents.service.ts`'s `NewDocumentVersionBody`/`newVersion` (§0 B3b — every existing caller is unaffected,
confirmed by reading `documents.controller.ts`'s own route, which never passes it); `EcnLinkBody`/
`AutoReviseResult` in `packages/types`; `ecns.auto_revise_result jsonb` (migration `0072`).

### X1 — Cross-cutting wiring (RBAC, nav, search, graph, realtime, notifications)

**Design:** ROADMAP §8's standing rules — every new module wires into `navigation.ts` (already present, §1a),
`rbac.ts`, palette nav, `entity-routes.ts`, search KINDS, realtime topics, notifications, audit events, graph
node kinds.

UC
- An admin/manager/auditor sees `Customer complaints`/`Engineering changes` in the sidebar and command
  palette; a viewer sees both, read-only; an inspector sees neither (§1 role decision). Search hits for a
  complaint/ECN by subject/title keyword appear in the command palette. A second approver's ECN Kanban board
  refreshes live when a colleague approves a stage. Notifications fire for SLA risk/breach (complaints) and
  pending-approval reminders (ECN).

AC
1. `packages/core/src/rbac.ts` `Capability` gains `complaint:view`/`complaint:manage`/`ecn:view`/`ecn:manage`/
   `ecn:approve`. Grants: admin/manager = all 5; auditor = `complaint:view`/`complaint:manage`/`ecn:view`/
   `ecn:manage` (**not** `ecn:approve`, mirrors `document:approve`'s admin/manager-only grant exactly);
   inspector = none of the 5 (§1 role decision, reasoned, not an oversight); viewer = `complaint:view`/
   `ecn:view` only; partner = none.
2. `apps/web/src/config/rbac.ts` `ROLE_NAV`: auditor's `Set` gains `complaints`/`ecn`; viewer's `Set` gains
   `complaints`/`ecn`; inspector's `Set` is **not** changed (deliberate).
3. `apps/web/src/lib/entity-routes.ts` `entityHref`/`entityIcon`/`entityLabel` gain `complaint` →
   `/complaints?id=` (icon: `MessageSquare`, matching `navigation.ts`'s existing complaints glyph) and `ecn` →
   `/ecn?id=` (icon: `GitBranch`, matching `navigation.ts`'s existing ECN glyph). **Also (§0 S3, confirmed
   missed by the original wiring):** `document-detail.tsx`'s own local `ENTITY_ROUTE`/`ENTITY_LABEL` maps
   (`document-detail.tsx:53,78`) and `capa-detail.tsx`'s own local `ENTITY_ROUTE`/`ENTITY_LABEL` maps
   (`capa-detail.tsx:51,69`) — both separate `Record<EntityKind,...>` maps from `entity-routes.ts`'s shared
   helpers, both force-widened by `EntityKind` gaining two members, both need the same `complaint`/`ecn`
   route+label entries added by hand.
4. **`assertEntityVisible` (`apps/api/src/collab/entity-ref.ts`) now also enforces a per-kind capability (§0
   B4):** `ENTITY_TABLES` becomes `{ table, capability }` per kind (reusing the same capability strings
   `entity-links.service.ts`'s `LABEL_CONFIG` already carries) — a caller lacking the kind's own `:view`
   capability 404s (never 403, rule 8), closing the real exposure that opens up the moment `EntityKind` gains
   `complaint`/`ecn` (the first two kinds a real internal role, inspector, doesn't hold `:view` for — confirmed
   zero behaviour change for the 11 existing kinds, every internal role already holds all of their `:view`
   capabilities today). `comments.controller.ts` now passes `membershipOf()` through to `comments.service.ts`'s
   `list`/`create` (which previously called `assertEntityVisible` with no membership at all, `comments.
   service.ts:110,135`, confirmed — no plant-scope check either) so comments get both checks entity-links
   already had. `apps/api/src/collab/entity-ref.ts` `ENTITY_TABLES` gains `complaint: { table: "complaints",
   capability: "complaint:view" }`, `ecn: { table: "ecns", capability: "ecn:view" }`.
   `apps/api/src/ai/chat.ts` `ENTITY_SPECS` gains `complaint: { table: "complaints", label: "subject",
   plantScoped: false, view: "complaint:view" }` (**`label: "subject"`, the real column — §0 S3, matches B5's
   fix — not `"title"`, which the complaints schema doesn't have**) and `ecn: { table: "ecns", label: "title",
   plantScoped: false, view: "ecn:view" }`. `apps/web/src/features/graph/graph-kinds.ts` `GRAPH_KINDS`
   gains both (TS-forced total-map completeness) but **neither renders in the graph explorer** —
   `apps/api/src/graph/graph.service.ts`'s own separate literal array is not widened this sprint, mirroring
   Sprint 04's Q27 judgment call exactly (logged §7, not silently claimed as done).
5. `packages/types/src/dto.ts` `SearchEntityKind` gains `complaint`/`ecn`; `apps/api/src/search/search.
   service.ts`'s `KindConfig` gains two new fields **(§0 B5)**: `capability: Capability` (checked in `search()`
   before a kind is queried at all — a caller lacking it never reaches `queryKind` for that kind, the same
   fix-class as item 4 above) and `titleColumn: string` (defaults `"title"` for every existing kind, unchanged);
   `KINDS` gains `complaint: { table: "complaints", plantScoped: false, capability: "complaint:view",
   titleColumn: "subject" }` (**`titleColumn: "subject"`, not the hard-coded `"title"` `queryKind` selects
   today — confirmed complaints has no `title` column, this would have errored at runtime**) and
   `ecn: { table: "ecns", plantScoped: false, capability: "ecn:view", titleColumn: "title" }`; `queryKind`'s SQL
   interpolates `titleColumn` (still safe — hard-coded map, never user input) and aliases it back to `title` so
   `SearchResultDto`'s shape is unchanged. `AUDIT_HIDDEN_ROLES`-style role exclusion is **not** additionally
   needed for either new kind (the new `capability` check already covers it).
6. `packages/types/src/realtime.ts` `RealtimeTopic` gains `complaint`/`ecn`; `apps/api/src/realtime/audit-
   signal.ts` `ENTITY_TOPIC` gains `complaint: { topic: "complaint", capability: "complaint:view" }`,
   `complaint_attachment: { topic: "complaint", capability: "complaint:view" }`, `ecn: { topic: "ecn",
   capability: "ecn:view" }`, `ecn_approval: { topic: "ecn", capability: "ecn:view" }`.
7. Notifications: the complaint SLA check **rides the existing `sla.sweep` job (`SLA_SWEEP_CRON`, every 5
   minutes, `job-types.ts:140`, confirmed) — no new daily job (§0 B7a)** — and notifies a complaint's `owner`
   when `complaintSlaState` crosses into `at_risk` or `breached` for the still-unacknowledged response leg,
   cycle-tied dedupe key `complaint-sla:<complaintId>:<slaState>` (mirrors Sprint 05 B4's cycle-tied dedupe fix
   — re-notifies once per state transition, not forever-silent after the first); a closed complaint's frozen
   SLA state (§0 B7b) is excluded from the sweep entirely once `closed_at` is set. ECN approval-pending
   notifications are **synchronous, not a sweep**: the moment `ecns.stage` advances to `feasibility` — **via
   the new `submit` route (§0 B1), never "at creation"** — every member holding `ecn:approve` in the tenant
   **except the ECN's own `owner` and `created_by` (§0 S7 — they shouldn't be told their own ECN needs someone
   else's sign-off)** is notified (a broadcast, since "who approves" is role-based, not a named individual, the
   fixed admin/manager-only rule, §1a/E4 AC1) — reuses the existing `NotificationsService`, not a new mechanism.
8. `placeholder-ledger.ts` loses `"planned:complaints"`/`"planned:ecn"`; both removed from `PLANNED_MODULES`.

**Web/Mobile/Shared:** Shared (rbac.ts, entity-ref.ts, entity-links.service.ts, comments.service.ts/
comments.controller.ts, chat.ts, graph-kinds.ts, dto.ts, search.service.ts, realtime.ts, audit-signal.ts — no
new job, wired onto the existing `sla.sweep` processor) + Web (rbac.ts ROLE_NAV, entity-routes.ts,
document-detail.tsx, capa-detail.tsx, placeholder ledger, planned-modules). Mobile: unaffected; `pnpm --filter
@kaenal/mobile typecheck` stays green (every touched shared type is additive).

---

## 3. Backend design — PROPOSED, NEEDS EXPLICIT USER SIGN-OFF (P18 + P19)

*(This is the section to extract and present alone for approval, per ROADMAP §0 Q2 — mirrors Sprints 03/04/05's
own practice. NO code for either module is written until this is approved.)*

### 3.1 Customer complaints (P18) — resolving both of P18's own open questions

**P18's open question 1 — "email/EDI auto-intake in scope now, or manual-only first?" Proposed: manual-only.**
None of the jsx's 5 "Intake channels" (public web form, customer portal/EDI, email parser, phone, customer
extranet API) has any real integration, parser, or public-facing endpoint anywhere in this codebase (§1a), and
building even one (an unauthenticated public complaint-submission form needs rate-limiting, CAPTCHA/abuse
protection, and a genuine customer-portal auth story none of which is specified anywhere) is exactly the class
of vendor/external-infra work ROADMAP Q5 defers to Sprint 13 — mirrors Sprint 05's own LMS-connector exclusion
(§1a of that sprint) precisely. **Proposed:** this sprint builds **manual intake only** — an authenticated
tenant user (admin/manager/auditor) logs a complaint on the customer's behalf via `IntakeForm`, selecting which
`channel` the complaint actually arrived through (portal/email/web-form/EDI/phone — the enum still models all
5 real-world channels; only the *automated ingestion* of 4 of them is out of scope, not the data model). The
"Intake channels" card and "Public intake form" button are reproduced as **honest, real, non-interactive
reference content** — a static status card the tenant's admin can see today's manual-only posture on — rather
than either a fake "Connect" button (rule 10) or silently dropping the drawn card (rule 9). This is flagged
plainly as a real exclusion, not disguised (§7).

**P18's open question 2 — "SLA clock on complaints?" Proposed: yes**, reusing `packages/core/src/sla.ts`'s
existing `SlaState` type and business-hours-aware philosophy (not a new mechanism, §1a) — but with the SLA
matrix's own two distinct target *shapes*, both taken as fixed config this sprint (not yet tenant-configurable
— P18 doesn't ask for configurability, and no settings screen exists yet to hold it):

| Severity | Acknowledge target (`sla_target_hours`) | Close target (`sla_close_target_days`) |
|---|---|---|
| Critical | 1 | 14 |
| High | 4 | 21 |
| Medium | 24 | 45 |
| Low | 48 | 90 |

The **acknowledge** target drives `complaintSlaState` (C1 AC5) — a plain elapsed-hours comparison, not routed
through `computeDueAt`'s business-hours machinery, because the SLA matrix names the acknowledge target in
plain hours with no stated business-hours qualifier (unlike NCR's `respondHours`, which *is* explicitly
business-hours-scoped in 03 §10) — a critical field-failure complaint doesn't stop its 1-hour clock overnight.
**Corrected for internal consistency (§0 B7d):** `packages/core/src/sla.ts`'s `computeDueAt` is confirmed, by
reading the whole file, to be inherently business-hours-aware with no plain-elapsed-hours mode (it always
routes through `addBusinessHours`) — so the complaint ack-clock correctly never calls it at all; only
`SlaState` (the `on_track\|at_risk\|breached` **type**, and its general philosophy) is reused from `sla.ts`,
not its business-hours *machinery*, and this sprint's `complaintSlaState` reuses the same, already-existing
`AT_RISK_THRESHOLD` constant (**0.8**, confirmed at `sla.ts:163` — not a new, second 75% constant). The
complaint SLA check runs on the **existing** `sla.sweep` job cadence (`SLA_SWEEP_CRON`, every 5 minutes,
confirmed `job-types.ts:140`) — a once-daily job cannot serve a 1h/4h acknowledge target — and freezes at
`closed_at` once a complaint closes (never recomputed against a later `now` for a closed complaint). The
**close** target is a plain calendar-day count (`received_at + N days`), shown as a KvField in the detail
panel and used only for display, not a hard block on anything this sprint (P18 names no "auto-escalate on
close-breach" behavior, so none is invented). The SLA matrix's own "8D required" column is reproduced as
**informational display copy only** this sprint (e.g., "Critical: 8D suggested within 4h") — not an enforced
gate (nothing blocks a critical complaint from staying un-8D'd), since P18 doesn't ask for enforcement and none
of NCR/CAPA/8D has a comparable "you must open one of these" hard rule to mirror.

**The one field this sprint adds beyond what `IntakeForm` draws, flagged plainly (not invented decoration):**
`contact` (a single free-text field) and `channel` (a required select) are added to the intake dialog because
P18 §1 names both as required intake data and the list view's own columns display both for every row — the
drawn dialog simply omits inputs for data it needs to have collected (§1a). This mirrors Sprint 04 B1's own
precedent (adding `owner` to risk's undrawn Details step) exactly — a minimal, evidenced, necessary addition,
not scope invention.

**What the user is being asked to approve:** the `complaints`/`complaint_attachments` schema (§2 C1 AC1); the
**composite-FK** (not plain — corrected §0 S1) convert-link mechanism, extended to a third target (8D) via two
new, unconstrained `eight_ds.source`/`source_id` columns and a real "link to an existing NCR" capability (§2
C4 AC1, §0 B8c); manual-only intake this sprint, with the 4 automated channels and the public/portal screens
explicitly excluded (not built, not faked); the SLA table above (1h/4h/24h/48h ack, 14/21/45/90d close) as
fixed config, checked on the existing 5-minute SLA sweep (not a new daily job) and using the existing 0.8
at-risk threshold (§0 B7, corrected from the originally-approved daily-job/75% description); the cohort-based
"< 24h response %" formula (§2 C1 AC3); the `contact`/`channel` fields added to the intake dialog; and
`customer_color` computed on read, not stored (§0 S6, corrected from a stored column).

### 3.2 ECN (P19) — the canonical stage/approval machine, resolving the jsx's own internal conflict

**The problem, stated plainly (§1a):** `ECNList` implies a 6-step numbered pipeline with 4 named labels
("Risk review" 3/6, "CAB approval" 4/6, "Doc revision" 5/6, "Pilot run" 6/6); `ECNKanban` implies a 7-column
pipeline (draft, feasibility, risk-review, cab, pilot, impl, closed) with no "Doc revision" column and no
reject path; P19 §2 proposes a 5-value `status` enum matching neither. These three sources cannot all be
literally correct at once, and P19 §5 itself explicitly asks "number/identity of approval stages: fixed vs
configurable?" as an open sign-off question — this section proposes the resolution, using the more complete
of the two jsx sources (`ECNKanban`'s named, structural column set) as the backbone, reconciling `ECNList`'s
"Doc revision" label, and closing the missing reject path.

**Proposed canonical pipeline, now including the real `ppap` gate (§0b D1):**

`draft → feasibility → risk_review → ppap → cab_approval → pilot → implementation → closed`, with **every**
pre-`implementation` stage able to move to a terminal `rejected` state instead of advancing, and `rejected`
itself able to move back to `draft` via resubmission (§0b D3, below). **Every transition has a named, callable
route (§0 B1 — the version approved 2026-09-30 only covered the 4 gated transitions; `draft→feasibility`,
`implementation→closed`, and `draft→rejected` had no route at all):** `draft→feasibility` via `POST
/v1/ecns/:id/submit` (`ecn:manage`); `draft→rejected` via `POST /v1/ecns/:id/withdraw` (`ecn:manage` — an
author cancelling their own draft, not a four-eyes decision, since no `ecn_approvals` row exists yet at
`draft`); **`rejected→draft` via `POST /v1/ecns/:id/resubmit` (`ecn:manage`, §0b D3, below)**; the 5 gated
stages' approve/reject via `POST /v1/ecns/:id/approvals/:stage` (`ecn:approve`); `implementation→closed` via
`POST /v1/ecns/:id/close` (`ecn:manage`). The Kanban's drag action is named for every one of the 9 columns (E2,
revised) — no column is left without a defined drag behavior.

**PPAP — decided as a real 5th approval gate, not a mock error (§0b D1):** `ECNList`'s row `ECN-2026-0180`
(`s: 'ppap', stl: 'PPAP', step: 4, of: 6`, §3.2a Q1) is confirmed by the user to be a genuine pipeline stage,
placed `risk_review → ppap → cab_approval` — PPAP (Production Part Approval Process, a real IATF 16949
production-readiness confirmation) logically precedes the Change Approval Board's own sign-off, and this
placement does not contradict P19 (which names no fixed stage count) or the rest of the jsx (`ECNKanban`'s
column set already omitted one real thing, "Rejected," before this sprint added it back — a missing "PPAP"
column there carries no more weight against PPAP being real than that omission carried against the reject
path). `ppap` is backed by its own `ecn_approvals` row and the same `admin`/`manager` four-eyes rule as the
other 4 gates — not a special case (§2 E4 AC1).

**Resubmission — `rejected → draft`, decided as in scope (§0b D3, closing Q33):** modelled directly on
`documentMachine`'s own real `rejected → draft` transition (`document.ts:17`, an unguarded transition in the
map) rather than inventing a new shape. `POST /v1/ecns/:id/resubmit` (`ecn:manage`, not owner-restricted —
matches documents' own precedent, which restricts this transition no further) moves `stage` back to `draft`
and, in the same transaction, resets every one of the 5 `ecn_approvals` rows to `pending` (a resubmitted ECN
needs fresh sign-off at every gate — no stale pre-rejection approval carries forward), audited as the ECN's own
`status_changed` event. `owner` becomes `PATCH`able again the moment `stage` returns to `draft` — the existing
"`owner` PATCHable only while `stage='draft'`" rule is stage-based, not a one-way ratchet, so resubmission
genuinely reopens it, exactly as it was open the first time the ECN was in `draft` (§2 E1 AC1/AC3).

**Reconciling `ECNList`'s "Doc revision" label:** this is **not** a genuine 7th human-approval stage — it is
`ECNList`'s own inaccurate depiction of what is actually the **auto-revise-documents side effect** (E5) that
fires automatically the moment `implementation` is reached. An ECN doesn't sit in a manual "Doc revision"
holding stage waiting for a person to act; the system revises the affected documents itself, in the same
transaction, the instant the pipeline reaches `implementation`. `ECNList`'s mock numbering was simply wrong to
show it as a 5th of 6 human steps — this is stated here as a found-and-corrected mock defect (same class as
Sprint 04's `R-NNN` code-format correction), not a silent reproduction of an inaccurate label.

**Human approval gates, exactly 5 (§0b D1 adds `ppap`):** `feasibility`, `risk_review`, `ppap`, `cab_approval`,
`pilot` — each backed by one `ecn_approvals` row (§2 E4 AC1). **Every gate requires the same role, `admin` or
`manager`** (fixed and
uniform this sprint, resolving P19's "fixed vs configurable" question as **fixed**, mirroring `documentMachine`'s
own admin/manager-only rule — the only real precedent this codebase has for "who signs off a controlled
change." A configurable, stage-specific role (e.g., "CAB requires admin only," "Pilot requires the plant
manager") is a real, named future enhancement (§7), not silently built now with no UI to configure it.

**Four-eyes, made explicitly stricter than documents (§0 B2 — the version approved 2026-09-30 claimed this
"mirrors `documentMachine`'s `forbidsSelfApproval` exactly," which was inaccurate: reading `document.ts:44-54`
in full confirms it only blocks self-*approval*, never self-*rejection*):** the approving/rejecting actor must
be `≠ ecns.owner` **and** `≠ ecns.created_by`, checked for **both** decisions, approve and reject. Also
corrected: `ecns.owner` is frozen the instant `stage` leaves `draft` — `PATCH /v1/ecns/:id` can no longer
reassign it at any time, which would otherwise let a creator hand ownership to someone else and then approve
their own ECN (the exact bypass this stricter rule and the freeze together close). This is a deliberate,
stated ECN-specific divergence from `documentMachine`, not a claimed exact mirror, and not a stronger "no two
stages decided by the same person" rule either (not asked for by P19, not built).

**`change_type` widened to 4 values (`design\|process\|tooling\|material`):** P19 §2 proposes only 3, but the
jsx's own `ECNList` fixture uses a 4th ("Material," `ECN-2026-0180`, a supplier bushing swap) and P19 §5 itself
independently confirms supplier-change ECNs are a real dependency ("Relates to: P08 — supplier change,
`linkedEcns`"). Proposed: `material` is added as a genuine 4th value, not silently dropped to match P19's
narrower list nor silently invented without justification.

**Reject path added (`ECNKanban` corrected to 9 columns, adding "Rejected" and "PPAP"):** the header text's own
claim of a "multi-stage approval workflow" necessarily implies a stage can be *rejected*, not only approved —
the jsx's Kanban simply never drew that column; separately, `ppap` (§0b D1) is a genuine 5th gated column the
board never drew either. Both flagged for the designer (§5) as real, evidenced additions to the board, not
invented ones.

**"Auto-revises affected documents" — the real mechanism (§2 E5), stated plainly for sign-off, corrected (§0
B3):** on the `pilot → implementation` transition, for every `entity_links` row of kind `document` attached to
the ECN (`WHERE from_kind='ecn' AND to_kind='document' AND from_id=:ecnId`), the service calls the **existing,
confirmed-callable** `DocumentsService.newVersion` (`documents.service.ts:358-409`, read in full) with
**`fileId` set to the document's own current `file_id`** (never `null` — the version approved 2026-09-30 said
`fileId: null`, which reading `newVersion`'s actual code confirms would detach the document's live file — a
real defect in the approved design, now fixed) and **`ownerId` set to the document's own current `owner_id`**,
passed through a new, small, additive optional parameter on `newVersion` (confirmed: without it, `newVersion`
unconditionally sets `owner_id = actorId`, which would silently hand the approving actor ownership of every
revised document — not previously stated, now decided explicitly: the document keeps its existing owner), and
a minor-bumped version string. A document that isn't currently `approved`, or whose version string isn't a
parseable `"X.Y"` format, is pre-checked and **skipped with a named reason, persisted (not just returned once)**
— and each document's actual revision attempt runs inside its own `SAVEPOINT` (the `purgeRow` pattern,
`purge-soft-deleted.ts:152-190`, confirmed real) so a document-level failure (including a genuine race caught
as `newVersion`'s own 409) rolls back only that document, never the ECN's own `implementation` transition. This
is proposed as real, working, transactional behavior — not a stub, not a "link-only" fallback — resolving
P19's own second open question ("is document auto-revision in scope for v1, or link-only?") as **yes, in
scope, real**, now with the file-detach and owner-reassignment defects the approved version carried both fixed.

**"Affected parts" is not buildable this sprint:** no `parts` table or `EntityKind` exists anywhere in this
codebase (§1a) — only `document`/`supplier` linking ships; a parts master table is out-of-scope invention this
sprint doesn't introduce.

**What the user is being asked to approve:** the `ecns`/`ecn_approvals` schema (§2 E1 AC1, E4 AC1, now without
`role_required`, a dead field, §0 S8); the canonical 7-stage-plus-rejected machine above, with the previously-
missing `submit`/`withdraw`/`close` routes making every transition drivable (§0 B1); the fixed, uniform
admin/manager-only approval-role rule; the stricter-than-documents four-eyes rule and the `owner`-frozen-after-
`draft` rule (§0 B2); the 4-value `change_type` enum (adding `material`); the real `DocumentsService.
newVersion`-based auto-revision mechanism, corrected to preserve the document's file and owner and to isolate
each document's attempt in its own `SAVEPOINT` (§0 B3); and the exclusion of "affected parts" linking (no real
target exists to link to). **Amendment 2 (§0b), now decided by the user and folded in above:** `ppap` as a real
5th approval gate placed `risk_review → ppap → cab_approval` (D1); the auto-revise trigger point confirmed
unchanged at `pilot→implementation` (D2); and `rejected → draft` resubmission via a new `resubmit` route,
resetting all 5 `ecn_approvals` rows and reopening `owner` (D3).

### 3.2a — jsx-fidelity questions found on a closer re-read — BOTH NOW RESOLVED (§0b, Amendment 2)

Re-reading `ECNList` (`qms-modules.jsx:549-591`) a second time, past what the first pass caught, surfaced two
more real inconsistencies between the jsx and the canonical machine §3.2 already proposes. The architecture
review's own instruction was not to silently resolve these the way the original §3.2 resolved "Doc revision" —
they went back to the user as explicit questions, and **the user has now decided both (2026-09-30, §0b)**:

1. **Is "PPAP" a real, distinct stage?** Row `ECN-2026-0180` (`qms-modules.jsx:562`) is shown at
   `s: 'ppap', stl: 'PPAP', step: 4, of: 6` — a stage name that appeared nowhere in P19, `ECNKanban`, or the
   original 6-stage machine this sprint proposed. Two readings were plausible: (a) "PPAP" is a genuine 7th
   pipeline stage the machine was missing; or (b) it's `ECNList`'s own mock error, the same class of defect as
   "Doc revision" already was, and this row simply meant `cab_approval`.
   **RESOLVED (D1): (a).** PPAP is a real, distinct 5th approval gate, placed `risk_review → ppap →
   cab_approval` — see §3.2's "PPAP — decided as a real 5th approval gate" paragraph above for the full
   placement rationale and the confirmation that it contradicts nothing else in P19 or the jsx. Cascaded
   through: `ECN_STAGE_ORDER` (§2 E1 AC2, 7 entries), the `stage`/`ecn_approvals.stage` enums (§2 E1 AC1, E4
   AC1), the approve/reject route's accepted-stage list (§2 E4 AC2, 5 values), the Kanban's column list (§2 E2,
   9 total), the approval tracker's row count (§2 E4 AC1/AC6, 5 rows), and the design follow-up naming one more
   Kanban column and one more tracker row (§5).
2. **Does documents-before-pilot row ordering mean auto-revise should fire earlier?** `ECNList`'s own row order
   places `ECN-2026-0182` ("Doc revision," step 5, line 560) **before** `ECN-2026-0181` ("Pilot run," step 6,
   line 561) — i.e., the mock's own numbering implies document revision happens *before* the pilot run, while
   §3.2 fires auto-revise **after** pilot, on `pilot→implementation`. Two readings were plausible: (a) the
   jsx's step-ordering is just an artifact of unrelated row sort order in a static fixture, not a real
   sequencing claim; or (b) documents should be revised earlier in the pipeline (e.g., on `cab_approval→pilot`).
   **RESOLVED (D2): (a).** The documents-before-pilot ordering is confirmed to be another instance of the same
   class of mock inaccuracy as "Doc revision" itself and PPAP's own ambiguous positioning — not a real
   sequencing claim. Auto-revise timing is **unchanged** from what was originally approved 2026-09-30: it still
   fires exactly on `pilot→implementation`, nowhere earlier. No mechanism, route, or AC changes as a result of
   this decision — it closes the question without altering §2 E5's already-approved behavior.

---

## 4. Backend needs

| Story | Migration | Contract / REST route | Service | Audit events | RBAC | Tenant isolation |
|---|---|---|---|---|---|---|
| C1 | `0071_complaints.sql` (`complaints` incl. **no `customer_color` column**, §0 S6; `complaint_attachments` incl. `UNIQUE(tenant_id,complaint_id,file_id)`, §0 S5; `eight_ds_tenant_id_uq`/`capas_tenant_id_uq`, §0 S1; `EntityKind`/`entity_links` widening) | `GET/POST /v1/complaints`, `GET/PATCH /v1/complaints/:id`, `GET /v1/complaints/summary` | `ComplaintsService` + `packages/core/customer-color.ts` (called on read, §0 S6) + `complaint-sla.ts` (pure, freezes at `closed_at`, uses existing `AT_RISK_THRESHOLD`, §0 B7) | `created`/`updated` (incl. severity-driven SLA re-derivation on `PATCH`, §0 B7c), in-tx | `complaint:view`/`complaint:manage` | forced RLS; cross-tenant id → 404 |
| C2 | none (uses C1's table) | `POST /v1/complaints` gains `attachmentFileIds` | `ComplaintsService.create`, `FilesService.presign` extended for `entityKind: "complaint"` | `created`, in-tx | `complaint:manage` | file link verified tenant+entity_kind+sha256, mirrors Sprint 05 B7 |
| C3 | none | `POST /v1/complaints/:id/acknowledge`, `POST /v1/complaints/:id/close` | `ComplaintsService` | `updated` (acknowledge); `status_changed` (close) | `complaint:manage` | forced RLS; 404; 409 on stale lockVersion |
| C4 | `0071` also (`eight_ds.source`/`source_id`, unconstrained; **composite FKs** `complaints.ncr_id`/`eight_d_id`/`capa_id`, §0 S1) | `POST /v1/complaints/:id/convert` (discriminated union incl. `existingNcrId`, §0 B8c; `lockVersion` required, §0 B6a) | `ComplaintsService.convert` (`SELECT...FOR UPDATE`, real per-target capability gate, §0 B6a/f) reusing `NcrsService.create`/`EightDService.create`/`CapasService.create` + `packages/core/state-machines/complaint.ts` (pure); **adjacent fix: `audits.service.ts`'s `raiseCapa` link-back moved into `withAudit`, §0 B6e** | `created` (target record); complaint audited on **every** convert — `status_changed` when status moves, `updated` otherwise, §0 B6d | `complaint:manage` + **real, enforced** target capability (`ncr:create`/`ncr:manage`/`capa:manage`, §0 B6f) | forced RLS; 404; 409 on stale `lockVersion`; 422 if already `closed` (§0 B6b) |
| E1 | `0072_ecn.sql` (`ecns` incl. `auto_revise_result jsonb`, §0 B3d; `stage`/`ecn_approvals.stage` enums include `ppap`, §0b D1; `EntityKind`/`entity_links` widening) | `GET/POST /v1/ecns`, `GET/PATCH /v1/ecns/:id` (`owner` PATCHable only while `stage='draft'`, incl. a `draft` reached via resubmit, §0 B2/S4/§0b D3) | `EcnService` + `packages/core/state-machines/ecn.ts` (pure, 7-stage `ECN_STAGE_ORDER` incl. `ppap`, `rejected→draft` transition, stricter owner-or-created_by four-eyes on both approve/reject, §0 B2/§0b D1/D3) | `created`/`updated`, in-tx | `ecn:view`/`ecn:manage` (unchanged, §0b D1) | forced RLS; cross-tenant id → 404 |
| E2 | none | reuses E4's approve route + E1's `submit`/`withdraw`/`close`/`resubmit`; `GET /v1/ecns/summary` (new, 9 stage keys) | `EcnService.summary` | none (read-only) | `ecn:view` (read); `ecn:manage` (Draft/Implementation/Rejected drag, §0 B1/§0b D3); `ecn:approve` (5 gated-stage drags) | RLS-scoped |
| E3 | none | CreateWizard's existing create route, `"ecn"` type added | `EcnService.create` (shared with E1) | `created` | `ecn:manage` | forced RLS |
| E4 | `0072` also (`ecn_approvals` — 5 gated `stage` values incl. `ppap`, **no `role_required` column**, §0 S8/§0b D1) | **New (§0 B1):** `POST /v1/ecns/:id/submit`, `POST /v1/ecns/:id/withdraw`, `POST /v1/ecns/:id/close`; **new (§0b D3):** `POST /v1/ecns/:id/resubmit`; existing `POST /v1/ecns/:id/approvals/:stage` (5-value stage list, exact statement order, §0 S2/§0b D1), `GET /v1/ecns/:id/approvals` (5-row tracker) | `EcnService.decideApproval`/`.submit`/`.withdraw`/`.close`/`.resubmit` | `status_changed` (ecn, every transition incl. `submit`/`withdraw`/`close`/`resubmit` — `resubmit`'s payload records the `ecn_approvals` reset, §0b D3); `updated` (ecn_approvals row, per-decision) | `ecn:approve` (decide); `ecn:manage` (submit/withdraw/close/resubmit — resubmit **not** owner-restricted, §0b D3a); `ecn:view` (read tracker) | forced RLS; cross-tenant id → 404; 409 on stale lockVersion (every route) |
| E5 | `0072` also (`ecns.auto_revise_result`) | `POST /v1/ecns/:id/link` (`FOR SHARE` lock, §0 S2; stage `draft`-`pilot` only), **new** `POST /v1/ecns/:id/links/:linkId/delete` (§0 B4), `GET /v1/ecns/:id/links` | `EcnService.link`/`.unlink`, auto-revise call into `DocumentsService.newVersion` (existing, **new optional `ownerId` param**, §0 B3b) + `packages/core/version-bump.ts` (pure); each document's attempt in its own `SAVEPOINT` (§0 B3c) | `linked`/`unlinked` (entity_links row); auto-revise result persisted into the ECN's own `status_changed` event `after` payload (§0 B3d) | `ecn:manage` (link/unlink); side-effect of `ecn:approve` (auto-revise) | ECN-specific unlink route closes the generic-route bypass (§0 B4); existing `assertEntityVisible` (rule 8), now also capability-checked |
| X1 | none | none | `apps/api/src/collab/entity-ref.ts` (`assertEntityVisible` gains a capability check, §0 B4), `comments.service.ts`/`comments.controller.ts` (membership threaded through, §0 B4), `chat.ts`'s `ENTITY_SPECS` (`label: "subject"` for complaint, §0 S3), `document-detail.tsx`/`capa-detail.tsx`'s own local `ENTITY_ROUTE`/`ENTITY_LABEL` maps (§0 S3), `apps/web/.../graph-kinds.ts`, `search.service.ts`'s `KindConfig` (+`capability`/`titleColumn`, §0 B5), `audit-signal.ts`'s `ENTITY_TOPIC` — **no new job; the complaint SLA check rides the existing `sla.sweep` cadence, §0 B7a** | none new | `complaint:view`/`complaint:manage`/`ecn:view`/`ecn:manage`/`ecn:approve` added to `packages/core/src/rbac.ts` per §2 X1 AC1 | n/a |

Every mutation runs inside `withAudit` in the same transaction (rule 3); both list endpoints are cursor-
paginated (rule 6); all new Zod schemas live in `packages/types` (rule 4); the complaint and ECN state
machines are `packages/core` pure functions (rule 5), never computed in a controller or a React component.
Reserved migration range for this sprint: **`0071`-`0072`** (0071 complaints + complaint_attachments + 8D
source columns + `eight_ds`/`capas` tenant-id-uq prereqs + EntityKind/entity_links widening, 0072 ecns +
ecn_approvals + `ecns.auto_revise_result` + EntityKind/entity_links widening); `0073` held as buffer for a
build-time correction, mirroring Sprints 04/05's own convention — Sprint 07 takes `0074` onward.

## 5. Design needs

**Existing binding jsx — designer audits these against the built screens, does not redraw them:**
- `CustomerComplaints` (KPI strip, 4 tabs, register table, Intake channels/SLA matrix cards) — `qms-
  modules.jsx` lines 332-475.
- `IntakeForm` (the drawn create dialog) — `qms-modules.jsx` lines 477-523.
- `ECNList` (list table) — `qms-modules.jsx` lines 549-591.
- `ECNKanban` (7-column board) — `qms-modules.jsx` lines 593-633, **with the corrected 9-column set the
  designer must add: "Rejected" (§3.2) and "PPAP" (§0b D1, between Risk review and CAB approval) — a required
  follow-up design touch-up, not yet reflected in `docs/design/DESIGN-06-complaints-ecn.md`'s existing Kanban
  board**.

**NO existing jsx — designer must draw these, in the existing visual language, before Gate 1:**
1. **Complaint detail panel** (C3) — no board exists at all; the list rows are clickable but wired to nothing
   in the mock. Needs: field grid (KvField pattern, matching risk/instrument detail-card precedent), SLA state
   chip, attachments list, Acknowledge/Edit/Convert/Close actions.
2. **Complaint intake dialog's added fields** (C2) — `Contact` and `Channel` need a placement in the existing
   `IntakeForm` layout (a 2-column grid already exists; these fit as two more fields, likely alongside
   Customer/Severity at the top).
3. **ECN detail view w/ approval tracker** (E4) — no board exists at all; P19 §3 calls for one but the jsx
   never draws it. Needs: field grid, **5-row approval tracker** (stage/decision/approver/decided-at, incl.
   `ppap`, §0b D1), affected-records panel (reusing `LinkPicker`'s existing visual pattern from Sprint 04),
   Approve/Reject actions (visibly disabled, not merely 403'd, for a non-approver), **and a Resubmit action
   (§0b D3, item 12 below)**.
4. **ECN Kanban's 9-column set** (§3.2/§0b D1) — a small, evidenced addition to the existing `ECNKanban`
   board: the "Rejected" column and the "PPAP" column (placed between Risk review and CAB approval), same
   visual treatment as the other 7 columns. **This is a required follow-up design touch-up to the existing
   `docs/design/DESIGN-06-complaints-ecn.md` board — not assumed already covered by it.**
5. **ECN create-wizard Details step board** — no jsx anywhere shows ECN's Details-step fields (changeType/
   title/description/changeRisk/effectiveDate/owner) or the 3-step branch; a new board in the existing
   CreateWizard visual language, mirroring risk's R4 precedent board.
6. **6th CreateWizard Type-step card** — icon `GitBranch` (reuse, already established by `navigation.ts`), a
   color from the existing wizard palette distinct from the other 5 cards.
7. **Complaint register's convert-target picker** (revised, §0 B6/B8c) — the jsx's own button text, "Link /
   **Create** NCR," becomes a real 4-way choice (create NCR / **link existing NCR** / create 8D / create CAPA),
   each option shown only if the caller holds its capability (§0 B6f); needs a small dropdown/menu affordance
   in the existing visual language, not a new full dialog, with the "link existing" option opening a compact
   NCR-picker (search-by-code, reusing whatever existing NCR-lookup pattern the codebase has).
8. **Kanban drag-and-drop visual states** (E2) — a draggable-card affordance, capability-gated **per column**
   (§0 B1/§0b D3 — `ecn:manage` on Draft/Implementation/**Rejected** cards, `ecn:approve` on the 5 gated-stage
   cards incl. PPAP) vs. a static (non-draggable, visibly so, not silently disabled) card for everyone else;
   Closed cards are never draggable for anyone; **Rejected cards are draggable exactly one way, back to Draft
   (resubmit), never to any other column**. No existing drag-and-drop precedent exists anywhere else in this
   codebase's board views to reference, so this is genuinely new interaction design, not a reskin.
9. **ECN detail view's submit/withdraw/close actions** (§0 B1) — three new buttons alongside E4's
   Approve/Reject, each visible only in the stage it applies to (`draft` → Submit + Withdraw; `implementation`
   → Close), same visual treatment as the existing action buttons.
10. **ECN detail view's persisted auto-revise banner** (§0 B3d) — the affected-records panel gains a small
    status banner showing the last `autoReviseResult` (revised/skipped counts + reasons), visible on any later
    visit to the detail view, not only right after the transition — a compact variant of the same one-time
    approval-response toast, reusable as a persistent element.
11. **ECN affected-records panel's remove affordance** (§0 B4) — a small "×"/remove control per linked
    document/supplier row, visible only while `ecn:manage` + stage `draft`-`pilot`, calling the new unlink
    route.
12. **ECN detail view's Resubmit action** (new, §0b D3) — a button visible only while `stage = 'rejected'`,
    same visual treatment as the existing Submit/Withdraw/Close actions (item 9 above), calling the new
    `resubmit` route; capability-gated `ecn:manage`, not owner-restricted, so visible to any manage-capable
    viewer, not only the ECN's own author.

## 6. Dead-end audit

| Control | Current state | This sprint |
|---|---|---|
| Sidebar "Customer complaints" (`/complaints`) | `PLANNED_MODULES["complaints"]` placeholder | Real register + KPIs + tabs (C1) |
| Sidebar "Engineering changes" (`/ecn`) | `PLANNED_MODULES["ecn"]` placeholder | Real List + Kanban (E1/E2) |
| `CustomerComplaints` "Log complaint" button | Opens `IntakeForm`, which submits nothing | Real create (C2) |
| `CustomerComplaints` row click (`cursor: pointer`, no `onClick`) | Dead in the mock itself | Real detail panel (C3, flagged §5) |
| `CustomerComplaints` "Link / Create NCR" button | `kToast` only | Real 4-way convert — create/link NCR, create 8D, create CAPA (C4, §0 B6/B8c) |
| `CustomerComplaints` "Public intake form" button | `kToast` (fake link-copy) | **Not built** — honestly excluded (§3.1), button removed/replaced with the real manual-intake-only reference card, never left as a fake copy action |
| `CustomerComplaints` "Intake channels" card's 4 non-manual "Active" channels | Fully fabricated status (no real integration exists, rule 10) | Reproduced as an honest, static, non-interactive reference card describing this tenant's manual-only posture — never a fake "Active"/"Connected" badge |
| `ECNWorkbench` "New ECN" button | `kToast` only | Real create via CreateWizard (E3) |
| `ECNList`/`ECNKanban` rows | No detail click-through drawn or wired | Real ECN detail view (E4, flagged §5) |
| `ECNKanban` cards | Static, no drag | Real drag-to-advance for `ecn:approve` holders (E2) |
| ECN "auto-revises affected documents" (header claim) | No mechanism anywhere | Real, transactional, `DocumentsService.newVersion`-based (E5) |
| ECN "Doc revision" stage (`ECNList` mock) | A mislabeled manual step that never existed as such | Corrected: it is the real, automatic auto-revise side effect (§3.2), not a 5th human stage |
| ECN reject path | Not drawn anywhere (`ECNKanban` has no "Rejected" column despite claiming "approval workflow") | Real, added: every gated stage can reject (E4), Kanban gains a "Rejected" column (§3.2/§5) |
| ECN "PPAP" stage (`ECNList` mock, row `ECN-2026-0180`) | Named nowhere in P19, `ECNKanban`, or the pre-Amendment-2 machine — a stage with no gate, no route, no Kanban column | Real, added: `ppap` is a genuine 5th approval gate (`risk_review → ppap → cab_approval`), its own `ecn_approvals` row, its own Kanban column, its own tracker row (§0b D1) |
| ECN "Rejected" Kanban column | (new after Amendment 1) had no outgoing drag defined at all — a rejected ECN was a dead end on the board | Real: Rejected → Draft drag calls the new `resubmit` route (§0b D3); Closed remains the board's only true dead end |
| "Affected parts" linking (P19's own text) | No `parts` table/`EntityKind` anywhere | **Not built** — honestly excluded (§1a/§3.2), no picker offers a fake "part" kind |
| **(§0 B1) ECN Draft/Implementation Kanban columns** | No route existed to drive `draft→feasibility`, `draft→rejected`, or `implementation→closed` — dragging a card in/out of these columns would have had nothing to call | Real `submit`/`withdraw`/`close` routes wired to every drag action in these columns (E2/E4, revised) |
| **(§0b D3) ECN Rejected stage / detail view** | No resubmission path existed — a rejected ECN was fully terminal, with no Resubmit button drawn or wired and no route to call | Real `POST /v1/ecns/:id/resubmit` route, wired to a real Resubmit button in the ECN detail view (visible only at `stage='rejected'`) and to the Kanban's Rejected→Draft drag (§0b D3, §5 item 12) |
| **(§0 B4) `POST /v1/entity-links/:id/delete`, applied to an ECN's own document link** | Would have let anyone with generic link-delete access strip an ECN→document link after `implementation`, bypassing E5's stage-freeze | Real ECN-specific `POST /v1/ecns/:id/links/:linkId/delete`, gated `ecn:manage` + stage `draft`-`pilot` (E5, revised) — the generic route no longer suffices for this guarantee |
| **(§0 B8c) "Link / Create NCR" button's "link" half** | The jsx's own button text always implied linking to an existing NCR too; the original build only wired "create new" | Real "link to an existing NCR" convert variant added (C4, revised; §5 item 7) |

No new "coming soon" text, no new dead button. The two controls this sprint explicitly does **not** wire in
full (automated intake channels; parts linking) are each either removed/replaced with honest reference content
or omitted from their picker entirely, never left selectable-but-broken — CLAUDE.md rule 10 is "never stub,"
not "never say no."

## 7. Out of scope / open questions

- **Q28 (new).** Automated complaint-intake channels (public web form submission, customer-portal/EDI
  ingestion, email parsing, a customer extranet OAuth API) are not built this sprint — no vendor, no parser
  spec, no unauthenticated-endpoint security design exists anywhere (§3.1). This is the direct successor to
  Sprint 05's own LMS-connector exclusion (Q-T1) and Sprint 05's B9-adjacent reasoning: real vendor/external-
  facing work belongs to the ROADMAP Q5 wave (Sprint 13) or a dedicated future sprint with its own sign-off on
  auth, rate-limiting, and abuse protection — not silently built here, not silently dropped either (named
  here, in the dead-end audit, and in the DoD).
- **Q29 (new).** "Affected parts" linking on ECN is not built — no `parts` table or `EntityKind` exists
  anywhere in this codebase (§1a). A future sprint that introduces a real parts/BOM master table can extend
  ECN's `LinkPicker` to a third kind at that point; not invented here.
- **Q30 (new, revised §0 S8, updated §0b D1).** ECN's per-stage approval gate is fixed and uniform
  (`admin`/`manager` at every one of the 5 gates, now including `ppap`) this sprint, resolving P19's own
  "fixed vs configurable" question as fixed (§3.2) —
  enforced entirely in `ecnMachine`'s guard code, with **no `role_required` column** (removed, §0 S8 — a stored
  value nothing read). Per-stage-distinct roles (e.g., "CAB requires admin only," "Pilot requires the plant
  manager") is a real, named future enhancement once a settings surface exists to configure it (Sprint 07's
  Workspace/Process settings wave is the natural home) — not silently built now with no UI, and not silently
  promised either.
- **Q33 (new, §0 S9) — RESOLVED (§0b D3, 2026-09-30).** `documentMachine` allows `rejected → draft`
  (resubmission); the pre-Amendment-2 ECN machine treated `rejected` as fully terminal, with no resubmission
  path. **Decided: yes, ECN also allows `rejected → draft`**, modelled directly on `documentMachine`'s own
  precedent — any `ecn:manage` holder may resubmit (not owner-restricted, matching documents), every
  `ecn_approvals` row resets to `pending` on resubmission (fresh sign-off required at every gate), and `owner`
  becomes `PATCH`able again since it is genuinely back in `draft`. See §0b D3 and §3.2's "Resubmission" section
  for the full mechanism, and §2 E1/E4 for the schema/route/AC detail. No longer open.
- **Q34 (new, §0 B8b — see §3.2a for full detail) — RESOLVED (§0b D1/D2, 2026-09-30).** Is `ECNList`'s "PPAP"
  stage (row `ECN-2026-0180`, step 4 of 6) a real 7th pipeline stage the canonical machine is missing, or is it
  the mock's own error, the same class of defect as "Doc revision" already was? Does `ECNList`'s own
  documents-before-pilot row ordering mean auto-revise should fire earlier in the pipeline (e.g., on
  `cab_approval→pilot`) rather than on `pilot→implementation`? **Decided: PPAP is real** — a genuine 5th
  approval gate, placed `risk_review → ppap → cab_approval` (§0b D1). **Auto-revise timing is unchanged** —
  still fires on `pilot→implementation`; the documents-before-pilot row ordering is confirmed to be another
  mock inaccuracy, not a real sequencing signal (§0b D2). Both parts closed; see §3.2/§3.2a for the full
  resolution. No longer open.
- **Q31 (new).** `apps/web/src/features/graph/graph-kinds.ts`'s `GRAPH_KINDS` map gains real `complaint`/`ecn`
  entries purely to satisfy TypeScript's exhaustiveness check (widening `EntityKind` forces it), but neither
  kind will actually render in the knowledge-graph explorer this sprint — `apps/api/src/graph/graph.service.ts`
  keeps its own separate literal array, unchanged. This mirrors Sprint 04's own Q27 judgment call exactly (not
  a new inconsistency this sprint introduces) — wiring complaint/ECN into the graph explorer for real is a
  named future story, not silently started or silently claimed done here.
- **Q32 (new).** Sprint 04's own auditor-`ROLE_NAV` gap for `spc` (Q24, left open) and any other pre-existing
  RBAC-nav inconsistency from prior sprints are **not** touched or fixed here — this sprint only adds its own
  two new modules to auditor's/viewer's `Set`s, per the standing per-sprint pattern, and does not audit or
  retrofit earlier sprints' own nav grants.
- **Complaint cost tracking** (`cost_usd`) has no source-of-truth beyond manual entry this sprint (no
  integration with any finance/ERP system) — a future sprint could add a real cost-rollup mechanism (e.g.,
  summing linked NCR/CAPA action costs) if FEATURES ever specifies one; not invented here.
- Mobile: confirmed no `m-*.jsx` designs either module; both stay fully unaffected this sprint (no route, no
  nav, `pnpm --filter @kaenal/mobile typecheck` must stay green on the additive shared-type changes only).
- **Merge-conflict hot spots (ROADMAP §4):** this sprint touches `packages/types/src/contract.ts`,
  `packages/types/src/enums.ts`, `packages/types/src/dto.ts`, `packages/types/src/realtime.ts`,
  `apps/web/src/config/navigation.ts` (no structural change, ids already exist), `planned-modules.ts`,
  `placeholder-ledger.ts`, `entity-routes.ts`, `apps/web/src/config/rbac.ts`, `apps/api/src/collab/
  entity-ref.ts`, `apps/api/src/ai/chat.ts`, `apps/api/src/realtime/audit-signal.ts`,
  `apps/api/src/search/search.service.ts` — one owner, rebase before PR, per the standing rule.

## 8. Definition of Done

- [ ] **User has explicitly re-approved the corrected §3, including Amendment 2 (§0b)** (see §0's DELTAS block:
      the 3 new ECN routes, the stricter owner-frozen/owner-or-created_by four-eyes rule, `newVersion`'s new
      `ownerId` parameter, the SLA cadence/threshold corrections, and the reinstated "link to an existing NCR"
      capability; **plus §0b's three now-decided deltas: `ppap` as a real 5th approval gate, auto-revise timing
      confirmed unchanged, and `rejected→draft` resubmission via the new `resubmit` route**) — build does not
      start before this.
- [ ] Migrations `0071_complaints.sql` (`complaints` with no `customer_color` column; `complaint_attachments`
      with its `UNIQUE(tenant_id,complaint_id,file_id)`; `eight_ds.source`/`source_id`; `eight_ds_tenant_id_uq`/
      `capas_tenant_id_uq`; composite FKs on `complaints.ncr_id`/`eight_d_id`/`capa_id`; `EntityKind`/
      `entity_links` widening) and `0072_ecn.sql` (`ecns` with `auto_revise_result jsonb`, **`stage` enum with 9
      values incl. `ppap`**, `ecn_approvals` with **5 gated `stage` values incl. `ppap`** and no `role_required`
      column, `EntityKind`/`entity_links` widening) applied; `pnpm db:check` green; `pnpm test:rls` green
      including both new tables, the composite FKs, and the widened `entity_links` kinds.
- [ ] `packages/core/customer-color.ts`, `complaint-sla.ts`, `state-machines/complaint.ts`,
      `state-machines/ecn.ts`, `version-bump.ts` all unit-tested — including `complaintSlaState`'s **0.8**
      boundary (the existing `AT_RISK_THRESHOLD`) and both the "acknowledged late, stays breached forever" and
      "frozen at `closed_at`" rules; `complaintMachine`'s "converts backward, status doesn't move" case;
      `ecnMachine`'s every legal/illegal transition **across its 7 ordered stages incl. `ppap`**, the stricter
      owner-**or**-created_by four-eyes guard on **both** approve and reject, the admin/manager-only guard,
      every one of the 5 gated stages' ability to reject, **and the new `rejected→draft` transition (no
      four-eyes guard, matching `documentMachine`'s own unguarded precedent)**; `bumpMinorVersion`'s
      malformed-input case.
- [ ] `packages/core/src/codes.ts` gains `"complaint"`→`COM` and `"ecn"`→`ECN` `CodeKind` entries, unit-tested;
      created complaints/ECNs get real `COM-YYYY-NNNN`/`ECN-YYYY-NNNN` codes via the `counters` table.
- [ ] C1's summary formulas (Open, Critical, < 24h response % cohort rule, avg time to close, avg cost, all 4
      tab counts) are unit-tested against seeded fixtures, not eyeballed against the UI — including the
      zero-denominator "—" cases for each.
- [ ] Contract gains all routes in §4 (incl. `submit`/`withdraw`/`close`/`resubmit`/`links/:linkId/delete` for
      ECN); `complaint:view`/`complaint:manage`/`ecn:view`/`ecn:manage`/`ecn:approve` enforced via
      `@RequireCapability` (unchanged set — `resubmit` and the `ppap` gate reuse existing capabilities, §0b);
      RBAC grant matrix matches §2 X1 AC1 exactly (mobile RBAC config, if any, stays untouched since neither
      module reaches mobile).
- [ ] C2's attachment presign-then-link flow tested for the exact Sprint-05-precedented bypass case: a
      presign with `entity_kind` omitted must not be linkable via `attachmentFileIds` later (the `entity_kind`
      exact-match + `deleted_at IS NULL` double-check, §2 C2 AC1).
- [ ] C4's convert route tested for: the locked-row race (`SELECT...FOR UPDATE`, 409 on stale `lockVersion`,
      exactly one winner, never a lost-update overwrite), converting an already-`closed` complaint (422), the
      "converts to a chronologically earlier target" case (link created, status does not regress), the 4-target
      coverage (NCR create/NCR-link-existing/8D/CAPA all real, reusing each module's own `.create()`, not a
      parallel mechanism), the real per-target capability gate (an auditor-role test proving 403 on a target
      they lack, not a silent bypass), the audit-on-every-convert rule (`updated` when status doesn't move), and
      `audits.service.ts`'s `raiseCapa` fix (its link-back now inside `withAudit`).
- [ ] E4's submit/withdraw/close/approve/reject routes tested for: wrong-stage 422 (incl. approving/rejecting
      `ppap` out of turn), self-approval **and** self-rejection 403 for both `owner` and `created_by`,
      non-admin/manager 403 on approve/reject, 409 on stale lockVersion (every route), reject requiring a
      comment, and the two-entity audit split (ecn `status_changed` + ecn_approvals `updated`).
- [ ] **New (§0b D3):** `resubmit` tested for: 422 when `stage` is not `rejected`, 409 on stale `lockVersion`,
      success moving `stage` back to `draft`, **all 5 `ecn_approvals` rows reset to `pending`/`approver=NULL`/
      `decided_at=NULL`/`comment=NULL`** (not just the one that was rejected), `owner` becoming `PATCH`able
      again immediately after (a follow-up `PATCH` changing `owner` succeeds where it 422'd before resubmission),
      the ECN's own `owner`/`created_by` successfully calling it themselves (no four-eyes guard applies), and a
      single `status_changed` audit event whose `after` payload records the approvals reset.
- [ ] E5's auto-revise tested end to end: an ECN with 3 linked documents (one `approved` with a clean "X.Y"
      version, one `approved` with a malformed version string, one not `approved`) reaching `implementation`
      real-calls `DocumentsService.newVersion` for the clean one only, **preserving that document's own
      `file_id` and `owner_id`** (not detaching the file, not reassigning ownership to the approver), each
      attempt isolated in its own `SAVEPOINT`, and the persisted `ecns.auto_revise_result`/`autoRevise.skipped`
      names the other two with their real reasons — browser-verified, not just unit-tested, since this is the
      sprint's own headline "not hand-waved" claim (CLAUDE.md rule 0). Also tested: the new ECN-specific unlink
      route rejects once `stage` reaches `implementation`, and the generic `/v1/entity-links/:id/delete` route
      can no longer remove an ECN's own document link at all.
- [ ] B4's capability fix tested: an inspector (holding neither `complaint:view` nor `ecn:view`) gets 404 from
      `GET/POST /v1/entity-links` and `GET/POST /v1/comments` against a complaint/ECN id, and a regression test
      confirms every one of the 11 pre-existing `EntityKind`s' behavior is unchanged for every role that already
      holds their `:view` capability.
- [ ] Web `/complaints` fully real: KPI strip (real formulas), 4 tabs (real counts), register table (customer
      color computed on read, "Linked" column showing the most-advanced record), intake
      dialog (incl. added Contact/Channel fields + attachments), detail panel (Acknowledge/Edit/Convert/Close,
      4-way convert picker filtered to the caller's own capabilities), Intake-channels/SLA-matrix reference
      cards (honest, non-interactive), all empty/error/offline/permission states — browser-verified side-by-side
      against `qms-modules.jsx`'s `CustomerComplaints`/`IntakeForm`.
- [ ] Web `/ecn` fully real: List (incl. "Affected" column, "step X of 7" progress bar incl. `ppap`) + Kanban
      (**9 columns** incl. Rejected and PPAP, every column's drag action wired incl. Rejected→Draft resubmit)
      toggle, ECN detail view w/ **5-row** approval tracker + submit/withdraw/close/**resubmit** actions +
      affected-records panel (incl. remove/unlink) + persisted auto-revise banner, CreateWizard `ecn` type
      (3-step branch), capability-gated drag-to-advance per column (static, visibly non-draggable otherwise),
      all empty/error/offline/permission states — browser-verified against `qms-modules.jsx`'s
      `ECNWorkbench`/`ECNList`/`ECNKanban`.
- [ ] Auditor's/viewer's web nav includes `complaints`/`ecn`; inspector's does not (browser-verified for all
      three roles, confirming inspector gets a client + server 404 on entity-links/comments, not merely a
      hidden nav entry).
- [ ] `complaint`/`ecn` real search hits appear in the command palette for a subject/title keyword match
      (complaint hits resolved from the real `subject` column, not the nonexistent `title`), role-scoped
      correctly (inspector never sees a hit for either kind, since inspector holds neither capability at all).
- [ ] A second browser session's ECN Kanban board updates live when the first approves/rejects a stage
      (realtime topic wiring, X1 AC6), browser-verified with two sessions side by side.
- [ ] Placeholder ledger entries `"planned:complaints"`/`"planned:ecn"` removed; both removed from
      `PLANNED_MODULES`.
- [ ] Full gate green: `pnpm typecheck && pnpm lint`, `pnpm test`, `pnpm test:rls`, `pnpm db:check`.
- [ ] Demo login re-seeded and proven 201 after the suite run (rule 12).
- [ ] `PROGRESS.md` updated (Current status + Decisions log: manual-only intake exclusion and why, the SLA
      table values and the 5-minute-sweep/0.8-threshold correction, the canonical **7-stage** machine (incl.
      the real `ppap` gate, §0b D1) plus its `submit`/`withdraw`/`close`/**`resubmit`** routes (§0b D3), the
      `material` change-type addition, the fixed admin/manager-only approval role (now 5 gates), the stricter
      owner-or-created_by four-eyes rule and owner-frozen-after-draft rule (and its resubmission-reopens-owner
      corollary, §0b D3c), the real `newVersion`-based auto-revise mechanism (with its `fileId`/`ownerId` fixes,
      per-document `SAVEPOINT` isolation, and its **confirmed-unchanged `pilot→implementation` timing**, §0b
      D2), the "affected parts" exclusion, the `customer_color` computed-on-read mechanism, the composite-FK
      convert-link pattern, the reinstated link-to-existing-NCR capability, the `assertEntityVisible`/search
      capability fixes, the `raiseCapa` audit fix, Q28-Q32 plus **Q33/Q34 now resolved, not open**) and
      `progress_mobile.md` gets an explicit "Sprint 06 — mobile unaffected" line.

## 9. Out-of-scope confirmation

No scope beyond P18/P19 + FEATURES §12 + `qms-modules.jsx`'s `CustomerComplaints`/`IntakeForm`/`ECNWorkbench`/
`ECNList`/`ECNKanban` components is introduced. `TrainingMatrix` and `CalibrationManagement` (the other two
components in the same jsx file) are already built (Sprint 05) and are not touched here except the standing
per-sprint config wiring (§2 X1) does not name them. NCR/8D/CAPA gain no new UI this sprint — they gain two new
loose columns (`eight_ds.source`/`source_id`) and a new caller (`ComplaintsService.convert`) into their
already-existing `.create()` methods, never a new parallel creation path or a reshaped existing route.
Documents gain no new UI or route either — `DocumentsService.newVersion` is called exactly as it already
exists, apart from **one small, additive, optional `ownerId` parameter (§0 B3b)** that every existing caller
continues to omit with unchanged behavior. Automated complaint-intake channels (Q28) and ECN "affected parts"
(Q29) are named, explicit exclusions, not silently dropped scope. `assertEntityVisible`'s new capability check
and `raiseCapa`'s audit fix (§0 B4/B6e) are small, named, adjacent corrections to existing shared code, not new
scope — both are zero-behavior-change for every role/kind combination that held the relevant capability before
this sprint. **Amendment 2 (§0b) introduces no scope beyond P18/P19 either:** `ppap` is a real IATF 16949
concept already implied by the jsx's own row and consistent with P19's own unresolved "number/identity of
approval stages" question (§3.2a Q1); it adds one enum value and one `ecn_approvals` stage, reusing every
existing mechanism (`ecnMachine`'s guard shape, the existing `ecn:approve` capability, the existing approval-
tracker UI pattern) rather than inventing a new one. `resubmit` is modelled directly on `documentMachine`'s own
real, already-shipped `rejected → draft` transition (§0b D3) — not a new mechanism either.

---

**PO use-case sign-off: SIGNED (unchanged by Amendment 1 or Amendment 2).** Every use case (happy/error/empty/
permission/offline/cross-tenant) across C1-C4 (register/list/KPI, intake+attachments, detail+acknowledge+close,
convert), E1-E5 (schema+list, Kanban, CreateWizard, approval, affected-docs+auto-revise), and X1 (cross-cutting
wiring) — **10 stories in total, none added or removed by either amendment** — still maps to a story with
testable acceptance criteria and an explicit Web/Mobile/Shared split; §0's and §0b's fixes/decisions tighten
and extend those ACs (E1/E2/E4 gain the `ppap` gate and the `resubmit` route/AC, §0b D1/D3), they do not remove
use-case coverage or add a new story. The dead-end audit (§6) accounts for every control the jsx introduces
plus every new control both amendments add (submit/withdraw/close, resubmit, the ECN unlink route, the
reinstated link-to-existing-NCR affordance); two designed-but-unbuildable elements (automated intake channels,
ECN parts-linking) remain named and honestly excluded rather than faked. This covers **use-case coverage
only** — it does **not** constitute approval to write any code.

**§3 backend design sign-off: APPROVED, including both amendments (user, 2026-09-30).** The user's original
2026-09-30 approval of §3, §0's DELTAS block (new ECN `submit`/`withdraw`/`close` routes; the `owner`-frozen-
after-`draft` + owner-or-created_by four-eyes rule; `DocumentsService.newVersion`'s new optional `ownerId`
parameter; the SLA sweep-cadence/threshold corrections; and the reinstated "link to an existing NCR" capability
with its required composite-FK schema change), and §0b's three decisions (the real `ppap` 5th approval gate
placed `risk_review→ppap→cab_approval`; auto-revise timing confirmed unchanged at `pilot→implementation`; and
`rejected→draft` resubmission via the new `resubmit` route, resetting all `ecn_approvals` rows and reopening
`owner`) are all approved as proposed. `planner` re-review of this amendment (including §0b) and the UI Lead
Designer's Gate 1 touch-up (the board additions named in §5 — submit/withdraw/close/**resubmit** actions, the
persisted auto-revise banner, the unlink affordance, the 4-way convert picker, the Kanban's **PPAP and Rejected**
columns, and the tracker's **5th row**) remain pending before implementation may begin, per `SCRUM.md`'s
ordering — but no further backend-design sign-off is required.

---

## 10. Amendment 2 — interaction check with the prior amendment round

Checked, not assumed: does folding in `ppap` (a 9th Kanban column, a 5th gate), the confirmed-unchanged
auto-revise timing, or the new `resubmit` route require any adjustment to Amendment 1's own deltas?

- **Complaint SLA/close mechanism (§0 B7):** no interaction — it is entirely a `complaints` table/`sla.sweep`
  concern; nothing in it references ECN stages, gate counts, or Kanban columns.
- **Search wiring (§0 B5, X1 AC5):** no interaction — `ecn`'s `KindConfig` (`table`, `capability`,
  `titleColumn: "title"`) is indifferent to how many `stage` values `ecns.stage` has; a 9th stage value changes
  nothing about how a title-keyword search matches an `ecns` row.
- **`EntityKind` widening (§0 B4/X1 AC4, S3):** no interaction — `ppap`/`resubmit` touch `ecns.stage` and a new
  route, not `EntityKind` or any `Record<EntityKind,...>` map; `entity_links`/`assertEntityVisible`/
  `comments.service.ts`'s capability fix are unaffected.
- **`GET /v1/ecns/summary`'s 8-values-always-present shape (E2 AC2, part of Amendment 1's own build):** *does*
  need its literal value count updated to 9 (incl. `ppap`) — already folded into E2's edit above, not a separate
  untouched item.
- **Composite-FK convert-link pattern (§0 S1), `raiseCapa` audit fix (§0 B6e), `customer_color` (§0 S6),
  `assertEntityVisible` capability check (§0 B4):** all complaint-side or shared-infrastructure fixes with no
  ECN-stage dependency — no interaction.

No other Amendment 1 delta needs adjustment for a 9-column Kanban or a `resubmit` route; the one place a number
genuinely had to change (the Kanban summary's stage-count literal) is already corrected in §2 E2 directly, not
left as a hidden inconsistency.
