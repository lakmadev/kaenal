# P21 — Predictive Risk (end-to-end)

**Status:** Backend 🔴 `PROPOSED` · FE 🔴
**Design jsx:** `predictive.jsx`
**Spec:** FEATURES §10.2 — **designed here, needs sign-off**
**Value:** forward-looking risk scoring across suppliers / production lines / NCRs — "where will the next escape come from?"

## 1. Feature scope (from jsx)
- Ranked lists: **Production lines** and **Suppliers** by *predicted NC volume next quarter*; **NCR** risk. Forecast sparkline (history + forecast band), mini-trends, lead rows linking into supplier / NCR detail. Confidence bands.

## 2. Backend — `PROPOSED`, migration `0030_predictions.sql`
- **`risk_predictions`**: `tenant_id`, `id`, `subject_kind` (`supplier|line|ncr`), `subject_id`, `horizon` (e.g. `2026-Q3`), `predicted_value` numeric, `confidence` int, `band_low`/`band_high`, `history` numeric[], `reasoning`, `model_version`, `generated_at`. FORCED RLS, leading `tenant_id`.
- **Computation is a job, not user input:** `predict-risk` (nightly/weekly, per-tenant fan-out) reads historical NCRs/PPM/OTD/inspections and writes predictions. **v1 = transparent statistical baseline** in `packages/core/forecast.ts` (e.g. trend + seasonal naïve with a confidence band) — pure + unit-tested; a real ML/AI model is a later swap behind the same table (mirror the stub→real `AiProvider` pattern).
- Contract (**read-only surface**): `GET /v1/predictions?subject_kind=&order=predicted_value` (ranked, cursor), `GET /v1/predictions/:subjectKind/:id`. No user mutations (the job owns the data); reads are tenant-scoped, foreign-tenant → 404.

## 3. Frontend (maps to jsx)
- **Route:** `/predictive-risk`.
- **Components:** ranked **Cards** (Production lines / Suppliers), **ForecastSpark** (history+forecast+band), **MiniTrend**, **LeadRow** → supplier/NCR detail. Confidence display via Trust `ConfidenceMeter`.
- **States:** "not enough history" empty state, loading, error; **model/version + generated-at disclosure** (governance: predictions are advisory).

## 4. Definition of Done
- [ ] Ranked lines/suppliers/NCR forecasts + spark/band match `predictive.jsx`.
- [ ] Forecast baseline in **core** (unit-tested); predictions written by the job, surfaced read-only.
- [ ] Lead rows deep-link correctly; confidence + model version shown; cross-tenant 404.

## 5. Dependencies & open questions
- Depends on: [P08](P08-suppliers.md) (KPIs), [P02](P02-ncr.md) (history), [P01](P01-inspections.md).
- **Open (sign-off):** v1 statistical baseline vs AI model; horizon granularity; is "production line" a modeled entity yet (may need a lightweight `lines` reference)?
