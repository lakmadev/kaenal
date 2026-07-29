# P16 — Calibration Management (end-to-end)

**Status:** Backend 🔴 `PROPOSED` · FE 🔴
**Design jsx:** `qms-modules.jsx` (`CalibrationManagement`, `INSTRUMENTS`)
**Spec:** FEATURES §12 — **designed here, needs sign-off** · **Code:** `CAL-NNN`
**Value:** IATF 16949 §7.1.5 — measurement-equipment control; overdue gauges invalidate results.

## 1. Feature scope (from jsx + `INSTRUMENTS`)
- Instrument register: `id`, name, **type** (CMM/Comparator/Profilometer/NDT/Caliper/Torque/Laser tracker), area/location, **last** + **next** calibration dates, **method** (internal ISO 10360 / external NABL/A2LA/UKAS), **status** (ok / warn / overdue), tolerance, days-until-due.
- Due-soon / overdue emphasis; certificate attachment; recall on overdue.

## 2. Backend — `PROPOSED`, migration `0026_calibration.sql`
- **`instruments`**: `tenant_id`, `id`, `code` (`CAL-NNN`), `name`, `type` (enum), `area`, `method`, `tolerance`, `interval_months` int, `last_calibrated` date, `next_due` date (generated = last + interval), `status` (derived ok/warn/overdue), `owner` (member FK), `lock_version`. FORCED RLS, leading `tenant_id`, unique `(tenant_id, code)`.
- **`calibration_events`**: `tenant_id`, `instrument_id`, `performed_at`, `result` (`pass|adjusted|fail`), `certificate_file_id` (→ Files), `performed_by`, `notes`. Each event advances `last_calibrated`/`next_due`.
- **`packages/core/calibration.ts`** (pure): status derivation (`warn` within N days, `overdue` past due), next-due from interval — unit-tested.
- Contract: `GET /v1/instruments` (filters type/area/status/due-soon), `GET/POST /v1/instruments(/:id)`, `POST /v1/instruments/:id/calibrations` (record event → recompute due), certificate via Files presign. Mutations `withAudit`.
- **Job:** `calibration-due` reminder (reuse the document-expiry reminder pattern) → notifications on warn/overdue.
- Enums: `InstrumentType`, `CalibrationResult`.

## 3. Frontend (maps to jsx)
- **Route:** `/calibration`.
- **Components:** InstrumentTable (type icon, next-due with **status color**, days-until, method), instrument detail (event history, certificate download), Record-calibration dialog (result + certificate upload), due-soon filter.
- **States:** overdue (red) / warn (amber) / ok (green), empty/loading/error.

## 4. Definition of Done
- [ ] Register + status colors + due tracking match `CalibrationManagement`.
- [ ] Recording a calibration advances next-due (core-tested) + attaches certificate (AV-gated).
- [ ] Due/overdue reminder job fires notifications; RLS green; cross-tenant 404.

## 5. Dependencies & open questions
- Feeds: [P15](P15-msa.md) (instrument link), [P01](P01-inspections.md) (gauge used).
- **Open (sign-off):** warn-window days; external-lab vendor tracking needed; block inspections that used an overdue gauge?
