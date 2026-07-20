# 03 — API (NestJS, contract-first)

## 1. Contract-first setup
- Contracts defined with **ts-rest** (`@ts-rest/core`) in `packages/types/src/contracts/*.ts` — one router per module (`inspections`, `ncrs`, `eightDs`, `audits`, `capas`, `documents`, `suppliers`, `notifications`, `settings`, `auth`, `webhooks`).
- Every route: Zod request schema (params/query/body) + Zod response schema per status code. `packages/api-client` wraps the contract with fetch + TanStack Query hooks (`useNcrList`, `useNcrUpdate`...). **No hand-written fetch calls anywhere in web/mobile.**
- OpenAPI 3.1 generated from the same contracts (`@ts-rest/open-api`) → served at `/v1/openapi.json` and powers the public Developer Platform docs.
- Versioning: URL prefix `/v1`. Breaking changes → `/v2` route added alongside; `/v1` supported ≥ 12 months.

## 2. Authentication
- **Web:** httpOnly, Secure, SameSite=Lax session cookie (encrypted JWT, 12h, sliding refresh). CSRF: double-submit token on mutating routes.
- **Mobile:** short-lived access token (15 min) + refresh token (30 days, rotated on use, revocable per-device in `sessions` table).
- **Public API:** `Authorization: Bearer knl_<prefix>_<secret>` API keys, scoped (`read:ncr`, `write:inspection`...), SHA-256 hash stored, prefix shown in UI. Per-key rate limits.
- Phase 4: WorkOS for SSO (SAML/OIDC) and SCIM; local email+password stays for non-SSO tenants. Account lockout: 10 failed attempts → 15 min lock (mirror the prototype's locked state). Password reset tokens single-use, 30 min TTL.
- Invitations: signed token (7-day TTL) → accept page → creates user + membership. Re-inviting regenerates and invalidates the old token.

## 3. RBAC matrix (enforced by a route guard reading membership.role)
| Capability | admin | manager | auditor | inspector | viewer |
|---|---|---|---|---|---|
| View all modules | ✓ | ✓ | ✓ | own+plant | ✓ (read) |
| Create/perform inspections | ✓ | ✓ | ✓ | ✓ | — |
| Create NCR | ✓ | ✓ | ✓ | ✓ | — |
| Assign/close NCR, manage CAPA | ✓ | ✓ | — | — | — |
| Verify NCR (four-eyes) | ✓ | ✓ (≠ resolver) | ✓ | — | — |
| Manage audits | ✓ | ✓ | ✓ | — | — |
| Approve documents | ✓ | ✓ | — | — | — |
| Manage templates, SLA config, categories | ✓ | ✓ | — | — | — |
| Members, roles, billing, entitlements, API keys | ✓ | — | — | — | — |
Additional scoping: inspector/viewer restricted to `membership.plant_ids` when set (WHERE plant_id = ANY). Guards return `403 FORBIDDEN` with the missing capability name; UI hides what the role can't do (capabilities list returned by `GET /v1/me`).

## 4. Response & error envelope
Success: plain resource JSON (camelCase). Errors, always:
```json
{ "error": { "code": "INVALID_TRANSITION", "message": "Cannot move NCR from closed to in_progress",
             "details": { "allowed": ["reopened"] }, "requestId": "…" } }
```
Codes (closed set in `packages/types`): `VALIDATION_FAILED` (422, details = Zod issues), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `TENANT_NOT_FOUND`/`NOT_FOUND` (404), `CONFLICT`/`INVALID_TRANSITION`/`STALE_WRITE` (409), `RATE_LIMITED` (429, Retry-After), `IDEMPOTENCY_REPLAY` (200 w/ original body), `INTERNAL` (500, no internals leaked). Every response carries `X-Request-Id`; log it everywhere.

## 5. List endpoints (uniform)
`GET /v1/ncrs?filter[status]=open,assigned&filter[ownerId]=…&filter[dueBefore]=…&q=weld&sort=-createdAt&cursor=…&limit=50`
- **Cursor pagination** (uuid v7 + created_at keyset). `limit` max 100. Response: `{ items, nextCursor, total? }` — `total` only when `withTotal=true` (it's a second query; don't pay for it by default).
- `q` = Postgres FTS over title/description/code (tsvector column, updated by trigger). Command palette uses `GET /v1/search?q=` federated across entity kinds (top 6 per kind, matching prototype).
- All filter values validated by Zod enums — unknown filter keys → 422, not silently ignored.

## 6. Writes
- **Optimistic concurrency:** every entity carries `updatedAt`; mutating requests send `If-Unmodified-Since` (or `expectedUpdatedAt` in body). Mismatch → `409 STALE_WRITE` with current server state so the UI can merge (critical for the kanban and detail views open in two tabs).
- **Idempotency:** POST create endpoints accept `Idempotency-Key` header; key + body hash stored 24h in Redis; replay returns the original response. Mobile sync (05) depends on this.
- **Bulk actions** (`POST /v1/ncrs/bulk` with `{ids, action}`) run per-item, return per-item results `{id, ok, error?}` — one failure doesn't abort the batch.
- **Transitions** are verbs, not generic PATCH: `POST /v1/ncrs/:id/transition {to, reason?}` → validates the state machine in `packages/core`, writes audit event, triggers side effects (notifications, SLA recompute).

## 7. Files & uploads
1. `POST /v1/files/presign {filename, mime, sizeBytes, entityKind?, entityId?}` → validates mime allowlist (images, pdf, office docs) and size (≤ 25 MB default, tenant-configurable) → returns presigned S3 PUT URL + `fileId` (row status `pending`).
2. Client uploads directly to S3.
3. `POST /v1/files/:id/complete` → server verifies object exists, records `sha256` (S3 ETag or re-hash for multipart), enqueues AV scan job. Files with `scan_status != 'clean'` are not downloadable (except by the uploader, watermarked "pending scan").
Edge cases: orphaned `pending` rows cleaned by a nightly job (>24h, no S3 object); duplicate uploads deduped by (tenant, sha256) optionally; EXIF GPS preserved for evidence photos (it IS the geolocation feature) but stripped from avatars.

## 8. Webhooks (outbound, Phase 4)
Events: `ncr.created`, `ncr.status_changed`, `inspection.completed`, `capa.closed`, `document.approved`, `eightd.step_completed`… Delivery: POST JSON with `X-Kaenal-Signature: t=<ts>,v1=<hmac-sha256(secret, ts + '.' + body)>`; receiver must verify ts within 5 min (replay protection). Retries: 8 attempts, exponential backoff + jitter over ~24h; endpoint auto-disabled after 20 consecutive failures (notify admin). Per-endpoint event log with redelivery button. Never include file bytes — only presigned URLs (15 min TTL).

## 9. Rate limits
Per-user web: 60 rpm sustained / burst 120. Per API key: plan-based (default 300 rpm). Login/reset endpoints: 5/min per IP + per identifier. Implement with Redis sliding window; respond 429 + `Retry-After`. Health check `/healthz` (no auth, checks DB+Redis) and `/readyz` for deploys.

## 10. API edge cases
- Entity referenced by id from another tenant in a body (`ownerId`, `ncrId`…): FK exists but RLS makes it invisible → treat as `404 NOT_FOUND` (never reveal cross-tenant existence). Validate ALL referenced ids resolve within the tenant before writing.
- Assigning to a deactivated user → 422 `USER_INACTIVE`.
- Closing an NCR that has an open linked 8D → 409 with `details.blockedBy = eightDId` (or allow with `force=true` for managers, audited).
- Deleting a document version that is the only approved version of a controlled document → forbidden.
- Timezone-sensitive due dates: `due_at` computed from SLA config in the TENANT timezone business hours (core function `computeDueAt(now, priority, slaConfig, tz)` — unit-test across DST transitions).
- Large exports (CSV/XLSX/PDF) are jobs, not synchronous responses: `POST /v1/exports` → `202 {jobId}` → poll/notify → presigned download. Cap 100k rows per export; larger → chunked files in a zip.
