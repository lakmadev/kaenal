# 07 — Security & Compliance

## 1. Audit trail — immutability guarantees (extends 02 §3)
- `audit_events` append-only: app role has no UPDATE/DELETE; trigger blocks both; nightly job verifies row count only ever grows per partition (alert on shrink = tampering signal).
- Every mutation path (API handler, job, sync replay, support tool) goes through service functions that REQUIRE an audit event argument — make it impossible to call `repo.update()` without one (the repo method signature takes `{audit: AuditEventInput}`).
- What gets logged: entity CRUD, every status transition, assignment changes, file attach/download of controlled docs, exports, sign-ins (success/fail), permission/role changes, settings changes, entitlement changes, AI draft acceptance, support-role access (with reason).
- UI: History tab on every entity renders its `audit_events` reverse-chronological with actor, diff chips (before → after), and comments interleaved (see prototype History tabs).
- Retention: never delete inside a tenant's lifetime; export included in offboarding bundle.

## 2. Electronic signatures (inspection sign-off, 8D sign-offs, document approval)
Implement 21 CFR Part 11-style, which also satisfies IATF customers:
- Signing = explicit action requiring **re-authentication** (password or biometric on mobile) at the moment of signing.
- A signature record: `signatures(id, tenant_id, entity_kind, entity_id, signer_id, meaning: 'performed'|'reviewed'|'approved', signed_at, auth_method, content_sha256, stroke_file_id null)` where `content_sha256` hashes the canonical JSON of the signed content at that moment.
- After signing, the signed content is frozen: further edits require a new version/revision that visibly supersedes (never edits) the signed one.
- Verification endpoint recomputes the hash → UI shows "Signature valid" / "Content changed after signing" (red).

## 3. File integrity & access
- `files.sha256` recorded on upload completion; downloads of quality records go through the API (audited: who, when, which version) — presigned URLs are single-use-short-TTL and requested per download, never stored in HTML.
- Evidence photos are immutable once attached to a completed inspection/closed NCR.
- AV scanning gate (03 §7). Mime sniffing server-side (magic bytes, not extension). SVG uploads sanitized or rejected (XSS vector).

## 4. Application security checklist (block release on any miss)
- OWASP basics: parameterized queries only (Drizzle), output encoding (React default — never `dangerouslySetInnerHTML` with user content), CSRF tokens on cookie-auth mutations, strict CORS (exact origins), `HttpOnly/Secure/SameSite` cookies, HSTS, CSP (no `unsafe-inline` scripts; hash Next.js inline runtime), X-Content-Type-Options.
- Secrets: KMS/secret manager; DB encryption at rest; TLS 1.2+ everywhere.
- Rate limiting per 03 §9; login lockout; password policy zxcvbn ≥ 3; MFA (TOTP) available from day one, enforceable per tenant policy.
- Session policies (Enterprise): max session length, idle timeout, IP allowlists, geo restrictions — evaluated in the auth middleware from tenant settings.
- Dependency scanning (Dependabot + `pnpm audit` in CI), container image scanning, SAST (CodeQL).
- Server logs NEVER contain: passwords, tokens, file contents, full request bodies of auth routes; PII in logs minimized + requestId correlation instead.

## 5. Privacy & data lifecycle
- **DSAR:** `POST /v1/dsar {userEmail, kind: export|delete}` (admin only) → job compiles all rows/files referencing the user → export zip, or anonymization (name → "Former employee", email nulled) — audit events keep actor_id but the user row is anonymized; quality records themselves are business records and are retained (this is the correct posture for QMS — deletion applies to personal data, not quality evidence; document this in the DPA).
- **Legal hold:** `legal_holds(tenant_id, scope jsonb, reason, created_by, released_at null)` — while active, blocks: hard deletes, DSAR deletion of in-scope data, tenant offboarding purge. Checked by `purgeSoftDeleted` and offboarding jobs.
- **Data residency:** region attribute on tenant registry → dedicated instances pinned to region; file buckets per region; document which subprocessors (AI providers!) see data — AI gateway respects a `region_lock` flag (EU tenants → EU inference endpoints or AI disabled).
- **Backups:** automated daily snapshots + PITR (WAL); quarterly restore drill is a calendar-enforced ritual with a written runbook; per-tenant logical export available on demand (Enterprise contractual).

## 6. Compliance posture (what to prepare for enterprise security review)
- SOC 2 Type II track: audit logging (done above), access reviews (quarterly membership export), change management (PR + CI gates), incident response runbook + status page.
- Pen test before first enterprise deal; fix criticals before go-live.
- Trust Center page (prototype `src/trust-center.jsx`) backed by real facts only — never claim certifications not held; show "in progress" honestly.

## 7. Edge cases
- Admin demotes themselves / deletes the last admin → block: a tenant must always have ≥ 1 active admin.
- Invite sent to an email that already belongs to another tenant → allowed (multi-tenant membership) — user picks workspace at sign-in (prototype's workspace switcher).
- Role downgraded mid-session → capabilities re-evaluated per request (guards read DB/cached membership with 60s TTL), sockets resubscribed on next auth ping; UI refetches `/v1/me` on `membership.updated` event.
- API key of a suspended tenant → 404 tenant, key unusable, but not deleted (restored if tenant reactivates).
- Signature on content containing a file → hash covers the file's sha256, so replacing the file invalidates the signature.
- Support (Kaenal staff) access: only via the support role path with reason + time-boxed grant (4h), fully audited, visible to the tenant admin in their audit log ("Kaenal support accessed…") — transparency is a feature.
