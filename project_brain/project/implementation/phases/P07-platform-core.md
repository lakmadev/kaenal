# P07 — Dashboard, Shell, Search & Notifications (end-to-end)

**Status:** Backend ✅/🟡 · FE 🟡 partial
**Design jsx:** `dashboard.jsx`, `shell.jsx`, `notifications.jsx`, `notifications-center.jsx`, `realtime-empty-skel.jsx`
**Spec:** 01, 03 §2, 04 §1–3, 06 (realtime), FEATURES §1, §3, §14
**Value:** the frame every feature lives in — nav, search, alerts, and the at-a-glance KPI landing.

## 1. Feature scope (from jsx)
- **Shell** (`shell.jsx`): collapsible sidebar (260↔72, grouped nav, badge counts, sub-navs, "all systems operational" pill); sticky topbar (breadcrumbs, ⌘K search, quick-create, live-mode, AI, notifications bell, theme, profile menu + workspace switcher).
- **Command palette** (⌘K): Navigate / Actions / Recent / live search results.
- **Dashboard** (`dashboard.jsx`): 4 KPI cards (Open Inspections, Open NCRs, Active 8Ds, Overdue) w/ trend + sparkline; NCR trend line; risk-distribution donut; recent activity; My Assignments tabs; risk heatmap; compliance stacked bars; drag-drop widget customization.
- **Notifications** (`notifications*.jsx`): topbar dropdown + full center (filters, bulk actions, routing); per-channel preferences; real-time toasts.
- **Live mode**: streamed simulated events → toast → entity.

## 2. Backend
- ✅ **Federated Search** (`apps/api/src/search/*`), **Notifications** (`apps/api/src/notifications/*` + `notify` delivery job), the `me` controller (assignments), audit-events (recent activity).
- 🟡 **Realtime/SSE** for live-mode is deferred (06 note). **Dashboard aggregates** (KPI counts, NCR trend series, risk distribution, heatmap, compliance bars) — confirm which exist vs need a `GET /v1/dashboard/summary` aggregate. Per "no invented scope", build only the tiles backed by real queries; the rest stay deferred (this matches the PROGRESS dashboard-fidelity note).

## 3. Frontend (maps to jsx)
- **Done:** shell (sidebar collapse+drawer, capability-gated nav, sub-navs, status pill), topbar (search copy verbatim), sign-in, dashboard **KPI tiles + recent NCRs** foundation.
- **Remaining FE:**
  - **⌘K command palette** (Navigate/Actions/Recent + live search over the search API).
  - Dashboard: NCR-trend chart, risk donut (click-to-filter), My Assignments tabs, heatmap, compliance bars — **only where backed**; drag-drop customization last.
  - Notifications **center** (filters/bulk/routing) + **preferences matrix**; topbar dropdown.
  - Quick-create wizard (Inspection/NCR/8D/Document); profile menu quick-facts + workspace switcher (some fields are mock — surface only real data).
  - Live-mode toggle gated on SSE (deferred).

## 4. Definition of Done
- [ ] ⌘K palette navigates + creates + searches.
- [ ] Every dashboard widget shown is backed by a real aggregate; no fabricated numbers.
- [ ] Notifications center + preferences functional; topbar bell unread count live.
- [ ] Quick-create routes to the new entity; workspace switcher switches tenants.

## 5. Dependencies & open questions
- **Open:** which dashboard aggregates exist vs need a new summary endpoint; SSE/live-mode timing (deferred infra). Drag-drop widget grid needs backing data before it's built (per PROGRESS).
