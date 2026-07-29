# P14 — SPC Charts (end-to-end)

**Status:** Backend 🔴 `PROPOSED` · FE 🔴
**Design jsx:** `qms-risk-spc.jsx` (`SPCCharts`, `SPCChart`)
**Spec:** FEATURES §12 — **designed here, needs sign-off**
**Value:** Statistical Process Control with Western Electric rules — the live "is the process in control?" signal, linkable to inspection data.

## 1. Feature scope (from jsx)
- Chart types: **X̄/R**, **I-MR**, **p-chart**, **c-chart**. Control limits from subgroup stats (jsx uses A2/D3/D4 constants for X̄/R). **USL/LSL** overlay, **Cp/Cpk**. **Western Electric runs rules 1–4** flag out-of-control points/patterns; **Configure alarm**; Export PDF. "Live link to inspection data."

## 2. Backend — `PROPOSED`, migration `0024_spc.sql`
- **`spc_charts`**: `tenant_id`, `id`, `code`, `name`, `chart_type` (`xbar_r|imr|p|c`), `characteristic`, `part_no`, `source` (`manual|inspection`), `subgroup_size` int, `usl`/`lsl`/`target` numeric, `rules_enabled` int[] (WE 1–4), `lock_version`. FORCED RLS.
- **`spc_samples`**: `tenant_id`, `chart_id`, `seq` int, `taken_at`, `values` numeric[] (subgroup), `source_inspection_id` (nullable composite FK). Unique `(tenant_id, chart_id, seq)`.
- **`packages/core/spc.ts`** (pure, **the crux**): control-limit math per chart type (X̄/R via A2/D3/D4; I-MR; p; c), **Cp/Cpk**, and **Western Electric rules 1–4** violation detection. Heavily unit-tested (deterministic, no I/O) — this is where correctness lives, not the UI.
- Contract: `GET /v1/spc-charts` (filters type/characteristic/part), `GET/POST /v1/spc-charts(/:id)`, `POST /v1/spc-charts/:id/samples` (append subgroup; may reference an inspection), `GET /v1/spc-charts/:id/analysis` (limits + Cp/Cpk + violations computed on read). Mutations `withAudit`; `lockVersion`.
- Enums: `SpcChartType`.
- **Inspection link:** a numeric inspection form-item can push a sample (optional job/seam) — the "live link"; start manual, wire the seam behind a flag.

## 3. Frontend (maps to jsx)
- **Route:** `/spc`.
- **Components:** chart-type Segmented, **SPCChart** SVG (points, center line, UCL/LCL, USL/LSL, **violation markers**), Cp/Cpk readout, WE-rules legend, Configure-alarm dialog, Export-PDF (async job).
- **States:** out-of-control emphasis, empty/loading/error.

## 4. Definition of Done
- [ ] X̄/R, I-MR, p, c charts render with correct limits from **core** (unit-tested), matching `qms-risk-spc.jsx`.
- [ ] Western Electric rules 1–4 flag the right points; Cp/Cpk correct.
- [ ] Sample append (manual + optional inspection seam) audited; RLS green; cross-tenant 404.

## 5. Dependencies & open questions
- Relates to: [P01](P01-inspections.md) (numeric data source), [P13](P13-fmea.md) (special characteristics).
- **Open (sign-off):** which WE rule set (WE 1–4 vs full Nelson 8)? subgroup constants table extent; is the inspection→sample auto-push in scope now?
