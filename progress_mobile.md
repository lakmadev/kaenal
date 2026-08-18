# PROGRESS_MOBILE.md — Kaenal Mobile App

Living tracker for the **Expo mobile/tablet app** (`apps/mobile`). Web/API progress lives in
`PROGRESS.md`; this file is mobile-only. Session protocol mirrors CLAUDE.md: read this first,
resume from **Current status**, update it in the same commit as the work.

- **Design source (pixel-for-pixel, rule #9):** `project_brain/mobile/` — `Mobile App.html` gallery +
  `src/m-*.jsx` (12 files) + `src/mobile-kit.jsx` (the design-system kit). Originals live in the
  Claude Design bundle at `~/Downloads/KAENAL_Mobile/mobile`; a copy is vendored under
  `project_brain/mobile/` so the binding reference is in-repo.
- **Canonical spec:** `project_brain/project/implementation/05-MOBILE-APP.md` (offline-first architecture,
  §2 sync, §3 device features, §4 edge cases). Widened by `project_brain/mobile-design-brief.md`
  (role-aware dashboards, oversight, tablet).
- **jsx is a binding VISUAL reference only** — never copied into the codebase; screens are recreated
  natively (React Native), verified side-by-side.

---

## Architecture decisions (mobile) — do not re-litigate

1. **Location = `apps/mobile`** inside the existing Turborepo/pnpm workspace. Reuses the same
   TS-strict base config, ESLint, and `pnpm`/`turbo` tasks.
2. **Reuse `@kaenal/api-client` + `@kaenal/types` verbatim.** The client is already framework-agnostic
   and RN-aware (bearer-token mode, `X-Tenant-Id` header, plain `fetch`, no cookies). This guarantees
   the mobile app and web share ONE ts-rest/Zod contract — no type drift, no duplicated DTOs.
3. **Styling = runtime theme-object + StyleSheet UI kit, NOT NativeWind.** The delivered design kit
   (`mobile-kit.jsx`) is theme-object driven (`mkTheme(dark)` → palette `T`). A `ThemeProvider` +
   `useTheme()` + `StyleSheet.create` factory is (a) the most faithful reproduction of the binding
   design, (b) more performant than NativeWind's per-render className resolution, and (c) exactly what
   "easy theme switching later" needs — swap the palette, the whole tree recolors. **This deviates from
   05 §1's mention of NativeWind**; recorded here per the CLAUDE.md "smallest reasonable choice" rule.
   Tokens still derive from `styles/tokens.css` (ink accent, Archivo, zinc neutrals), so visual parity
   with web holds.
4. **Component common library = `apps/mobile/src/ui` + `src/theme`.** Self-contained, dependency-light,
   no app/feature imports — structured for later extraction to `packages/mobile-ui` if another client
   appears. This is the "themeable common library" the build is asked to centre on.
5. **Portability via ports/adapters.** Every platform capability sits behind a small interface with an
   Expo adapter: `SecureStorePort`, `DbPort`, `FilesPort`, `CameraPort`, `LocationPort`,
   `NotificationsPort`, `BiometricPort`, plus the API port (the shared client). Swapping a service =
   swapping one adapter; features depend on the port, never the SDK.
6. **State:** TanStack Query (server cache, persisted to SQLite for instant cold-start) + Zustand
   (session/token/tenant/role, appearance, live sync-status). No business logic in components.
7. **Offline-first is the priority.** Expo SQLite + Drizzle local DB; delta-sync read path +
   `mutation_queue` write path with uuidv7 idempotency keys, FIFO-per-entity, retry/backoff, and the
   explicit conflict policy from 05 §2.3. Never block fieldwork on connectivity.
8. **Nav = Expo Router** (file-based), auth stack vs role-aware app tabs; adaptive to tablet
   (master-detail + side rail) and split-view.
9. **Performance budget:** Hermes engine, `@shopify/flash-list` for every list, memoized rows, no inline
   object/style allocation in hot paths, images downscaled on capture, lazy route bundles.

---

## Phases (each = committed + typechecked/linted + tested-where-logic-exists + verified on Expo Web/iOS sim)

- [x] **M0 — Scaffold & monorepo wiring.** ✅ Expo SDK 57 (RN 0.86, React 19) app at `apps/mobile`,
  Expo Router, TS strict. Metro tuned for the pnpm workspace (watchFolders + nodeModulesPaths + a
  `resolveRequest` that retries ESM `.js` specifiers as `.ts` so the shared TS packages resolve). Wired
  `@kaenal/api-client` + `@kaenal/types`; demo template stripped. Boots on Expo Web with the shared
  client linked. `apps/mobile` excluded from root ESLint (uses its own `expo lint`).
- [x] **M1 — Theme & component common library.** ✅ `theme/` (tokens light/dark ported from the design
  kit + spacing/radius/type scale, `ThemeProvider`/`useTheme`/`useThemeContext` with light/dark/system
  and an `onModeChange` hook for M2 persistence, Archivo + JetBrains Mono via expo-font). `ui/` kit:
  Icon (design names → lucide, typed union), Text/Mono, Screen/Body/Card/SectionLabel/ActionBar (real
  safe-area insets), SyncPill/StatusPill/Sev/Avatar, Button, Row, Skeleton/EmptyState, Header/BellButton/
  Badge, TabBar (+FAB +badges). Kitchen-sink screen verified in-browser in **both light and dark** with
  instant in-app toggle. Typecheck clean.
- [x] **M2 — App shell, navigation & ports/adapters.** ✅ Expo Router groups `(auth)` / `(app)` with a
  session gate; `(app)` tabs render the custom design `TabBar` (FAB + badges) driven by `tabsForRole`
  (role→tab map from the design). Ports (`services/ports.ts`) + real adapters for KV (async-storage) and
  secure store (expo-secure-store, web→KV fallback); db/files/camera/location/notifications/biometric
  are typed interfaces wired in later phases via the `services` registry. Zustand stores: appearance
  (persisted via KV), session (token/tenant/me in secure store, `useRole`/`useCapabilities` selectors),
  sync (placeholder for M3). Shared api-client bound to the session store; TanStack QueryClient.
  `useLayout` hook (phone/tablet 768pt breakpoint, split-view reactive). Dev role-picker welcome so the
  role-aware shell is testable pre-M4. Verified in browser: welcome → dev sign-in → role-aware tabs →
  navigation, tablet + phone form factors, live theme toggle. Typecheck clean.
- [x] **M3 — Offline foundation (SQLite + Drizzle + sync engine).** ✅ ← key factor. Pure, unit-tested
  core in `src/sync/`: `types` (domain), `ids` (uuidv7 = Idempotency-Key), `cursor` (delta keyset),
  `queue` (FIFO-per-entity + file-dependency ordering + backoff), `conflict` (§2.3 policy → decision),
  `pusher` (HTTP→PushOutcome normaliser + kind-dispatch table), `read-source` (delta-pull seam), and
  `engine` (pull→push→pull orchestrator, re-entrant-safe, pause-on-auth). Persistence via a domain
  `SyncStorePort`: Drizzle SQLite schema + expo-sqlite adapter (native, `store.native.ts`) and an
  in-memory adapter (web/test, `store.web.ts`) chosen by Metro platform-extension resolution. Persisted
  TanStack Query cache (`PersistQueryClientProvider` + KV persister) for instant cold-start. Sign-out
  wipes the store (§2/§4). Engine boots on authentication and drives the header sync pill. **31 unit
  tests green** (queue/conflict/cursor/ids/pusher + full engine round-trips: offline-hold→flush, transient
  retry+backoff, stale_write→needs-review, validation→failed, auth→pause→resume, delta-pull→mirror).
  Typecheck clean; app boots on Expo Web with the engine wired (pill "Synced"). **Backend gap logged
  below**: no `/v1/sync/*` delta endpoints → read path uses the cursor-list fallback behind `SyncReadSource`.
- [x] **M4 — Auth & onboarding.** ✅ Full flow wired to the REAL API, all screens reproduced from
  `m-auth.jsx`/`m-auth-extra.jsx` (rule #9): Welcome → Workspace (slug + recent chips) → Sign in →
  MFA (6-box, auto-verify, error/success states) → recovery code; invite set-password (paste-link +
  strength meter); forgot-password + reset-sent; permission priming (one-time gate); biometric unlock
  (`unlock` screen, expo-local-authentication behind `BiometricPort`); workspace switcher (bottom sheet,
  real `/v1/me/workspaces`); unsynced sign-out/switch guard (§4). SecureStore holds the bearer token;
  last-known `me` cached in KV for offline cold-start. **Backend:** sign-in and switch-workspace now
  return the session token in the body for bearer clients (opt-in `X-Auth-Mode: bearer` header, no
  cookies) — web cookie/CSRF path untouched; `WorkspaceDto.sessionToken?` added (optional, web ignores).
  Dev-only CORS (localhost) added so the Expo web preview can call the API. Browser-verified end-to-end:
  welcome → workspace `acme` → sign in `demo@acme.test` → **34 real capabilities from /v1/me** → priming →
  home; workspace switcher lists the real membership. `apps/api` auth (32) + workspaces (6) tests green
  incl. new bearer cases; 31 mobile unit tests green; typecheck + lint clean.
- [x] **M5 — Home / role-aware dashboards.** ✅ Inspector / Viewer / Manager / Admin, curated by role +
  `/v1/me` capabilities (presentation only; server still enforces). NEW backend `GET /v1/me/dashboard`
  computes every metric live in the tenant-scoped tx (RLS); the four dashboards from `m-home.jsx` are
  reproduced pixel-for-pixel and wired to it. Interim: sign-out/switch moved to the `Me` tab.
- [x] **M6 — Inspections.** ✅ List (Tasks tab) → start overview → section-by-section runner
  (pass/fail/yes-no/score/number/text/select/multiselect, autosave + resume) → review (tally + sign-off)
  → complete → saved-on-device. Completion is a durable, idempotent offline mutation through the M3
  engine; inspections are mirrored via a registered read-puller. Photo/signature capture + inline NCR
  flag are honest seams to M7/M8 (rendered, deferred). Loading/empty/offline states throughout.
- [x] **M7 — Capture.** ✅ Real offline evidence pipeline (`pending_files` + presign-at-push via the engine's
  new `uploadFiles` hook + local→remote file-id resolution) + native capture adapters (camera/photo via
  expo-image-picker, GPS via expo-location, compression via expo-image-manipulator) behind ports. Photo
  capture wired into the M6 runner `photo` items. Quick-Log sheet (FAB): photo evidence + GPS stamp + typed
  note + **real AI structuring** (`quicklog_structuring` via `/v1/ai/drafts`) + "Log it" → **real NCR**
  (`POST /v1/ncrs`). Honest stubs (no backend / device-only): AI vision defect-detect, voice transcription,
  QR-scan + annotate screens, signature-draw pad.
- [x] **M8 — NCR.** ✅ NCR list (tab, real `/v1/ncrs`, status chips) → read-mostly detail
  (description, details, escalate-to-8D banner, status-appropriate transition) + 3-step guided create
  (title/desc + AI structuring + severity + evidence + containment) + auditor verify (four-eyes). Create,
  transition and verify are durable offline mutations. The M6 runner's **"Flag NCR"** now opens the create
  wizard prefilled from the inspection.
- [x] **M9 — My Tasks + 8D follow-up + CAPA check-off.** ✅ Tasks tab is now the unified assigned inbox
  (NCRs + CAPAs + inspections + 8D steps owned by me, grouped by due, per-kind filters, deep-linked). 8D
  follow screen: D1–D8 vertical stepper from the real `steps` record; advance the owned/current step
  (durable). CAPA check-off: action checklist toggled via real status writes + evidence. Aggregation is
  client-side (no `/v1/me/tasks` endpoint) — flagged.
- [ ] **M10 — Oversight (manager/admin).** Approvals inbox + item (reason field), assign/reassign,
  team & plant snapshot, audit-log highlights, "Manage in web app" list.
- [ ] **M11 — System & Settings.** Sync queue (+ conflict "needs review"), Notifications, Settings root
  + sub-pages (profile, security/MFA/biometric/sessions/password, offline & storage gauge, notif prefs,
  appearance, sign-out guard).
- [ ] **M12 — Tablet adaptive polish + accessibility + perf pass.** Master-detail/side-rail/split-view;
  Dynamic Type, reduced-motion, VoiceOver/TalkBack labels, WCAG AA; FlashList/memo/Hermes/bundle audit.
- [ ] **M13 — Device integration + E2E + EAS.** Push deep-links, biometric, real device flows end-to-end;
  Maestro smoke; EAS build/update config.

---

## Current status

**M10 — Oversight: NEXT.** Branch `feat/mobile-app`, pushed; PR #9 open. M0–M9 done, committed,
browser-verified against the live API. M9 shipped the unified My-Tasks inbox (client-side aggregation of my
NCRs/CAPAs/inspections/8D-steps, grouped by due), the 8D follow screen (D1–D8 stepper + durable step
advance) and the CAPA check-off (action-status writes + evidence). Next (M10): Oversight (manager/admin) —
approvals inbox + item (reason field), assign/reassign, team & plant snapshot, audit-log highlights,
"Manage in web app" list. Still outstanding across phases: bind capture/NCR/CAPA **evidence → its entity**
(photos upload as tenant files; EntityKind has no `file`), a backend **`/v1/me/tasks`** aggregation to make
the inbox exhaustive, and home-queue deep-links.

## Decisions log
- (M-plan) Chose theme-object + StyleSheet kit over NativeWind — see decision #3 above.
- (M-plan) Chose `apps/mobile` in-workspace over a standalone repo — shares contract, tooling, CI.
- (M3) **Offline persistence is a domain `SyncStorePort`, not a raw-SQL `DbPort`.** Keeping it
  domain-shaped makes the native (expo-sqlite/Drizzle) and in-memory (web/test) adapters interchangeable
  and the engine unit-testable. Adapter chosen by Metro **platform-extension resolution**
  (`store.native.ts`/`store.web.ts`/`store.ts`) — a `require()` guard did NOT work (Metro statically
  bundles it, and expo-sqlite's web build imports a wasm worker the preview can't resolve).
- (M3) **The conflict reducer is client-side reaction, not merge.** The SERVER owns field-level merge +
  LWW (it sees before/after); the client maps the responses it can receive (ok/STALE_WRITE/transition/
  404/validation/auth) to done/retry/needs-review/failed/pause, and NEVER silently drops a rejected write.
- (M3) **Engine ordering bug found + fixed by the round-trip test:** `run()` must not touch the
  re-entrancy `active` flag — a synchronous early-return (offline) cleared it before `sync()` set it,
  wedging all later cycles. Lifecycle now lives entirely in `sync()`'s IIFE.
- (M4) **Mobile gets its bearer token via a gated header, not a new endpoint.** `POST /v1/auth/sign-in`
  and `POST /v1/me/switch-workspace` return the raw session token in the body ONLY when the client sends
  `X-Auth-Mode: bearer` (and then set no cookies). Web (no header) keeps httpOnly-cookie + double-submit
  CSRF unchanged; the token is never exposed to browser JS. The session authenticator already accepted
  `Authorization: Bearer`, so this only closed the "how does mobile obtain the token" gap. `WorkspaceDto`
  gained an optional `sessionToken` (web ignores it). Both paths have backend tests.
- (M4) **Auth routes are called with plain fetch, not the ts-rest client** (`lib/auth-api.ts`) — sign-in/
  MFA/accept-invite/forgot live outside the contract (they negotiate cookies/MFA). Switch-workspace IS in
  the contract, so it uses the typed client with `extraHeaders: { 'x-auth-mode': 'bearer' }`.
- (M4) **Last-known `me` is cached in KV.** On an offline cold-start we trust the stored token AND a
  cached identity to render the shell (§4); without a cached `me` we can't show a coherent shell, so we
  fall back to sign-in rather than showing an empty one.
- (M4) **Dev-only CORS** (`main.ts`, localhost origins, `credentials:false`, non-production) so the Expo
  **web** preview can call the API cross-origin. Native builds are same-process (no CORS). Never enabled
  in production.
- (M4) **Priming is a top-level route** (not in `(auth)`/`(app)`) so neither group redirect can loop it,
  with its own `authenticated && !primed` guard; the `(app)` layout redirects unprimed sessions to it.
- (M5) **Dashboards are backed by a real aggregation endpoint, not client math.** `GET /v1/me/dashboard`
  (`apps/api/src/dashboard/`) returns a role-discriminated `DashboardDto` (`variant: inspector|viewer|
  manager|admin`; auditor → viewer). Pure query functions (`dashboard.queries.ts`) compute every metric
  live inside the request's tenant-scoped tx, so RLS confines them exactly like every other service —
  the builder never adds a tenant predicate. Server sends **data** (raw counts, ISO timestamps, refs);
  the client formats copy ("Due 2h", "09:41"). Chosen (user call) over client-side list crunching so the
  numbers are correct and cross-tenant-safe by construction.
- (M5) **One metric is an honest gap, not a fake number.** Admin "Failed syncs" has NO tenant-wide
  telemetry server-side (the offline engine is client-only), so the KPI returns `value: null` and renders
  as "—" (never 0). The design's "sign-in anomalies" / "failed syncs" needs-attention rows are sourced
  from the real audit trail instead (failed sign-ins today, breached-SLA NCRs); shown only when > 0.
- (M5) **Sign-out + switch-workspace moved to the `Me` tab.** The design home carries no account actions
  (they live in profile/settings, M11). To keep the home pixel-faithful without stranding users before
  M11, the interim `Me` tab holds identity + Switch workspace + unsynced-guarded Sign out + theme toggle.
- (M6) **Inspection completion is the single durable mutation; the draft is separate.** In-progress
  answers autosave to a local KV draft (`features/inspections/drafts.ts`) — offline-durable and resumable,
  NOT sent to the server per-answer. Only `complete` is a queued `MutationRecord` (`inspection.complete`,
  mutation-id = Idempotency-Key, last-seen `lockVersion` = optimistic token). This avoids the
  version-chaining problem (a queued start then complete would carry a stale version): `start` is a direct
  online transition, `complete` carries the current version, and there is exactly one queued write per
  inspection. Completing offline shows "saved on device" and syncs on reconnect.
- (M6) **The Tasks tab is the inspection work queue for now.** The design's `InspList` sits on the Tasks
  tab ("Today's work"); M9 (unified inbox) later augments it with NCRs/CAPAs/8D. Detail/runner/review/done
  are top-level `inspection/[id]/*` routes (full-screen, no tab bar), matching the design.
- (M6) **The client never scores.** `features/inspections/scoring.ts` computes progress, visibility
  (visibleWhen), the required-complete gate and the pass/fail/NA tally for the UI; the official score is
  the server's on `complete` (a client score is forgeable). Unit-tested (4 cases).
- (M7) **Evidence is a real presign-at-push pipeline, not immediate upload.** A captured photo is staged as
  a local `pending_file` (client uuid) and uploaded only during the sync cycle via the engine's new
  optional `uploadFiles` hook (presign → PUT → complete). The referencing mutation lists the local file ids
  in `dependsOnFileIds` (so it can't push until the evidence is on the server) and the push handler swaps
  local ids for server ids in the payload. This keeps capture fully offline and reuses the M3 queue. The
  engine change is a single optional hook (no-op when unset) — the 7 engine unit tests are unaffected.
- (M7) **Capture is behind platform ports; web falls back where hardware isn't available.** `camera`
  (expo-image-picker: device camera on native, file dialog on web), `location` (expo-location / browser
  Geolocation), `files` (expo-image-manipulator compress on native, passthrough on web). The native PUT
  uses `expo-file-system/legacy` `uploadAsync` (the upload API moved to the legacy surface in SDK 54+).
- (M7) **Quick-Log "Log it" creates a real NCR now** (`POST /v1/ncrs`) even though the M8 NCR UI isn't
  built — the endpoint exists, so capture is genuinely end-to-end. The note + `quicklog_structuring` AI
  summary + GPS go into the NCR description; severity maps to priority. M8 builds the richer create wizard
  and binds evidence files to the NCR.
- (M8) **NCR create / transition / verify are durable offline mutations** (`ncr.create` / `ncr.transition`
  / `ncr.verify` in `pushDispatch`), NCRs mirror via a read-puller. Because `POST /v1/ncrs` mints the id
  server-side, the create mutation carries a throwaway client `entityId` as its local handle and the list
  refetches server truth after sync — no phantom mirror row (the DTO's `lockVersion` ≠ the pusher's
  `version`, so the ok-outcome uses epoch and skips the mirror bump).
- (M9) **The unified inbox is client-side aggregation, not a backend endpoint.** `buildTasks`
  (`features/work/tasks.ts`, pure + unit-tested) merges my NCRs (owner=me) + CAPAs (owner=me) + inspections
  (inspector=me) + 8Ds I'm on the team for, from the existing plant-scoped lists. Honest limitation: it only
  sees in-scope items — a `/v1/me/tasks` aggregation (like M5's dashboard) would make it exhaustive. 8D +
  CAPA writes (`eightd.step`, `capa.action.status`) are durable offline mutations.
- (M9) **8D step state comes from the `steps` record, not just `currentStep`.** The server marks a step
  `complete` (updateEightDStep) but does NOT auto-bump `currentStep`, so the UI derives done/current from
  `ed.steps["d{n}"].status` (lowercase keys — found during verification) and treats the first non-complete
  step as current. Advancing a step is `updateEightDStep(n, "complete")`.
- (M8) **Detail actions await the sync cycle before refetching.** A durable transition only *queues*;
  the screen `await engine.sync()` then `refetch()`s so the UI reflects the new status online, while
  offline it simply shows "pending" and reconciles on reconnect. The lifecycle mapping respects the state
  machine: `open` must be **assigned** (to an owner — self) before `in_progress`; a direct open→in_progress
  is a 409 the server rejects (found + fixed during verification).

## Known issues / open questions
- **BACKEND GAP (confirmed): no `/v1/sync/<table>?since=` delta endpoints exist.** The contract exposes
  cursor-paginated lists (`PageQuery`) with `updatedAt`+`version` on every DTO, plus server-side
  Idempotency-Key (Redis `IdempotencyStore`) and optimistic concurrency (`version`→`STALE_WRITE`). So the
  **write path is fully backed**; the **read path** uses `createListReadSource` (walk cursor pages,
  delta-filter by `updatedAt`) behind the `SyncReadSource` seam. Two honest limitations until the real
  endpoints land: (1) no tombstones from lists → deletes reconcile on full refresh, not incrementally;
  (2) pull is O(changed) not O(1). Swapping in a `/v1/sync/*` adapter later leaves the engine unchanged.
  → Recommend a backend follow-up to add the delta endpoints (own PR, web/API track).
- **Mobile lint is a no-op:** root `eslint.config.js` ignores `apps/mobile/**` (M0 decision), but
  `expo lint` reads that same root flat config and finds everything ignored, so it errors. Root
  `pnpm lint` (the pre-push gate) is unaffected. Fix = give `apps/mobile` its own `eslint.config.js`
  (eslint-config-expo) that doesn't inherit the root ignore. Deferred; not an M3 regression.
- End-to-end network pull/push verification is deferred to M4+ (needs real auth + the M6/M8 screens that
  register handlers). M3's engine is proven by the 31-test suite + a clean web boot.
- (M4) **"Add another workspace"** in the switcher signs out (guarded on unsynced) and returns to the
  workspace picker — the session model is single-token, so joining another tenant is a fresh sign-in.
  True multi-account (staying signed into several workspaces at once, instant switch) is a future
  enhancement; surfaced here rather than silently dropped (rule #9).
- (M4) Benign Metro warning: `session.ts → lib/api.ts → session.ts` require cycle. Safe — the api-client
  reads token/tenant through lazy getters (`() => useSession.getState()`), so no uninitialised access.
  Could be broken later by injecting the getters instead of importing the store.
- **(M5) BACKEND GAP: no tenant-wide sync-failure telemetry.** The admin dashboard's "Failed syncs" tile
  has no server data source (device sync state is client-only), so it renders "—". → Recommend a
  device→server sync-failure report channel (M11 System/Settings or M13 device integration); the tile
  then lights up with real counts. Every other dashboard metric is real.
- **(M5) Only the Admin dashboard was browser-rendered; the other three variants are shape-verified by
  the backend test, not visually.** The seeded demo account (`demo@acme.test`) is an admin, so the web
  preview showed the Admin pulse. Inspector/Viewer/Manager shapes + role dispatch + the honest admin null
  + cross-tenant RLS are covered by `apps/api/test/dashboard.test.ts` (5 tests). A quick way to eyeball
  the others is to seed a non-admin membership and sign in as them.
- **(M6) Photo/signature capture + inline NCR flag are deferred seams, rendered honestly.** The runner's
  `photo`/`signature` items and the review sign-off pad show an "arrives in M7" affordance (not a fake
  control); the runner's "Flag NCR" button explains it "arrives in M8". A template whose REQUIRED items
  include a photo/signature therefore can't be completed on mobile until M7 — acceptable for M6 (the seed
  template is pass/fail/score/text). Wire real capture (`pending_files` + presign-at-push) in M7.
- **(M6) `start` is online-only.** Beginning a scheduled inspection is a direct API transition; if it
  fails offline the runner still opens (draft is local) but a later `complete` may hit a server
  precondition. Full offline-start (queued transition with version reconciliation) is a future refinement;
  in practice you have connectivity when you pick up work. Flagged rather than silently assumed.
- **(M7) No backend for the AI-vision / voice-transcription features** the design shows (camera "87%
  porosity", voice-to-NCR). Only a text `/v1/ai/drafts` gateway exists — used for real for Quick-Log
  structuring. The camera-preview-with-AI-defect screen (`CapCamera`), voice-to-NCR (`CapVoice`) and the
  annotate canvas (`CapAnnotate`) are **not built** — they need a vision model + a transcription service;
  faking them would violate the no-hallucination rule. Quick-Log carries an honest note that voice-to-text
  isn't available yet. QR scan (native expo-camera barcode) is also deferred. Revisit when those backends
  land.
- **(M7) Photo upload verified via API calls, not a full round-trip on web.** The web preview can't drive
  the OS file dialog headlessly, and a browser PUT to the MinIO presigned URL is subject to MinIO CORS. The
  pipeline (presign → PUT → complete), the pending-file staging, the engine `uploadFiles` hook and id
  resolution are code-complete and typecheck; on device the PUT uses `FileSystem.uploadAsync` (no CORS).
  Quick-Log's server calls WERE verified live: `POST /v1/ai/drafts → 200`, `POST /v1/ncrs → 201`.
- **(M7) Quick-Log evidence isn't yet linked to the NCR it creates.** Photos upload as tenant files;
  binding them to the `POST /v1/ncrs` result (entity_links / file entityKind+entityId) is M8. The
  inspection runner's photo evidence IS bound (it rides in the completion `responses`).

## Verification log
- **M0** — `expo start --web` (port 8082) boots; page shows "shared api-client linked: yes", proving
  Metro resolves the workspace contract package. Typecheck clean.
- **M1** — Kitchen-sink screen renders all kit components; verified light + dark via the in-app mode
  toggle (instant recolor). Archivo/JetBrains Mono loaded. Typecheck clean.
- **M2** — Flow verified in-browser: welcome dev-picker → sign in as Inspector → role-aware tab shell
  (Home/Tasks/+/NCRs/Me) with server-resolved capabilities shown on Home; tab navigation to the Tasks
  placeholder; live sync pill; theme toggle; tablet (800px) and phone (375px) form factors both clean.
  Typecheck clean.
- **M3** — `pnpm --filter @kaenal/mobile test` → **31 passing** (queue, conflict, cursor/ids/pusher, and
  7 full-engine round-trips). Typecheck clean; root `pnpm lint` green. Browser: fixed a Metro web-bundle
  break (expo-sqlite's wasm worker) via platform-extension store resolution, then Expo Web boots to the
  welcome screen → sign-in as Inspector → authenticated Home renders with the offline engine wired
  (module graph loads, header pill engine-driven → "Synced"). The engine's runtime behaviour is proven
  by the unit suite; network pull/push E2E deferred to M4+ (needs real auth + M6/M8 handlers).
- **M4** — Backend: `apps/api` auth (32) + workspaces (6) tests green, incl. new "bearer sign-in returns
  token, no cookies" and "bearer switch-workspace returns token" cases. Mobile: 31 unit tests still green;
  typecheck (mobile + api + types) + root lint clean. Browser E2E against the LIVE API (dev CORS on): welcome
  → workspace `acme` → sign in `demo@acme.test`/`demo-password-1234` → **/v1/me resolved 34 real
  capabilities** (role admin) → permission priming (verified the gate shows once, then Continue → home) →
  home with live "Synced" pill; opened the workspace switcher → real `/v1/me/workspaces` listed "Acme ·
  Admin". Not browser-exercisable on web: MFA/recovery (demo account has MFA disabled — covered by the
  server's `mfa_required` path + the built UI) and biometric unlock (device-only; web reports unavailable
  and falls back to the password path).
- **M5** — Backend: `apps/api/test/dashboard.test.ts` → **5 passing** (role dispatch for all four
  variants, a real owned NCR surfacing in the inspector's "assigned", the honest `null` on the admin
  "Failed syncs" tile, cross-tenant RLS keeping one tenant's NCR out of another's counts). Mobile: 31 unit
  tests still green; typecheck (mobile + api + types, 7/7) + root lint clean. Also fixed three UI defects
  found this session (Button height/weight, LAN API base for physical devices, web focus-outline) —
  separate commits. Browser E2E against the LIVE API: signed in as `demo@acme.test` (admin) → **Admin
  "Workspace pulse"** renders pixel-faithfully — KPIs "Active today 5/5", "Failed syncs —" (honest null),
  "Awaiting 0"; **real audit highlights** ("Settings changed", "Record deleted · fmea · by Demo Admin",
  "Bulk export · ncr", "Role changed") from `/v1/me/dashboard → 200`; "Needs attention" correctly omitted
  (0 real signals); "Open web" card; tab bar Pulse/+/Me. `Me` tab renders identity + Switch workspace +
  Sign out. Console/network clean (`/v1/me` + `/v1/me/dashboard` both 200; the lone 500 was a stale
  buffered entry). Inspector/Viewer/Manager render only shape-verified (demo user is admin) — see Known
  issues.
- **M6** — Mobile: **35 unit tests** green (incl. 4 new inspection-scoring: presentational exclusion,
  conditional visibility, NA tally, required-complete gate). Typecheck (7/7) + root lint clean. Browser
  E2E against the LIVE API as `demo@acme.test`: Tasks tab → "Today's work" list with real inspections
  (chips Assigned·6 / Overdue·2 / Done·1, real codes/templates/statuses) → opened INS-2026-0187 → start
  overview (real "Safety checks · 4 checks" section) → **runner** rendered the real template questions
  (pass_fail / yes_no+NA / score / textarea); answered three → progress advanced **0/4 → 3/4**, green
  answered-badges, "✓ Autosaved" fired (draft persisted to KV) → **review** tally **Pass 2 / Fail 0 /
  N/A 0** (score correctly excluded from the pass/fail tally) → **Complete** → **`POST
  /v1/inspections/:id/complete → 200 OK`** through the offline queue → done screen with "Synced". Also
  fixed a real layout bug found here (single-button ActionBars rendered content-width because a Button
  has no `flex` in a row — added `flex:1`).
- **M7** — Mobile: 35 unit tests still green (the engine's new optional `uploadFiles` hook leaves the 7
  engine tests untouched); typecheck (7/7) + root lint clean. Installed SDK-matched native deps
  (expo-camera / image-picker / image-manipulator / location / file-system / audio) + app.json permission
  plugins. Browser E2E of the Quick-Log sheet against the LIVE API: typed a defect note → **Structure with
  AI** → `POST /v1/ai/drafts → 200` returned a real structured summary (MEDIUM confidence) → **Log it** →
  `POST /v1/ncrs → 201 Created` (a real NCR carrying the note + AI summary + severity) → back to home. Photo
  capture + the presign→PUT→complete pipeline are code-complete and typecheck; the full photo round-trip is
  device-verified (web can't drive the file dialog headlessly + MinIO CORS on the browser PUT) — see Known
  issues.
- **M8** — Mobile: 35 unit tests still green; typecheck (7/7) + root lint clean. Browser E2E against the
  LIVE API as `demo@acme.test`: **NCRs tab** listed real NCRs (chips Open·7 / To verify·0 / Closed·0),
  including NCR-2026-0149 raised by the M7 Quick-Log → opened **detail** (read-mostly: description with the
  AI-structured summary, details rows, escalate-to-8D banner) → drove the lifecycle **open → assigned →
  in_progress** (each `POST /v1/ncrs/:id/transition → 200`, UI updated live after the sync cycle); found +
  fixed a real bug (open→in_progress 409 — the state machine needs open→assigned-to-self first). Create
  wizard Step 1 renders (3-step progress); durable `ncr.create` is the same proven pattern as the M7
  Quick-Log `POST /v1/ncrs → 201`. Verify screen (four-eyes) built + wired.
- **M9** — Mobile: **39 unit tests** green (4 new `buildTasks` cases); typecheck (7/7) + root lint clean.
  Browser E2E against the LIVE API: **My Tasks** rendered the real unified inbox (All·5 / NCR·4 / 8D·1,
  grouped Overdue/This-week/Later — an 8D step + my owned NCRs incl. the M7 Quick-Log one) → opened the
  **8D** (D1–D8 stepper, real currentStep + `steps`) → **Complete D4** → `POST /v1/eight-ds/:id/steps/4 →
  200`; the stepper then correctly showed D1–D4 done, D5 current (fixed two real bugs live: the state must
  read the per-step `steps` record since the server doesn't bump `currentStep`, and its keys are lowercase
  `d{n}`). CAPA check-off built on the same durable pattern (no CAPA seeded to exercise on web).
