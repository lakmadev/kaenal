# Admin/Platform Functional Slices — Build Plan

Source: `PHASES_HANDOFF.md` (Claude Design made these functional in the *prototype* via
localStorage). In the **real app none of these screens exist** — they are placeholders
(`apps/web/src/config/planned-modules.ts`, `settings-nav.ts` `built:false`) with **no
backend**. So each handoff item is a **net-new vertical slice**: migration + forced RLS +
ts-rest contract + service + tests + audit events + UI (CLAUDE.md rules 5 & 7), built
backend-first, one entity at a time. The localStorage stand-ins are the *behaviour spec*,
never code to copy.

Shared primitives already exist in the web app — `components/ui/toast.tsx` and
`components/ui/dialog.tsx` are the real `kToast` / `kConfirm`. No throwaway primitive.

## Sequence

| Phase | Slice | Why here | Task |
|---|---|---|---|
| **A** | Settings foundation (`tenant_settings`) + **White-label branding** | Foundation. Self-contained, no cross-cutting enforcement. Builds the reusable `tenant_settings` table + settings read/write API that C (sessions), SLA, etc. reuse. Visible payoff: brand name/colours → TopBar + login. | #30 |
| **B** | **NCR validation rules** | Binds to the already-built NCR entity; real workflow enforcement. | #31 |
| **C** | **Session policies** | Larger — real enforcement in the lifecycle interceptor / session store, not just stored config. Reuses `tenant_settings` from A. | #32 |
| **D** | **Legal hold + DLP** | Compliance. Tenant-wide enforcement kept minimal (flagged). | #33 |
| **E** | **Cost centers & chargeback** | Needs usage metering we don't collect yet — stub/flag. | #34 |
| **F** | **FMEA workbench** | Whole new QMS module. | #35 |

Each phase ends green (`pnpm typecheck && pnpm lint`, + `pnpm test`/`build` when DB/API
touched — CI.md gate) and is committed; PR per feature (git-workflow memory).

## Phase A detail (in progress)

- **A1** `packages/db/migrations/0025_tenant_settings.sql` — `tenant_settings (tenant_id
  uuid, namespace text, doc jsonb, version int default 1, updated_at, updated_by)`, PK
  `(tenant_id, namespace)`, forced RLS + policy, leading `tenant_id` index. One row per
  namespace per tenant. Composite FK on `updated_by → memberships(tenant_id, user_id)`.
- **A2** `packages/types` — `BrandingSettings` Zod schema + `BRANDING_DEFAULTS`; contract
  `getBranding` (GET `/v1/settings/branding`), `updateBranding` (PUT, optimistic
  `version`). Capability `tenant:manage`. `@Internal`.
- **A3** API — settings service/module: `getBranding` (row `doc` merged over defaults) and
  `updateBranding` (upsert, bump version, `withAudit('branding.updated')`).
- **A4** Web — `sections/white-label.tsx` (built:true), `use-branding` hook, Save (toast) +
  Reset; brand display name flows to `TopBar` + login page.
- **A5** Tests — RLS suite row for `tenant_settings`; service + contract tests. Gate + commit.
