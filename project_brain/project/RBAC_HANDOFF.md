# Kaenal — RBAC / User-vs-Admin change handoff

## What this change does
Adds a real **role-based access control (RBAC)** layer so the app renders differently
for admins vs. ordinary users, instead of showing every module to one super-persona.

- New role model with 5 roles: **admin, manager, auditor, inspector, viewer**.
- The **sidebar now filters by role** (hidden modules + empty group dividers removed;
  `adminOnly` items only show for admin).
- A **"View as role" switcher** in the profile menu (top-right avatar) to demo each role.
- A `can('create.ncr')`-style capability API for per-screen action gating.

It mirrors the existing `addons.jsx` entitlement pattern (localStorage store + React
hook + pure helpers), so it drops into your Claude Code backend cleanly.

## Files to replace locally (copy these into your Claude Code project)
1. **`src/rbac.jsx`** — NEW FILE. The whole RBAC layer. Add it.
2. **`src/shell.jsx`** — CHANGED. Sidebar filters nav by role; TopBar shows the live
   role label and hosts the role switcher.
3. **`Kaenal.html`** — CHANGED (one line). Loads `src/rbac.jsx` right after
   `src/addons.jsx` and before `src/shell.jsx`. Script order matters.

Nothing else changed. If your local tree has diverged, only merge those three.

## Public API exposed by src/rbac.jsx (all on window)
- `currentRole()` → role id string. **In production, replace this getter to read the
  authenticated session (GET /me → role); keep the rest of the API identical.**
- `useRole()` → React hook, re-renders on role change.
- `setRole(id)` → demo-only setter (persists + broadcasts).
- `can('create.ncr' | 'edit.all' | 'verify' | 'configure' | 'admin' | ...)` → boolean.
- `visibleNav(NAV, role)` → filtered sidebar array.
- `ROLE_CATALOG`, `ROLE_ORDER`, `roleById(id)`.

## Roles & what each sees (nav)
- **admin** — everything (full settings + platform tools).
- **manager** — everything EXCEPT platform/admin tools (AI Governance, Dev Platform,
  Multi-tenancy, Plans, PDF Templates, design-pattern galleries).
- **auditor** — dashboard, inspections, NCR, 8D, audits, CAPA, documents, graph,
  predictive, reports, notifications.
- **inspector** (the core "user" UI) — dashboard, Quick-Log, inspections, NCR,
  documents, notifications.
- **viewer** — dashboard, documents, reports, notifications (read-only).

## What is DONE vs. STILL TODO
DONE: role model, capability API, sidebar filtering, role switcher, live role label.

STILL TODO (needs per-module work in Claude Code — the client gates are UX only):
1. **Action gating inside screens** — wrap create/edit/delete/verify buttons in
   `can(...)`. Example: hide "New NCR" unless `can('create.ncr')`; render NCR/8D
   detail read-only for `viewer`.
2. **Settings sections** — show admin-only sections (Roles & permissions, SSO, SCIM,
   billing, org, sites, members) only when `roleById(currentRole()).settingsFull`.
   Leave Personal settings visible to all.
3. **Route guard** — if a user deep-links a route not in `visibleNav`, redirect to
   dashboard (belt-and-suspenders with the server 403).
4. **Server enforcement (critical)** — the backend must re-check the SAME capability
   on every mutating endpoint and 403 hidden routes. Client gates are not security.

## Suggested Claude Code prompt
> We added an RBAC layer in `src/rbac.jsx` (roles: admin/manager/auditor/inspector/viewer)
> with a `can(capability)` API and `visibleNav()` sidebar filter, wired into `src/shell.jsx`.
> `currentRole()` currently reads localStorage — change it to read the authenticated
> session from our auth store / GET /me instead, keeping the same function signature.
> Then gate actions across the module screens: wrap every create/edit/delete/verify
> control in `can(...)` (e.g. `can('create.ncr')`, `can('verify')`, `can('configure')`),
> render entity detail views read-only for the `viewer` role, and in `src/settings.jsx`
> show the Workspace / Security & Identity / Compliance / Platform / Billing sections
> only when `roleById(currentRole()).settingsFull` is true. Add a route guard that
> redirects to `dashboard` when the current role can't see the requested route
> (use `isNavRootVisible`). Finally, add server-side authorization that re-checks the
> same capabilities on every mutating endpoint and 403s hidden routes — the client
> checks are UX only. Keep the capability names identical on client and server.
