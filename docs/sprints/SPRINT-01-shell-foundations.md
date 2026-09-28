# SPRINT-01 — Shell foundations (top bar completion, keyboard, offline/stale-write, a11y, i18n)

Author: Product Owner. Date: 2026-09-26. Part of the multi-sprint programme in `ROADMAP.md` (Wave 1 of 12).
Governing rules: CLAUDE.md rules 0, 7, 9, 10, 11 and `SCRUM.md`. Design fidelity is a completion gate.

## 1. Goal and roles served

Finish the app shell so every control the design shows in the top bar and shell is real, and add the cross-cutting behaviours `04-WEB-APP.md` requires of EVERY later screen (offline banner, 409 stale-write dialog, keyboard-accessible menus, i18n layer). Later sprints inherit these instead of each re-inventing them.

Roles: all authenticated web users (admin, manager, auditor, inspector, viewer). Partners (portal) are NOT served (separate `(portal)` shell, unchanged).

## 1a. User decisions applied (2026-09-26) and designer inputs

Decisions Q1-Q9 are recorded in `ROADMAP.md` "Decisions". Effects on this sprint: Q1 wizard replaces dialogs (CAPA keeps its dialog); Q2 no backend design approval needed for Sprint 01; Q3 pqe excluded (S1-11); Q4 English only, mobile no i18n; Q5 deferred external-infra settings entries are hidden, not dead (S1-11); Q7 AI "Generate PDF" uses existing exports; Q8 Tweaks panel and AI prominence are real, persisted (S1-9); Q9 mobile voice quick-log control removed (S1-11).

Designer input: `docs/design/DESIGN-01-shell-foundations.md` (board ids W1..W9 cited below). Two location corrections adopted: the command-palette design is `notifications.jsx` `CommandPalette` (lines 134-338) with `QUICK_ACTIONS` in `data.js:393-414` (NOT `shell.jsx`, which owns only the search trigger); `LiveModeButton` + `LiveToastProvider` are in `realtime-empty-skel.jsx` (149-173, 64-147), `shell.jsx:292` only mounts it.

The designer's 7 deviations from the jsx (D-P1, D-W1, D-T1, D-T2, D-F1, D-R1, D-S1) ALL touch stories in this sprint (mapping in section 8a). They are the USER's to approve; stories are written to the deviation, and the sprint cannot pass Gate 1 until the user approves the visuals and the deviations.

## 2. Verified current state (grepped this session, not assumed)

| Fact | Evidence |
|---|---|
| Command palette EXISTS and searches `GET /v1/search` (Navigation + Records groups, debounced) | `apps/web/src/components/shell/command-palette.tsx`, `hooks/use-search.ts`, contract `search` at `packages/types/src/contract.ts:255` |
| Palette has NO "Quick actions" group (04 §3 requires Quick actions / Navigation / Records) and no shortcuts dialog / ⌘I / ⌘D | command-palette.tsx (only `NAV` list + entity hits) |
| Top bar has search, bell, theme, profile only. Missing: Quick-create "New", Live-mode toggle, AI button | `components/shell/topbar.tsx` (118 lines) vs `shell.jsx` `TopBar` lines 228-340 |
| Realtime SSE consumer EXISTS (`use-realtime.ts`, `GET /v1/events`), but there is no user-facing Live-mode toggle or live toasts | `hooks/use-realtime.ts`, `app-shell.tsx` |
| AI backend: only `POST /v1/ai/drafts` and `/v1/ai/summaries/accept` — NO chat endpoint | `apps/api/src/ai/ai.controller.ts`; `gateway.service.ts` exists (governed gateway) |
| Create flows are per-entity DIALOGS (`ncr-create-dialog`, `inspection-create-dialog`, `eightd-create-dialog`, `document-create-dialog`, `capa-create-dialog`); no `CreateWizard` | `apps/web/src/features/*/…create-dialog.tsx`; design is full-page `createwizard.jsx` (`CreateWizard`, `QuickCreateButton`, `ENTITY_TYPES`) |
| Only `@radix-ui/react-dialog` is installed; profile menu / notif dropdown / filters are hand-rolled | `apps/web/package.json`, `profile-menu.tsx` |
| No offline banner, no 409/STALE_WRITE dialog (only Kanban revert-on-409 and settings sections mention 409) | grep of `apps/web/src` |
| No i18n layer (`next-intl` absent) | `apps/web/package.json` |
| Dashboard widget grid (drag/drop, presets, catalog) EXISTS — the "dashboard widget grid" gap in the inventory is STALE | `features/dashboard/dashboard-view.tsx` |
| `PLANNED_MODULES.spc` is STALE (real route `/spc` + `features/spc` exist) | `config/planned-modules.ts`, `app/(app)/spc/page.tsx` |
| Search hits of kind `audit` have no route (`entityHref` returns null) | `lib/entity-routes.ts`; closes in Sprint 02 |

## 3. Stories

Notation per story: UC = use cases (happy / error / empty / permission / offline). AC = testable acceptance criteria.

### S1-1 Quick-create "New" menu + full-page CreateWizard

**Design:** `project_brain/project/src/createwizard.jsx` (`QuickCreateButton` lines 636-684, `CreateWizard` line 228, 683 lines total) — READ ALL of it; every step/state is binding. Top-bar placement: `shell.jsx` line 290.

UC
- Happy: click "New" -> menu lists the entity types in `ENTITY_TYPES` (Inspection, NCR, 8D, Document) -> pick -> full-page wizard -> complete -> record is created -> navigate to its detail + success toast.
- Error: server validation error (422) maps to the offending wizard step/field; STALE/network error keeps wizard state, shows retry.
- Permission: a type the user lacks the create capability for is NOT listed (no button that will 403); viewer sees no "New" button at all.
- Offline: wizard submit is disabled with tooltip (see S1-5) — not silently queued.
- Abandon: leaving mid-wizard with dirty state prompts confirm; ESC/close returns to previous route.
- Idempotency: double-click submit creates one record (idempotency key per wizard session).

AC
1. "New" button + dropdown match `QuickCreateButton` pixel-for-pixel (240px min width, 28px tinted icon tiles, arrow, hover state).
2. Each of the 4 wizard flows reproduces every step, field, validation message and summary panel in `createwizard.jsx`.
3. Each wizard posts to the existing create endpoints (`POST /v1/inspections`, `/v1/ncrs`, `/v1/8d`, `/v1/documents`) with an idempotency key; created record opens.
4. Every wizard field that the design shows and the body schema lacks (e.g. NCR source selection, evidence upload, notify rules, tags, priority-based due dates — FEATURES §5) is either already persisted (proved by grep) or added to the body schema + service + audit event in THIS sprint (rule 0). No dropped field.
5. DECIDED (Q1): every per-entity "New …" trigger (list pages, empty states, detail-page actions) opens the wizard; the NCR/inspection/8D/document create dialogs are DELETED once replaced (no second create path). CAPA has no wizard type and keeps `capa-create-dialog`; the palette/menu "New CAPA" opens that dialog.
6. Capability-gated menu items verified with a non-admin role (boards W7-B inspector, W7-C viewer = no button).
7. States per DESIGN-01: submitting W7-E (double-click safe), offline W7-F (Create disabled with tooltip), server 422 mapped to failing step W7-G, create failed + Retry W7-H (O-11: re-post with the SAME idempotency key), dirty-leave confirm W7-I, post-create toast W7-J (emoji dropped, deviation D-W1). No Save-draft control exists in the jsx: none is built.

Web: `components/shell/quick-create.tsx`, `features/create-wizard/*` (route `/create/[type]` or overlay route — react-coder decides, must have a real URL so refresh works), replace dialog triggers in list screens.
Mobile: unaffected — mobile has its own dedicated create flows (`ncr/new.tsx`, Quick-Log) designed in `m-ncr.jsx`/`m-capture.jsx`; there is no mobile equivalent of a global "New" menu.
Shared: any new fields go into `packages/types` Zod schemas once (web + mobile share them; mobile keeps working because new fields are OPTIONAL). Wizard step/validation logic (priority -> due-date derivation etc.) belongs in `packages/core`, not in the component (rule 5).
Backend: possibly migration for missing NCR/inspection columns (audit at build start; `db-migrations` + RLS suite), contract bodies, audit events on create (already exist). Cross-tenant: foreign ids referenced in the wizard (supplier, template, assignee) must 404 (rule 8) — test.
Design needs: existing jsx (complete). No new design.

### S1-2 Command-palette parity + keyboard shortcuts dialog

**Design:** `notifications.jsx` `CommandPalette` (134-338) + `data.js` `QUICK_ACTIONS` (393-414) + `04-WEB-APP.md` §3 (one palette, three groups; `createwizard.jsx:550` `CommandPaletteBasic` is superseded — do not build it). Palette states W4-A..H and Shortcuts dialog W3-A..D are designed in DESIGN-01 (new, need user visual approval).

Decisions (designer open items O-1..O-4, O-10, O-12):
- O-1 Quick actions = New inspection, New NCR, New 8D, New document, New CAPA (opens the CAPA dialog), Toggle theme, Keyboard shortcuts, Open AI assistant, Sign out (real existing sign-out mutation). "Schedule audit" is NOT included now; Sprint 02 adds it when `/audits` exists (dead-end rule).
- O-2 Shortcut chips shown ONLY for bound keys (⌘I, ⌘D, ?, ⌘K) — deviation D-P1 (user sign-off).
- O-3 No ⇧⌘Q binding; the Sign-out chip in the profile menu is dropped.
- O-4 BUILD the two Preferences toggles from `settings.jsx:430-431`: "Keyboard shortcuts" (off => global bindings inactive, shortcuts dialog shows W3-C) and "Show keyboard hints" (off => `.kbd` chips hidden). Persisted server-side in preferences (see S1-9).
- O-10 palette search error "Retry" refetches `/v1/search`.
- O-12 W3-C "Open Preferences" routes to `/settings/preferences`.
- The profile-menu "Keyboard shortcuts" row (dead in the jsx, `shell.jsx:392`) opens the shortcuts dialog and replaces the built "Command palette" row (D-03).

UC
- Happy: ⌘K/Ctrl+K opens palette; typing shows Quick actions (New inspection, New NCR, New 8D, New document, Toggle theme, Open shortcuts, Open AI assistant), Navigation, Records; arrows/Enter/Esc work; ⌘I opens New inspection wizard, ⌘D New 8D wizard; `?` or palette action opens the shortcuts dialog listing all shortcuts.
- Empty/no result: existing "No results" state kept.
- Permission: quick actions and nav entries filtered by capability (same source as sidebar `rbac.ts`).
- Record hit with no detail route: shown non-navigating today (audit kind). After Sprint 02 it routes.
- Conflict: ⌘N NOT bound (browsers reserve it — spec).

AC
1. Quick actions group present, capability-filtered, each action executes real behaviour (opens S1-1 wizard / toggles theme / opens AI drawer / opens dialog).
2. ⌘I / ⌘D work from any authed screen except while typing in an input; documented in the shortcuts dialog.
3. Palette navigation list contains ONLY routes that resolve (test iterates every entry and asserts a real route or planned-module exists; after each later sprint the list grows with the new modules).
4. No `href: "#"` rows remain in Records: unroutable kinds are hidden or explicitly labelled, never a dead click.

Web: `command-palette.tsx`, `shortcuts-dialog.tsx`, a `useGlobalShortcuts` hook. Mobile: N/A (no palette in `m-*.jsx`; no hardware-keyboard requirement in 05). Shared: shortcut registry constant in `packages/core` is NOT needed (web-only) — keep in web config. Backend: none (uses `/v1/search`). Design needs: shortcuts dialog (see above).

### S1-3 Live-mode toggle + live event toasts

**Design:** `realtime-empty-skel.jsx` `LiveModeButton` (149-173) and `LiveToastProvider` (64-147); `shell.jsx:292` only mounts the button. States off/on/reconnecting/paused-offline/narrow dot-only and toasts with/without actor: DESIGN-01 W5-A..H, W9-A. While the browser is offline the toggle shows "Paused" (W5-D) and is not clickable-dead: it explains itself via tooltip (D-T1).

UC
- Happy: toggle ON -> subscribed SSE events involving the current user (assigned, mentioned, status changed on records they own/watch) raise a toast with entity code + action and a "View" link; toggle OFF -> data still refreshes silently (query invalidation stays always-on) but no toasts.
- Persistence: preference remembered per user (localStorage convenience is acceptable for the toggle state; not business data).
- Error/reconnect: SSE drop shows a subtle "reconnecting" state on the toggle; auto-reconnects with backoff; never toast-storms after reconnect (dedupe by event id).
- Permission: events for records the user cannot view are never delivered (server already RLS/plant-scopes pointer events — verify the event carries no data).
- Empty: no events -> no UI noise.

AC
1. Toggle renders per design (states on/off/reconnecting).
2. Toasts only for events where the actor is someone else and the entity relates to the user (rule defined in `packages/core` `shouldToast(event, me)` with unit tests).
3. Clicking "View" routes via `entityHref` (real detail route) — unroutable kinds produce no toast.
4. Two-browser manual test evidence: user B edits an NCR assigned to A -> A sees toast within 2s.

Web: `components/shell/live-mode-button.tsx`, extend `use-realtime.ts`, toast wiring. Mobile: unaffected (mobile already has realtime + push + notification center, `use-realtime-sync.ts`). Shared: `shouldToast` in `packages/core`. Backend: verify `RealtimeEvent` carries `actorId`/`entityKind`/`entityId`/`action`; if `actorId` or assignee relation is absent add it to the pointer envelope in `packages/types/src/realtime.ts` + emitter (still identity-only, never row data). Audit event: none (no mutation).
Design needs: existing jsx.

### S1-4 AI assistant button + drawer (chat)

**Design:** `project_brain/project/src/ai.jsx` (`AIDrawer`, 237 lines, incl. prompt chips, context header, response actions) + `shell.jsx` AI button (prominence variants: front / normal / quiet). FEATURES §1.11 (response actions: Copy · Pin to entity · Insert into field · Generate PDF).

UC
- Happy: click AI -> right-side drawer, context-aware of the current route/entity (e.g. viewing NCR-2026-0014 sends entity ref); ask "summarize", "suggest root cause"; streamed reply with provenance/confidence chip (trust components); Copy works; Pin to entity saves the reply as a comment on the entity (existing `POST /v1/comments`); Insert into field inserts into the focused registered text field on the page; Generate PDF creates an export via the existing export pipeline.
- Error: gateway down / provider error / budget exceeded / PII redaction blocked -> inline error message with retry, request id; never a fake reply.
- Governance: every invocation logged in `ai_invocations` (exists, migration 0014) with feature key, tokens, redaction result; tenant AI-off setting disables the button (button hidden, not dead).
- Permission: capability `ai:use` (add if absent); viewer role behaviour per rbac matrix (decide in build, record).
- Offline: input disabled with tooltip.
- Empty: welcome message + suggestion chips per design.

AC
1. Drawer, prompt chips, message bubbles, typing state pixel-match `ai.jsx`.
2. `POST /v1/ai/chat` (streaming via SSE per 06 §AI, cursor/idempotency not applicable to stream; request idempotency key accepted) routes through `gateway.service` so redaction, budget and audit apply; unit + integration tests incl. cross-tenant (entity ref from another tenant -> 404) and audit event.
3. DECIDED (Q8): ONE prominence vocabulary, `front | normal | quiet` (the vocabulary of `shell.jsx` and `04 §3`; the `quiet | visible` values in the `ai.jsx` TweaksPanel are retired and mapped visible->normal). Persisted per user (see S1-9); `quiet` removes the top-bar button (board W6-I "removed"); the palette action "Open AI assistant" still opens the drawer. Document the choice in `apps/web/docs/design-rules.md`.
4. DECIDED (Q7, O-8): Generate PDF uses the EXISTING exports pipeline (`apps/api/src/exports`): add an export kind for an AI reply (renders the message text + provenance) inside that pipeline; states preparing/ready/failed with "Download PDF" / "Retry PDF" (W6-H). "View comment" (after Pin) opens the entity's comments tab. No new PDF renderer, no dependency on the P24 designer.
4a. O-6 "Copy request ID" copies the request id to the clipboard; "Try again" re-sends with a NEW idempotency key.
4b. O-7 the budget-exceeded message (W6-F) shows its "Review AI governance" link ONLY when the user holds the governance capability AND `/ai-governance` is a built route (Sprint 10); until then the link is not rendered (no dead link).
4c. O-13 `ai:use` is granted to all internal roles including viewer (read-only chat); "Pin to entity" requires the comment capability and is hidden without it; "Insert into field" only when a registered field is focused (W6-H "no field" state). Tenant AI-off or missing capability => button removed (W6-I), not disabled. Partners never see AI.
5. Context builder is server-side (client sends entity ref only; server assembles governed context under RLS) so no client-supplied text is trusted as context.

Web: `features/ai-assistant/*`, `hooks/use-ai-chat.ts`, topbar button. Mobile: unaffected — no AI drawer in `m-*.jsx`; mobile AI is limited to capture assist (`detect.tsx`, vision feature 0038). New endpoint is web-first but generic (bearer-compatible) so a future mobile surface can reuse it without reshaping.
Shared: `AiChatRequest`/`AiChatChunk` Zod in `packages/types`; contract entry (SSE endpoints may live as plain controller routes like other streaming routes — follow the pattern of `/v1/events`).
Backend: service + controller + prompts (`prompts.ts`), capability, audit event `ai.chat`, tests. Migration only if a conversation log is wanted (not required: `ai_invocations` suffices — do NOT persist chat history unless designed; open if design shows history).
Design needs: existing jsx.

### S1-5 Offline banner + 409 stale-write reconcile dialog + mutation gating

**Spec:** `04-WEB-APP.md` §6 items 4-5, §9. Designer audit result: no web jsx exists (`realtime-empty-skel.jsx` has empty/skeleton/live-toast only). NEW designs: offline banner W1-A..D, 409 dialog W2-A..F (conflict, review merged with/without conflicts, reload failed, record deleted), toasts W2-G, phone width W9-B/C. Tone reuses the mobile banners (`m-system.jsx`). Deviations D-T1 (tooltip), D-T2 (toast second line), D-S1 (dialog has no X and ignores Esc) apply.
Decisions: O-5 "Copy my changes" copies a plain-text summary (field: my value) of the user's edited fields, then shows the "Copied" toast. O-9 offline-banner "Retry" forces an `onlineManager` re-check + refetch of active queries. Record deleted meanwhile (W2-F): only "Discard and go back" (routes to the list) — no re-apply.

UC
- Offline: `navigator.onLine`/TanStack `onlineManager` false -> sticky banner under top bar "You're offline — changes can't be saved"; write controls disabled with tooltip; reading cached data continues; back online -> banner dismisses, queries refetch.
- Stale write: any mutation returning 409 `STALE_WRITE` opens a dialog: "This record changed" with who/when (from `updatedAt`), options "Reload and re-apply my change" (refetch, re-run the diff of the user's edited fields onto fresh data, user confirms) / "Discard my change" / "Copy my changes".
- Kanban drag 409: revert card + toast listing allowed transitions (details in 409 body) — existing behaviour kept, aligned to the shared helper.
- Two tabs same entity: WS/SSE refetch + the dialog on save (spec §9).

AC
1. Banner and dialog are global (mounted once in `app-shell`), triggered from the single api-client error path, not per screen.
2. Reconcile logic (`reapplyChange(original, mine, fresh)` -> merged + conflicts) lives in `packages/core` with unit tests; UI only renders.
3. Every existing write form (NCR, CAPA, 8D, document, supplier, PPAP, SCAR, FMEA, settings sections) works through the global handler — proven by one Playwright/Vitest test simulating a 409 on each mutation hook family.
4. No button silently fails when offline.

Web: shell components + api-client interceptor hook. Mobile: unaffected — offline is first-class via the sync engine (`apps/mobile/src/sync`, `sync-queue.tsx`, conflict policy 05 §2.3, M3). Shared: `reapplyChange` in `packages/core`; `@kaenal/api-client` must expose a typed `isStaleWrite(err)` (verify it exists; if the details shape differs between web/mobile do NOT change the wire format — add the helper only).
Backend: none (409 already emitted with `lockVersion`); confirm response includes current `updatedAt`/`updatedBy`; if absent add to the error details additively.
Design needs: banner + dialog (designer).

### S1-6 Radix menus/popovers (keyboard + focus correctness)

UC: profile menu, notification popover, quick-create menu, list filter/overflow menus, tooltips: open on click/Enter/Space, arrow-key navigation, Esc closes and returns focus to trigger, click-outside closes, focus trapped in modal dialogs.
AC
1. Add `@radix-ui/react-dropdown-menu`, `-popover`, `-tooltip`; replace hand-rolled outside-click/Escape logic in `profile-menu.tsx`, notification popover, and the new quick-create.
2. ZERO visual change: side-by-side screenshots vs current build and vs `shell.jsx` identical (styles via existing tokens; Radix used unstyled).
3. axe-core check on shell shows no critical violations; keyboard-only walkthrough documented in PR.
Web only. Mobile: N/A (RN has no DOM menus; mobile a11y covered in M12). Shared: none. Backend: none. Design: existing jsx; fidelity must not regress.

### S1-7 i18n layer (`next-intl`, `en` only) + tenant-locale formatting

Spec: `04-WEB-APP.md` §8 ("strings through an i18n layer from day one, en only initially; Intl formatting with tenant locale"). FEATURES §"i18n intent (en/de/es)" is INTENT only — de/es catalogs are OUT of this sprint (Q4).

UC: all shell chrome strings (sidebar labels, top bar, palette, profile menu, offline/409 dialogs, wizard, AI drawer, settings nav labels) come from message catalogs; dates/numbers/relative times via `Intl` using tenant/user locale; unknown key falls back to key in dev + CI failure.
AC
1. `next-intl` wired for App Router without changing URLs (no locale prefix; locale from user preference/tenant setting/`Accept-Language`).
2. All strings introduced or touched in Sprint 01 are catalog-keyed; a lint/CI check fails on new hard-coded JSX text in `components/shell/**` and `features/create-wizard/**`.
3. `apps/web/src/lib/format.ts` uses locale-aware `Intl` (existing tests updated).
4. Rule added to `apps/web/docs/rules.md`: every later sprint keys its new strings; legacy module strings migrate opportunistically (tracked as Known issue, not a blocker).
Web: yes. Mobile: does not adopt i18n (decision Q4); English only, de/es deferred. Shared: message-key type helper may live in `packages/core` only if mobile later adopts. Backend: user `locale` preference — `GET/PATCH` of preferences already exists (verify the field; add `locale` to preferences schema if absent, with audit event). Design: none.

### S1-8 Placeholder ledger and dead-end guard (tooling)

UC: prevent regressions while 11 more sprints remove placeholders.
AC
1. Delete stale `spc` from `PLANNED_MODULES`.
2. Unit test enumerates `PLANNED_MODULES` keys, unbuilt `SETTINGS_NAV` items, and `ModulePlaceholder`-rendering pages (`audits`, `predictive`, `graph`) against an in-repo allow-list `apps/web/src/config/placeholder-ledger.ts` mapping each to its ROADMAP sprint; the list may only shrink (new entry = test fails).
3. The `settings-nav.ts` header comment ("coming soon placeholder") stays accurate until Sprint 09 when it is removed.
Web only; Mobile/Shared/Backend: none.

### S1-9 Appearance preferences (Tweaks panel + AI prominence + keyboard toggles) — REAL, persisted (Q8)

**Design:** `ai.jsx` TweaksPanel (134-235: accent, density, AI prominence); `settings.jsx:430-431` toggles. DESIGN-01 drew no Tweaks board (waiting on Q8) — UI Lead Designer must add it (panel placement, entry point) before build.

UC
- Happy: user opens the Tweaks panel (entry: Preferences section and the design-defined trigger), changes accent / density / AI prominence / keyboard toggles; the shell updates instantly and the choice persists across reloads and devices (server-side per-user preference, not localStorage).
- Error: save fails -> revert UI + toast; concurrent edit from two tabs -> last write wins per field (409 handled by S1-5).
- Permission: self-scoped, every role.
- Offline: controls disabled with tooltip.

AC
1. Accent and density apply through CSS variables on `:root` (ink accent stays the default; overrides only per user pref); contrast validated for every accent option in light and dark (designer supplies the allowed set from the jsx).
2. AI prominence uses the single vocabulary `front|normal|quiet` (S1-4 AC3).
3. Preferences persist via the existing preferences endpoints extended additively: `aiProminence`, `accent`, `density`, `keyboardShortcuts`, `showKeyboardHints` (+ `locale` from S1-7) with Zod in `packages/types`, audit event on update, optimistic concurrency.
4. Preferences section rows for these are wired (no dead toggles).
Web: `features/settings/sections/preferences.tsx`, Tweaks panel component, theme provider. Mobile: unaffected — mobile has its own appearance screen (`settings/appearance.tsx`, `m-settings-detail.jsx` SettingsAppearance); new fields are additive and mobile ignores them. Shared: preference schema in `packages/types`. Backend: verify the preferences table/route (`use-me`/preferences); add columns/jsonb keys via migration if stored typed; audit event; RLS test if a new table.

### S1-10 Top bar / menu fidelity fixes (unplanned divergences found by the designer)

From DESIGN-01 section 5 (code-level, must be confirmed in-browser by `web-fidelity-reviewer`). Fix to match the jsx:
- D-02 header padding 0 20 / gap 16; D-02b search trigger 38px, bg-subtle, `r-md`, 0 8 0 14 padding, placed right after the breadcrumbs (not centred), kbd on surface; D-02d bell 17px, badge 16px at top/right 4; D-02e profile divider + short name; D-P2 palette panel `r-lg`, input 16px; D-04 profile menu `r-lg`, "Tenant" label per jsx (chip dropped, O-3).
- D-02c breadcrumbs: page-driven (clickable parents, entity crumb on detail pages) from a route map, not static "Workspace > module".
- D-N1 notifications popover gains the "Mentions" filter. Prove at build whether a mention notification type exists (grep notifications types + comments mention parsing); if it does not, add mention notifications (comment @mention -> notification, audit, RLS) in this story, since the design shows the filter (rule 0).
- D-N2 unroutable notification rows are non-clickable (W8-E).
- D-05 "View as role" demo switcher stays OMITTED (role comes from the session) — USER must sign off this omission.
- D-06 sidebar add-on lock icon: NOT in this sprint; belongs to Sprint 10 (entitlements-only billing, Q6). Recorded so it is not lost.
Web only. Mobile: unaffected. Shared: none (mention notification type in `packages/types` only if added). Design: existing jsx. DoD: side-by-side in-browser check at desktop + 860px, light + dark.

### S1-11 Exclusions made visible: pqe and mobile voice quick-log (Q3, Q9) and deferred settings entries (Q5)

UC / AC
1. Q3: remove `pqe` from `planned-modules.ts`, sidebar `navigation.ts`, `rbac.ts`, the palette; add a row to `apps/web/src/config/excluded.md` ("Quality Engine `/pqe` — no spec; add a spec to re-include"). `/pqe` then 404s, like Quick-Log. No dead nav entry.
2. Q5: settings entries whose whole value needs external infrastructure and are deferred to the last wave — `sso`, `scim`, `byok`, `status-page`, `backup-restore`, `warehouse` — are HIDDEN from the settings rail (a `hidden: true` flag in `SETTINGS_NAV`, unknown-slug guard still resolves to profile) and listed in `excluded.md` with the re-include instruction. Vendor-free entries stay in the nav as "coming soon" until their own sprint (existing decision; the ledger S1-8 tracks them).
3. Q9: mobile: hide/remove the voice quick-log control (entry in the capture/Quick-Log screen and `apps/mobile/src/app/voice.tsx` route + any deep link); record under "Known issues / excluded" in `progress_mobile.md`; `m-capture.jsx` `CapVoice` stays a design reference, not built. Prove by grep that no other control navigates to `/voice`. This is the ONE mobile change in Sprint 01 (mobile-engineer; keep PWA/native safe-area and other capture flows working).
4. S1-8 ledger includes the hidden/excluded items so they can never reappear as dead entries.
Shared/Backend: none. Design: none.

## 4. Backend needs summary

| Story | Migration | Contract / route | Service | Audit | Capability | Tenant-isolation |
|---|---|---|---|---|---|---|
| S1-1 | only if wizard fields lack columns (audit at start) | body extensions on existing create routes | existing services | existing create events | existing `*:create` | foreign ids -> 404 tests |
| S1-3 | none | `RealtimeEvent` additive fields if needed | emitter | n/a | n/a | pointer-only events; RLS refetch |
| S1-4 | none | `POST /v1/ai/chat` (SSE, plain controller) | `AiService.chat` via gateway | `ai.chat` | `ai:use` (new, seed to roles per rbac) | entity ref resolved under RLS; RLS test |
| S1-5 | none | none (verify 409 detail shape) | none | none | none | none |
| S1-7 | none unless `locale` missing | preferences schema `locale` | preferences service | `preferences.update` | self | self-scoped |
| S1-9 | possibly (typed columns or jsonb keys) | preferences schema: aiProminence, accent, density, keyboardShortcuts, showKeyboardHints | preferences service | `preferences.update` | self | self-scoped |
| S1-4 (PDF) | none | export kind for AI reply in existing exports | exports service | existing export events | `ai:use` + export | export scoped to caller/tenant |
| S1-10 | only if mention notifications are missing | notification type `mention` | comments/notifications service | existing | existing | RLS test |

Every new/changed route: cursor pagination N/A (not lists), idempotency key accepted, optimistic concurrency preserved.

## 5. Design needs

UPDATE: DESIGN-01 now covers offline banner, 409 dialog, shortcuts dialog, palette states, live-mode states, AI states, New-menu/wizard states, phone width. STILL MISSING: Tweaks panel board (S1-9). All new visuals need the user's approval.

- Existing jsx: S1-1 `createwizard.jsx`; S1-3 `shell.jsx`; S1-4 `ai.jsx` + `shell.jsx`; S1-6 `shell.jsx`.
- NONE exists -> UI Lead Designer (SCRUM step 2): offline banner, stale-write dialog, shortcuts dialog, i18n has no UI. Designs must be approved by the user before implementation.

## 6. Dead-end audit (every control introduced/touched -> real behaviour)

| Control | Resolves to |
|---|---|
| Top bar "New" + 4 menu rows | S1-1 wizard routes (real URLs) |
| Top bar Live toggle | SSE subscription + toast pipeline |
| Top bar AI button | S1-4 drawer -> `POST /v1/ai/chat` |
| Drawer: prompt chips, Send, Copy, Pin to entity, Insert into field, Generate PDF | chat / clipboard / `POST /v1/comments` / focused-field insert / export job |
| Palette Quick actions (each) | wizard / theme toggle / dialog / drawer |
| Palette Records with no route | hidden or explicit non-clickable (no `#` rows) |
| ⌘K, ⌘I, ⌘D, `?` | palette / wizard / wizard / shortcuts dialog |
| Offline banner "Retry" | forces `onlineManager` re-check + refetch |
| 409 dialog: Reload & re-apply / Discard / Copy | reconcile helper / close+refetch / clipboard |
| Profile menu rows (touched by S1-6) | unchanged targets; verify every row still resolves (workspace switcher, sign out, settings) |
| Notification popover items (touched) | `entityHref`; unroutable kinds non-clickable |
| Wizard Back / Next / Cancel / Retry | step nav / close (dirty confirm) / re-post same idempotency key. No Save-draft exists in the jsx: none built |
| Palette Quick actions incl. New CAPA, Sign out | CAPA dialog / real sign-out mutation |
| Shortcuts dialog "Open Preferences" | `/settings/preferences` |
| Preferences toggles: keyboard shortcuts, keyboard hints, AI prominence, accent, density | persisted preferences (S1-9) |
| Tweaks panel controls | same persisted preferences |
| Notifications filters All/Unread/Mentions/Assigned | real filters (mention type proven or built) |
| Budget-exceeded "Review AI governance" | rendered only if capability + built route; else absent |
| Removed: `/pqe` nav, settings sso/scim/byok/status-page/backup-restore/warehouse rail rows, mobile voice control | gone, listed in `excluded.md` |

## 7. Definition of Done

Rule 7 per story: migration (if any) + contract + UI + tests + audit events. Plus:
1. Gates green: `pnpm typecheck && pnpm lint`, `pnpm test`, `pnpm test:rls`, `pnpm db:check`; mobile `pnpm --filter @kaenal/mobile typecheck` and `pnpm lint:mobile` still clean (shared types changed).
2. Demo login re-seeded (`pnpm --filter @kaenal/api exec tsx scripts/seed-demo.ts`) and a real sign-in returns 201 (rule 12). Sprint touches shared error handling and the app shell — sign-in must be re-proven.
3. Browser-verified against `createwizard.jsx`, `shell.jsx`, `ai.jsx` side by side at desktop + 860px breakpoint, light + dark theme, by `web-fidelity-reviewer`.
4. Security review: `/v1/ai/chat` (prompt injection into tool use is N/A — no tools; entity context RLS; PII redaction path exercised).
5. `PROGRESS.md` updated (checklists, decisions log, known issues incl. legacy-string i18n migration); `progress_mobile.md` only if a shared-type change affected mobile.
6. No new placeholder/dead control; S1-8 ledger test green; Known-issues lists any wizard field deferred WITH user sign-off.
7. One branch + PR per story cluster; no push without the user's go-ahead.

## 8. Out of scope / open questions

Out of scope (this sprint): de/es translations and any mobile i18n (Q4); sidebar entitlement lock (Sprint 10); audit search-hit routing and "Schedule audit" quick action (Sprint 02); pqe (excluded, Q3); mobile changes other than removing the voice control (S1-11).

Resolved by the user 2026-09-26: Q1, Q4, Q7, Q8 (see section 1a). Remaining decisions belong to the USER only: (a) approval of the new visuals in DESIGN-01 (offline banner, 409 dialog, shortcuts dialog, palette states, live/AI states, wizard states, phone width, Tweaks board once drawn); (b) the 7 deviations D-P1, D-W1, D-T1, D-T2, D-F1, D-R1, D-S1; (c) keeping D-05 (View-as-role) omitted; (d) whether the AI viewer-role decision (all internal roles) is acceptable.

## 8a. Designer deviations -> stories

| Deviation | Stories affected |
|---|---|
| D-P1 palette chips only on bound keys | S1-2 |
| D-W1 toast without emoji | S1-1 |
| D-T1 new tooltip component | S1-1 (offline Create), S1-3 (paused), S1-5, S1-6 |
| D-T2 toast second line | S1-5 (Kanban 409 allowed transitions) |
| D-F1 inset focus ring on highlighted menu row | S1-6, S1-1 menu |
| D-R1 narrow top-bar rules (theme toggle moves to palette/profile) | S1-1, S1-3, S1-4, S1-10 |
| D-S1 stale dialog has no X, ignores Esc | S1-5 |

## 9. Parallelism inside the sprint

Serialize S1-1, S1-3, S1-4, S1-6 UI edits to `topbar.tsx`/`app-shell.tsx` (same files; do S1-6 Radix first, then S1-1, S1-3, S1-4 add buttons). Independent worktrees OK for: S1-4 backend (`ai/`), S1-5 (core helper + dialog), S1-7 (catalog scaffold), S1-8 (ledger). Merge order: S1-8, S1-11, S1-6, S1-10, S1-5, S1-7, S1-9, S1-1, S1-3, S1-4. S1-11's mobile change is an independent mobile worktree.

## 10. Sign-off

Use-case coverage: every use case, designer open item O-1..O-13 and unplanned divergence now maps to a story with acceptance criteria (S1-1..S1-11). PO sign-off stays PENDING solely on user-owned items: visual approval, the 7 deviations, D-05 omission, and the missing Tweaks board (S1-9). Note S1-4 and S1-5 add a new export kind and possibly a mention notification type; both are inside this sprint.

PO use-case sign-off: PENDING
