# P11 — Supplier Portal (external) (end-to-end)

**Status:** Backend 🔴 (new build; **security-sensitive**) · FE 🔴
**Design jsx:** `supplier-portal.jsx`
**Spec:** FEATURES §17 (External) · 07 (security) — **PROPOSED external-access model below**
**Value:** lets suppliers respond to SCARs / submit PPAP evidence directly — closes the loop without email.

> ⚠️ **This is the one phase that crosses the tenant trust boundary** (external users act on tenant
> data). Treat the access model as `PROPOSED` and get explicit security sign-off before build. It
> must not weaken RLS or the identity model.

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
- [ ] `partner` role + supplier-scope enforced in the interceptor, isolation-tested (foreign supplier → 404, internal endpoints denied).
- [ ] Portal shell + SCAR-respond + PPAP re-submit per `supplier-portal.jsx`.
- [ ] All portal writes audited (`actor_kind=partner`); uploads AV-gated.
- [ ] Security sign-off recorded in PROGRESS Decisions log.

## 5. Dependencies & open questions
- Depends on: [P08](P08-suppliers.md), [P09](P09-ppap.md), [P10](P10-scar.md), Files/AV (P06).
- **Open (must decide before build):** confirm the `partner`/supplier-scope model vs a fully separate external service; MFA/session policy for external users; what exactly a supplier may see. **Highest-risk phase — do not build without sign-off.**
