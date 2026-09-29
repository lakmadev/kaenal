# SPRINT-04 — Risk Register + MSA / Gauge R&R

Author: Product Owner. Date: 2026-09-28. Part of the multi-sprint programme in `ROADMAP.md` (Wave 4 of 13).
Governing rules: CLAUDE.md rules 0, 1-8, 9, 10, 11 and `SCRUM.md`. Design fidelity is a completion gate.
Builds on Sprint 01 (shell), Sprint 02 (audits), Sprint 03 (graph + predictive) — all merged, not touched here.

**This sprint carries an APPROVAL GATE (ROADMAP §0 Q2).** Both modules' backends are `PROPOSED` (P12, P15)
with **no** existing `02-DATABASE`/`03-API` spec — this sprint file's §3 is the backend design the user must
approve before any code is written. **NO BUILD MAY START until the user has explicitly approved §3** (both
P12's risk-register design and P15's MSA/Gauge R&R design, including the AIAG math). This mirrors exactly how
Sprint 03 gated its predictive-risk design (§3B) before that sprint's Part B was built.

## 0. Amendment (Ceremony 4 SEND BACK response, 2026-09-28)

**Round 5 (post-build correction, 2026-09-29, during Slice 2 validation):** while validating
`packages/core/src/gauge-rr.ts` against a real, cited published source (the actual AIAG MSA 4th-edition
worked example, reproduced in "Three Ways to Analyze a Gage R&R Study," BPI Consulting/SPC for Excel, 2015
— not the hand-derived fixture an earlier pass had to fall back to for lack of network access), the ANOVA
interaction-pooling formula in §3.2 was found to diverge from the actual AIAG method by ~7% on `σ²_GRR` for
the real dataset. **User approved the fix**: §3.2's pooling rule now merges interaction and equipment into
one combined `MSE_pooled` term (matching the real AIAG manual) rather than the originally-approved zero-out
variant, which only zeroed the interaction component while leaving repeatability computed from unpooled
`MS_equipment`. This is a correctness fix to already-approved math, not new scope; see §3.2 for the full
corrected formula (marked `[AMENDED-5]`) and the reasoning. Re-validated: `packages/core/gauge-rr.ts` now
reproduces the published example's numbers exactly (within the source's own 3-decimal rounding), for both
`crossed_anova` and `average_range`.

**Round 4 (Ceremony 4, fourth pass, SEND BACK AGAIN, 2026-09-28, same day):** the planner's fourth re-review
confirmed AC2's guards, AC3/AC5's concurrency wording, the immutability rule, and both doc-only fixes all
hold — but found two remaining issues, one required-but-cosmetic and one a real correctness gap. Resolved,
marked `[AMENDED-4]`: (1) §4's M1 row still listed the completion `PATCH` under generic `created`/`updated`;
corrected to name `status_changed` for the completion transition specifically (matching M2 AC3's own text,
which was already correct — only the summary table was stale). (2) **The measurement-batch route
(`POST .../measurements`) had no `lockVersion`**, unlike every other mutation in this sprint — this meant a
batch that read a study as `draft` could still commit after a concurrent completion finished first, writing
into an already-`completed` study between the batch's read and write, undetected by AC2(a)'s completed-study
guard alone (that guard checks the state at request time, not at commit time). Fixed: the batch body is now
`{ lockVersion, cells: [...] }`, checked and bumped in the same transaction as the completed-study and
index-range guards, closing the race with a 409 rather than a silent corruption (rule 6). Also split AC2's
guards by layer per the review's finding that Zod cannot see database state (the integer-range/cap check
stays in the shared Zod schema; the per-study range check and the completed-study check move to
`MsaService`, still server-side and still 422, just correctly attributed), and added a 422 on completing an
already-`completed` study plus a `.strict()` body on the completion PATCH (AC3), mirroring reopen's own
already-in-the-target-state guard. No schema change — `lock_version` already exists on every RLS table per
CLAUDE.md rule 2; the `completed_at`/reopen delta-approval ask is unaffected.

**Round 3 (Ceremony 4, third pass, SEND BACK AGAIN — very narrow, 2026-09-28, same day):** the planner's
third re-review found N2-N6 and the doc-accuracy items fully resolved, leaving four small gaps in the M2
(MSA study lifecycle) stories plus two doc-only wording fixes. Resolved in place, marked `[AMENDED-3]`:
(1) `POST /v1/msa-studies/:id/measurements` now explicitly 422s against a `completed` study (previously
only stated in prose, not enforced) and against any cell index outside the study's own declared dimensions
(M2 AC2); (2) the `draft → completed` transition (M2 AC3) and the `reopen` route (M2 AC5) both now require
`lockVersion` and 409 on a stale value, matching every other mutation in this sprint; (3) completion is now
explicitly audited `status_changed` (not generic `updated`), consistent with reopen; `method`/`n_appraisers`/
`n_parts`/`n_trials`/`gauge_label`/`tolerance`/`characteristic` are stated as immutable after creation — a
study's `PATCH` performs status transitions only, no field edits, closing the gap where changing dimensions
after measurements exist could invalidate the bounds/index checks against stale values; (4) two doc-only
wording fixes: §4's R3 row no longer reads as if `LinkPicker` ships on CAPA/document/supplier (it doesn't —
they get the resolved-label display only; `LinkPicker` is risk's detail page only), and §9 no longer lists
supplier among pages "fully untouched" (it gains the label display). No schema or scope change; nothing here
touches the pending `completed_at` delta-approval ask, which is otherwise unchanged.

**Round 2 (Ceremony 4, SEND BACK AGAIN — narrow, 2026-09-28, same day, second pass):** the planner's second
re-review found six precision items (N1-N6) plus four documentation-accuracy corrections to §4's own table.
Resolved in place below (marked `[AMENDED-2]` at each touched AC/UC); no story is added or removed, and no
further schema changes beyond what N1 requires (a new PATCH route on the already-approved `msa_studies`
table, not a new column). Summary:

| # | Gap | Resolution |
|---|---|---|
| N1 (BLOCKING) | `completed_at` "set once" contradicted the reopen flow the design board and M2's own UC show | New `PATCH /v1/msa-studies/:id/reopen` (§2 M2 AC5, §4); reopening audits `status_changed` (distinct from generic `updated`, matching CAPA/NCR/SCAR/8D/audit/inspection precedent — confirmed by grep); re-completing **overwrites** `completed_at` with the new timestamp; `completed_at` is **kept** (not cleared) while reopened, so the UI can show "last completed on X" during correction |
| N2 | M1 AC4 typo: `n_appraisers ∈ {2,3}` should read the same inclusive-bound form as `n_trials ∈ {2,3}` | Fixed; M1 AC4, M2 AC4, and the design-board bound-hint text now all state the identical bounds: trials 2-3, appraisers 2-3, parts 2-10 |
| N3 | `crossed_anova` had no stated bounds (divide-by-zero risk below minimum; no cap on query cost) | Minimum 2/2/2 (appraisers/parts/trials) added for `crossed_anova`; upper cap of 10 appraisers / 50 parts / 10 trials added for **both** methods (§2 M1 AC4/AC5) |
| N4 (BLOCKING) | Auditor holds `risk:manage` but `fmea` isn't in auditor's `ROLE_NAV`, so a risk→FMEA link an auditor creates can't be clicked through | Resolved (a): `fmea` added to auditor's `ROLE_NAV` `Set` (X1 AC2 rewritten); `spc` left alone (out of scope, keeps the fix minimal); this supersedes half of Q24 — noted in §7, not claimed as more than it fixes |
| N5 | Should `risk` appear in the global "New" quick-create menu and CreateWizard's Type-step card grid? | Yes (R4 AC3, new) — consistency with every other real module type; flagged for designer: 5th `WIZARD_TYPES`/`WIZARD_ICON`/`WIZARD_COLOR` entry (icon `Shield`, reusing R3's established risk icon; color from the existing wizard palette) |
| N6 | (a) MSA list "Date" column ambiguity for draft rows; (b) confirm Date column applies to all rows; (c) verdict-wording vocabulary consistency | (a) `created_at`, stated unambiguously (M4 AC3 rewritten); (b) confirmed, both draft and completed rows show the Date column; (c) M3 AC3 (new): `excellent`/`acceptable`/`reject` is the **only** verdict vocabulary anywhere in the UI (banner and any chip/badge) — flagged as a design-board wording fix if any board still shows "pass/marginal/fail" |
| Doc accuracy | §4's R3 row wrongly said "`EntityLinksService` (unchanged)" | Corrected — real touch-points named: `entity-ref.ts`, `chat.ts`'s `ENTITY_SPECS`, `graph-kinds.ts` (new Q27 — risk/fmea won't render in the graph explorer's own separate kind list), CAPA/document/supplier detail pages |
| Doc accuracy | B3's linked-records panels claimed "no new backend" | Corrected — additive server-resolved `label` field on `entity_links` rows (capability-checked, tenant/plant-scoped) + `ids` filter on `GET /v1/risks`, named explicitly, still no new routes |
| Doc accuracy | X1's wording implied inspector/viewer get an API 403 on `/risk`/`/msa` deep links | Corrected — they hold `risk:view`/`msa:view`, so nothing 403s server-side; the block is the client-side web route guard, and X1's UC/AC now say so |
| Doc accuracy | KPI "Reviewed this quarter %" audit-action ambiguity | Stated explicitly: risk `PATCH` stays generic `updated` (not split, unlike CAPA/MSA's new `reopen`) — the KPI counts any `updated`/`created` audit event this quarter; zero-risks empty case reads "—", never "0%" or NaN |
| Copy | KPI tile label | "(≥ 12)" → "(≥ 10)" to match the corrected threshold (design-board one-line text edit) |

The `planner` agent reviewed this sprint file + `DESIGN-04-risk-msa.md` at Ceremony 4 and returned **SEND
BACK** on five gaps (B1-B5) plus two smaller items. This amendment resolves all seven **in place** in the
stories below (marked `[AMENDED]` at each touched AC/UC) and adds **§3-Addendum** for the one genuinely new
column the fixes surface. The user's existing approval of §3 as originally proposed is **not reopened** —
§3's text is unchanged; only the addendum is new and needs its own delta-approval before build. Summary:

| Gap | Resolution | Touches §3 (approved)? |
|---|---|---|
| B1 — CreateWizard risk step undesigned; R4 wrong about Assignees/defaults | R4 rewritten: exact Details fields + create-time defaults named; owner captured in-step, not via the shared Assignees step | No — R4 is §2, not §3 |
| B2 — KPI formulas undefined; "≥12" bad band | All four formulas defined exactly; "High residual" corrected to ≥10 (the real `high` band); **no new column needed** — "reviewed this quarter" is derived from existing `audit_events`, not a new `risks` column | No — reuses existing tables |
| B3 — no linked-records panel | Scoped explicitly: risk's own detail card gets the read-side link panel (reuses the existing pattern); FMEA gets one new reverse pane (FMEA currently has **zero** related-items display — confirmed by grep, so this is new but narrow, risk-only) | No |
| B4 — LinkPicker scope contradiction | R3 corrected: FMEA-only this sprint, `GET /v1/fmeas` + client-side filter, no new search index; reverse-direction UC corrected to FMEA only | No |
| B5 — MSA a/p/n bounds, verdict precedence, `completed_at`, draft rows in M4, verdict color | (a)-(b)(d)(e) are clarifications of already-approved math/UI, edited in place; (c) `completed_at` is a **genuinely new column** → **§3-Addendum**, flagged for delta-approval, not folded into §3 silently | **Yes, (c) only** — see §3-Addendum |
| Code format (`R-NNN`/`MSA-NNN`) | Conflicts with `packages/core/src/codes.ts`'s established `PREFIX-YYYY-NNNN` pattern (confirmed by reading that file) — corrected to `RISK-YYYY-NNNN` / `MSA-YYYY-NNNN` via the existing `counters` mechanism, `CodeKind` gains `risk`/`msa` | No — `codes.ts` additive change, not a schema change |
| `?id=` deep-links carry code, not uuid | Corrected everywhere (`R1`, `R3`, `R4`, `M1`, `M3`) to the opaque uuid `id`, matching how `entity_links` and every other deep-link in the app already work | No |

---

## 1. Goal and roles served

Replace the `/risk` and `/msa` `ModulePlaceholder`s (served today via `PLANNED_MODULES["risk"]`/
`PLANNED_MODULES["msa"]`, ledger entries `planned:risk`/`planned:msa`) with two real, backend-complete
quality-system modules:

- **Risk register** (ISO 9001 §6.1 risk-based thinking): a 5×5 likelihood×impact register with inherent/
  residual scoring, treatment plans, structured controls, trend, and links into NCR/8D/audit/supplier/FMEA —
  everything `RiskRegister` in `qms-risk-spc.jsx` (lines 1-224, read in full) and FEATURES §12 specify.
- **MSA / Gauge R&R**: AIAG 4th-edition Gauge R&R studies (3 appraisers × 10 parts × 3 trials crossed design,
  or the average-range method) with real variance-component math (EV/AV/GR&R/Part-to-Part/ndc/verdict) —
  everything `MSAStudy` in `qms-risk-spc.jsx` (lines 549-671, read in full) and FEATURES §12 specify.

Roles served: **admin, manager, auditor** (module administration + review); **inspector, viewer** get
read-only visibility of the same two capabilities for use elsewhere (linked-record display), but not the
standalone module page — this exactly mirrors how `fmea:view`/`spc:view` are already granted broadly while
the `/fmea`/`/spc` nav entries stay narrower (see §1a). No `m-*.jsx` designs either module for mobile
(confirmed by grep, §1a) — **mobile is unaffected by this sprint**, proven by `pnpm --filter @kaenal/mobile
typecheck` staying green on the additive shared-type changes only.

## 1a. Verified current state (grepped this session, not assumed — CLAUDE.md rule 10)

| Fact | Evidence |
|---|---|
| No `risks`, `risk_controls`, `msa_studies`, or `msa_measurements` table exists anywhere; no `apps/api/src/risk` or `apps/api/src/msa` directory exists | `grep -rn "CREATE TABLE" packages/db/migrations/*.sql` — no match; `ls apps/api/src` — no `risk`/`msa` dirs |
| `implementation/02-DATABASE.md`, `03-API.md`, `08-TESTING.md` define no risk/MSA tables, endpoints, or algorithms — confirmed via `PROGRESS.md`'s own "SPC / FMEA has no backend spec" note (still true for risk/MSA specifically; SPC and FMEA are now built, risk/MSA are not) | `project_brain/project/implementation/02-DATABASE.md`, `03-API.md` — no hits for "risk_register"/"msa_studies"; `PROGRESS.md:3034-3041` |
| `project_brain/project/implementation/phases/P12-risk-register.md` and `P15-msa.md` exist and are marked `Status: Backend 🔴 PROPOSED · FE 🔴` — this sprint's §3 supersedes their draft schemas where this session's grep found a real conflict (below) | both files read in full this session |
| Next free migration number is **0064** — `0063_entity_links_finding.sql` (Sprint 03) is the last one on disk; no branch (local or remote) has a migration past 0063. ROADMAP §4's guess of "04: 0044-0046" is stale (written before Sprints 02/03 landed 0061-0063) | `ls packages/db/migrations \| sort \| tail`; `git log --all --oneline -- packages/db/migrations/` |
| `EntityKind` currently has 9 members (`inspection, ncr, eight_d, audit, capa, document, supplier, scar, finding`) — **no `risk` and no `fmea`**, even though FMEA is a real, fully-built module (Phase F). The risk register jsx's "Link to FMEA" button is `kToast(...)` only in the prototype — a genuinely unbacked link this sprint must wire for real (§2, R3) | `packages/types/src/enums.ts:357-370`; `qms-risk-spc.jsx:200` (`onClick={() => kToast('Linked to PFMEA...')}`) |
| `entity_links` CHECK constraints (`entity_links_from_kind_check`/`_to_kind_check`, widened in migration `0063`) do not include `risk` or `fmea` | `packages/db/migrations/0063_entity_links_finding.sql:17-22` |
| No calibration/instrument table exists anywhere (`calibration`, `instruments`, `gauges` — 0 hits). P15's schema names `instrument_id` as an FK "→ calibration [P16]" — **P16 is Sprint 05, not built yet**, so that FK target does not exist | `grep -rln "calibration\|instrument" packages/db/migrations/` → 0 hits |
| `apps/web/src/config/planned-modules.ts` still lists `risk`/`msa`; `placeholder-ledger.ts` still carries `"planned:risk": 4` / `"planned:msa": 4` (correctly pointing at this sprint) | `apps/web/src/config/planned-modules.ts:31-38`; `placeholder-ledger.ts:13-14` |
| `apps/web/src/config/navigation.ts` already has real nav entries: `{ id: "risk", href: "/risk" }`, `{ id: "msa", href: "/msa" }` (not `/risk-register` as P12's own doc guesses — navigation truth wins per CLAUDE.md's visual/config precedence) | `apps/web/src/config/navigation.ts:164,167` |
| `apps/web/src/config/rbac.ts` `ROLE_NAV`: admin = all, manager = all-minus-platform (both already cover `risk`/`msa` once built — neither id is in `PLATFORM_ROOTS`), but **auditor's explicit allow-list does not include `risk`, `msa`, `fmea`, or `spc`** even though `fmea`/`spc` are real built modules today. This is a pre-existing gap predating this sprint (not introduced here) — logged in §7 as an observation, not fixed for fmea/spc (out of scope), but **this sprint does add `risk`/`msa` to auditor's set** so the new modules don't repeat the same mistake | `apps/web/src/config/rbac.ts:32-44` |
| No `risk:view`/`risk:manage`/`msa:view`/`msa:manage` capability exists in `packages/core/src/rbac.ts` | `grep -n "risk:\|msa:" packages/core/src/rbac.ts` → 0 hits |
| Generic related-records endpoints already exist and are reused elsewhere (`capa-detail.tsx`, `document-detail.tsx`, `supplier-detail.tsx`): `GET/POST /v1/entity-links`, no `@RequireCapability` (link creation only requires each side to already be visible to the caller) | `apps/api/src/collab/entity-links.controller.ts` |
| `packages/core/spc.ts` already carries a Shewhart-constants table (`SUBGROUP_CONSTANTS`: A2/D3/D4/d2 for n=2-10) and is the established precedent for "AIAG-adjacent pure statistical math, unit-tested against a documented example" — `fmea.ts` is the precedent for "pure scoring logic + an explicit note on which simplified rule variant is implemented and why" | `packages/core/src/spc.ts:17-33`; `packages/core/src/fmea.ts:1-16` |
| `ExportResource` enum precedent for a single-module PDF export: `audit_report` (Sprint 02), `predictive_forecast_pack` (Sprint 03) — same pattern this sprint reuses for `risk_board_pack` / `gauge_rr_aiag_report` | `packages/types/src/enums.ts:316-328` |
| Sprint 01 Q1: CreateWizard replaces per-entity create dialogs everywhere except CAPA | `ROADMAP.md §0 Q1` |
| `qms-risk-spc.jsx`'s risk detail "Controls" panel (Detective/Preventive/Corrective/Contingency rows with a strength chip) is **hard-coded identically for every risk** in the prototype (the four rows never change when `selected` changes) — a real product cannot show the same four fabricated controls for a ransomware risk as for a weld-porosity risk (rule 10). This is a **designed element with no backing data model at all**, not merely "no backend route" — P12's own schema proposal has no table for it. This sprint adds one (§2 R2) rather than reproducing static fabricated content | `qms-risk-spc.jsx:203-212` read closely — the `.map` iterates a literal array defined inline, not derived from `r` |
| `qms-risk-spc.jsx` MSA "Recent MSA studies" table lists 5 studies with `method` values `Crossed (X-bar/R)`, `Nested`, `Attribute (kappa)` — P15's own schema proposes only `crossed_anova\|average_range`. "Nested" and "Attribute/kappa" MSA are materially different statistical methods (kappa needs no variance-component math at all) with no spec anywhere beyond this one mock row each | `qms-risk-spc.jsx:637-664`; `P15-msa.md §5` open question |
| No `m-*.jsx` mentions a risk register or MSA/Gauge R&R screen (the one "gauge" hit is `m-system.jsx`'s unrelated storage-usage gauge) | grepped this session: `grep -il "risk\|msa\|gauge" project_brain/mobile/src/m-*.jsx` |

---

## 2. Stories

### R1 — Risk register: schema, list, 5×5 matrix, detail panel

**Design:** `RiskRegister` full component (`qms-risk-spc.jsx:16-224`) — KPI strip, 5×5 heat map, by-category bar
chart, register table, detail card (Field grid, treatment plan, Edit/Re-score buttons).

UC
- Happy: open `/risk` → KPI strip (real counts, not the jsx's static 47/4/2/12/87%), 5×5 heat map colored by
  count-per-cell with the jsx's 4-band coloring (low/medium/high/critical), register table sorted by residual
  score desc, clicking a row selects it and populates the detail card.
- Happy (matrix click-to-filter): click a heat-map cell → register table filters to risks at that exact
  (likelihood, impact) pair (jsx's stated behaviour, "Click a cell to filter the register" — not built as a
  toast in the mock, must be real here).
- Empty: tenant has zero risks → register/matrix/category panel all show a real empty state (heat map renders
  all-grey cells, "0" everywhere), not the jsx's populated mock.
- Permission: `risk:view` required for the page; a role without it never sees the nav entry (curated,
  see §4) and a direct deep-link 403s.
- Error/offline: list fetch fails → retry affordance; offline banner disables Add/Edit/Re-score mutations
  (reuse S1-5 infrastructure).
- Edit / Re-score: both open the same edit surface (category/title/owner/likelihood/impact/residual/trend/
  treatment/status/plan/review-due), optimistic-concurrency guarded by `lockVersion` — "Re-score" is not a
  separate backend concept, it is the same `PATCH` with the score fields pre-focused.

AC
1. Migration `0064_risk_register.sql`: `risks` table — `tenant_id`, `id`, `code` (**[AMENDED] `RISK-YYYY-NNNN`**
   — the jsx's `R-NNN` mock format conflicts with `packages/core/src/codes.ts`'s one established code pattern
   (`PREFIX-YYYY-NNNN`, confirmed by reading that file this session); `CodeKind` gains `"risk"` → prefix
   `RISK`, sequenced per-tenant-per-year via the existing `counters` table mechanism every other module already
   uses — not a new mechanism), `category` (enum: `supply|process|compliance|cyber|people|quality|
   environmental|financial|reputation` — the 9 values `RISKS`' `cat` field actually uses, all 9, not the "by
   category" panel's 8-bar mock which simply omitted `reputation` by mock coincidence), `title`, `owner`
   (composite member FK), `likelihood` int CHECK 1-5, `impact` int CHECK 1-5, `inherent_score` int
   **GENERATED ALWAYS AS (likelihood * impact) STORED**, `residual_score` int CHECK 1-25 (independently
   entered — see §3), `trend` enum (`up|down|flat`), `treatment` enum (`mitigate|accept|transfer|avoid`),
   `status` enum (`active|monitoring|accepted`), `plan` text NOT NULL DEFAULT '', `review_due` date NULL,
   `lock_version`, standard audit columns. Forced RLS, leading `tenant_id` index, unique `(tenant_id, code)`.
2. `packages/core/risk-matrix.ts` (pure): `scoreBand(score): "low"|"medium"|"high"|"critical"` using the
   jsx's own thresholds (≥16 critical, ≥10 high, ≥6 medium, else low — `qms-risk-spc.jsx:63`), and a
   `matrixCounts(risks)` helper building the 5×5 cell-count grid — unit-tested.
3. `GET /v1/risks` (cursor, rule 6; filters `category`/`status`/`treatment`/`owner`/`likelihood`/`impact`),
   `POST /v1/risks` (`risk:manage`), `GET /v1/risks/:id` (`risk:view`), `PATCH /v1/risks/:id` (`lockVersion`,
   `risk:manage`). All mutations `withAudit` in the same transaction (rule 3).
4. Cross-tenant risk id → 404, not 403 (rule 8), mutation-tested against RLS.
5. Category set is exactly the 9 named above; the "By category" panel renders every category with ≥1 risk,
   not a hard-capped top-8 list (the jsx's cap was a mock-data coincidence, not a designed limit).
6. **[AMENDED — B2] KPI strip formulas, exact:**
   - **Total risks** = `count(*)` for the tenant, no filter.
   - **High residual** = `count(*) where residual_score >= 10` — corrected from the jsx's arbitrary "≥12" to
     the real `high` band boundary already defined in `risk-matrix.ts`'s `scoreBand` (medium ≥6, high ≥10,
     critical ≥16); "high residual" reads as "band is `high` or `critical`," i.e. `scoreBand(residual_score)
     in ("high","critical")`, equivalent to `>= 10`.
   - **Treatments overdue** = `count(*) where review_due is not null and review_due < current_date` — uses
     the **existing** `review_due` column from AC1 above; **no new column needed** for this one (checked, per
     the gap's own instruction).
   - **Accepted** = `count(*) where status = 'accepted'` — uses the existing `status` column; no new column.
   - **Reviewed this quarter %** = `100 × (count of distinct risks with an `audit_events` row where
     `entity_kind='risk'`, `entity_id` = the risk's id, `action in ('created','updated')`, and `created_at`
     falls in the tenant's current calendar quarter, tenant-timezone) / total risks`. **No new column on
     `risks` is needed** — every `PATCH`/create on a risk already writes an audited `updated`/`created` event
     in the same transaction (rule 3), and `audit_events` already carries `entity_kind`/`entity_id`/
     `created_at` (`packages/db/migrations/0015_audit_partitioning.sql`, confirmed by reading it this
     session) — a risk edited (or created) at all this quarter counts as "reviewed" for this KPI, which is a
     read-only query over existing audit history, not a new write path or column. **[AMENDED-2 — doc-accuracy]
     Explicit, so the formula is unambiguous:** a risk's `PATCH` is **always** audited as generic `updated`,
     never split into a `status_changed` action the way M2's `reopen` route (N1) or CAPA's own status
     transitions are — so this KPI's "reviewed" signal is any `updated`/`created` audit event on the risk this
     quarter, full stop, not a narrower action-type filter. **Zero-risks empty case:** the KPI tile reads
     `"—"`, never `"0%"` or `NaN` (division by zero on `total risks = 0` is guarded, not silently rendered).
     This is the one formula the
     gap asked to check for a hidden schema need; checked, and none is needed.
7. Deep-link support uses the risk's opaque **uuid** `id`, never its human-readable `code` (**[AMENDED]** —
   corrects R1's own earlier text and mirrors how `entity_links`, which stores uuids not codes, already works
   everywhere else in the app): `/risk?id=<uuid>` pre-selects a risk (needed for R3's "open full record"
   click-through).

**Web/Mobile/Shared**
- **Web:** `apps/web/src/features/risk/` — `RiskRegisterPage` (KPI strip, heat map w/ click-to-filter,
  category bar, register table, detail card, **[AMENDED — B3; corrected — N4/doc-accuracy] a linked-records
  panel on the detail card** reading `entity_links` for the selected risk — reuses the exact read-side pattern
  `supplier-detail.tsx`/`document-detail.tsx`/`capa-detail.tsx` already ship via `useEntityLinks`. **This is
  additive backend, not "no new backend route" as round-1 said:** today's only consumers render each link by
  truncating the raw id (`id.slice(0,8)`, confirmed in all three files this session) — a real panel needs a
  human-readable label (an FMEA's name, "NCR-2026-0118", a risk's code+title+residual score). So `entity_links`
  read responses gain a server-resolved, optional `label` field per link — tenant/plant-scoped and
  capability-checked (resolved only when the caller can view that specific target record; omitted, never a
  raw/guessed value, when they can't — never leaking a label the caller shouldn't see), and `GET /v1/risks`
  gains an `ids` filter parameter (batch-resolves risk labels for the reverse FMEA pane, R3 AC7) — additive
  changes to the existing `GET /v1/entity-links`/`GET /v1/risks` routes, no new route), empty/loading/error/
  permission states. Deep-link support: `/risk?id=<uuid>` (**[AMENDED]** — uuid, not `code`) pre-selects a risk
  (needed for R3's "open full record" click-through).
- **Mobile:** not built — no `m-*.jsx` design (confirmed §1a); no route, no nav entry;
  `pnpm --filter @kaenal/mobile typecheck` must stay green on the additive shared-type changes only.
- **Shared:** migration `0064` (risks table); `RiskDto`/`RiskListQuery`/`CreateRiskBody`/`UpdateRiskBody` +
  `RiskCategory`/`RiskTreatment`/`RiskTrend`/`RiskRegisterStatus` enums in `packages/types`;
  `packages/core/risk-matrix.ts` (pure, unit-tested); `risk:view`/`risk:manage` in `packages/core/src/rbac.ts`.

### R2 — Risk controls sub-list (new: no schema existed for this designed panel)

**Design:** `qms-risk-spc.jsx:203-212` "Controls" block on the risk detail card (icon + description + strength
chip, four categories: Detective/Preventive/Corrective/Contingency).

UC
- Happy: a risk's detail card lists its own real controls (added by the risk owner), each with a type,
  description, and strength (`strong|medium|weak`) — never the jsx's fixed four-row mock regardless of which
  risk is selected (§1a gap).
- Empty: a risk with no controls yet shows an empty "No controls recorded" state with an "Add control"
  affordance, not the jsx's fabricated four rows.
- Permission: adding/editing/removing a control requires `risk:manage`; `risk:view` can read them.

AC
1. Migration `0064` also creates `risk_controls`: `tenant_id`, `id`, `risk_id` (composite FK →
   `risks(tenant_id, id)` ON DELETE CASCADE), `kind` enum (`detective|preventive|corrective|contingency`),
   `description` text NOT NULL, `strength` enum (`strong|medium|weak`), `seq` int (display order), standard
   audit columns. Forced RLS, leading `tenant_id` index (mirrors `fmea_items`' child-table precedent exactly).
2. Controls are managed via `PATCH /v1/risks/:id` accepting a full `controls[]` replace-array (mirrors how
   `fmea_items` are added/edited via the parent FMEA's own routes — see `fmea.controller.ts`), audited as
   part of the same `updated` event on the parent risk (not a separate audit action).
3. Reordering (`seq`) is preserved on read; the web list renders in `seq` order.

**Web/Mobile/Shared:** Web (controls editor inside the R1 detail card). Mobile: unaffected. Shared: table +
DTO addition to R1's migration/types; no new capability (reuses `risk:view`/`risk:manage`).

### R3 — Real cross-module links: `risk` and `fmea` become `EntityKind` members

**Design:** `qms-risk-spc.jsx:200` "Link to FMEA" button (currently `kToast` in the prototype); FEATURES §9/
§329 linkage graph; P12 §2 "Links to NCR/8D/audit/supplier via `entity_links`." **[AMENDED — B3/B4, per
planner SEND BACK]:** this story's scope is corrected below; it no longer claims a pre-existing generic
picker or a 5-kind reverse panel.

UC
- Happy: **[AMENDED — B4]** from a risk's detail card, "Link to FMEA" opens a **new** `LinkPicker` component
  (design audit `DESIGN-04-risk-msa.md` §4.6 found, independently, that no web component today calls
  `POST /v1/entity-links` — the three existing consumers only *read* links — so this is a real gap, not a
  reuse; corrected here rather than left as-is). This sprint's "Link to FMEA" is **FMEA-only**: the picker is
  scoped to `kind=fmea`, backed by the **existing** `GET /v1/fmeas` list with **client-side filtering** (no
  new search-index work, no new read route). Linking writes a real `entity_links` row (`from_kind='risk'`,
  `to_kind='fmea'`), audited `linked` (existing action, no new enum value needed). Linking to NCR/8D/audit/
  supplier is **out of scope this sprint** — the `LinkPicker` component itself is written generically (kind
  is a prop) so a future sprint can add more call sites without rework, but only the FMEA-scoped call site
  ships now.
- Click-through: a linked FMEA's row is a real link. Since `/fmea` has no per-record route today (it's a
  select-in-list page, same shape as `/risk`), `entityHref("fmea", id)` resolves to `/fmea?id=<uuid>` and the
  FMEA feature page gains the same `?id=` deep-link pre-select support `/risk` gains in R1 — a genuinely new
  small addition to the already-built FMEA page, not a dead link.
- Reverse direction: **[AMENDED — B3/B4, corrects the original UC's over-scoped claim]** this sprint wires
  the reverse pane for **FMEA only**, not for NCR/8D/audit/supplier. Rationale (checked this session by
  grepping `apps/web/src/features/fmea/fmea-workbench.tsx`): FMEA today has **zero** related-items/entity-
  links display of any kind — not a partial one to extend, a genuine absence — so this sprint adds one new,
  narrow, read-only reverse pane on FMEA's existing detail view showing only risks that link to it (reusing
  the same `useEntityLinks`/`LinkList` read-side pattern `capa-detail.tsx` already ships, just a new call site
  on FMEA's page), and clicking a row opens `/risk?id=<uuid>`. Retrofitting NCR/8D/audit/supplier's own pages
  with a new related-items panel is explicitly **not** this sprint's scope (those modules don't own this
  sprint and adding a panel to each is separate scope creep) — logged as Q25 in §7.

AC
1. `EntityKind` gains `"risk"` and `"fmea"` (`packages/types/src/enums.ts`).
2. `entity_links_from_kind_check`/`_to_kind_check` widened to include both (mirrors migration `0063`'s
   pattern exactly for `finding`).
3. `entityHref`/`entityIcon`/`entityLabel` (`apps/web/src/lib/entity-routes.ts`) gain `risk` → `/risk?id=`
   (icon: `Shield`, matching `navigation.ts`'s existing risk icon) and `fmea` → `/fmea?id=` (icon: `Grid3x3`,
   matching `navigation.ts`'s existing FMEA icon) — both carry the record's **uuid**, never its `code`.
4. No new audit action — `linked`/`unlinked` already exist (migration `0018`).
5. Cross-tenant link target → 404 via the existing `assertEntityVisible` (rule 8), unchanged behaviour.
6. **[AMENDED — B4]** `LinkPicker`'s dialog, when opened from risk's "Link to FMEA," offers **only** FMEA
   records in its result list (no kind-filter chips shown, since there is only one kind this sprint) — no UI
   surface anywhere in R3 offers linking to NCR/8D/audit/supplier from a risk.
7. **[AMENDED — B3]** FMEA's detail view gains one new reverse pane: read-only, lists risks with an
   `entity_links` row where `to_kind='fmea'` and `to_id` = the open FMEA's id (or the symmetric `from_kind`
   side, since links are undirected for display per migration `0018`'s own comment — a link is stored once
   and read from both ends), empty state "No linked risks" when none exist.

**Web/Mobile/Shared:** Web (new `LinkPicker` component + `useCreateEntityLink` hook — **[AMENDED]** flagged
in the design audit as missing from the sprint's own backend-needs table, added to §4 below; wiring on
`/risk`; **one new** reverse pane added to the existing `/fmea` page, not five). Mobile: unaffected. Shared:
`EntityKind` enum + `entity_links` CHECK migration (folded into `0064`).

### R4 — Create a risk via the CreateWizard (Q1)

**Design:** ROADMAP §0 Q1 ("CreateWizard replaces the create dialogs everywhere; CAPA keeps its dialog");
`qms-risk-spc.jsx:24` "Add risk" button (`kToast` in the prototype). **[AMENDED — B1, per planner SEND
BACK]:** the original R4 assumed a designed risk step and a normal Assignees mapping that don't hold up; both
are corrected below, and the corrected step is flagged as a **new designer input requirement** (no board
exists for it today — `createwizard.jsx` has only 4 types and none of risk's fields appear anywhere in it,
confirmed by reading the wizard's jsx this session).

UC
- Happy: "Add risk" opens `/create/risk` (the existing 4-step wizard shell: Type pre-selected → **Details**
  (risk-specific fields, below) → **Review** confirms) → creates a real risk, navigates to `/risk?id=<new
  uuid>` (**[AMENDED]** uuid, not code, matching R1's corrected deep-link AC).
- Cancel/dirty-leave: reuses the wizard's existing confirm-on-leave behaviour (Sprint 01 infrastructure,
  including its documented browser-back-button gap — not re-litigated here).

AC
1. **[AMENDED — B1(a)] Exact Details-step fields for `"risk"` and their create-time values:**
   - **Captured by the user in this step:** `category` (required select, the 9 values), `title` (required
     text), `likelihood` (1-5 picker), `impact` (1-5 picker), `treatment` (`mitigate|accept|transfer|avoid`
     select), `plan` (text area, optional at create — defaults to `''` per R1 AC1's `NOT NULL DEFAULT ''`).
   - **Not captured at create, given explicit defaults** (R4 as originally written omitted these entirely —
     the gap correctly caught this): `residual_score` defaults to **`inherent_score`** (i.e.
     `likelihood × impact`) at creation — rationale: no controls or treatment history exist yet at create
     time to justify a lower number than the raw inherent score, so the owner's post-control judgment call
     (§3.1's "independently entered" design) starts equal to inherent and is revised downward later via
     Edit/Re-score once controls are actually in place; `status` defaults to **`active`**; `trend` defaults
     to **`flat`** (no history yet to show a direction); `review_due` defaults to **`NULL`**/unset (no cadence
     is set at create — matches R1 AC1's `date NULL` and the still-open review-cadence question in §7).
   - `owner`: captured as a **single-select field inside this same Details step** (**[AMENDED — B1(b)]**),
     not via the wizard's shared Assignees step — resolution: risk's single `owner` column (R1 AC1) does not
     match the Assignees step's multi-role `entity_people` write shape (which the other 4 wizard types use for
     multiple assignee roles); rather than forcing a single-column entity through a multi-row assignee model,
     **risk skips the Assignees step entirely** and captures `owner` as one more field in its own Details
     step. This is a small, additive wizard-flow branch (the step sequence becomes Type → Details → Review for
     `risk`, three steps instead of four), not a new wizard, and not a schema or Assignees-infrastructure
     change.
   - **Designer input required before build** (flagged for the UI Lead Designer's amendment pass, not
     resolved here): a board for this Details step (category/title/likelihood/impact/treatment/plan/owner
     fields, in the existing wizard visual language) — no jsx anywhere shows it.
2. Created risk gets a real code in the corrected `RISK-YYYY-NNNN` format (**[AMENDED]**, R1 AC1), sequence-
   generated via `packages/core/src/codes.ts` + the `counters` table, never client-supplied.
3. **[AMENDED-2 — N5, new]** `risk` is a real entry in `packages/core/src/create-wizard.ts`'s `WizardType`
   union, `WIZARD_TYPE_ORDER`, and the `WIZARD_TYPES` map (capability `risk:manage`, `hasPriorityAndDue:
   false` — risk has no priority/due-date field in its Details step, AC1 above; `templates: []` — risk has no
   sub-template choice). Confirmed this session by reading `create-wizard.ts`: `WIZARD_TYPE_ORDER` is the one
   array that feeds **both** the global "New" quick-create menu (`apps/web/src/components/shell/quick-create.tsx`)
   and the CreateWizard's Type-step card grid (`apps/web/src/features/create-wizard/type-step.tsx`) — adding
   `risk` there makes it a real 5th option in both places in one change, consistent with every other real
   module type already appearing in both (a risk should not be creatable only from a hidden entry point).
   `apps/web/src/features/create-wizard/wizard-meta.ts`'s `WIZARD_ICON`/`WIZARD_COLOR` maps (also
   `Record<WizardType, …>`, confirmed this session) gain a 5th entry — icon `Shield` (the same icon
   `navigation.ts`/R3 AC3 already establish for risk, kept consistent across nav, entity-links, and the
   wizard) and a color from the existing wizard palette, chosen by the designer (§5, flagged below) to be
   visually distinct from the other four type cards.

**Web/Mobile/Shared:** Web only (wizard extension: `WizardType`/`WIZARD_TYPE_ORDER`/`WIZARD_TYPES`/
`WIZARD_ICON`/`WIZARD_COLOR` additions in `packages/core`/`apps/web`, Details-step fields, and the three-step
branch for `risk`). Mobile: unaffected (CreateWizard has no mobile counterpart in this sprint's scope). Shared:
none beyond R1's types (the `WizardType` union lives in `packages/core`, already a shared package, but no
mobile consumer reads it this sprint).

### R5 — Risk board-pack export

**Design:** `qms-risk-spc.jsx:23` "Board pack" button (`kToast('Export started — risk-board-pack.pdf')` —
dead in the prototype).

UC
- Happy: click "Board pack" → real export enqueued via the existing `reports.export`/`run-export.ts`
  pipeline (same UX as `audit_report`/`predictive_forecast_pack`: progress toast → notification → download).

AC
1. `ExportResource` gains `"risk_board_pack"`.
2. `run-export.ts` gains a branch rendering the register (KPI strip + heat-map counts + full table, as scoped
   to the requesting caller's tenant) to PDF.
3. `risk:view` required to request it (viewing the register is enough to export it — mirrors
   `prediction:view` → `predictive_forecast_pack`, not `audit_report`'s stricter precedent, since exporting
   a read surface doesn't need the stronger `:manage` capability).

**Web/Mobile/Shared:** Shared (export resource + `run-export.ts` branch) + Web (wire the button).

### M1 — MSA schema + AIAG Gauge R&R math (`packages/core/gauge-rr.ts`)

**Design:** `MSAStudy` full component (`qms-risk-spc.jsx:549-671`) — KPI tiles, variance-components table,
variation-by-source chart. **See §3 for the full math this needs sign-off on.**

UC
- Happy: a completed study's variance-component table, KPI tiles, and verdict are all computed from real
  entered measurements, not the jsx's static numbers (14.2%/8.4%/11.6%/ndc 8 are the prototype's fixture,
  not what every real study will show).
- Incomplete study: a study missing measurements can't be analyzed yet — `GET .../analysis` returns a
  "needs N more measurements" state, not a divide-by-zero or a fabricated result.
- Permission: `msa:view` to read; `msa:manage` to create/edit/enter data.

AC
1. Migration `0065_msa.sql`: `msa_studies` (`tenant_id`, `id`, `code` (**[AMENDED] `MSA-YYYY-NNNN`** — same
   `codes.ts`/`counters` fix as R1 AC1; `CodeKind` gains `"msa"` → prefix `MSA`), `title`/`characteristic`,
   **`gauge_label` text** (free-text instrument name — see §3 for why this is text, not an FK, this sprint),
   `method` enum (`crossed_anova|average_range` — exactly P15's two values; "Nested"/"Attribute (kappa)" are
   explicitly **not** built, §7 Q23), `n_appraisers` int, `n_parts` int, `n_trials` int, `tolerance` numeric
   NULL (drives `%Tolerance`; null when the study has no declared tolerance — `%Tolerance` then reads "—"),
   `status` enum (`draft|completed`), `owner` (composite member FK), **`completed_at` timestamptz NULL — see
   §3-Addendum, a genuinely new column not in the originally-approved §3, pending delta-approval**,
   `lock_version`, standard audit columns. `msa_measurements` (`tenant_id`, `study_id` composite FK →
   `msa_studies(tenant_id, id)` CASCADE, `appraiser` int, `part` int, `trial` int, `value` numeric NOT NULL,
   audit columns; unique `(tenant_id, study_id, appraiser, part, trial)`). Both forced RLS, leading
   `tenant_id` index.
2. `packages/core/gauge-rr.ts` (pure) implements **both** enum methods for real — see §3 for the exact
   formulas — unit-tested against a published AIAG worked example (not fabricated numbers).
3. `GET /v1/msa-studies/:id/analysis` computes variance components + `%StudyVar` + `%Tolerance` + `ndc` +
   verdict on read from the study's real measurements (never stored pre-computed, so edits to measurements
   are always reflected).
4. **[AMENDED — B5(a)] `average_range` method bounds, explicit (`[AMENDED-2 — N2]` typo fixed: both bounds
   below now read the same inclusive-set form):** the published AIAG Average-Range K-tables (K1/K2/K3, §3.2)
   only cover **trials 2-3, appraisers 2-3, parts 2-10**. Values outside this range are only mathematically
   valid for `crossed_anova` (which needs no K-table lookup). `average_range` with any of `n_trials ∉ {2,3}`,
   `n_appraisers ∉ {2,3}`, or `n_parts ∉ [2,10]` is invalid and must never be computed — see M2 AC4 for where
   this is enforced.
5. **[AMENDED-2 — N3] `crossed_anova` bounds and a shared upper cap for both methods, previously unstated:**
   `crossed_anova` has no K-table, but its ANOVA math divides by degrees of freedom that reach zero below a
   minimum design — **minimum 2 appraisers, 2 parts, 2 trials** for `crossed_anova` (`(a−1)(p−1)` and
   `a·p·(n−1)` degrees of freedom must both be ≥1, so 2/2/2 is the hard floor below which the math cannot
   run); below this, `POST /v1/msa-studies` with `method: "crossed_anova"` returns 422, mirroring AC4's
   enforcement for `average_range`. **Upper cap, both methods: 10 appraisers / 50 parts / 10 trials** —
   reasoning: 10×50×10 = 5,000 measurement rows is already far beyond any realistic Gauge R&R study (AIAG's
   own long-form default is 3×10×3 = 90), large enough that no legitimate study is ever blocked, while bounding
   the per-row live-computed `GET /v1/msa-studies` list query (M4) to a fixed worst case instead of an
   unbounded one; enforced in the same `packages/types` Zod schema as the lower bound (rule 4), 422 on
   violation for either method. **Designer needs:** the MSA wizard's Step 1/2 bound-hint text (already flagged
   in §5 item 2 for the Average-Range bounds) must also name this upper cap, so the caps are visible, not just
   enforced silently server-side.

**Web/Mobile/Shared**
- **Web:** none directly here (M3 consumes the analysis read).
- **Mobile:** not designed; unaffected.
- **Shared:** migration `0065`, `MsaStudyDto`/`MsaMeasurementDto`/`MsaAnalysisResult`/`MsaMethod` in
  `packages/types`, `packages/core/gauge-rr.ts` (pure, unit-tested), `msa:view`/`msa:manage` in
  `packages/core/src/rbac.ts`.

### M2 — New-study wizard + bulk measurement grid entry

**Design:** `qms-risk-spc.jsx:558` "New study" button (`kToast('New study — pick instrument & operators')` —
dead in the prototype); P15 §3 "New-study wizard (pick instrument + appraisers)."

UC
- Happy: "New study" opens a **dedicated wizard** (not the generic CreateWizard — see rationale below):
  step 1 picks characteristic/gauge label/method/tolerance, step 2 sets appraiser count/part count/trial
  count (defaults 3×10×3 per the AIAG long-form the jsx names), step 3 shows the empty appraiser×part×trial
  grid for data entry. Saving a partially-filled grid keeps `status: draft`; a fully-filled grid can be
  submitted, computing the analysis for the first time.
- Grid edit: an existing draft study's grid can be revisited and completed/corrected before `status` moves to
  `completed`; a `completed` study's measurements are read-only (re-opening for correction requires an
  explicit "reopen" action, audited).
- **[AMENDED-2 — N1, BLOCKING] Reopen for correction:** a `completed` study can be moved back to `draft` via
  an explicit, audited reopen action — this is the "Reopened for correction" / "completed on 2026-05-12" /
  "Save & re-complete" flow the MSA measurement-grid design board shows, and which this UC already named
  ("re-opening for correction requires an explicit reopen action, audited") before Ceremony 4's second pass
  caught that §3-Addendum's "`completed_at` set once, never updated again" text contradicted it. Once
  reopened, measurements become editable again exactly like a fresh draft; re-completing recomputes the
  analysis from whatever the grid now holds.
- Permission: `msa:manage` for all of the above; `msa:view` sees the read-only variance/verdict output once a
  study is `completed`.

AC
1. `POST /v1/msa-studies` (`msa:manage`) creates the study shell (`draft`).
2. `POST /v1/msa-studies/:id/measurements` (`msa:manage`) bulk-upserts grid cells — body:
   **[AMENDED-4]** `{ lockVersion, cells: [{appraiser, part, trial, value}] }` (not a bare array — the batch
   now carries the study's `lockVersion` like every other mutation in this sprint, bumping `lock_version` on
   success and returning **409** on a stale value). One audited `updated` event per submission batch (not
   per-cell — mirrors the FMEA/audits precedent of batching a multi-field edit into one audit row).
   **[AMENDED-3 — planner round 3; AMENDED-4 — split by layer]** Guards, checked server-side: (a) an
   **integer-range check** (each index is a positive integer no greater than the shared upper cap, 10/50/10)
   lives in the `packages/types` Zod schema, shared by web/mobile (rule 4); (b) two further checks need the
   study's own row, not just the request body, so they live in `MsaService.recordMeasurements`, inside the
   same transaction as the `lockVersion` check above, not the Zod schema (Zod cannot see database state):
   **posting to a `status: completed` study is rejected** — "a completed study's measurements are read-only"
   (this AC's own UC line, previously stated only in prose, not enforced) now has a real check: a measurement
   batch against a `completed` study 422s with a "reopen the study first" message, never silently edits it;
   and **any cell whose `appraiser`/`part`/`trial` index falls outside the study's own declared
   `1..n_appraisers`/`1..n_parts`/`1..n_trials`** (AC1, checked against the row, not the global cap) 422s —
   this closes the gap where AC3's "every cell is filled" completeness count could otherwise be satisfied by
   a grid with out-of-range indices standing in for missing in-range ones. **The `lockVersion` check on this
   route is what actually closes the race the completed-study guard alone cannot:** without it, a batch that
   read the study as `draft` could still commit after a concurrent completion elsewhere finished first,
   writing into an already-`completed` study between this route's read and write — the same lockVersion the
   "Save & re-complete" flow uses (its own second call, completing, passes the `lockVersion` this save
   returns) makes that interleaving a 409, not a silent corruption, matching rule 6's optimistic-concurrency
   requirement for every mutation in this sprint, this route included.
3. A `PATCH /v1/msa-studies/:id` moves `draft → completed` once every cell is filled (validated server-side:
   `n_appraisers × n_parts × n_trials` measurements must exist); attempting to complete an incomplete grid
   is a 422, not a silently wrong analysis. This transition sets `completed_at = now()` — **[AMENDED-2 — N1]**
   on a **first** completion this is a fresh value; on a **re-completion after a reopen** (AC5 below) it
   **overwrites** the previous `completed_at` with the new timestamp, since the column's purpose (§3-Addendum,
   corrected) is "when was this study most recently completed," not "when was it first completed."
   **[AMENDED-3]** This is the ONLY transition a study's `PATCH /v1/msa-studies/:id` performs — `method`,
   `n_appraisers`, `n_parts`, `n_trials`, `gauge_label`, `tolerance`, and `characteristic` are all set once at
   `POST /v1/msa-studies` and are **immutable** for the life of the study (a study with different dimensions
   is a new study, not an edit to this one — this also closes the gap where changing counts after measurements
   exist could silently invalidate AC4's bounds checks or AC2(b)'s index checks against stale dimensions); the
   route accepts no other body fields. Like every other status-transition route in this codebase (reopen,
   AC5 below; CAPA/NCR/SCAR/8D status transitions), this transition is audited as **`status_changed`**, not
   generic `updated`, and requires the request's `lockVersion` to match the study's current `lock_version`,
   returning **409** on a stale value (rule 6's optimistic-concurrency requirement, same as every other
   mutation in this sprint). **[AMENDED-4]** The request body is `.strict()` — `{ status: "completed",
   lockVersion }` and nothing else (no dimension fields, per the immutability rule above; an extra field is a
   422, not silently dropped). Completing an already-`completed` study is also a 422 (mirrors reopen's own
   "already-`draft` is a no-op 422," AC5 below) — completion, like reopen, is a one-way transition from a
   specific source state, never a no-op success.
4. **[AMENDED — B5(a); AMENDED-2 — N2/N3] Method bounds enforcement, both methods, both layers, exact and
   consistent everywhere (design board, M1 AC4/AC5, M2 AC4):** server-side is authoritative —
   - `POST /v1/msa-studies` with `method: "average_range"` and any of `n_trials ∉ {2,3}` /
     `n_appraisers ∉ {2,3}` / `n_parts ∉ [2,10]` returns **422**.
   - `POST /v1/msa-studies` with `method: "crossed_anova"` and any of `n_appraisers < 2` / `n_parts < 2` /
     `n_trials < 2` returns **422** (N3 — the ANOVA degrees-of-freedom floor, M1 AC5).
   - `POST /v1/msa-studies` with **either** method and any of `n_appraisers > 10` / `n_parts > 50` /
     `n_trials > 10` returns **422** (N3 — the shared upper cap, M1 AC5).
   - All three checks are enforced in the same `packages/types` Zod schema so web/mobile share the same rule
     (rule 4). Client-side, the wizard's Step 1 method picker (M2 design, below) **disables** the
     `average_range` option whenever Step 2's currently-entered counts already fall outside its bounds (or,
     in step order 1-then-2, disables/greys the out-of-range values in Step 2 once `average_range` is chosen),
     and Step 2's count inputs are hard-clamped to the shared upper cap regardless of method — a pre-emptive
     UX guard, not the enforcement of record; the 422s above are what tests assert against.
5. **[AMENDED-2 — N1, BLOCKING] Reopen route:** `PATCH /v1/msa-studies/:id/reopen` (`msa:manage`) — a
   dedicated sub-route rather than folding into the general `PATCH /v1/msa-studies/:id`, because a reopen is a
   one-way, single-purpose state transition (like `completed → draft` here, mirroring how other modules give
   their own status-transition actions dedicated routes rather than overloading the general PATCH with a
   status-transition side-channel) — only valid from `status: completed`, moving it to `status: draft`;
   attempting to reopen an already-`draft` study is a 422 (no-op transition, not silently ignored). This is
   audited as **`status_changed`**, not generic `updated` — a new, distinct audit action for this route, not a
   generic mutation, following the precedent already established elsewhere in this codebase for status
   transitions (CAPA `capa.service.ts:430,472`, NCR `ncr.service.ts:467,512,688`, SCAR, 8D, audits,
   inspections, PPAP, documents, portal — all write `status_changed` for their own status-affecting
   transitions, confirmed by grep this session; `status_changed` is an existing `AuditAction` enum member,
   `packages/types/src/enums.ts:389`, so this needs no new enum value). **`completed_at` is kept, not
   cleared**, while the study sits in the reopened `draft` state (§3-Addendum correction, AC3 above) — so the
   study page and M4's list can still show "last completed on 2026-05-12" alongside the "Reopened for
   correction" banner during the correction window, matching the design board's own literal text.
   **[AMENDED-3]** Like AC3's completion transition, reopen requires the request's `lockVersion` to match the
   study's current `lock_version`, returning **409** on a stale value — no status-transition route in this
   sprint is exempt from the optimistic-concurrency rule every other mutation follows. Reopening changes only
   `status` (and bumps `lock_version`); no other field is reset by a reopen, and a study may be reopened more
   than once (each reopen/re-complete cycle is its own audited pair, with no cap on how many times).

**Design decision (logged, not gated — see rationale):** this sprint builds MSA study creation as its **own**
wizard, not the shared 4-step CreateWizard, because the entry shape (appraiser/part/trial dimensions, then a
grid, not a flat field form) doesn't fit CreateWizard's Type/Details/Assignees/Review shape — this mirrors
the same reasoning Q1 already accepted for CAPA's own dialog. Smallest-reasonable-choice, logged in
PROGRESS.md Decisions log at build time, not a Q2-style gate item.

**Web/Mobile/Shared:** Web (`apps/web/src/features/msa/` wizard + grid). Mobile: unaffected. Shared: none
beyond M1's types.

### M3 — MSA study page: KPI tiles, variance table, chart, verdict

**Design:** `qms-risk-spc.jsx:562-635` (KPI tiles, variance-components table, variation-by-source SVG chart,
verdict banner).

UC
- Happy: `/msa` shows the 4 KPI tiles (Total GR&R %, EV %, AV %, ndc) and the active/selected study's full
  variance-components table + chart + verdict banner, all real (§ M1).
- Acceptable/reject verdict: **[AMENDED-2 — N6(c), wording fix]** verdict banner text and color follow the
  real thresholds (§3) and use exactly one verdict vocabulary — `excellent`/`acceptable`/`reject` — never the
  jsx's always-green "Acceptable" copy, and never a second vocabulary like "pass"/"marginal"/"fail".
- Empty (no completed study yet): KPI tiles read "—"/0, no fabricated 14.2%-style placeholder.
- Permission: `msa:view`; role without it → hidden nav + 403 deep-link.

AC
1. All values in the KPI tiles, table, and chart come from `GET /v1/msa-studies/:id/analysis` — none are
   hard-coded.
2. **[AMENDED — B5(b)] Verdict precedence, restated as unambiguous if/elif/else order** (the reject
   conditions are checked **first**, so `%StudyVar ≥30%` always wins over `ndc<5` being separately true, and
   neither can be shadowed by an acceptable-range check running first):
   ```
   if %StudyVar >= 30% or ndc < 5:
       verdict = "reject"
   elif 10% <= %StudyVar < 30%:      # ndc >= 5 is implied here, since reject already caught ndc < 5
       verdict = "acceptable"
   else:                              # %StudyVar < 10% and ndc >= 5
       verdict = "excellent"
   ```
   This is a restatement of the same rule already in §3.2 (no new threshold, no schema change) — it removes
   the ambiguity the planner flagged in the original prose ordering.
3. **[AMENDED-2 — N6(c)] Verdict vocabulary, restated explicitly: exactly one, everywhere.** The UI wording is
   `excellent`/`acceptable`/`reject` in **every** place a verdict is shown — the M3 banner text, and any
   verdict chip/badge elsewhere (e.g. M4's recent-studies list). This matches §3.2's own enum values and the
   jsx's own banner text (`qms-risk-spc.jsx`'s literal copy), not the jsx's separate mock chip wording
   elsewhere in the same file that uses "pass"/"marginal"/"fail" — that second vocabulary is **not** built;
   there is exactly one verdict vocabulary in the product. If any design board currently shows
   "pass"/"marginal"/"fail" for a verdict chip, that is a design-board wording defect to fix before Gate 1
   (§5 item 12), not a second valid wording.
4. **[AMENDED — B5(e)] Verdict banner colors, resolved (a jsx color correction, logged in PROGRESS.md
   Decisions-log style at build time, not a silent override):** `excellent` = green, `acceptable` = **amber**
   (kept, not changed to the jsx mock's green), `reject` = red. The jsx mock renders its "Acceptable" banner
   in green, which contradicts the jsx's **own header text** on the same screen ("10-30% acceptable" is
   explicitly named as the caution band, not a success band). Amber is also the established `.k-*` token this
   codebase already uses for every other mid-tier/caution state (Sprint 02/03's severity-color convention),
   and reserving green for `excellent` alone keeps a consistent three-tier ladder (green=excellent,
   amber=caution/acceptable, red=reject) instead of two tiers sharing green. This is a deliberate correction
   of the jsx's color, not the sprint's earlier unresolved AC-vs-mock conflict — the designer only needs to
   update the color token in the `MSAStudy`-derived board to amber to match.

**Web/Mobile/Shared:** Web (`apps/web/src/features/msa/`). Mobile: unaffected. Shared: none beyond M1.

### M4 — Recent MSA studies list (scope-limited to real methods)

**Design:** `qms-risk-spc.jsx:637-664` "Recent MSA studies" table.

UC
- Happy: **[AMENDED — B5(d)]** lists real studies in **both** `draft` and `completed` status (corrected from
  the original "completed-only" text — the design boards (`MsaIncompleteState.dc.html`) already show a draft
  row, and M4 as originally written contradicted that), gauge label, method, date, GR&R %, ndc, verdict —
  cursor-paginated, **[AMENDED-2 — N6(b), confirmed]** the Date column applies to every row regardless of
  status, not completed rows only. A `draft` row shows **"—"** for GR&R%/ndc/verdict (not yet computable — a
  draft study may not have every cell filled, so no analysis is run for it) and a neutral "draft" status chip
  instead of a verdict badge.
- Scope: only `crossed_anova`/`average_range` studies exist for real; the jsx's mock "Nested" and "Attribute
  (kappa)" rows are **not reproduced** — this sprint does not build those two methods (§7 Q23), so the New
  Study wizard's method picker only offers the two real options, honestly, rather than offering a method
  that silently computes nothing or the wrong math.

AC
1. `GET /v1/msa-studies` (cursor, rule 6; filters `status`/`method`); **[AMENDED]** the list includes both
   `draft` and `completed` studies by default (no implicit status filter) — a caller narrows via the
   `status` filter if they want completed-only.
2. No UI control offers "Nested" or "Attribute (kappa)" as a selectable method (rule 10 — never a dead
   selectable option).
3. **[AMENDED-2 — N6(a), unambiguous, single field per row]** the "Date" column reads, exactly, in this
   precedence (no "or" left ambiguous):
   - `completed_at` when it is non-null — this covers every `completed` row, **and** a `draft` row that was
     previously completed and then reopened (M2 AC5): the reopen keeps `completed_at`, so its Date column
     still reads "last completed on X" until it is re-completed, matching the design board's own literal text.
   - `created_at` otherwise — a `draft` row that has never been completed (a genuinely new study) has no
     `completed_at` yet, so its Date column is the moment it was created. `updated_at` is never used for this
     column (the earlier "created_at or updated_at" wording is removed as ambiguous).
4. **[AMENDED — B5(d)]** `draft` rows render GR&R%/ndc/verdict as `"—"`, matching the M1/M3 "incomplete
   study" honest-empty-state convention — never a fabricated or zero value.

**Web/Mobile/Shared:** Web + Shared (list route, part of M1's contract surface).

### M5 — AIAG report export

**Design:** `qms-risk-spc.jsx:557` "AIAG report" button (`kToast('Export started — gauge-rr-aiag-report.pdf')`
— dead in the prototype).

UC
- Happy: click "AIAG report" on a specific study → real export enqueued (existing pipeline), rendering that
  study's full variance-component table + chart + verdict + raw grid to PDF.

AC
1. `ExportResource` gains `"gauge_rr_aiag_report"`.
2. `run-export.ts` gains a branch, scoped to one `studyId`, requiring `msa:view` (mirrors `audit_report`'s
   per-entity, pre-enqueue-checked precedent — a study id from another tenant 404s before enqueue, not after).

**Web/Mobile/Shared:** Shared (export resource + `run-export.ts` branch) + Web (wire the button).

### X1 — Cross-cutting: nav retirement, capability wiring, placeholder ledger

UC
- `/risk` and `/msa` resolve to the real modules for `admin`/`manager`/`auditor`. **[AMENDED-2 — N4, doc
  accuracy]** `inspector` and `viewer` hold `risk:view`/`msa:view` (AC1's grant matrix below) — a direct
  deep-link from either role does **not** 403 at the API; the API happily serves the page's data. What blocks
  them is the **client-side web route guard** (`roleSeesNavRoot`/the route-level nav check in
  `apps/web/src/config/rbac.ts`), which keeps `risk`/`msa` out of their `ROLE_NAV` set, so the shell hides the
  nav entry and the route guard redirects a direct deep-link away — this is a UI-curation gate, not a security
  boundary (the file's own doc comment says so explicitly: "It is NOT the security boundary"). `partner` has
  neither capability, so a partner deep-link **does** 403 server-side (partner is routed to `/portal` and
  never reaches this shell at all). Testing this UC means testing the web guard for inspector/viewer, and the
  real 403 only for partner.

AC
1. `packages/core/src/rbac.ts` gains `risk:view`, `risk:manage`, `msa:view`, `msa:manage`. Grant matrix
   (mirrors `fmea`'s exact distribution, since both modules live in the same `qms-risk-spc.jsx` file and
   serve the same audience): **admin** all four; **manager** all four; **auditor** all four (mirrors
   `fmea:manage`/`scar:manage` already being granted to auditor in the existing matrix — auditor is Kaenal's
   elevated quality-system role, not merely a read-only reviewer, per the existing 03 §3 table); **inspector**
   `risk:view`, `msa:view` only (mirrors `fmea:view`/`spc:view`); **viewer** `risk:view`, `msa:view` only
   (mirrors `fmea:view`/`spc:view`); **partner** neither (external portal, mirrors every other internal QMS
   capability — this is the one role for which a deep-link genuinely 403s at the API).
2. **[AMENDED-2 — N4, BLOCKING]** `apps/web/src/config/rbac.ts` `ROLE_NAV`: `risk`, `msa`, **and `fmea`** are
   added to auditor's explicit `Set` (admin/manager already cover all three structurally). The `fmea` addition
   is a deliberate, in-scope fix, not an oversight: R3 grants auditor `risk:manage` and lets them create a
   risk→FMEA link (R3 AC6), but without this fix `fmea` stays outside auditor's nav set, so `entityHref("fmea",
   id)` would resolve to a route auditor's own nav guard blocks — a dead-end click for a role this very sprint
   grants the capability to (rule 10). Fixing it is a one-line `Set` addition, smaller than the cost of leaving
   a real dead-end for a role this sprint's own R3 story creates the click for. **This decision supersedes half
   of Q24** ("auditor's nav gap for `fmea`/`spc` is out of scope") **for `fmea` only** — noted here and in §7,
   not silently taken as credit for fixing `spc` too, which is left alone (`spc` stays out of scope; no story
   this sprint gives auditor a reason to click into it, so the same dead-end risk doesn't arise for it).
3. `RiskController`/`MsaController` routes carry `@RequireCapability` per §4's table.
4. Placeholder ledger entries `"planned:risk"`/`"planned:msa"` removed from `PLACEHOLDER_LEDGER`, and `risk`/
   `msa` removed from `PLANNED_MODULES` (mirrors how `fmea`/`spc` were removed from that map when they shipped
   — comments already in `planned-modules.ts` show the precedent).

**Web/Mobile/Shared:** Web + Shared (capability + nav config). Mobile unaffected.

---

## 3. Backend design — PROPOSED, NEEDS EXPLICIT USER SIGN-OFF (P12 + P15)

*(This is the section to extract and present alone for approval, per ROADMAP §0 Q2 — mirrors Sprint 03's
§3B practice. NO code for either module is written until this is approved.)*

### 3.1 Risk register (P12) — schema recap and the one real design decision

The schema is in §2 R1/R2 AC1-AC1 above (not repeated here) with one substantive judgment call carried over
from P12's own open question ("is residual entered or derived from treatment effectiveness?"):

**Proposed: `residual_score` is directly entered by the risk owner**, independent of `inherent_score`
(`likelihood × impact`), not derived by any formula. Rationale: the jsx's own fixture data shows residual
scores that are *not* a clean function of inherent score and treatment type alone (e.g. R-001: inherent
4×5=20, residual 12 with treatment `mitigate`; R-008: inherent 3×2=6, residual 6 with treatment `accept` —
no consistent multiplier), meaning the design intends residual to be the risk owner's own post-control
judgment call, recorded directly — exactly how ISO 31000 risk registers are used in practice (the register
captures the assessor's stated residual position, which the controls list justifies narratively, not a
mechanically-derived number). No cross-field validation is enforced (residual is not forced ≤ inherent);
the UI may show a soft warning if residual > inherent, but this is not a hard block. **This is the one
detail in P12 open to adjustment as part of this sign-off** — an alternative (residual = inherent minus a
treatment-effectiveness discount) was considered and rejected as inventing a formula the design doesn't
show or justify.

Score bands (drives heat-map cell color, residual badge color, category health) are the jsx's own thresholds,
non-negotiable: **critical ≥16, high ≥10, medium ≥6, low ≥1** (`packages/core/risk-matrix.ts`).

### 3.2 MSA / Gauge R&R (P15) — the AIAG math, in full

**What is proposed to be built, precisely, because this is the part that must be numerically correct:**

**Both study designs use the standard AIAG 4th-edition crossed Gauge R&R layout**: `a` appraisers ×
`p` parts × `n` trials (default 3×10×3, the jsx's "AIAG long-form"), each appraiser measuring every part
`n` times in randomized order (randomization itself is a data-collection procedure, not something the
software enforces — the grid simply records whatever values are entered against appraiser/part/trial
coordinates).

**Method 1 — ANOVA (the `crossed_anova` enum value, the jsx's stated default "AIAG long-form"):**

Given the grand mean `x̿`, part means `x̄ₚ`, appraiser means `x̄ₐ`, and appraiser×part cell means `x̄ₐₚ`:

- `SS_part = n·a · Σ(x̄ₚ − x̄̿)²` — df = `p − 1`
- `SS_appraiser = n·p · Σ(x̄ₐ − x̄̿)²` — df = `a − 1`
- `SS_interaction = n · ΣΣ(x̄ₐₚ − x̄ₚ − x̄ₐ + x̄̿)²` — df = `(a−1)(p−1)`
- `SS_equipment (repeatability/error) = ΣΣΣ(xᵢⱼₖ − x̄ₐₚ)²` — df = `a·p·(n−1)`
- Mean squares `MS = SS / df` for each source.

**Interaction pooling — [AMENDED-5, post-build correction, 2026-09-29] the real, standard AIAG pooled-MSE
convention, not the zero-out variant originally proposed:** if the appraiser×part interaction is not
significant (`MS_interaction ≤ MS_equipment`, the common simplified pooling test used when a formal F-test
table isn't available), it is pooled by merging interaction and equipment into **one combined error term**,
`MSE_pooled = (SS_interaction + SS_equipment) / (df_interaction + df_equipment)`, and **this pooled value
replaces both `MS_interaction` and `MS_equipment` in every downstream formula below** — repeatability
included, not just the appraiser×part component. This is a correction to the originally-approved formula,
found during Slice 2's validation against the real, cited AIAG MSA 4th-edition worked example ("Three Ways
to Analyze a Gage R&R Study," BPI Consulting/SPC for Excel, 2015): the original zero-out variant (below,
struck through) reproduced the published Average-Range results exactly but diverged from the published
ANOVA results by ~7% on `σ²_GRR` for that same real dataset (0.0981 vs the published 0.0914) — a genuine
methodological gap, not a rounding artifact, independently re-derived from the raw 90-value dataset before
concluding this. The pooled-MSE convention below reproduces the published numbers exactly (within the
source's own 3-decimal rounding). ~~The original proposal: "pool it into equipment/repeatability instead of
computing a negative variance component" using `MS_interaction`/`MS_equipment` unpooled everywhere except
the zeroed appraiser×part term itself~~ — superseded by the pooled-MSE formula below. This remains a fixed
rule, not a user-facing toggle.

Variance components (each clamped to ≥0 before taking a square root; **[AMENDED-5]** `MS_e` below denotes
`MSE_pooled` when pooling triggers, else the raw `MS_equipment`):
- `σ²_repeatability (EV) = MS_e`
- `σ²_appraiser×part = 0` (always, once pooled — there is no longer a separate interaction term to estimate;
  when NOT pooled, `σ²_appraiser×part = max(0, (MS_interaction − MS_equipment) / n)` as originally proposed,
  unchanged)
- `σ²_appraiser (AV component) = max(0, (MS_appraiser − MS_e) / (n·p))`
- `σ²_reproducibility (AV) = σ²_appraiser + σ²_appraiser×part`
- `σ²_GRR = σ²_repeatability + σ²_reproducibility`
- `σ²_part (PV) = max(0, (MS_part − MS_e) / (n·a))`
- `σ²_total = σ²_GRR + σ²_part`
- `StdDev` for every row = `√(variance)`.
- When NOT pooled (`MS_interaction > MS_equipment`), `MS_e` in the `σ²_appraiser`/`σ²_part` formulas above is
  `MS_interaction`, not `MS_equipment` — unchanged from the original proposal; only the pooled branch changes.

**Method 2 — Average & Range (the `average_range` enum value):** the classic AIAG X̄/R short-form using
K-factor constants (K1 for repeatability by trial count, K2 for reproducibility by appraiser count, K3 for
part-to-part by part count — the standard published AIAG K-tables, the same family of lookup tables
`spc.ts`'s `SUBGROUP_CONSTANTS` already establishes the precedent for encoding literally rather than
approximating). This method is simpler and does not need ANOVA's interaction term. Both methods are real,
unit-tested implementations — the `method` field is a genuine choice, not a cosmetic label over one
implementation.

**%StudyVar, %Tolerance, ndc (both methods, once variance components exist):**
- `StudyVariation = StdDev_source × k` where **k = 5.15** (AIAG 4th-edition default, 99% coverage — proposed
  explicitly here since the multiplier materially changes `%Tolerance`; 6.0/99.73% is the well-known
  alternative some shops use, but the jsx's own header text says "AIAG 4th Ed methods" and 5.15 is that
  edition's default, so this sprint proposes 5.15, not 6.0 — **flagged for the sign-off**, not silently
  chosen).
- `%StudyVar_source = 100 × StdDev_source / StdDev_total` (the `k` cancels — this ratio does not depend on
  the 5.15-vs-6.0 choice at all).
- `%Tolerance_source = 100 × (StdDev_source × k) / tolerance` (only computable when the study has a declared
  `tolerance`; shows "—" otherwise, per M1 AC1).
- `ndc = floor(1.41 × (StdDev_part / StdDev_GRR))` (the standard AIAG formula) — the jsx's own displayed
  ndc=8 for its 14.2%/GR&R example is the target validation number once a matching fixture is built.

**Verdict (drives the banner in M3 and the badge in M4):**
- `excellent`: Total GR&R %StudyVar < 10%
- `acceptable`: 10% ≤ %StudyVar < 30% **and** ndc ≥ 5 (matches the jsx's literal banner copy "Total GR&R
  14.2% is below 30% acceptable threshold per AIAG. NDC = 8 (≥5 required)" — both conditions are named
  together in the jsx's own text, so both are proposed as the real rule, not %GRR alone)
- `reject`: %StudyVar ≥ 30% **or** ndc < 5

**Unit-test obligation (non-negotiable part of this sign-off):** `packages/core/gauge-rr.ts` must be tested
against a **published AIAG worked example** (the AIAG MSA Reference Manual's own crossed-ANOVA worked
example, a citable public source), not a number invented for this sprint — mirrors `fmea.ts`'s "AIAG/VDA
table" and `forecast.ts`'s "hand-computed reference series" precedent for how this codebase validates
domain math it did not invent. The exact fixture numbers are an implementation detail fixed at build time
against that published source, not authored here.

**`instrument_id` — the one schema deviation from P15's own draft, proposed here:** P15's phase doc names
`instrument_id` as an FK "→ calibration [P16]" — but P16 (Sprint 05) does not exist yet (§1a). Building a
fake FK to a table that doesn't exist, or inventing a stub calibration table just to satisfy this FK, would
be scope creep into Sprint 05's own module. **Proposed:** `msa_studies.gauge_label` is a plain `text` column
this sprint (free-text instrument name, e.g. "Zeiss Contura" — matching what the jsx displays today, which is
itself just a label string, not a linked record anywhere in the mock). When Sprint 05 ships calibration, a
follow-up migration adds a real composite FK `instrument_id` and a backfill maps existing `gauge_label`
strings to instrument records where they match — logged here as a named follow-up (§7 Q22), not silently
dropped, and not blocking this sprint on a module three sprints away.

**What the user is being asked to approve:** the `risks`/`risk_controls` schema (§2 R1/R2) and the residual-
scoring judgment call (§3.1); the `msa_studies`/`msa_measurements` schema (§2 M1) including `gauge_label` as
text-not-FK this sprint (§3.2); the ANOVA method with its interaction-pooling rule; the Average-Range method;
the k=5.15 multiplier; the ndc formula; and the excellent/acceptable/reject verdict thresholds above — all of
which will be reproduced in the AIAG-report export and the on-screen KPI tiles/banner exactly as computed,
never adjusted for cosmetic effect.

### 3-Addendum — Ceremony 4 amendment: one new column, flagged for delta-approval

**This section is new. §3.1 and §3.2 above are UNCHANGED and remain approved as originally proposed
(2026-09-28) — nothing above this addendum was edited.** The Ceremony 4 SEND BACK review (planner) surfaced
five gaps (B1-B5); working through each against the already-approved schema, **exactly one** genuinely new
column is needed. Everything else the gaps raised (KPI formulas, verdict precedence, a/p/n bounds, draft rows
in M4, the verdict color) is resolved using columns and tables §3 already approved, or existing shared
infrastructure (`audit_events`), and needed no schema change — checked explicitly per gap, not assumed:

| Gap | Needs a new column? | Why / why not |
|---|---|---|
| B2 "Treatments overdue" | **No** | Uses `risks.review_due`, already in §3.1/R1 AC1, compared to `current_date`. |
| B2 "Accepted" | **No** | Uses `risks.status = 'accepted'`, already in §3.1/R1 AC1. |
| B2 "High residual" | **No** | Uses `risks.residual_score >= 10`, already in §3.1/R1 AC1; just a threshold fix (12→10). |
| B2 "Reviewed this quarter %" | **No** | Derived from the existing `audit_events` table's `entity_kind`/`entity_id`/`created_at`/`action` columns (migration `0015`), which every `risks` mutation already writes to via `withAudit` (rule 3). No new column, no new write path. |
| B5(a) a/p/n bounds | **No** | A validation rule over existing `n_appraisers`/`n_parts`/`n_trials` columns (§3.1/M1 AC1); no schema change. |
| B5(b) verdict precedence | **No** | A restatement of §3.2's existing thresholds in explicit order; no new threshold, no schema change. |
| B5(d) draft rows in M4 | **No** | Uses the existing `status` enum (`draft|completed`, §3.1/M1 AC1); no schema change. |
| B5(e) verdict color | **No** | A UI token choice, not a schema matter. |
| **B5(c) `completed_at`** | **YES** | M4's "Date" column needs the moment a study was completed. Checked against the originally-approved M1 AC1 schema recap (§2, before this amendment): it listed `tenant_id, id, code, title/characteristic, gauge_label, method, n_appraisers, n_parts, n_trials, tolerance, status, owner, lock_version, standard audit columns` — no `completed_at`, and "standard audit columns" (`created_at`/`updated_at`/`created_by`/`updated_by`/`deleted_at`) do not carry a domain-specific completion timestamp (`updated_at` changes on every edit, not just the draft→completed transition, so it cannot stand in for it). This is genuinely new. |

**What is asked of the user for delta-approval:** add **one column**, `msa_studies.completed_at timestamptz
NULL`. This is a strict, additive amendment to §3.2's `msa_studies` schema — nothing else in §3 changes.

**[AMENDED-2 — N1, BLOCKING — this replaces the round-1 text below, which contradicted the reopen flow the
MSA measurement-grid design board and M2's own UC already describe ("re-opening for correction requires an
explicit reopen action, audited"). The round-1 text said `completed_at` is "set once, never updated again";
that is corrected here to the following three explicit rules, which is what the user is now asked to approve:**

1. `completed_at` is set to `now()` the first time `PATCH /v1/msa-studies/:id` transitions the study
   `draft → completed` (M2 AC3).
2. A completed study can be moved back to `draft` via the new, dedicated `PATCH /v1/msa-studies/:id/reopen`
   route (M2 AC5) — a real, additive route this sprint adds, not a schema change (the column itself needs no
   further alteration for this). Reopening is audited as `status_changed` (a distinct action from the
   generic `updated` risk/MSA mutations otherwise use, following the same precedent CAPA/NCR/SCAR/8D/audits/
   inspections already use for their own status transitions).
3. **Re-completing after a reopen overwrites `completed_at` with the new completion timestamp** (it reflects
   the latest completion, not the first) — **while `completed_at` is kept, not cleared, during the reopened
   `draft` state**, so the study page and M4's recent-studies list can still show "last completed on
   2026-05-12" alongside a "Reopened for correction" indicator until the study is re-completed.

This is now internally consistent with M2's UC and the design board: "set once" described only the column's
*first* write, not a lifetime constraint — the corrected text above states plainly that a later reopen +
re-complete cycle updates it again. **The already-approved §3 does not need to be re-approved in full; only
this one column, together with the three rules above governing when it is (re)written, needs the user's
explicit delta sign-off before `0065_msa.sql` and the `reopen` route are written.**

---

## 4. Backend needs

| Story | Migration | Contract / REST route | Service | Audit events | RBAC | Tenant isolation |
|---|---|---|---|---|---|---|
| R1 | `0064_risk_register.sql` (`risks`) | `GET/POST /v1/risks` (**[AMENDED-2 — N4/doc-accuracy] gains an `ids` filter param**, for batch-resolving risk labels from FMEA's reverse pane), `GET/PATCH /v1/risks/:id` | `RiskService` + `packages/core/risk-matrix.ts` (pure) | `created`/`updated`, in-tx | `risk:view` / `risk:manage` | forced RLS; cross-tenant id → 404 |
| R2 | `0064` also (`risk_controls`) | folded into `PATCH /v1/risks/:id` (`controls[]`) | `RiskService` | `updated` (parent risk), in-tx | `risk:manage` | forced RLS, cascades with parent |
| R3 | `0064` also (`entity_links` CHECK widened; `EntityKind` gains `risk`,`fmea`) | reuses existing `GET/POST /v1/entity-links` (**[AMENDED-2 — doc-accuracy] response gains an optional, server-resolved, capability-checked `label` per link — see below, not "unchanged"**), `GET /v1/fmeas` (existing, client-filtered) | **[AMENDED-2 — doc-accuracy corrects the round-1 claim below]** `EntityLinksService` gains real, additive work, not "unchanged": (1) `entity-ref.ts`'s `ENTITY_TABLES` (a `Record<EntityKind, string>`) gets real `risk`/`fmea` entries — TS-forced by widening `EntityKind`, not optional; (2) `chat.ts`'s `ENTITY_SPECS` (a `Record<EntityKind, EntitySpec>`) gets real `risk`/`fmea` entries wired to `risk:view`/`fmea:view`, so the AI assistant's entity-context lookup doesn't break on the widened enum; (3) `apps/web/src/features/graph/graph-kinds.ts`'s `GRAPH_KINDS` (also a `Record<EntityKind, …>`) needs real `risk`/`fmea` entries too (TS-forced completeness) **but risk/fmea will NOT actually render in the graph explorer** — `apps/api/src/graph/graph.service.ts` keeps its own separate, literal `GRAPH_KINDS: readonly EntityKind[]` array that this sprint does not add them to — logged as **Q27 (new)** in §7, not silently fixed; (4) CAPA/document/supplier detail pages (`capa-detail.tsx`/`document-detail.tsx`/`supplier-detail.tsx`), which today each just truncate a raw link id (`id.slice(0,8)`, confirmed by grep), gain the resolved `label` field's real display **only** — a read-side change to their existing `LinkTable`/`LinkList`, no new write UI on any of the three. **[AMENDED-3 — doc fix]** The new `LinkPicker` component + `useCreateEntityLink` hook (design audit found no existing write-side UI anywhere) is wired to **risk's own detail page only** (R3 AC6, Q26, DoD) — CAPA/document/supplier gain the label fix but not a picker; this sentence previously read as if all three also gained the picker, which contradicted R3 AC6/Q26/the DoD's single-call-site statement | `linked`/`unlinked` (existing actions) | none (link visibility = each side's own capability); label resolution is capability-checked per target record | unchanged (existing `assertEntityVisible`); label omitted (never a raw/guessed value) when the caller can't view the target |
| R4 | none | CreateWizard's existing create route, `"risk"` type added (**[AMENDED-2 — N5]** also a real 5th entry in `WIZARD_TYPE_ORDER`/`WIZARD_TYPES`, feeding both the quick-create menu and the Type-step grid) | `RiskService.create` (shared with R1) | `created` | `risk:manage` | forced RLS |
| R5 | none | `ExportResource` gains `"risk_board_pack"` | `run-export.ts` new branch | existing export-created event | `risk:view` | scoped to caller's visible risks before enqueue |
| M1 | `0065_msa.sql` (`msa_studies` incl. **[AMENDED — B5(c), pending delta-approval] `completed_at`**, `msa_measurements`) | `GET/POST /v1/msa-studies`, `GET/PATCH /v1/msa-studies/:id`, `GET /v1/msa-studies/:id/analysis` | `MsaService` (`.create`/`.complete`/`.reopen`/`.recordMeasurements`) + `packages/core/gauge-rr.ts` (pure) | **[AMENDED-4]** `created` (POST); `status_changed` (PATCH `:id`, the completion transition — not generic `updated`, matching reopen) | `msa:view` / `msa:manage` | forced RLS; cross-tenant id → 404 |
| M2 | none | `POST /v1/msa-studies/:id/measurements`, **[AMENDED-2 — N1, BLOCKING, new] `PATCH /v1/msa-studies/:id/reopen`** (`completed → draft`) | `MsaService.recordMeasurements`, `MsaService.reopen` | `updated` (measurement batch, in-tx); **`status_changed`** (reopen, in-tx — a new, distinct action from generic `updated`, matching the CAPA/NCR/SCAR/8D/audits/inspections precedent) | `msa:manage` | forced RLS |
| M3/M4 | none | `GET /v1/msa-studies` (list) | `MsaService.list` | read-only | `msa:view` | RLS-scoped |
| M5 | none | `ExportResource` gains `"gauge_rr_aiag_report"` | `run-export.ts` new branch | existing export-created event | `msa:view` | scoped to one `studyId`, pre-enqueue 404 check |
| X1 | none | `@RequireCapability` on both controllers | none | none | `risk:view`/`risk:manage`/`msa:view`/`msa:manage` added to `packages/core/src/rbac.ts` per §2 X1 AC1; **[AMENDED-2 — N4, BLOCKING]** `fmea` added to auditor's web `ROLE_NAV` `Set` (`apps/web/src/config/rbac.ts`), a UI-curation config change, not a capability | n/a |

Every mutation runs inside `withAudit` in the same transaction (rule 3); both list endpoints are
cursor-paginated (rule 6); all new Zod schemas live in `packages/types` (rule 4); risk-matrix and Gauge R&R
math are `packages/core` pure functions (rule 5), never computed in a controller or a React component.
Reserved migration range for this sprint: **`0064`-`0066`** (0064 risk register + controls + entity-links
widening, 0065 MSA tables, 0066 held as buffer for a build-time correction — Sprint 05 takes `0067` onward).

## 5. Design needs

**Existing binding jsx — designer audits these against the built screens, does not redraw them:**
- `RiskRegister` (KPI strip, 5×5 heat map, category bar, register table, detail card) — `qms-risk-spc.jsx`
  lines 1-224.
- `MSAStudy` (KPI tiles, variance-components table, variation-by-source chart, recent-studies table) —
  `qms-risk-spc.jsx` lines 549-671.

**NO existing jsx — designer must draw these, in the existing visual language, before Gate 1:**
1. **Risk controls editor** (R2) — the jsx's Controls block is read-only decoration; a real add/edit/remove/
   reorder UI for controls (type picker, description, strength picker) has no design reference at all.
2. **MSA New-study wizard + data-entry grid** (M2) — the jsx has zero UI for entering measurements (it only
   ever displays pre-computed results); a 3-step wizard + an appraiser×part×trial input grid needs a real
   design, in the visual language of the existing CreateWizard/audit-checklist grid precedents. **[AMENDED —
   B5(a)]** Step 1/2 of this wizard must also show, or reference, the Average-Range method's valid a/p/n
   bounds (trials 2-3, appraisers 2-3, parts 2-10) so the disabled-state affordance (M2 AC4) is visible, not
   just implied — designer adds this to the existing `MsaWizardSteps.dc.html` board rather than a new board.
3. **Risk 5×5 matrix click-to-filter interaction and empty states** (R1) — the jsx never demonstrates the
   filtered state or the zero-data state; needs a design pass consistent with Sprint 02/03's matrix/heat-map
   empty-state precedent.
4. **MSA "needs N more measurements" / incomplete-study state** (M1/M3) — no jsx state for this; needs the
   same honest-empty-state treatment Sprint 03's "not enough history" design established.
5. **[AMENDED — B1] Risk-create wizard Details step board** — no jsx anywhere shows risk's Details-step
   fields (category/title/likelihood/impact/treatment/plan/owner) or the three-step (Type→Details→Review)
   branch R4 now specifies; a new board is needed in the existing `CreateWizard` visual language.
6. **[AMENDED — B3] Risk detail-card linked-records panel** — R1's detail card now carries a read-side
   linked-records list (reusing `supplier-detail.tsx`/`capa-detail.tsx`'s existing visual pattern); designer
   confirms the existing pattern transplants directly (no new visual language) and shows it composed with the
   rest of R1's detail card in context.
7. **[AMENDED — B3] FMEA reverse-reference pane** — FMEA's detail view has **no** existing related-items
   display of any kind (confirmed by grep this session); a new, small, read-only pane ("Linked risks") is
   needed for FMEA's existing detail view, in FMEA's own visual language (not risk's).
8. **Risk/FMEA cross-link picker (`LinkPicker`)** (R3) — **[AMENDED — B4, corrects this item's earlier "no new
   visual treatment needed" claim]**: this is confirmed to be a **new** component (design audit §4.6 already
   drew it as `LinkPicker.dc.html`, following the `AssigneePicker` pattern) — not a reuse of an existing
   picker, since none existed. No further design work needed beyond what `DESIGN-04-risk-msa.md` §4.6 already
   drew; listed here only to correct the sprint file's own earlier inaccurate description of it as a pure
   reuse.
9. **[AMENDED — B5(e)] Verdict banner color token** — already resolved above (M3 AC4): the designer's
   existing `MSAStudy`-derived board needs its "Acceptable" banner swatch changed from the jsx mock's green to
   the amber `.k-*` token; no new board, a one-token edit to an existing one.
10. **[AMENDED-2 — N3, new]** The `MsaWizardSteps.dc.html` board (already touched per item 2 above for the
    Average-Range a/p/n bounds) also needs hint text for the **upper cap** this round adds: 10 appraisers / 50
    parts / 10 trials, applying to both methods — a short caption or disabled-state tooltip near the count
    inputs, e.g. "max 10 appraisers, 50 parts, 10 trials," so the server-enforced ceiling (M1 AC5/M2 AC4) is
    visible in the UI, not just silently rejected on submit.
11. **[AMENDED-2 — N5, new]** If a 5th wizard-type card ships (R4 AC3, recommended), the existing
    `createwizard.jsx`-derived Type-step board needs a 5th card added: icon `Shield` (reuse — already
    established for risk by `navigation.ts` and R3 AC3, no new icon to design) and a color from the existing
    wizard palette, visually distinct from the other four type cards. One new card, not a redesign of the
    grid.
12. **[AMENDED-2 — N6(c), copy fix if present]** Any design board that currently shows a second verdict
    vocabulary ("pass"/"marginal"/"fail") for the MSA verdict chip/badge (distinct from the banner's own
    `excellent`/`acceptable`/`reject` copy) needs that wording corrected to the same three values used
    everywhere else (M3 AC3) — one vocabulary, not two, anywhere in the product.
13. **[AMENDED-2 — N6(b), confirm]** Confirm the amended `MsaIncompleteState.dc.html`/recent-studies board
    still shows the "Date" column for **both** draft and completed rows (M4 AC1/AC3) — flagged here in case
    the amendment pass that added the draft row accidentally dropped the column for it.

**Copy fix (one line, not a new board):** the KPI tile label for "High residual" changes from the jsx's
"(≥ 12)" to "**(≥ 10)**" to match the corrected threshold (R1 AC6) — a single-character text edit on the
existing `RiskRegister`-derived KPI-strip board.

## 6. Dead-end audit

| Control | Current state | This sprint |
|---|---|---|
| Sidebar "Risk register" (`/risk`) | `PLANNED_MODULES["risk"]` placeholder | Real register + matrix (R1) |
| Sidebar "MSA / Gauge R&R" (`/msa`) | `PLANNED_MODULES["msa"]` placeholder | Real studies + analysis (M1-M4) |
| `RiskRegister` "Add risk" button | `kToast` only | Real create via CreateWizard (R4) |
| `RiskRegister` "Board pack" button | `kToast` only | Real export (R5) |
| `RiskRegister` "Edit"/"Re-score" buttons | `kToast` only | Real edit form (R1) |
| `RiskRegister` "Link to FMEA" button | `kToast` only, and FMEA isn't even a linkable kind today | **[AMENDED — B4]** Real, new `LinkPicker` component scoped to FMEA only (R3) |
| FMEA detail view | No related-items/linked-records display of any kind (confirmed by grep) | **[AMENDED — B3]** New reverse pane: "Linked risks," read-only (R3) |
| `RiskRegister` Controls block | Static, identical for every risk (fabricated per rule 10) | Real per-risk data (R2) |
| `RiskRegister` 5×5 matrix cell click | No interaction in the mock beyond a stated intent | Real click-to-filter (R1) |
| `MSAStudy` "New study" button | `kToast` only | Real wizard + grid (M2) |
| `MSAStudy` "AIAG report" button | `kToast` only | Real export (M5) |
| `MSAStudy` "Recent studies" "Nested"/"Attribute (kappa)" method rows | Mock-only, no backend, no spec | **NOT built** — no method picker offers them; logged §7 Q23, not silently faked |

No new "coming soon" text, no new dead button. The one control this sprint explicitly does **not** wire in
full ("Nested"/"Attribute (kappa)" MSA methods) is omitted from the method picker entirely rather than left
selectable-but-broken — CLAUDE.md rule 10 is "never stub," not "never say no."

## 7. Out of scope / open questions

- **Q22 (new).** `msa_studies.gauge_label` is free text this sprint because Sprint 05's calibration module
  (P16) doesn't exist yet; a real `instrument_id` FK + backfill is a named Sprint-05-adjacent follow-up
  (§3.2), not silently dropped.
- **Q23 (new).** "Nested" and "Attribute (kappa)" MSA methods appear in the jsx's mock "Recent studies" table
  but have no spec (P15 names only `crossed_anova|average_range`) and materially different math (kappa needs
  no variance components at all). Not built this sprint; a future story can add them if wanted, each needing
  its own sign-off on its own math the same way §3.2 does for the two methods built now.
- **Q24 (new, half-closed by Round 2 / N4).** Auditor's `ROLE_NAV` set already omitted `fmea`/`spc` despite
  holding their `:manage`/`:view` capabilities (a pre-existing inconsistency, not introduced by this sprint).
  Round 1 added `risk`/`msa` to auditor's set and left `fmea`/`spc` alone. **Round 2 (N4, X1 AC2) adds `fmea`
  too** — not as a retroactive general fix, but because this sprint's own R3 story hands auditor a `risk→fmea`
  link they could not click through without it (a genuine dead-end this sprint would otherwise introduce,
  rule 10). **`spc` remains open** — nothing in this sprint gives auditor a reason to navigate to `/spc`, so
  the same forcing function doesn't apply; a future small fix can still add it as originally logged. This
  sprint closes half of Q24 as a side effect of fixing its own dead-end, not as extra unrequested scope.
- **Risk review-cadence reminder job** (P12's own open question: "review cadence reminder job wanted?") —
  not built this sprint; no spec names a cadence or an owner-notification rule. If wanted, it's a small
  follow-up reusing the existing notification substrate (mirrors calibration's due-soon job precedent, which
  itself lands in Sprint 05) — logged, not invented here.
- **Q25 (new, from Ceremony 4 amendment, B3).** NCR/8D/audit/supplier's own detail pages do **not** get a new
  linked-records panel this sprint, even though FMEA does (a minimal reverse-reference pane, risk-only). Only
  risk's own detail card (read side) and FMEA's new reverse pane (risk-only) are in scope. Retrofitting a
  general related-records panel onto NCR/8D/audit/supplier is a separate future story on those modules' own
  backlog, not silently started or dropped here.
- **Q26 (new, from Ceremony 4 amendment, B4).** The generic `LinkPicker` component built for R3 is written to
  accept `kind` as a prop (so it isn't hard-coded to FMEA), but only the FMEA-scoped call site ships this
  sprint. Wiring it up for NCR/8D/audit/supplier link-creation is left to whichever future sprint owns that
  need — the component's existence doesn't imply those call sites are silently in scope now.
- **Q27 (new, Round 2 / doc-accuracy).** Widening `EntityKind` to include `risk`/`fmea` forces
  `apps/web/src/features/graph/graph-kinds.ts`'s `GRAPH_KINDS` map (a `Record<EntityKind, GraphKindMeta>`) to
  gain real entries for both, purely to satisfy TypeScript's exhaustiveness check — but `risk`/`fmea` nodes
  will **not** actually appear in the knowledge-graph explorer this sprint, because
  `apps/api/src/graph/graph.service.ts` keeps its own separate, literal `GRAPH_KINDS: readonly EntityKind[]`
  array (confirmed by reading it this session) that this sprint does not add them to. Wiring risk/FMEA into
  the graph explorer for real (seed kinds, plant-scoping, neighbor queries) is left as a named future story,
  not silently started or silently claimed as done here.
- Mobile: confirmed no `m-*.jsx` designs either module; both stay fully unaffected this sprint (no route, no
  nav, `pnpm --filter @kaenal/mobile typecheck` must stay green on the additive shared-type changes only).
- **Merge-conflict hot spots (ROADMAP §4):** this sprint touches `packages/types/src/contract.ts`,
  `packages/types/src/enums.ts`, `apps/web/src/config/navigation.ts` (no structural change, ids already
  exist), `planned-modules.ts`, `entity-routes.ts`, and `apps/web/src/config/rbac.ts` — one owner, rebase
  before PR, per the standing rule. This sprint stays off `sections/integrations.tsx` and does not touch
  anything under `apps/web/src/features/settings/`, so it does not intersect the two still-unpushed branches
  (`feat/partner-invite-mfa`, `feat/webhook-config-form`); no action needed beyond the standing caution.

## 8. Definition of Done

- [x] **User has explicitly approved §3** (risk residual-scoring decision; MSA schema incl. `gauge_label`
      text-not-FK; ANOVA method incl. interaction-pooling rule; Average-Range method; k=5.15; ndc formula;
      excellent/acceptable/reject thresholds) — **approved 2026-09-28, as proposed, no changes.**
- [x] **[AMENDED-2 — N1] User has explicitly approved §3-Addendum** (`msa_studies.completed_at timestamptz
      NULL`, set on first `draft → completed`; a new `PATCH /v1/msa-studies/:id/reopen` route moves
      `completed → draft`, audited `status_changed`; re-completing after a reopen **overwrites**
      `completed_at`; `completed_at` is **kept**, not cleared, while reopened) — **approved 2026-09-29, as
      proposed.** Build unblocked.
- [ ] Migrations `0064_risk_register.sql` (`risks`, `risk_controls`, `entity_links`/`EntityKind` widening)
      and `0065_msa.sql` (`msa_studies` incl. `completed_at`, `msa_measurements`) applied; `pnpm db:check`
      green; `pnpm test:rls` green including the two new tables and the widened `entity_links` kinds.
- [ ] `packages/core/risk-matrix.ts` unit-tested (score bands, matrix cell counts).
- [ ] `packages/core/gauge-rr.ts` unit-tested against a published AIAG worked example for **both** methods,
      including ndc and verdict banding, **and** the verdict if/elif/else precedence (M3 AC2), the
      `average_range` a/p/n bounds rejection (M1 AC4 / M2 AC4), **and [AMENDED-2 — N2/N3]** the
      `crossed_anova` minimum-bounds rejection (2/2/2) and the shared upper-cap rejection (10/50/10) for
      **both** methods.
- [ ] **[AMENDED-2 — N1, BLOCKING; AMENDED-4]** `PATCH /v1/msa-studies/:id/reopen` built and tested:
      `completed → draft` only, 422 on an already-`draft` study, audited `status_changed` (not `updated`),
      `completed_at` unchanged by the reopen itself, **409 on a stale `lockVersion`**, and a subsequent
      re-completion overwriting `completed_at` with the new timestamp — browser-verified end to end (complete
      a study → reopen → edit a measurement → re-complete → confirm `completed_at` updated and the analysis
      reflects the edit).
- [ ] **[AMENDED-4, new]** Completion (`PATCH /v1/msa-studies/:id`) tested for: 422 on an incomplete grid, 422
      on an already-`completed` study, `.strict()` body (extra fields 422, not dropped), audited
      `status_changed` (not `updated`), 409 on a stale `lockVersion`. Measurement batch
      (`POST .../measurements`) tested for: 422 on a `completed` study, 422 on any cell index outside the
      study's own `n_appraisers`/`n_parts`/`n_trials`, 409 on a stale `lockVersion` — including the race the
      lockVersion check closes (a batch and a concurrent completion cannot both succeed against the same
      version).
- [ ] `packages/core/src/codes.ts` gains `"risk"`→`RISK` and `"msa"`→`MSA` `CodeKind` entries, unit-tested;
      created risks/studies get real `RISK-YYYY-NNNN`/`MSA-YYYY-NNNN` codes via the `counters` table.
- [ ] R1's four non-quarter KPI formulas (High residual ≥10, Treatments overdue, Accepted) and the
      `audit_events`-derived "Reviewed this quarter %" formula are unit-tested against seeded fixtures, not
      eyeballed against the UI.
- [ ] Contract gains all routes in §4; `risk:view`/`risk:manage`/`msa:view`/`msa:manage` enforced via
      `@RequireCapability`; RBAC grant matrix matches §2 X1 AC1 exactly (mobile RBAC config, if any, stays
      untouched since neither module reaches mobile).
- [ ] Web `/risk` fully real: KPI strip (real formulas, §3-Addendum), 5×5 matrix w/ click-to-filter, category
      panel, register table, detail card w/ Edit/Re-score/Link-to-FMEA/controls editor/**linked-records
      panel**, CreateWizard "risk" type (3-step Type→Details→Review branch, B1 defaults), board-pack export,
      all empty/error/offline/permission states — browser-verified side-by-side against `qms-risk-spc.jsx`'s
      `RiskRegister` (with the Controls panel showing real per-risk data, not the jsx's fixed mock).
- [ ] Web `/msa` fully real: 4 KPI tiles, variance-components table, variation-by-source chart, verdict
      banner (amber `acceptable`, B5(e)), recent-studies list (2 real methods only, **draft rows shown with
      "—" per B5(d)**), New-study wizard w/ a/p/n bounds enforcement + grid entry, AIAG-report export,
      all empty/error/offline/permission states — browser-verified against `MSAStudy`.
- [ ] `/fmea` gains `?id=<uuid>` deep-link pre-select **and** a new "Linked risks" reverse pane (B3) — browser-
      verified that a risk's "Link to FMEA" round-trips to the real FMEA record and back, and that the FMEA
      record shows the risk back-reference.
- [ ] New `LinkPicker` component + `useCreateEntityLink` hook (B4) built and wired to risk's "Link to FMEA"
      only; no other call site added this sprint.
- [ ] **[AMENDED-2 — doc-accuracy]** `entity_links` read responses carry the server-resolved, capability-
      checked, tenant/plant-scoped `label` field; `capa-detail.tsx`/`document-detail.tsx`/`supplier-detail.tsx`
      render it instead of `id.slice(0,8)`; `GET /v1/risks?ids=` batch-resolves labels for FMEA's reverse pane;
      a link to a record the caller cannot view shows no label (never a raw id leak), browser-verified with a
      restricted-role account.
- [ ] **[AMENDED-2 — N5]** `risk` appears as a real 5th card in both the global "New" quick-create menu and the
      CreateWizard's Type-step grid (icon `Shield`, a distinct palette color) — browser-verified for a role
      holding `risk:manage`, and confirmed hidden for a role that lacks it (existing `creatableTypes` gating).
- [ ] **[AMENDED-2 — N4, BLOCKING]** Auditor's web nav includes `fmea` (alongside `risk`/`msa`); browser-
      verified end to end: an auditor creates a risk→FMEA link (R3) and clicks through to the real `/fmea?id=`
      record without hitting the client-side nav guard.
- [ ] Placeholder ledger entries `"planned:risk"`/`"planned:msa"` removed; `risk`/`msa` removed from
      `PLANNED_MODULES`.
- [ ] Full gate green: `pnpm typecheck && pnpm lint`, `pnpm test`, `pnpm test:rls`, `pnpm db:check`.
- [ ] Demo login re-seeded and proven 201 after the suite run (rule 12).
- [ ] `PROGRESS.md` updated (Current status + Decisions log: residual-scoring choice, `gauge_label`
      text-not-FK, k=5.15, interaction-pooling rule, Nested/Attribute-kappa exclusion, **the Ceremony 4
      amendment's `completed_at` delta-approval, the amber-not-green verdict-color correction with its
      reasoning, the `RISK`/`MSA` code-format fix, the audit_events-derived "reviewed this quarter" formula,
      the Round-2 `completed_at`/reopen semantics correction (N1), the `crossed_anova`/shared upper a/p/n
      bounds (N2/N3), the auditor `fmea`-nav fix and its partial closure of Q24 (N4), and the 5th CreateWizard
      type card for `risk` (N5)**) and `progress_mobile.md` gets an explicit "Sprint 04 — mobile unaffected"
      line (not silently skipped, per Sprint 02/03's own DoD lesson).

## 9. Out-of-scope confirmation

No scope beyond P12/P15 + FEATURES §12 + `qms-risk-spc.jsx`'s `RiskRegister`/`MSAStudy` components is
introduced. `FMEAWorkbench` and `SPCCharts` (the other two components in the same jsx file) are already
built (Phase F, SPC B5) and are not touched here except for the three small additive changes named above
(`fmea` becoming an `EntityKind`, `/fmea` gaining a `?id=` deep-link param, `/fmea` gaining one new read-only
"Linked risks" reverse pane per the Ceremony 4 amendment, B3). NCR/8D/audit gain no new panel and no other
change (Q25) and are fully untouched; **[AMENDED-3 — doc fix]** CAPA/document/supplier are *not* fully
untouched — per §4's R3 row, all three gain the resolved-`label` read-side display on their existing
`LinkTable`/`LinkList` (no new panel, no picker) — the new `LinkPicker` component itself is scoped to its one
FMEA call site only, on risk's own detail page (Q26).

---

**PO use-case sign-off: PENDING — Ceremony 4 Round 4 (mechanical) amendment issued, awaiting planner
re-confirmation.** Rounds 2 and 3's items are all resolved and re-verified; Round 4 closed the last two items
(a mislabeled audit action for completion, and a real concurrency race on the measurement-batch route with no
`lockVersion`, which the planner's fourth review caught and which is now closed the same way every other
mutation in this sprint is).

Every use case (happy/error/empty/permission/offline/cross-tenant) across R1-R5, M1-M5, and X1 maps to a
story with testable acceptance criteria and an explicit Web/Mobile/Shared split; the dead-end audit (§6)
accounts for every control the jsx introduces, with the one honestly excluded item (Q23, Nested/Attribute-
kappa MSA) named rather than faked, and one previously-undetected gap (the Controls sub-list, §1a/R2) caught
and given a real backend rather than being silently reproduced as fabricated static content. This covers
**use-case coverage only** — it does **not** constitute approval to write any code.

**Amendment status (2026-09-28, this session):** the planner's Ceremony 4 SEND BACK named five gaps (B1-B5)
plus two smaller items; all seven are now resolved in this file with specific, testable language (§0 summary
table; inline `[AMENDED]` markers at each touched AC/UC). Of these, **exactly one** surfaces a genuinely new
column — `msa_studies.completed_at timestamptz NULL` (§3-Addendum, B5(c)) — everything else was resolved using
already-approved schema or existing shared infrastructure (`audit_events`), confirmed explicitly per gap, not
assumed. **The already-approved §3 (2026-09-28) is unchanged and does NOT need to be re-approved in full; only
the §3-Addendum's one new column needs the user's separate delta sign-off before `0065_msa.sql` is written.**

Per ROADMAP §0 Q2, this sprint's backend build remains blocked until: (1) the planner re-reviews this
amendment and lifts the SEND BACK, and (2) the user grants delta-approval on §3-Addendum's `completed_at`
column. The design canvas (`DESIGN-04-risk-msa.md`) also needs its own amendment pass for the newly-named
boards (§5 items 5-7: risk-create wizard Details step, risk detail-card linked-records panel, FMEA reverse-
reference pane) and the board updates (§5 items 2, 9-13: Average-Range bounds note, verdict-color token fix,
the N3 upper-cap hint text, the possible 5th wizard-type card, the verdict-wording consistency check, and the
Date-column confirmation) before Gate 1 can close on the updated scope.

**Round 2 status (2026-09-28, same session, second SEND BACK — narrow):** the planner's second pass named six
precision items (N1-N6) plus four documentation-accuracy corrections to this file's own §4 table. All ten are
now resolved in this file with specific, testable language (§0's Round 2 summary table; inline `[AMENDED-2]`
markers at each touched AC/UC). Of these, **N1 and N4 were BLOCKING**:
- **N1** is resolved without reopening §3 itself — the contradiction was in the round-1 §3-Addendum's own
  prose ("set once, never updated again" vs. the reopen flow M2's UC already named), not in the approved
  schema. The addendum text is corrected in place (§3-Addendum) to three explicit rules (first-set, reopen via
  a new audited route, overwrite-on-re-complete, kept-while-reopened) — this is the exact text now being asked
  for delta sign-off, alongside the one new column, before `0065_msa.sql` **and** the new
  `PATCH /v1/msa-studies/:id/reopen` route are written.
- **N4** is resolved as a one-line `ROLE_NAV` config fix (X1 AC2), not a schema or capability change, closing
  half of Q24 as a named side effect.

No further schema change beyond N1's new route (no new column). Per ROADMAP §0 Q2, backend build remains
blocked until: (1) the planner re-reviews this Round 2 amendment and lifts the SEND BACK, and (2) the user
grants delta-approval on the corrected §3-Addendum text (the column **and** its reopen/overwrite/retention
rules together, as one package — not the round-1 text in isolation).

---

## 10. Gate 2 — PO acceptance verdict (2026-09-29, Ceremony 7)

**Verified independently this session** (not taken on the implementer's, `web-fidelity-reviewer`'s,
`security-reviewer`'s or `ci-gate-runner`'s word alone — commands re-run, code re-read, demo login re-proven):

| Check | Result |
|---|---|
| `pnpm --filter @kaenal/core test -- gauge-rr risk-matrix codes` | 77/77 green, incl. all AIAG worked-example, bounds, verdict-precedence, K-table tests |
| `pnpm --filter @kaenal/api test -- msa risk entity-links exports fmea` | 48/48 green |
| `pnpm --filter @kaenal/api test` (full) | 618/622 green; the same 4 failures `ci-gate-runner` reported (`webhook-config.test.ts` ×3, `scoped-transaction.test.ts` ×1) reproduced identically — confirmed pre-existing and unrelated (webhook SSRF/policy-default assertions and a DB-pool ECONNRESET, neither file touched by this sprint) |
| `pnpm test:rls` | 357/357 green (up from Sprint 03's 333 — consistent with `risks`/`risk_controls`/`msa_studies`/`msa_measurements` added) |
| `pnpm db:check` | 58 tenant tables, RLS lint clean |
| `pnpm typecheck` (all 7 packages) | Clean |
| `pnpm lint` | Clean, no findings |
| `pnpm --filter @kaenal/mobile typecheck` | Clean — independently re-run, not just trusted from the CI gate |
| Demo login | Re-seeded (`seed-demo.ts`) after this session's own `pnpm test`/`pnpm test:rls` runs, `POST /v1/auth/sign-in` → **201**, confirmed twice (once before, once after a stray process restart) |
| Migrations `0064`/`0065`/`0066` | Read in full: `apply_tenant_rls('risks')`/`('risk_controls')`, leading `tenant_id` indexes, composite member FKs, `entity_links` CHECK widened for `risk`/`fmea` exactly mirroring `0063`'s `finding` pattern; `0066` closes a real DB-CHECK/Zod-enum mismatch the exports suite itself caught |
| **R2 controls editor** | Confirmed real, not the old fabricated mock: `risk.service.ts` persists `risk_controls` via a delete-and-reinsert full-array replace inside the same `updated` audit event; `risk-controls-editor.tsx` derives its rows from `risk.controls` (the parent's real, per-risk data), keyed by `risk.id` so it resets cleanly per selected risk — no fixed four-row template anywhere |
| **M2 reopen/re-complete lifecycle + lockVersion race** | Read `msa.service.ts` in full: `recordMeasurements`/`complete`/`reopen` all check `lockVersion` first (409 on stale), `recordMeasurements` 422s on a `completed` study and on any out-of-range cell index, `complete` 422s on non-`draft` and on an incomplete grid, `reopen` 422s on non-`completed`; `completed_at` is overwritten on re-completion and kept (not cleared) through reopen. `apps/api/test/msa.test.ts`'s full-lifecycle test (draft→fill→complete→reopen→edit→re-complete) and its dedicated race test (a stale-lockVersion batch racing a concurrent completion → 409, not corruption) both pass and genuinely exercise every guard named above, not a superficial happy-path check |
| **Security fix** (`e472560`) | Read the diff in full: `entity-ref.ts`'s `assertEntityVisible` now takes an optional `membership` and 404s a foreign-plant primary entity for the four plant-scoped kinds (`inspection`/`ncr`/`audit`/`finding`, mirroring `graph.service.ts`'s own `PLANT_SCOPED_KINDS`); `isEntityVisible` reuses the same check to decide whether `entity-links.service.ts`'s `resolveLabel` may resolve a *linked* target's label. `entity-links.test.ts`'s new "plant scoping (SECURITY FIX)" block (4 tests, independently re-run, all green) proves the exploit is closed (foreign-plant label omitted despite holding the kind's `:view` capability), proves no over-correction (same-plant inspector and an unrestricted manager still see the label), and proves the fix applies at both read (`GET /v1/entity-links`) and write (`POST /v1/entity-links` 404s a foreign-plant target at link-creation time too) |
| **Dead-end audit (§6)** | `grep -rn "ModulePlaceholder"` finds no match anywhere near risk/msa; `PLANNED_MODULES` has no `risk`/`msa` keys (comments confirm "built — see app/(app)/risk|msa"); `apps/web/src/app/(app)/risk/page.tsx` and `.../msa/page.tsx` are real routes; `apps/web/test/placeholder-ledger.test.ts`'s structural check (every actual placeholder is ledgered, every ledger entry still exists) passes, which independently proves neither route is a stray, un-ledgered placeholder |
| RBAC grant matrix (X1 AC1) | `packages/core/src/rbac.ts` read in full: admin/manager/auditor all four capabilities; inspector/viewer `risk:view`/`msa:view` only; partner neither — exact match |
| Auditor nav fix (X1 AC2) | `apps/web/src/config/rbac.ts`'s `ROLE_NAV.auditor` set includes `risk`, `msa`, **and** `fmea` — exact match, confirmed by direct read |
| R4 wizard defaults | `create-wizard.ts`'s `buildCreateBody` sets `status: "active"`, `trend: "flat"`, omits `residualScore`; `risk.service.ts`'s `create` applies `body.residualScore ?? body.likelihood * body.impact` — matches R4 AC1's inherent-score default exactly |
| M4 Date column | `msa-page.tsx`: `longDate(study.completedAt ?? study.createdAt)` — exact match to AC3's precedence rule |
| M3 verdict vocabulary/color | `msa-page.tsx`'s verdict style map: `excellent`=success/green, `acceptable`=warning/amber, `reject`=danger/red; no "pass/marginal/fail" string anywhere in the MSA feature directory |
| R1 KPI zero-case | `risk-register-page.tsx`: `reviewedThisQuarterPct !== null ? ... : "—"`, and the service returns `null` at `total === 0` — exact match |
| Exports (R5/M5) | `run-export.ts` has real `risk_board_pack`/`gauge_rr_aiag_report` branches (not stubs), gated by `0066`'s widened CHECK |

**Minor, non-blocking gaps found:**

1. **`PROGRESS.md` "Current status" is stale**, same class of miss Sprint 03's Gate 2 flagged. Its top entry
   stops at "Slice 6: `/risk` web module" (2026-09-29) and never mentions the MSA web module (`4523ed3`), the
   CreateWizard risk story (`7d8dbcc`), the X1 nav/placeholder-retirement commit (`43affe0`), the security fix
   (`e472560`), or the two docker-compose fixes (`8e4a1be`, `e95c61d`) — five real commits undocumented. This
   is a direct miss against CLAUDE.md's session protocol and §8's own "PROGRESS.md updated" DoD line.
2. **`progress_mobile.md` has no Sprint 04 entry at all** (confirmed by grep — the file's "Current status"
   section's newest entry is still Sprint 03 Part B). §8 explicitly asks for "an explicit 'Sprint 04 — mobile
   unaffected' line" — missing, not just under-detailed. `pnpm --filter @kaenal/mobile typecheck` itself is
   clean (independently confirmed above), so the substance holds; only the record of it is missing.
3. **`GET /v1/risks/summary`'s own test is looser than the DoD asks for.** §8 says the four non-quarter KPI
   formulas and the audit-events-derived "reviewed this quarter" formula are "unit-tested against seeded
   fixtures, not eyeballed against the UI." `risk.test.ts`'s one `summary` test only asserts
   `toBeGreaterThanOrEqual(1)`-style loose bounds and never exercises the `review_due` overdue-date boundary,
   the exact `residual_score` 9-vs-10 high-residual boundary at the summary-endpoint level (thresholds ARE
   precisely tested in `risk-matrix.test.ts`'s `scoreBand`, which `summary()` calls — so the underlying logic
   is solid), or a real zero-risk tenant hitting the `null`/"—" path end-to-end. The implementation itself is
   correct (read and confirmed above); this is a test-thoroughness gap, not a functional defect.

**None of the three gaps above are functional defects** — every acceptance criterion I could exercise against
real code, real tests I re-ran myself, and the demo app's live sign-in checks out. All three are
documentation/test-thoroughness misses CLAUDE.md and this sprint's own DoD treat as part of "done," not
optional polish, so they block a clean close but not the underlying engineering.

**One forward-looking backlog candidate** (SCRUM.md's continuous-improvement rule, logged not built): this is
the **second consecutive sprint** (Sprint 03's Gate 2, then this one) where `PROGRESS.md`/`progress_mobile.md`
fell behind the actual commit history by several real slices before Gate 2 caught it. **Q28 (new):** worth a
small process fix — e.g. a pre-Gate-2 checklist step (or a lightweight CI check comparing `PROGRESS.md`'s
newest dated entry against `git log`'s newest feature commit date) that flags staleness automatically, rather
than relying on the PO to catch it by hand at acceptance time every sprint.

**Verdict: PO acceptance — ACCEPTED, conditional on `PROGRESS.md`/`progress_mobile.md` being brought current**
(gaps #1-#2 above) before the sprint is marked closed. Gap #3 (the loose `summary` test) should be tightened
in the same close-out pass or logged as an explicit follow-up if deferred — it is not a functional defect, but
the DoD's own wording ("not eyeballed") is not yet fully met. No product code, schema, or contract rework is
required: every migration, route, service, capability, audit event, and UI control this sprint introduced is
real, wired, and independently verified against running tests and code, not taken on any prior reviewer's word
alone.
