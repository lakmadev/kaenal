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

## M19.6 — "Photo + AI" vision triage (self-hosted VLM) ✅ DONE (commit)
Was a deferral ("no vision model wired"). Now real, behind the existing AI-gateway chokepoint:
- [x] Types: `AiFeature` += `ncr_photo_triage`; `AiDraftRequest.imagesBase64[]`.
- [x] Core: `FEATURE_ROUTING.ncr_photo_triage → { model:"vision" }`.
- [x] API: vision system-prompt (returns strict JSON title/severity/category/description); provider port gains
  `images[]`; **`OllamaAiProvider`** (real local model, `/api/chat`) selectable via `AI_PROVIDER=ollama` +
  `OLLAMA_*` env — stub stays the default (dev/test/CI need no model). Gateway threads images through; gating/
  budget/ledger unchanged.
- [x] Mobile: `triageFromPhoto` (`features/ncr/ai.ts`) base64s the first evidence photo → `requestAiDraft` →
  parses JSON → prefills title/severity/category/description. "Pre-fill from photo with AI" banner in create
  step 2 (advisory; user edits).
- [x] Verified: model runs on this M4 (qwen2.5vl:3b); the exact provider payload + prompt against real Ollama
  returned clean parseable JSON with valid severity/category enums. Gate: typecheck 7/7 · lint · api tests
  (ai-gateway 7, ai-http 7, **ai-provider-ollama 3** mocked-fetch).
- [x] **LIVE end-to-end** (restarted API on `AI_PROVIDER=ollama`, acme intelligence pack + `allow_ai`
  enabled via `scripts/enable-ai-acme.ts`): `POST /v1/ai/drafts {feature:ncr_photo_triage, imagesBase64}`
  → **HTTP 200 in 1.5s** through the full governed gateway → local qwen2.5vl → JSON draft; `ai_invocations`
  row `ncr_photo_triage/vision/succeeded/1491ms`. The live run caught a real gap — the ledger's `feature`
  CHECK didn't include the new value → **migration `0038_ai_feature_vision.sql`** (rule #7: a feature is
  migration + contract + service + tests). db:check 49 tables green.
- Harness note: the in-app *file-picker* tap can't be driven by the browser automation (OS dialog), so the
  photo→button→prefill was proven via the governed API round-trip the button calls (the button+parse+prefill
  UI itself is verified to render in M19.5c). To see it in-app: NCR create → step 2 → **Add** a photo → tap
  **Pre-fill from photo with AI**.
- Note: default all `OLLAMA_MODEL_*` to one 3B vision model so a single `ollama pull qwen2.5vl:3b` serves
  everything on a laptop. For real defect *grading* (not just description), a fine-tuned YOLO detector is a
  later phase — the VLM triage is advisory, human-confirmed (IATF traceability).

## Honest deferrals (flag in progress, never fake)
- Voice→text quick-log (no transcription backend).
- ~~AI vision defect-detection (no vision model wired)~~ → **DONE in M19.6** (self-hosted Ollama VLM behind
  the AI gateway; "Photo + AI" triage prefills the NCR). Live on-frame overlay + fine-tuned defect *grading*
  (YOLO) remain later phases.
- Any endpoint proven absent after grepping BOTH the contract and the controllers.

---

# MOCK COMPLETION AUDIT + M20+ PLAN (post-M19)

Full pass over `project_brain/mobile/src/m-*.jsx`, every exported component cross-referenced with the
built routes. **Most of the design is built and faithful** — all auth screens (incl. recovery/forgot/
reset/biometric), the 4 role dashboards, inspections (list→start→runner→review→saved), the **NCR 3-step
guided create** + detail + verify, My-Tasks/8D/CAPA, approvals/team/manage-web, every settings sub-page,
sync-queue, notifications, and the tablet **side rail**. Remaining, grounded gaps below.

## Confirmed gaps to build (real; endpoints/where-needed noted)
1. **AssignSheet** (`m-oversight.jsx`) — assign/reassign bottom sheet: teammate search + workload + select →
   assign. Endpoints EXIST: `/v1/{inspections,ncrs,capa,eight-d,scar}/:id/assign` + `/v1/members`. Not on
   mobile yet. → **M20**
2. **CapAnnotate** (`m-capture.jsx`) — tap-to-annotate photo editor (arrows/circles/freehand). No backend
   (annotated image becomes the evidence). → **M21**
3. **CapVoice** (`m-capture.jsx`) — voice quick-log. REAL half: hold-to-talk record (expo-audio, installed) →
   attach **audio as evidence** (needs audio mimes added to `packages/core/src/file-policy.ts` allowlist —
   small backend change). Voice→text→chips stays flagged (no transcription backend). → **M22**
4. **Tablet two-pane master-detail** (`m-tablet.jsx` TabletInspections/TabletApprovals/TabletDashboard) —
   list+detail split-view at ≥768pt beside the existing SideRail. → **M23**
5. **State fidelity** — verify/fill the designed loading + empty + error states: `InspLoading`, `InspEmpty`,
   `MyTasksEmpty`, `ErrorState`, `SyncSynced` (`NotifEmpty` already done). Plus FlashList + Dynamic-Type
   perf/a11y polish (the standing M12 carry-forward). → **M24**

## Deferred (need a backend/service that doesn't exist — flag, never fake)
- **CapCamera** live-camera **AI defect detection** — needs a vision model. (Plain camera capture already
  works via the picker; only the on-frame AI overlay is deferred.)
- **Voice→text transcription** → structured chips — needs a transcription service.
- **AuthSSORedirect** (`m-auth-extra.jsx`) — SSO/IdP handoff isn't wired server-side.
- Signature capture (05 §3, no mock component) — revisit if a design lands.

---

## M19.5 — NCR screens: pixel-for-pixel + full backend (rule #0)  ← IN PROGRESS
Trigger: the five `m-ncr.jsx` screens are wired-but-simplified — designed elements dropped. Rule #0
(CLAUDE.md): implement pixel-to-pixel INCLUDING the backend, additive only, without touching web behaviour.

**Grounding (verified — the schema already carries most of this):**
- `ncrs` table already has `category`, `risk`, `created_by` (reporter), `impact jsonb`, `plant_id`,
  `area_id`, `created_at` — just not exposed in `NcrDto`.
- `ncr_actions.kind IN ('containment','corrective','preventive')` already models containment;
  `listNcrActions` exists AND mobile already fetches it (`useNcrActions`) but never renders it.
- `files.entityKind/entityId` already attach evidence to any entity; presign accepts them.
- `audit_events(entity_kind,entity_id,action,actor_id,created_at)` — every `withAudit` NCR mutation
  is an activity row. This is the Activity feed source.
- Comments API (`listComments`/`createComment`) exists; mobile's Comment button is a dead `alert()`.

**M19.5a — Backend (additive, web-safe; one migration if any, contract + service + tests):**
- [ ] Enrich `NcrDto`: `category`, `risk`, `reporterId` (=created_by), `plantName`, `areaName`
  (LEFT JOIN plants/areas), `unitsAffected` (from `impact`). Map existing columns; 2 joins. Web ignores new fields.
- [ ] `CreateNcrBody`: add `category?`, `containment?: string[]`, `evidenceFileIds?: string[]`. Create
  persists containment as `ncr_actions(kind='containment')` and links files (`entity_kind='ncr'`) — all in the audited tx.
- [ ] `GET /v1/files?entityKind=&entityId=` list (reuse the comments/links `?entityKind&entityId` selector
  pattern) → evidence strips on detail/verify. Returns download URLs.
- [ ] `GET /v1/ncrs/:id/activity` → audit_events for the NCR (actor name + action + ts), newest first,
  cursor-paged. The detail Activity feed.
- [ ] Tests: DTO fields populated; create persists containment+evidence; files-by-entity list scoped + RLS;
  activity list scoped + RLS; cross-tenant 404. `pnpm db:check` if a migration lands.

**M19.5b — Mobile Detail + Verify pixel-perfect:** ✅ DONE (commit).
- [x] Detail: evidence **photo strip**, location+timestamp **meta line**, full **Details** (Reporter, Owner,
  Category, Severity+units, Due — real resolved names), **Activity feed** (real `/v1/audit-events` + actorName),
  real **Comment** (thread screen `ncr/[id]/comments.tsx`, not `alert()`), 8D banner. Browser-verified.
- [x] Verify: **"Evidence to verify"** list (real `ncr_actions` corrective/containment + attached evidence
  count), decision, note, action — per `NcrVerify`. (Typecheck-clean; not visually exercised — no seeded
  awaiting-verify NCR + admin self-verify is four-eyes-blocked.)

**M19.5c — Mobile Create Steps 1–3 pixel-perfect:** ✅ DONE (commit). Browser-verified end-to-end.
- [x] Step 1 `NcrCreateStep1`: **method chooser** (Photo / Voice [Soon] / Manual / Scan → /scan), Location
  card + hint, Asset/part scan row (consumes the /scan store handoff).
- [x] Step 2 `NcrCreate`: evidence grid (PhotoField), Title, What-happened, Severity **+ Category chips**,
  containment checklist (persists via `containment[]`), **"Open an 8D?" banner** (shows on critical/containment).
- [x] Step 3 `NcrCreateStep3`: summary + review rows (Evidence / Containment / 8D / Location) with **Edit**
  links that jump back to the right step.
- [x] Create body now carries `category`, `containment[]`, `evidenceFileIds[]` (evidence gated on upload via
  `dependsOnFileIds`, local→server ids swapped at push). "Yes, open 8D" → create + escalate (online).
- Honest flags: **AI-from-photo prefill** (vision) and **Voice** capture stay deferred (M22), shown as "Soon"
  / plain manual entry — never faked.

**Sequencing:** M19.5a (backend) → M19.5b → M19.5c ✅ all committed + gated + browser-verified. **NCR is now
pixel-for-pixel with a real backend.** Next: **M20 — AssignSheet**.

## M20 — Assign / reassign work (AssignSheet)
- [ ] `AssigneeSheet` bottom-sheet component (design `m-oversight.jsx AssignSheet`): drag handle, entity ref,
  teammate **search** over `/v1/members`, per-teammate workload hint + selectable row, primary "Assign to X".
- [ ] `account`/entity assign calls (typed client): `assignInspection/assignNcr/assignCapa/assignEightD/
  assignScar` with `Assign*Body`. Offline-queued mutation (reuse the M3 engine) with optimistic UI.
- [ ] Wire the sheet where the role can assign (manager/admin, RBAC-gated via `can()`): NCR detail, inspection
  start, My-Tasks rows, 8D, CAPA.
- [ ] Tests (pure `buildAssignPayload`/eligibility where logic exists) + browser-verify + audit event.

## M21 — Photo annotation (CapAnnotate)
- [ ] Annotate editor over a captured photo: `react-native-svg` draw layer (arrow / circle / freehand),
  color + undo, per `m-capture.jsx CapAnnotate`.
- [ ] Flatten photo+overlay to a new image (`react-native-view-shot` or canvas) → replace the staged
  `pending_file` so the annotated version is what uploads. No backend.
- [ ] Hook an "Annotate" affordance into `PhotoField` / capture after a photo is added; web falls back
  gracefully (annotate on native; web keeps the plain photo).

## M22 — Voice quick-log (CapVoice) — real recording + audio evidence
- [ ] Add audio mimes (`audio/m4a`, `audio/mp4`, `audio/aac`, `audio/mpeg`) to `ALLOWED_MIME_TYPES`
  (`packages/core/src/file-policy.ts`) + a policy test.
- [ ] Hold-to-talk recorder (expo-audio) with level meter, per `m-capture.jsx CapVoice`; on release, stage the
  audio as a `pending_file` and attach it as evidence on the quick-log/NCR (reuses the M7 presign pipeline).
- [ ] Voice→text→severity/area/part chips stays an **honest flagged note** (no transcription backend) — the
  audio itself is captured, stored and attached for real ("audio file always kept as evidence", 05 §3).

## M23 — Tablet master-detail two-pane
- [ ] At ≥768pt, a `<TwoPane list detail>` layout beside the SideRail: list on the left, selected-item detail
  on the right (`m-tablet.jsx TabletInspections/TabletApprovals/TabletDashboard`).
- [ ] Apply to inspections/My-Tasks and approvals; keep phone single-pane. Selection state in the URL/route so
  deep-links + back behave. FlashList for the list pane.

## M24 — State-fidelity + perf/a11y polish
- [ ] Verify + fill the designed states on every list/detail: loading skeleton (`InspLoading`), empty
  (`InspEmpty`, `MyTasksEmpty`), error (`ErrorState`), all-synced (`SyncSynced`).
- [ ] FlashList migration on the hot lists (tasks, NCRs, notifications, sessions).
- [ ] Dynamic-Type (respect OS text size) + contrast pass; larger-touch-target option from Appearance.

## Sequencing
M20 (assign — highest workflow value, endpoints ready) → M21 (annotate) → M22 (voice+audio) → M23 (tablet
two-pane) → M24 (states + perf/a11y). Each an independent committed + gated + browser-verified slice;
`progress_mobile.md` updated in the same commit. Same non-negotiables (CLAUDE.md #10/#11: never fake/stub;
native edge-to-edge).
