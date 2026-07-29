# P22 — Reporting & BI (end-to-end)

**Status:** Backend 🟡 (async exports ✅; builder/aggregates new) · FE 🔴
**Design jsx:** `reports.jsx`, `prebuilt-dashboards.jsx`
**Spec:** 06 (exports), FEATURES §13
**Value:** turns operational data into the charts auditors and managers ask for — and schedules their delivery.

## 1. Feature scope (from jsx)
- **Reports hub** (My Reports), export history.
- **Pre-built dashboards** — Quality Overview, Inspection Performance, Compliance (charts: line, bar, donut, radar, gauge, heatmap, KPI).
- **Report builder** — drag-drop widget placement, data sources, filters, save/share, **scheduled email delivery**.
- Exports **PDF / CSV / XLS**, export history, scheduled recurring exports.

## 2. Backend
- ✅ **Async exports** shipped: the `exports` job + all three renderers (CSV/XLSX/PDF), export history. Scheduling/recurrence infra exists (used by inspections).
- 🟡 **New:**
  - **Aggregate/query endpoints** feeding the prebuilt dashboards (NCR trend series, inspection performance, compliance rollup, heatmaps). Prefer a small set of typed **`GET /v1/analytics/*`** aggregates over an arbitrary query engine — build only what a prebuilt dashboard needs (avoid inventing a generic BI backend).
  - **Saved reports**: `0031_reports.sql` → `reports` (`tenant_id`, `id`, `name`, `definition` jsonb {widgets, sources, filters}, `owner`, `shared` bool, `schedule` jsonb, `lock_version`). Scheduled delivery reuses the `exports` + `notify` jobs.
- Do **not** fabricate metrics — every widget maps to a real aggregate. Mirrors the dashboard "no invented scope" rule ([P07](P07-platform-core.md)).

## 3. Frontend (maps to jsx)
- **Routes:** `/reports`, `/reports/[id]`, `/reports/dashboards/[key]`.
- **Components:** ReportsHub (My Reports + history), **PrebuiltDashboard** renderer (line/bar/donut/radar/gauge/heatmap/KPI — a small chart kit), **ReportBuilder** (drag-drop widget canvas, source+filter pickers, save/share, schedule), export buttons → async job + download.
- **States:** empty ("no reports yet"), loading skeleton charts, error.

## 4. Definition of Done
- [ ] Prebuilt dashboards render from real `/v1/analytics/*` aggregates (no mock numbers).
- [ ] Report builder saves a definition, shares, and schedules email delivery via the export+notify jobs.
- [ ] Export PDF/CSV/XLS from any report; history shown; RLS on `reports`; cross-tenant 404.

## 5. Dependencies & open questions
- Depends on: data from [P01–P10]; export + notify jobs (✅).
- **Open (sign-off):** how generic is the builder v1 (fixed widget catalog vs freeform); which aggregates ship first; scheduled-email provider is a stub→real swap.
