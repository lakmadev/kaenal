# 04 — Web App (Next.js)

## 1. Ground rules
- Next.js App Router, TypeScript strict, Tailwind + shadcn/ui, TanStack Query (via `@kaenal/api-client` hooks only), Zustand for UI state, React Hook Form + Zod, TanStack Table, dnd-kit, Recharts.
- **The prototype (`../Kaenal.html` + `../src/*.jsx`) is the visual spec.** Recreate each screen to match its layout, spacing, copy, and interaction patterns. Open it in a browser while building. Component source in `../src/` shows exact structures (e.g. `src/ncr.jsx` for NCR list/detail, `src/eightd.jsx` for the D1–D8 stepper).
- Server Components for shells/static chrome; Client Components for anything interactive. All data via the typed hooks — no fetch in components.

## 2. Design tokens (from `../styles/tokens.css` — port into the Tailwind preset in `packages/config`)
- **Brand blue:** 600 `#2563eb` (accent), hover 700 `#1d4ed8`, soft `#eff6ff`, ring `rgba(37,99,235,.25)`.
- **Neutrals (slate):** 50 `#f8fafc` … 900 `#0f172a`, 950 `#020617`.
- **Semantic:** success `#16a34a`/`#22c55e`, warning `#d97706`/`#f59e0b`, danger `#dc2626`/`#ef4444`.
- **Risk scale:** critical `#dc2626`, high `#ea580c`, medium `#f59e0b`, low `#22c55e`, info `#6366f1`.
- **Light surfaces:** bg `#f6f8fb`, bg-subtle `#eef2f7`, surface `#ffffff`, border `#e2e8f0`, text `#0f172a`, muted `#64748b`, subtle `#94a3b8`. Sidebar is always dark: bg `#0f1d35`, fg `#cbd5e1`, active accent `#3b82f6`.
- **Dark theme** is a full token remap (see `[data-theme="dark"]` block in tokens.css) — implement as CSS variables + `data-theme` attr on `<html>`, persisted per user. Accent variants (indigo/teal/orange) and density (dense/comfortable) likewise per-user preferences from `GET /v1/me`.
- **Type:** Inter (400–800) for UI, JetBrains Mono for entity codes/IDs/numbers. Base sizes: page title 26–28/700, section 15–16/600, body 13–13.5, meta 11–12, table cells 12.5–13.
- **Shape/shadows:** radius sm 6 / md 10 / lg 14; card = white surface, 1px `#e2e8f0` border, subtle shadow.

## 3. App shell (match `src/shell.jsx`)
- **Sidebar** 260px (collapsed 72px, persisted): groups Core / Supply chain / Quality system / Platform; badge counts (live from API); "All systems operational" status pill footer; below 860px becomes an off-canvas drawer with scrim.
- **Top bar** 56px sticky: breadcrumbs from the route map; global search field (400px) opening the command palette; Quick-create button; live-mode toggle; AI button (prominence per preference); notifications bell with unread count; theme toggle; profile menu (identity, quick facts, workspace switcher, sign out).
- **Command palette (⌘K):** searches quick actions + navigation + entities via `GET /v1/search` (debounced 150ms). Groups: Quick actions / Navigation / Records; keyboard nav; ↵ opens. NOTE: the prototype had a bug where a second, commands-only palette shadowed this one — implement ONE palette with entity search.
- Keyboard shortcuts: ⌘K palette, ⌘I new inspection, ⌘D new 8D (document all in the shortcuts dialog; don't bind ⌘N — browsers reserve it).

## 4. Routes (App Router) — mirror the prototype's route map
```
/(auth): /sign-in /forgot-password /reset-password /invite/[token]
/(app): /dashboard /inspections /inspections/[id] /inspections/templates /inspections/templates/[id]/edit
  /inspections/schedule /ncrs /ncrs/[id] /8d /8d/[id] /8d/[id]/report /8d/templates
  /audits /audits/[id] /capa /capa/[id] /documents /documents/[id]
  /suppliers /suppliers/[id] /suppliers/scorecards /suppliers/risk /ppap /ppap/[id] /scar
  /graph /predictive /reports /reports/builder/[id] /notifications
  /training /calibration /complaints /ecn /risk /fmea /spc /msa
  /settings/[...section] /pricing
```
Deep-linkable everything: filters/tabs in searchParams (`/ncrs?status=open&view=kanban`).

## 5. Module build specs (each = list + detail + create; consult the matching `src/*.jsx`)
- **Dashboard** (`src/dashboard.jsx`): 4 KPI cards w/ sparklines, NCR trend line chart, risk donut (click filters NCR list), activity feed, My Assignments tabs, risk heatmap (area × category — keep matrix shape at all breakpoints; narrow label rail ≤720px), compliance bars. Widget layout per-user: dnd-kit reorder/hide, persisted via `PATCH /v1/me/dashboard`. Role presets (default/executive/operations/inspector).
- **Inspections** (`src/inspections.jsx`, `src/template-editor.jsx`, `src/schedule.jsx`): sortable/filterable table + grid view, bulk actions, export; detail with Overview (rendered dynamic form, score gauge), Findings (create-NCR per finding), Media (lightbox, GPS), History tabs. **Dynamic form renderer** consumes the template `schema` jsonb — one component per item type, conditional visibility, live scoring from `packages/core`. Template editor: drag-drop sections/items, property panel, preview, publish=new immutable version. Schedule: month/week/day calendar, recurrence editor.
- **NCR** (`src/ncr.jsx`): table + kanban (drag between columns = transition call; on 409 revert card with toast). Detail tabs: Details (evidence gallery, impact), Investigation (5-Whys chain editor, fishbone 6M builder), Actions (containment/corrective/preventive lists w/ verification), History (audit trail + threaded comments). SLA chip (on-track/at-risk/breached) from server state.
- **8D** (`src/eightd.jsx`): list with D1–D8 mini progress; detail = step navigator + one section per discipline (IS/IS-NOT table, containment, root-cause methods, decision matrix, sign-offs). Step gating per the state machine. PDF report route renders a print-optimized page (server-generated PDF in Phase 2 jobs). AI drafting UI (Phase 4) per `src/eightd-agentic.jsx`: per-field AI draft chips with accept/dismiss + provenance strip.
- **Audits, CAPA, Documents, Suppliers, Reports, Notifications, Settings**: follow the corresponding `src/*.jsx` layouts. Settings is the grouped hub (Personal/Workspace/Security/Compliance/Process/Developer) — each section a form with explicit Save (no auto-save for admin-level settings) and audit events.
- **Entitlements/paywalls** (`src/addons.jsx`, `src/pricing.jsx`): locked module routes render the real page blurred behind the upsell card; entitlements from `GET /v1/entitlements`; toggling in pricing updates instantly.

## 6. UI states — every list/detail MUST implement all of
1. **Loading:** skeletons matching final layout (patterns in `src/realtime-empty-skel.jsx`) — no spinners on full pages.
2. **Empty:** icon + one-line explanation + primary CTA (per `src/realtime-empty-skel.jsx` gallery).
3. **Error:** inline retry card w/ requestId; toast for mutation failures.
4. **Stale write (409):** dialog offering reload-and-reapply.
5. **Offline:** banner; mutations queued by TanStack Query `onlineManager` where safe, otherwise disabled with tooltip.
6. **Permission-hidden:** capabilities from `/v1/me` hide actions; never render a button that will 403.

## 7. Real-time
WebSocket connection per session (auth by cookie): server pushes `notification.created`, `entity.updated {kind,id,updatedAt}`. Client invalidates matching TanStack Query keys (targeted, not global). Toasts for events involving the current user; "Live mode" toggle controls toast verbosity, not the socket. Reconnect with backoff; on reconnect, refetch active queries (missed events).

## 8. Accessibility & i18n
- All interactive elements keyboard-reachable; focus rings (`--ring`); dialogs trap focus; tables have proper th/scope; color is never the only signal (badges include text).
- Strings through an i18n layer from day one (`next-intl`), `en` only initially; date/number formatting via `Intl` with tenant locale.

## 9. Web edge cases
- Two tabs, same entity: resolved by 409 STALE_WRITE flow + WS-driven refetch.
- Kanban drag to an illegal column: block on drop with the allowed-transitions list from the 409 details.
- A filter URL pointing at a deleted/invisible entity: render NOT_FOUND state inside the shell, not a crash page.
- Very long titles/codes: single-line ellipsis + title attr in tables; wrap in detail headers.
- 10k-row lists: server pagination + virtualized rows (TanStack Virtual) — never render unbounded DOM.
- Print: NCR/8D/audit detail get print stylesheets (used by "Export PDF" fallback).
