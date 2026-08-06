# P11 — Supplier Portal (external) (end-to-end)

**Status:** Backend ✅ (security foundation + audited writes + AV-gated evidence upload) · FE ✅ (portal shell + screens + evidence attach) — **complete** (2026-08-06)
**Design jsx:** `supplier-portal.jsx`
**Spec:** FEATURES §17 (External) · 07 (security)
**Value:** lets suppliers respond to SCARs / re-submit PPAP directly — closes the loop without email.

> ⚠️ **This is the one phase that crosses the tenant trust boundary** (external users act on tenant
> data). Treat the access model as `PROPOSED` and get explicit security sign-off before build. It
> must not weaken RLS or the identity model.

> **Sign-off (recorded, this branch):** access model = **partner role + supplier-scope within the
> existing identity plane** (not a separate service — one governed identity/audit/MFA plane, reuses
> the mutation-tested RLS, no data-sync boundary to secure). Partner auth = **MFA-required + short
> (2h) sessions**. v1 scope = **read-only** (validate the external boundary before opening any write
> path). See PROGRESS Decisions log. **Remaining gate before production exposure:** no per-login TOTP
> verify/enrolment subsystem exists yet — the MFA gate currently enforces *enrolment* (a secret must
> exist) but not a per-login challenge; that subsystem is a hard dependency (PROGRESS Known issues).

## 1. Feature scope (from jsx)
- External-facing, **branded** portal for a single supplier contact: their open **SCARs** (respond, upload 8D evidence), their **PPAP** submissions (see element feedback, re-submit), acknowledgements, messages/notifications. Read-mostly + narrow, audited writes.

## 2. Backend — PROPOSED external-access model
- **Identity:** external supplier users are still `control.users` rows, but their **membership** is a new `partner` role scoped to a **single `supplier_id`** (not a plant). A supplier-scoped capability set (portal-only) — cannot read internal NCR/8D detail, only the SCAR/PPAP records linked to their supplier.
- **Scoping:** add a `supplier_scope` to the membership (like plant-scope) and a lifecycle-interceptor check: a `partner` session's queries are additionally filtered to `supplier_id = <their scope>` on top of RLS. Foreign supplier ids → 404. This mirrors the existing plant-scope 404 (rule 8, one level down).
- **Surface:** a **separate, minimal contract namespace** `POST/GET /v1/portal/*` (SCAR respond + evidence upload via the presign flow with the AV gate; PPAP element view + re-submit; notifications). No access to `/v1/ncrs`, `/v1/suppliers` internal endpoints.
- **Invites:** cross-tenant invite flow already exists (07 §7) — extend to issue `partner` memberships bound to a supplier.
- Every portal write `withAudit` with `actor_kind='partner'`; downloads gated by AV scan.

### Tests
- **New isolation tests** (this is the risk surface): a `partner` cannot read another supplier's SCAR/PPAP (404), cannot reach internal endpoints (403/404), cannot see un-linked documents. Mutation-test the supplier-scope filter the way plant-scope is tested.

## 3. Frontend (maps to jsx)
- **Separate route group** `/portal/*` with its own minimal shell (supplier branding, no internal nav). Screens: my SCARs (respond + upload), my PPAP (element feedback + re-submit), notifications.
- Reuse Trust/upload components; **no** internal sidebar.

## 4. Definition of Done
- [x] `partner` role + supplier-scope enforced (auth layer, inside the tenant tx), isolation-tested (foreign supplier → 404, internal endpoints → 403, admin-without-scope → 403). *(17-test suite `apps/api/test/portal.test.ts`.)*
- [x] Portal shell + SCAR-respond + PPAP re-submit per `supplier-portal.jsx` *(teal top-nav shell, Overview/Corrective-actions/PPAP; verified in-browser end-to-end)*.
- [x] Portal writes audited (`actor_kind=partner`).
- [x] AV-gated evidence UPLOAD — partner-scoped `/v1/portal/files/{presign,:id/complete}` (file created unlinked; attached to the partner's own SCAR/PPAP via `fileIds` on respond/re-submit), teal `PortalEvidenceAttach` on both forms. *(portal.test.ts 23 tests; 2026-08-06.)*
- [x] Security sign-off recorded in PROGRESS Decisions log.

## Delivered this branch (slice 1 — the security foundation, read-only)
**Backend:** migration `0022_supplier_portal.sql` — `partner` added to the memberships/invitations
role CHECKs, a `supplier_scope` uuid on both (FK → suppliers), the coupling invariant
`(role='partner') = (supplier_scope IS NOT NULL)` enforced in the DB, and a partial scope index.
`Role` gains `partner`; a new `InternalRole` (Role minus partner) guards the staff-invite endpoint so
it can never mint an un-scoped external membership. `rbac`: a `portal:view` capability granted ONLY to
`partner` (+ admin's all-caps); `Membership` carries `supplierScope`; `authorizeSupplier` mirrors
`authorizePlant` (foreign supplier → NOT_FOUND). `auth-policy`: `sessionTtlFor`/`PARTNER_SESSION_TTL_MS`
(2h) and `mfaRequiredFor` (partner). `AuthService`: partner sign-in is refused (403) unless MFA is
configured; partner sessions use the short TTL; `resolveSession`/`activeMembership` thread
`supplier_scope` into the session membership. `PortalService` + `PortalController`: read-only
`/v1/portal/{me,scars,scars/:id,ppap,ppap/:id}`, every route `@RequireCapability("portal:view")`,
scoped to the caller's own supplier (from the membership, never the request), reusing the tested
`ScarService`/`PpapService` and mapping onto **narrow portal DTOs** that omit internal identifiers
(owner, linked NCR, reviewer id, AI prediction). **Isolation suite** (`apps/api/test/portal.test.ts`,
11 tests): partner sees only their supplier's SCAR/PPAP, foreign records 404, every internal endpoint
403, internal viewer 403 on the portal, admin (cap but no scope) 403, no-MFA partner sign-in 403,
short session verified, no internal-field leakage. Core: `rbac` partner/supplier-scope + `auth-policy`
MFA/TTL tests (core now 592). RLS 227 (schema lint green over the widened memberships/invitations).

## Delivered this branch (slice 2 — audited writes + portal FE)
**Backend:** migration `0023_portal_writes.sql` widens `audit_events.actor_kind` to admit `partner`;
`ActorKind` gains `partner`; a `portal:respond` capability (partner + admin only) gates the writes.
`PortalService` gains `respondScar` (records the note as a comment on the SCAR — visible to internal
staff — + optional acknowledge; refused on a closed SCAR) and `resubmitPpap` (→ `in_review` + fresh
submitted date; refused on a decided package; the note becomes the audit reason). Both write inside
`withAudit(actor_kind='partner')`, scoped to the caller's supplier (foreign → 404). `apiQueries.portal.*`.
Tests: `apps/api/test/portal.test.ts` grows to 17 (respond writes a partner-authored comment + a
`partner` audit event; foreign respond 404; viewer/admin-no-scope 403; re-submit → in_review audited as
partner; decided-package 422; foreign re-submit 404).
**FE:** `apps/web/src/app/(portal)/` — a SEPARATE route group with `PortalShell` (distinct TEAL top-nav,
no internal sidebar, its own session guard: 401 → sign-in, non-partner → "supplier accounts only").
Screens: `portal-overview` (welcome banner + KPIs + open corrective-actions list), `portal-scar-list` /
`portal-scar-detail` (8D tracker + response form with Submit / Submit&acknowledge), `portal-ppap-list` /
`portal-ppap-detail` (element-feedback grid + re-submit). `AppShell` now redirects a portal-only session
to `/portal`. `use-portal.ts` hooks; `portal-bits.tsx` (teal badges, reuses the SCAR `DSteps`).
**Verified in-browser** as a real partner (`jen@acmeforging.test`, MFA-gated, supplier-scoped): landed on
`/portal`, saw only Acme Forging's SCAR/PPAP, submitted a SCAR response + acknowledge (green banner,
today's date), re-submitted the PPAP (Pending → In review, submitted date bumped) — no console errors.
core 592 / rbac 174, api 238 (portal 17), RLS 227, typecheck 6/6, lint clean.

## 5. Dependencies & open questions
- Depends on: [P08](P08-suppliers.md), [P09](P09-ppap.md), [P10](P10-scar.md), Files/AV (P06).
- **Open (must decide before build):** confirm the `partner`/supplier-scope model vs a fully separate external service; MFA/session policy for external users; what exactly a supplier may see. **Highest-risk phase — do not build without sign-off.**
