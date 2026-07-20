# 05 — Mobile App (Expo) + Offline Sync

## 1. Scope — deliberately small
The mobile app is the **field inspector experience only** (see `src/mobile-inspector.jsx` + `src/quicklog-mobile.jsx` for visual spec): Today's work list → perform inspection (dynamic form) → capture photos/voice/signature → raise Quick-Log/NCR → sync. No admin, no settings beyond profile/notifications, no reports. Anything else opens the web app.

Screens: Sign-in (incl. tenant slug entry) · Today (assigned/overdue/done) · Inspection runner (section-by-section, per-item pass/fail/score/photo) · Quick-Log capture (hold-to-talk voice, photo, QR scan) · NCR create/detail (read-mostly) · Sync status · Profile.

Stack: Expo + Expo Router, NativeWind (same tokens), TanStack Query + Zustand, **Expo SQLite + Drizzle** local DB, Expo Camera/Location/Notifications/FileSystem, EAS Build + Update.

## 2. Offline-first architecture
Local SQLite mirrors a SUBSET of server tables: `inspections` (assigned to me, ±30 days), `inspection_templates` (versions referenced), `ncrs` (mine), `plants/areas`, `users` (name/avatar only), plus local-only tables `mutation_queue` and `pending_files`.

### 2.1 Read path (pull)
Delta sync per table: `GET /v1/sync/<table>?since=<cursor>` where cursor = server `updated_at` + id keyset. Server returns changed + tombstoned rows (`deleted: true`). Runs: on app start, on foreground, after each push, and on WS/push nudge. Initial hydration bounded (max 500 inspections) with progress UI.

### 2.2 Write path (push queue)
Every local mutation appends to `mutation_queue`:
```
{ id: uuidv7 (client-generated — becomes the Idempotency-Key), kind: 'inspection.answer'|'inspection.complete'|
  'ncr.create'|'file.attach'|..., entityId, payload, baseUpdatedAt, createdAt, attempts, status: pending|inflight|failed|done }
```
Rules:
- Queue is FIFO **per entity** (parallel across entities). A failed item blocks only its own entity's queue.
- Push = replay through the normal API with `Idempotency-Key: <mutation.id>` → retries are safe.
- Client generates entity UUIDs locally (uuid v7) so offline-created NCRs/inspections have stable ids; server accepts client-supplied ids on create (validated: unused, v7).
- Files: photos saved to app storage, queued in `pending_files`; upload via presign flow BEFORE the mutation that references the fileId is pushed (dependency ordering). Photos compressed to ≤ 2000px/80% JPEG; originals discarded after `complete` confirms sha256.

### 2.3 Conflict resolution (be explicit — this is where offline apps die)
Each pushed mutation carries `baseUpdatedAt` (server timestamp the client last saw). Server compares:
- **No conflict** (base matches): apply.
- **Conflict, disjoint fields** (e.g. office changed NCR priority; inspector added a comment): **field-level merge — apply both.** The server computes changed-field sets from `before/after`.
- **Conflict, same field:** policy by field class:
  - *Inspection responses:* inspector wins (they are the source of truth on the floor) — but only while inspection is `in_progress`; if the office cancelled/completed it, mutation is rejected → surfaced in Sync status as "needs review" with local data preserved and exportable.
  - *Status transitions:* state machine wins; illegal replayed transition → rejected, user sees a clear card ("This NCR was closed by Anna while you were offline") with a one-tap "reopen & apply" where role allows.
  - *Free-text same-field edits:* last-write-wins + BOTH versions recorded in the audit event (`before`, `after`, `conflictedWith`).
- Rejected mutations are NEVER silently dropped: `status='failed'` + human-readable reason; Sync screen lists them; user can retry, discard (confirm), or convert to a comment.

### 2.4 Sync status UI
Persistent pill: `Synced · 12:04` / `3 pending` / `2 failed` / `Offline`. Tapping opens the queue. Completing an inspection offline shows "Saved on device — will sync" (green, not an error). Never block fieldwork on connectivity.

## 3. Device features
- **Camera:** in-form capture, multiple per item, annotation (arrows/circles) optional Phase 3.5. Keep EXIF GPS.
- **Location:** captured at inspection start + each photo (permission-gated; degrade gracefully if denied — never block).
- **Signature:** capture as vector strokes → render to PNG → file upload; store stroke JSON too (see 07 e-sign).
- **Voice (Quick-Log):** hold-to-talk records audio; on-device or server transcription → structured chips (severity/area/part) via AI gateway (Phase 4); audio file always kept as evidence.
- **QR scan:** area/asset QR pre-fills location fields.
- **Push notifications:** assignment, due-soon, sync-failed. Deep link into the entity.
- **Biometric unlock** after first sign-in; tokens in SecureStore.

## 4. Mobile edge cases
- **App killed mid-inspection:** every answer is written to SQLite synchronously on change — reopening resumes exactly where left off.
- **Template version updated while offline:** inspection keeps its pinned `template_version`; never re-render against a newer schema.
- **Storage pressure:** cap local photo cache (500 MB LRU) but NEVER evict un-synced evidence; warn at 90%.
- **Time skew:** device clock wrong → server time is authoritative; store `client_recorded_at` separately (02 §7).
- **Multi-device same user:** allowed; queue idempotency + field merge handles overlap; assignments pull-refresh on foreground.
- **Tenant switch / sign-out with pending mutations:** block with "3 items not synced" dialog (sync or explicit discard). Sign-out wipes SQLite + SecureStore.
- **Token expiry offline for weeks:** refresh token 30 days; if expired, data stays local and read-only until re-auth succeeds — do not wipe.
- **Airplane-mode uploads:** presign URLs expire (15 min) — request presign at push time, not capture time.
- **Android back button / iOS swipe during form:** autosaved, confirm-free; explicit "Submit" is the only completion gate.
