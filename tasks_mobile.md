# TASKS_MOBILE.md — Kaenal Mobile: fidelity + "make it real" program (M14+)

Living plan for the next block of mobile work. Trigger: user review of the shipped app found
(1) stubbed/dead features presented as done, (2) settings/logout divergence from the mocks,
(3) PWA/home-screen safe-area cut-off (doesn't feel native). Governing rules now in CLAUDE.md #10
(never fake/stub/hallucinate — wire real endpoints; prove gaps by grepping controllers) and #11
(native edge-to-edge + real insets on device AND installed PWA).

**Design source (binding, pixel-for-pixel — rule #9):** `project_brain/mobile/src/m-*.jsx`.
**Cadence:** one committed + typechecked/linted + tested-where-logic-exists + browser-verified slice
at a time; update `progress_mobile.md` in the same commit. Per-feature branch `feat/mobile-app` (PR #9).

## Grounding facts (verified this session — not assumptions)
- **Role dashboards already exist & are correct.** `m-home.jsx` defines HomeInspector/Viewer/Manager/
  Admin, each with its own TabBar; `apps/mobile/src/config/rbac.ts` matches. The reviewer saw
  Pulse/Approvals/Audit/Me because they were signed in as **admin** — that's the admin nav by design.
  Inspector = Home/Tasks/+/NCRs/Me. ✅ No change needed beyond a per-role fidelity audit (M18).
- **Biometric-in-Security is per design.** `m-settings-detail.jsx` SettingsSecurity → "Sign-in" group
  has "Biometric unlock · Face ID" toggle. Keep it; make it fully work. (Not a bug.)
- **The "non-working" features are backed by REAL endpoints** (grepped `apps/api/src/auth/*.controller.ts`):
  `POST /v1/auth/change-password`; MFA `POST /v1/auth/mfa/{enroll,activate,disable,recovery-codes/regenerate}`
  + status; sessions `GET /v1/auth/sessions` + `POST /v1/auth/sessions/:id/revoke` + `revoke-others`.
  They're OUTSIDE the ts-rest contract → call via plain `fetch` (pattern: `lib/auth-api.ts`). So wiring
  them is real, not faked.
- **PWA cut-off cause:** Expo web export ships no `viewport-fit=cover`, no PWA standalone metas, no
  manifest; `react-native-safe-area-context` on web then reports 0 insets and the page renders inside the
  browser-chrome "safe box" → looks boxed/clipped. Fix = custom `+html.tsx` + manifest + `100dvh`.

---

## M14 — Native shell: edge-to-edge + real safe-area insets (device + installed PWA)  ← START HERE
Goal: the app fills the whole screen and honours the notch + home indicator, native and as an installed
PWA. (CLAUDE.md #11.)
- [ ] `apps/mobile/src/app/+html.tsx` — custom root document: `<meta viewport … viewport-fit=cover>`,
  `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style=black-translucent`,
  `theme-color` (light+dark), `<link rel="manifest">`, `<link rel="apple-touch-icon">`; root CSS pins
  `html,body,#root { height:100dvh; overflow:hidden; }` and exposes `env(safe-area-inset-*)`.
- [ ] `apps/mobile/public/manifest.webmanifest` — `display:standalone`, name/short_name, theme+bg color,
  icons (use existing assets). Wire in app.json `web`.
- [ ] Confirm `SafeAreaProvider` picks up env insets on web (add `initialMetrics`/frame if needed) so
  `Header` (top) + `TabBar`/`ActionBar`/`Body` (bottom) get real inset values in standalone.
- [ ] Native: verify `android.edgeToEdgeEnabled` + iOS full-bleed; `Screen` fills, no letterbox.
- [ ] Verify: browser at mobile preset + emulate standalone; screenshot top+bottom not clipped. Native
  sim screenshot if available. Gate green.

## M15 — Settings root fidelity + About/version screen
- [ ] Settings root (`me.tsx`) pixel-for-pixel vs `m-system.jsx SettingsRoot`: sign-out is a **danger-
  tinted** ghost button (`T.dangerFg`) with the unsynced-warning line; section order/labels/rows exact.
- [ ] Danger ghost variant on `Button` (or a dedicated style) — the current ghost is text-coloured.
- [ ] **About & version** is a real screen (`/settings/about`): app version + build from `expo-constants`,
  env/channel, legal links, workspace. (Currently a dead row.)

## M16 — Security section: make every row real (biggest "doesn't work" cluster)
Design: `m-settings-detail.jsx SettingsSecurity`. All endpoints exist (see grounding).
- [ ] `lib/account-api.ts` — typed `fetch` wrappers (bearer + X-Tenant-Id) for change-password / MFA /
  sessions, mirroring `auth-api.ts`.
- [ ] **Two-factor**: status (enrolled/added date), **enroll** (QR + secret + verify code → activate),
  **disable**; design from `m-auth.jsx`/`m-auth-extra.jsx`. Real `/v1/auth/mfa/*`.
- [ ] **Recovery codes**: show remaining, **view/regenerate** (`recovery-codes/regenerate`).
- [ ] **Change password**: real screen → `POST /v1/auth/change-password` (current + new + strength).
- [ ] **Active sessions**: list real devices (`GET /v1/auth/sessions`), **Revoke** each + **Sign out all
  other devices** (`revoke-others`).
- [ ] **Biometric unlock**: keep in Security per design; confirm end-to-end on device (enable → locks →
  Face ID/fingerprint unlock). Already wired via expo-local-authentication.
- [ ] Tests: account-api unit tests where logic exists; RBAC/self-only where relevant. Browser-verify.

## M17 — Permissions + capture hardware (camera / location / QR) made real
Design: `m-capture.jsx` (CapCamera/CapVoice/CapAnnotate), priming screen, `m-auth` permission prompts.
- [ ] Permission priming screen matches design; requests camera + location + notifications for real,
  reflects grant/deny state, degrades gracefully (never blocks).
- [ ] Camera capture screen (`CapCamera`) real via expo-camera (photo → evidence pipeline already exists).
- [ ] QR/asset scan (expo-camera barcode) pre-fills location/asset fields.
- [ ] Location permission request + capture flow surfaced (auto-stamp), permission-gated.
- [ ] Voice quick-log: honest — needs a transcription backend; keep the flagged note, don't fake.

## M18 — Profile edit + storage + notif-prefs real wiring; per-role fidelity audit
- [ ] Profile edit (`ProfileEdit`): real save (grep for a profile-update endpoint; if none, add or flag
  honestly — no silent dead form). Avatar/change-photo per capability.
- [ ] Offline & storage: real gauge already; wire the offline-behaviour toggles to persisted prefs.
- [ ] Notification prefs → real `/v1/notification-prefs` (already in contract).
- [ ] Audit each role (inspector/viewer/manager/admin/auditor) home + tabs vs `m-home.jsx` pixel-for-pixel;
  fix drift.

## Verification (every slice)
`pnpm -w typecheck` (7/7) + `pnpm -w lint`; mobile unit tests; browser-verify in the Expo-web preview
(and standalone-PWA emulation for M14); screenshot the working state; update `progress_mobile.md` in the
same commit. No feature marked done while any designed control is a stub (CLAUDE.md #10).

## Honest deferrals (flag in progress, never fake)
- Voice→text quick-log (no transcription backend).
- AI vision defect-detection on live camera (no vision model wired).
- Any endpoint proven absent after grepping BOTH the contract and the controllers.
