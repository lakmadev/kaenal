# P25 — User assignment (assign / reassign / unassign)

**Status:** in progress (2026-08-04). CAPA slice = the reference; other entities follow.

## Problem

Every work item carries an assignee column (`capas.owner_id` / `sponsor_id`, `ncrs.owner_id`,
`inspections.inspector_id`, `eight_ds.team_lead_id` / `champion_id`, `scars.owner_id`), and the FE renders
them read-only through `MemberCell`. But **there is no way to change an assignee after create.** The only
assignment path that exists is NCR's lifecycle transition `open → assigned` (state-coupled: it can set an
owner exactly once, and cannot reassign a later-stage NCR or unassign anyone). CAPA/Inspection/8D/SCAR have
no assign endpoint at all. Assignment is clearly intended — `AuditAction` already has `assigned`, and every
table has the column — so this is a real gap, not new scope.

## Goal

A uniform, audited **assign** capability on every assignee-bearing entity: set, reassign, or clear an
assignee at any time (independent of the lifecycle state machine), plus a single reusable FE control.

## Design principles (follow existing house style)

1. **One dedicated endpoint per entity:** `POST /v1/<entity>/:id/assign`. Do NOT overload the lifecycle
   transition — assignment is orthogonal to state (mirrors CAPA's rule that `advance` and `revert` are
   separate controls). NCR keeps its `transition(to:"assigned")` for the *first* open→assigned step; the
   new `assign` endpoint handles free reassign/unassign at any state.
2. **Audited in the same transaction** via `withAudit`, `action: "assigned"`, `before`/`after` carrying the
   old/new ids. Unassign (id → `null`) reuses `assigned` (there is no `unassigned` action, and before/after
   already records the clearing) — do not add an enum value.
3. **Optimistic concurrency:** body carries `version`; the `UPDATE … WHERE id = $1 AND lock_version = $2`
   returns 0 rows → `STALE_WRITE` (409). The existing per-table `lock_version` bump trigger handles the
   increment.
4. **Validation:** every non-null assignee must be an **active member** (`assertMember` → `VALIDATION_FAILED`).
   Foreign-tenant users are invisible under RLS, so they fail the same check (never leak existence — rule 8).
5. **Capability:** assignment is a management action → the entity's `:manage` capability (admin/manager).
6. **Zod-first:** one `Assign<Entity>Body` schema in `packages/types`, shared by API + web + tests.
7. **A feature = migration + contract + service + tests + UI + audit** (rule 7). No migration is needed here
   — the columns already exist; the "schema" step is satisfied.

## Contract shape (per entity)

```ts
// packages/types — e.g. AssignCapaBody
export const AssignCapaBody = z.object({
  version: z.number().int().nonnegative(),
  ownerId: z.string().uuid().nullable().optional(),   // present+uuid = assign; present+null = unassign; absent = leave
  sponsorId: z.string().uuid().nullable().optional(), // CAPA has two assignee columns
}).refine((b) => b.ownerId !== undefined || b.sponsorId !== undefined, {
  message: "Provide ownerId and/or sponsorId",
});
```
Single-assignee entities (NCR/Inspection/SCAR) carry just the one nullable field; 8D carries
`teamLeadId` + `championId`. Route: `POST /v1/<entity>/:id/assign`, `200: <Entity>Dto`.

## Service method (reference — `CapaService.assign`)

```
fetch → 404 if gone; assertVersion(row.lock_version, body.version);
for each provided non-null id → assertMember;
build a dynamic SET from only the provided keys (owner and/or sponsor);
withAudit(action:"assigned", before:{ownerId,sponsorId}, after:{…}) {
  UPDATE … SET <cols>, updated_by WHERE id AND lock_version RETURNING … ;  // 0 rows → STALE_WRITE
}
```

## FE — one reusable control

`apps/web/src/components/assignee-picker.tsx` — a lightweight dropdown (no popover lib exists): trigger
shows the current assignee via `MemberCell`; the panel has a search box, the member list from `useMembers`,
and an **Unassign** row. `onAssign(userId | null)` fires the entity's assign mutation with the current
`lockVersion`; success invalidates the detail query. Gated on the caller passing `canManage`; read-only
(plain `MemberCell`) otherwise. Generic over entity — each detail passes its own mutation + version.

## Rollout order (each a vertical slice; CAPA proves the pattern)

| # | Entity | Column(s) | Endpoint | Capability | Status |
|---|--------|-----------|----------|-----------|--------|
| 1 | CAPA | `owner_id`, `sponsor_id` | `POST /v1/capas/:id/assign` | `capa:manage` | **DONE** ✓ |
| 2 | NCR | `owner_id` | `POST /v1/ncrs/:id/assign` | `ncr:manage` | planned |
| 3 | Inspection | `inspector_id` | `POST /v1/inspections/:id/assign` | `inspection:manage` | planned |
| 4 | 8D | `team_lead_id`, `champion_id` | `POST /v1/eight-ds/:id/assign` | `ncr:manage` | planned |
| 5 | SCAR | `owner_id` | `POST /v1/scars/:id/assign` | `supplier:manage` | planned |

**Slice 1 (CAPA) shipped.** `AssignCapaBody` + `POST /v1/capas/:id/assign`; `CapaService.assign`
(dynamic SET from provided keys, `assertMember`, optimistic concurrency, `withAudit` `assigned`
before/after); 4 new tests in `capa.test.ts` (assign+reassign+unassign audited / non-member 422 / empty
body 422 / stale 409 + viewer 403). FE: reusable `components/assignee-picker.tsx` (search + Unassign
dropdown, read-only `MemberCell` for viewers) wired into the CAPA detail Owner + Sponsor rows via
`useAssignCapa` (which `setQueryData`s the fresh row so rapid reassigns don't race the refetch).

## Tests (per slice, mirroring `capa.test.ts`)

- assign a member → 200, column set, one `assigned` audit event with before/after;
- reassign to a different member → 200;
- unassign (`null`) → 200, column cleared;
- non-member / foreign-tenant id → `VALIDATION_FAILED`/404 (no existence leak);
- stale `version` → `STALE_WRITE` (409);
- viewer (no `:manage`) → 403.

Run `pnpm test` (serial) + the RLS suite on any schema touch (none here). Web: typecheck + lint + an
in-browser assign/unassign round-trip with the live-error listener.
