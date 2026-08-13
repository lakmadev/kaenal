# P15 — MSA / Gauge R&R (end-to-end)

**Status:** Backend 🔴 `PROPOSED` · FE 🔴
**Design jsx:** `qms-risk-spc.jsx` (`MSAStudy`)
**Spec:** FEATURES §12 — **designed here, needs sign-off** · AIAG 4th Ed.
**Value:** proves the measurement system is trustworthy before you trust any inspection/SPC number.

## 1. Feature scope (from jsx)
- KPI header: **Total GR&R %**, **Repeatability (EV) %**, **Reproducibility (AV) %**, **ndc** (number of distinct categories ≥5), verdict (acceptable <30% / marginal / reject).
- Active study: instrument + **3 appraisers × 10 parts × 3 trials** (AIAG long-form). **Variance components** table: Source (Total GR&R, Repeatability, Reproducibility, Appraiser, Appraiser×Part, Part-to-Part, Total) with **StdDev, %StudyVar, %Tolerance**.

## 2. Backend — `PROPOSED`, migration `0025_msa.sql`
- **`msa_studies`**: `tenant_id`, `id`, `code`, `instrument_id` (→ calibration [P16]), `characteristic`, `method` (`crossed_anova|average_range`), `n_appraisers`, `n_parts`, `n_trials`, `tolerance`, `status`, `owner` (member FK), `lock_version`. FORCED RLS.
- **`msa_measurements`**: `tenant_id`, `study_id`, `appraiser` int, `part` int, `trial` int, `value` numeric. Unique `(tenant_id, study_id, appraiser, part, trial)`.
- **`packages/core/gauge-rr.ts`** (pure, **the crux**): AIAG Gauge R&R (ANOVA + average-and-range) → EV, AV, GR&R, Part-to-Part, Total Variation, **%StudyVar**, **%Tolerance**, **ndc**, verdict bands. Unit-tested against a known AIAG worked example (the jsx numbers: 14.2% GR&R, ndc 8 are a validation fixture).
- Contract: `GET /v1/msa-studies`, `GET/POST /v1/msa-studies(/:id)`, `POST /v1/msa-studies/:id/measurements` (bulk enter the grid), `GET /v1/msa-studies/:id/analysis` (variance components computed on read). Mutations `withAudit`.
- Enum: `MsaMethod`.

## 3. Frontend (maps to jsx)
- **Route:** `/msa`.
- **Components:** 4 KPI tiles (GR&R/EV/AV/ndc with verdict colors), variance-components table (StdDev/%StudyVar/%Tolerance), data-entry grid (appraiser×part×trial), New-study wizard (pick instrument + appraisers). AIAG-report export (async job).
- **States:** verdict color (green<30 / amber marginal / red reject), empty/loading/error.

## 4. Definition of Done
- [ ] KPI tiles + variance-components table match `MSAStudy` in the jsx.
- [ ] GR&R math in **core** matches an AIAG worked example (unit-tested), incl. ndc + verdict.
- [ ] Grid data entry audited; instrument link to calibration; RLS green; cross-tenant 404.

## 5. Dependencies & open questions
- Depends on: [P16](P16-calibration.md) (instrument), feeds [P14](P14-spc.md) trust.
- **Open (sign-off):** ANOVA vs average-range as default; attribute (Kappa) MSA in scope now or later?
