# P17 — Training & Competency (end-to-end)

**Status:** Backend 🔴 `PROPOSED` · FE 🔴
**Design jsx:** `qms-modules.jsx` (`TrainingMatrix`, `COMPETENCIES`, `TRAINEES`)
**Spec:** FEATURES §12 — **designed here, needs sign-off**
**Value:** IATF 16949 §7.2 competence — proves the right people are qualified; expiring certs are a real audit finding.

## 1. Feature scope (from jsx)
- **Competency catalog:** `id`, name (IATF awareness, AIAG/VDA FMEA, SPC, MSA, CMM, AWS CWI weld, ISO 19011 auditor, 8D, plant safety), **mandatory** flag, **valid-for months**.
- **Training matrix:** members × competencies grid; cell status **ok / warn (expiring) / — (none)**; per-member role.
- Expiry-driven warnings; mandatory-gap highlighting.

## 2. Backend — `PROPOSED`, migration `0027_training.sql`
- **`competencies`**: `tenant_id`, `id`, `code`, `name`, `mandatory` bool, `valid_months` int, `lock_version`. FORCED RLS.
- **`training_records`**: `tenant_id`, `user_id` (composite member FK), `competency_id`, `completed_at` date, `expires_at` date (generated = completed + valid_months), `evidence_file_id` (→ Files), `status` (derived ok/expiring/expired). Unique `(tenant_id, user_id, competency_id)` (latest record; keep history in audit).
- **`packages/core/competency.ts`** (pure): status derivation (expiring within N days), **mandatory-gap** detection per member — unit-tested.
- Contract: `GET /v1/competencies`, `GET /v1/training/matrix` (members × competencies grid, computed), `POST /v1/training/records` (record completion + evidence), `GET /v1/training/gaps` (who's missing a mandatory / expiring). Mutations `withAudit`.
- **Job:** `training-expiry` reminder (document-expiry pattern) → notifications.

## 3. Frontend (maps to jsx)
- **Route:** `/training`.
- **Components:** **TrainingMatrix** grid (members rows × competency cols, ok/warn/— cells with `Legend`), member drawer (records + evidence), Record-training dialog, gaps/expiring filter.
- **States:** mandatory-gap emphasis, expiring color, empty/loading/error.

## 4. Definition of Done
- [ ] Matrix + legend + role column match `TrainingMatrix`.
- [ ] Expiry + mandatory-gap derivation in **core** (unit-tested); expiry reminders fire.
- [ ] Evidence upload AV-gated; RLS green; cross-tenant 404.

## 5. Dependencies & open questions
- Relates to: identity/memberships (rows), Files (evidence), Notifications.
- **Open (sign-off):** competency catalog seeded per-tenant or global template; expiring-window days; link competencies to role requirements (auto-gap by role)?
