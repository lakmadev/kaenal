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
- [ ] **M5 — Home / role-aware dashboards.** Inspector / Viewer / Manager / Admin, curated by `/v1/me`
  capabilities (presentation only; server still enforces).
- [ ] **M6 — Inspections.** List → section-by-section runner (pass/fail/score/photo/note, inline NCR
  flag) → review → submit; autosave-to-SQLite + resume; loading/empty/offline states; tablet
  master-detail.
- [ ] **M7 — Capture.** Camera + AI-defect chip, voice-to-NCR (hold-to-talk), quick-log sheet, QR scan,
  annotate; image compression, `pending_files`, presign-at-push.
- [ ] **M8 — NCR.** Guided create (steps 1–3, AI pre-fill, severity, containment) + read-mostly detail
  (escalate-to-8D banner) + auditor verify.
- [ ] **M9 — My Tasks + 8D follow-up + CAPA check-off.** Unified assigned inbox; D1–D8 progress/advance
  for owned steps; CAPA action complete + evidence.
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

**M5 — Home / role-aware dashboards: NEXT.** Branch `feat/mobile-app`, pushed; PR #9 open. M0–M4 done,
committed, browser-verified against the live API. Next (M5): replace the M2/M4 identity-dump home with the
role-aware dashboards from `m-home.jsx` (Inspector / Viewer / Manager / Admin), curated by `/v1/me`
capabilities (presentation only; server still enforces) — KPIs + Today's queue. As inspection/NCR screens
land (M6/M8), register their push handlers + read pullers into `sync/index.ts`
(`pushDispatch`/`readPullers`) so the offline engine starts carrying real traffic.

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
</content>
