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
- [ ] **M2 — App shell, navigation & ports/adapters.** Router layouts (auth vs tabs), role-aware tab
  config, adaptive-layout hook (phone/tablet), Zustand stores, all platform ports + Expo adapters
  (stubbed where deep).
- [ ] **M3 — Offline foundation (SQLite + Drizzle + sync engine).** ← key factor. Local schema (mirror
  subset + `mutation_queue` + `pending_files`); delta-pull client; push-replay with Idempotency-Key;
  conflict resolution (§2.3); persisted Query cache; unit tests for queue/conflict reducers. Verify
  `/v1/sync/*` contract coverage; flag any backend gap honestly.
- [ ] **M4 — Auth & onboarding.** Welcome → Workspace (slug + recent chips) → Sign in → MFA (6-box) →
  recovery code; invite set-password; permission priming; biometric unlock; SecureStore tokens;
  workspace switcher; sign-out guard (unsynced). Wired to real API.
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

**M2 — App shell, navigation & ports/adapters: NEXT.**
Branch `feat/mobile-app`. M0 (scaffold) and M1 (theme + UI kit) done, committed, and browser-verified
(light + dark). Next: Expo Router layouts (auth stack vs role-aware tabs), adaptive-layout hook,
Zustand stores, and the platform ports + Expo adapters.

## Decisions log
- (M-plan) Chose theme-object + StyleSheet kit over NativeWind — see decision #3 above.
- (M-plan) Chose `apps/mobile` in-workspace over a standalone repo — shares contract, tooling, CI.

## Known issues / open questions
- Verify the API exposes the delta-sync endpoints (`GET /v1/sync/<table>?since=`) the offline spec
  assumes; if absent, M3 builds the client against the real contract and the gap is logged here.

## Verification log
- **M0** — `expo start --web` (port 8082) boots; page shows "shared api-client linked: yes", proving
  Metro resolves the workspace contract package. Typecheck clean.
- **M1** — Kitchen-sink screen renders all kit components; verified light + dark via the in-app mode
  toggle (instant recolor). Archivo/JetBrains Mono loaded. Typecheck clean.
</content>
