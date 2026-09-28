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
     read-only query over existing audit history, not a new write path or column. This is the one formula the
     gap asked to check for a hidden schema need; checked, and none is needed.
7. Deep-link support uses the risk's opaque **uuid** `id`, never its human-readable `code` (**[AMENDED]** —
   corrects R1's own earlier text and mirrors how `entity_links`, which stores uuids not codes, already works
   everywhere else in the app): `/risk?id=<uuid>` pre-selects a risk (needed for R3's "open full record"
   click-through).

**Web/Mobile/Shared**
- **Web:** `apps/web/src/features/risk/` — `RiskRegisterPage` (KPI strip, heat map w/ click-to-filter,
  category bar, register table, detail card, **[AMENDED — B3] a linked-records panel on the detail card**
  reading `entity_links` for the selected risk — reuses the exact read-side pattern `supplier-detail.tsx`/
  `document-detail.tsx`/`capa-detail.tsx` already ship via `useEntityLinks`, no new backend route),
  empty/loading/error/permission states. Deep-link support: `/risk?id=<uuid>` (**[AMENDED]** — uuid, not
  `code`) pre-selects a risk (needed for R3's "open full record" click-through).
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

**Web/Mobile/Shared:** Web only (wizard extension: Details-step fields + the three-step branch for `risk`).
Mobile: unaffected. Shared: none beyond R1's types.

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
4. **[AMENDED — B5(a)] `average_range` method bounds, explicit:** the published AIAG Average-Range K-tables
   (K1/K2/K3, §3.2) only cover **trials 2-3, appraisers 2-3, parts 2-10**. Values outside this range are only
   mathematically valid for `crossed_anova` (which needs no K-table lookup). `average_range` with any of
   `n_trials ∉ {2,3}`, `n_appraisers ∈ {2,3}`, or `n_parts ∉ [2,10]` is invalid and must never be computed —
   see M2 AC4 for where this is enforced.

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
- Permission: `msa:manage` for all of the above; `msa:view` sees the read-only variance/verdict output once a
  study is `completed`.

AC
1. `POST /v1/msa-studies` (`msa:manage`) creates the study shell (`draft`).
2. `POST /v1/msa-studies/:id/measurements` (`msa:manage`) bulk-upserts grid cells (body: array of
   `{appraiser, part, trial, value}`), one audited `updated` event per submission batch (not per-cell —
   mirrors the FMEA/audits precedent of batching a multi-field edit into one audit row).
3. A `PATCH /v1/msa-studies/:id` moves `draft → completed` once every cell is filled (validated server-side:
   `n_appraisers × n_parts × n_trials` measurements must exist); attempting to complete an incomplete grid
   is a 422, not a silently wrong analysis. This transition sets **`completed_at = now()`** (§3-Addendum).
4. **[AMENDED — B5(a)] `average_range` bounds enforcement, both layers:** server-side is authoritative —
   `POST /v1/msa-studies` with `method: "average_range"` and any of `n_trials ∉ {2,3}` /
   `n_appraisers ∉ {2,3}` / `n_parts ∉ [2,10]` returns **422** (enforced in the `packages/types` Zod schema so
   web/mobile share the same rule, rule 4). Client-side, the wizard's Step 1 method picker (M2 design, below)
   **disables** the `average_range` option whenever Step 2's currently-entered counts already fall outside
   the bounds (or, in step order 1-then-2, disables/greys the out-of-range values in Step 2 once
   `average_range` is chosen) — a pre-emptive UX guard, not the enforcement of record; the 422 is what a test
   asserts against.

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
- Marginal/reject verdict: verdict banner text and color follow the real thresholds (§3), not always the
  jsx's green "Acceptable" copy.
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
3. **[AMENDED — B5(e)] Verdict banner colors, resolved (a jsx color correction, logged in PROGRESS.md
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
  cursor-paginated. A `draft` row shows **"—"** for GR&R%/ndc/verdict (not yet computable — a draft study may
  not have every cell filled, so no analysis is run for it) and a neutral "draft" status chip instead of a
  verdict badge. `completed_at` (§3-Addendum) backs the "Date" column for completed rows; `draft` rows show
  their `created_at` or `updated_at` instead (no completion date exists yet).
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
3. **[AMENDED — B5(d)]** `draft` rows render GR&R%/ndc/verdict as `"—"`, matching the M1/M3 "incomplete
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
- `/risk` and `/msa` resolve to the real modules for `admin`/`manager`/`auditor`; a direct deep-link from
  `inspector`/`viewer`/`partner` 403s server-side and the nav entries stay hidden client-side.

AC
1. `packages/core/src/rbac.ts` gains `risk:view`, `risk:manage`, `msa:view`, `msa:manage`. Grant matrix
   (mirrors `fmea`'s exact distribution, since both modules live in the same `qms-risk-spc.jsx` file and
   serve the same audience): **admin** all four; **manager** all four; **auditor** all four (mirrors
   `fmea:manage`/`scar:manage` already being granted to auditor in the existing matrix — auditor is Kaenal's
   elevated quality-system role, not merely a read-only reviewer, per the existing 03 §3 table); **inspector**
   `risk:view`, `msa:view` only (mirrors `fmea:view`/`spc:view`); **viewer** `risk:view`, `msa:view` only
   (mirrors `fmea:view`/`spc:view`); **partner** neither (external portal, mirrors every other internal QMS
   capability).
2. `apps/web/src/config/rbac.ts` `ROLE_NAV`: `risk`/`msa` added to auditor's explicit `Set` (admin/manager
   already cover them structurally). **Note:** `fmea`/`spc` have the same capability-vs-nav gap for auditor
   today (auditor holds `fmea:manage`/`spc:view` but `fmea`/`spc` aren't in auditor's nav `Set`) — this is a
   pre-existing inconsistency this sprint does **not** fix (out of scope; flagged in §7, not silently carried
   forward as a new instance of the same mistake for risk/msa).
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

**Interaction pooling (standard AIAG convention, proposed as-is):** if the appraiser×part interaction is not
significant (`MS_interaction ≤ MS_equipment`, the common simplified pooling test used when a formal F-test
table isn't available), pool it into equipment/repeatability instead of computing a negative variance
component. This is the standard guard against the well-known "negative variance component" artifact of the
ANOVA method on small studies — proposed as a fixed rule, not a user-facing toggle.

Variance components (each clamped to ≥0 before taking a square root):
- `σ²_repeatability (EV) = MS_equipment`
- `σ²_appraiser×part = max(0, (MS_interaction − MS_equipment) / n)` (0 if pooled)
- `σ²_appraiser (AV component) = max(0, (MS_appraiser − MS_interaction) / (n·p))`
- `σ²_reproducibility (AV) = σ²_appraiser + σ²_appraiser×part`
- `σ²_GRR = σ²_repeatability + σ²_reproducibility`
- `σ²_part (PV) = max(0, (MS_part − MS_interaction) / (n·a))`
- `σ²_total = σ²_GRR + σ²_part`
- `StdDev` for every row = `√(variance)`.

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
NULL`, set once, at the moment `PATCH /v1/msa-studies/:id` transitions `draft → completed` (M2 AC3), never
updated again. This is a strict, additive amendment to §3.2's `msa_studies` schema — nothing else in §3
changes. **The already-approved §3 does not need to be re-approved in full; only this one column needs the
user's explicit delta sign-off before `0065_msa.sql` is written.**

---

## 4. Backend needs

| Story | Migration | Contract / REST route | Service | Audit events | RBAC | Tenant isolation |
|---|---|---|---|---|---|---|
| R1 | `0064_risk_register.sql` (`risks`) | `GET/POST /v1/risks`, `GET/PATCH /v1/risks/:id` | `RiskService` + `packages/core/risk-matrix.ts` (pure) | `created`/`updated`, in-tx | `risk:view` / `risk:manage` | forced RLS; cross-tenant id → 404 |
| R2 | `0064` also (`risk_controls`) | folded into `PATCH /v1/risks/:id` (`controls[]`) | `RiskService` | `updated` (parent risk), in-tx | `risk:manage` | forced RLS, cascades with parent |
| R3 | `0064` also (`entity_links` CHECK widened; `EntityKind` gains `risk`,`fmea`) | reuses existing `GET/POST /v1/entity-links`, `GET /v1/fmeas` (existing, client-filtered) | `EntityLinksService` (unchanged) + **[AMENDED — B4] new web `LinkPicker` component + `useCreateEntityLink` hook** (design audit found no existing write-side UI; named explicitly here per its own flag) | `linked`/`unlinked` (existing actions) | none (link visibility = each side's own capability) | unchanged (existing `assertEntityVisible`) |
| R4 | none | CreateWizard's existing create route, `"risk"` type added | `RiskService.create` (shared with R1) | `created` | `risk:manage` | forced RLS |
| R5 | none | `ExportResource` gains `"risk_board_pack"` | `run-export.ts` new branch | existing export-created event | `risk:view` | scoped to caller's visible risks before enqueue |
| M1 | `0065_msa.sql` (`msa_studies` incl. **[AMENDED — B5(c), pending delta-approval] `completed_at`**, `msa_measurements`) | `GET/POST /v1/msa-studies`, `GET/PATCH /v1/msa-studies/:id`, `GET /v1/msa-studies/:id/analysis` | `MsaService` + `packages/core/gauge-rr.ts` (pure) | `created`/`updated`, in-tx | `msa:view` / `msa:manage` | forced RLS; cross-tenant id → 404 |
| M2 | none | `POST /v1/msa-studies/:id/measurements` | `MsaService.recordMeasurements` | `updated` (one event per batch), in-tx | `msa:manage` | forced RLS |
| M3/M4 | none | `GET /v1/msa-studies` (list) | `MsaService.list` | read-only | `msa:view` | RLS-scoped |
| M5 | none | `ExportResource` gains `"gauge_rr_aiag_report"` | `run-export.ts` new branch | existing export-created event | `msa:view` | scoped to one `studyId`, pre-enqueue 404 check |
| X1 | none | `@RequireCapability` on both controllers | none | none | `risk:view`/`risk:manage`/`msa:view`/`msa:manage` added to `packages/core/src/rbac.ts` per §2 X1 AC1 | n/a |

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
9. **[AMENDED — B5(e)] Verdict banner color token** — already resolved above (M3 AC3): the designer's
   existing `MSAStudy`-derived board needs its "Acceptable" banner swatch changed from the jsx mock's green to
   the amber `.k-*` token; no new board, a one-token edit to an existing one.

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
- **Q24 (new).** Auditor's `ROLE_NAV` set already omits `fmea`/`spc` despite holding their `:manage`/`:view`
  capabilities (a pre-existing inconsistency, not introduced by this sprint). This sprint adds `risk`/`msa`
  to auditor's set correctly and does **not** retroactively fix `fmea`/`spc` — flagged here so it isn't
  mistaken for something this sprint should have caught and silently didn't; a future small fix can add both.
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
- [ ] **[NEW] User has explicitly approved §3-Addendum** (`msa_studies.completed_at timestamptz NULL`) —
      delta-approval, separate from the checkbox above; blocks `0065_msa.sql` until granted.
- [ ] Migrations `0064_risk_register.sql` (`risks`, `risk_controls`, `entity_links`/`EntityKind` widening)
      and `0065_msa.sql` (`msa_studies` incl. `completed_at`, `msa_measurements`) applied; `pnpm db:check`
      green; `pnpm test:rls` green including the two new tables and the widened `entity_links` kinds.
- [ ] `packages/core/risk-matrix.ts` unit-tested (score bands, matrix cell counts).
- [ ] `packages/core/gauge-rr.ts` unit-tested against a published AIAG worked example for **both** methods,
      including ndc and verdict banding, **and** the verdict if/elif/else precedence (M3 AC2) and the
      `average_range` a/p/n bounds rejection (M1 AC4 / M2 AC4).
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
- [ ] Placeholder ledger entries `"planned:risk"`/`"planned:msa"` removed; `risk`/`msa` removed from
      `PLANNED_MODULES`.
- [ ] Full gate green: `pnpm typecheck && pnpm lint`, `pnpm test`, `pnpm test:rls`, `pnpm db:check`.
- [ ] Demo login re-seeded and proven 201 after the suite run (rule 12).
- [ ] `PROGRESS.md` updated (Current status + Decisions log: residual-scoring choice, `gauge_label`
      text-not-FK, k=5.15, interaction-pooling rule, Nested/Attribute-kappa exclusion, **the Ceremony 4
      amendment's `completed_at` delta-approval, the amber-not-green verdict-color correction with its
      reasoning, the `RISK`/`MSA` code-format fix, and the audit_events-derived "reviewed this quarter"
      formula**) and `progress_mobile.md` gets an explicit "Sprint 04 — mobile unaffected" line (not silently
      skipped, per Sprint 02/03's own DoD lesson).

## 9. Out-of-scope confirmation

No scope beyond P12/P15 + FEATURES §12 + `qms-risk-spc.jsx`'s `RiskRegister`/`MSAStudy` components is
introduced. `FMEAWorkbench` and `SPCCharts` (the other two components in the same jsx file) are already
built (Phase F, SPC B5) and are not touched here except for the three small additive changes named above
(`fmea` becoming an `EntityKind`, `/fmea` gaining a `?id=` deep-link param, `/fmea` gaining one new read-only
"Linked risks" reverse pane per the Ceremony 4 amendment, B3). NCR/8D/audit/supplier remain fully untouched
(Q25); the new `LinkPicker` component is scoped to its one FMEA call site only (Q26).

---

**PO use-case sign-off: PENDING — Ceremony 4 amendment issued, awaiting planner re-review.**

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
reference pane) and the two board updates (§5 items 2, 9: Average-Range bounds note, verdict-color token
fix) before Gate 1 can close on the updated scope.
