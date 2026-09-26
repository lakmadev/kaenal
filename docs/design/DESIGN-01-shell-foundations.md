# DESIGN-01 — Shell foundations

Author: UI Lead Designer. Date: 2026-09-26. Sprint file: `docs/sprints/SPRINT-01-shell-foundations.md`.
Visual truth: `project_brain/project/styles/tokens.css` (ink accent `#18181b`, Archivo + JetBrains Mono, 3-9px radii, flat hairline shadows), `project_brain/project/src/*.jsx` (web), `project_brain/mobile/src/m-*.jsx` (mobile). No prototype code was copied; boards are visual specs.

Canvas (private, Claude Design, new): https://claude.ai/artifact/4TCh6HY46WoSirKHviV42R — "Kaenal Sprint 01 Shell Foundations", 11 boards (W10 Appearance added, 12 tiles), 73 tiles (39 new design, 16 existing jsx reproduced for side-by-side, 6 existing jsx extended). The earlier "Kaenal Portal Invite Design" canvas was not touched.

Designer sign-off: APPROVED pending user view of the Tweaks board (W10). User has approved the other Sprint 01 visuals, all 7 deviations (D-P1, D-W1, D-T1, D-T2, D-F1, D-R1, D-S1) and confirmed D-05 "View as role" stays omitted.

## 1. Corrections to the sprint file (found while auditing)

| Sprint file says | Actual |
|---|---|
| Palette design is in `shell.jsx` | It is `notifications.jsx` `CommandPalette` (lines 134-338), with `QUICK_ACTIONS` in `data.js:393-414`. `createwizard.jsx:550` has a superseded `CommandPaletteBasic`. `shell.jsx` only owns the search trigger button. |
| `LiveModeButton` defined in `shell.jsx` | Defined in `realtime-empty-skel.jsx:149-173` (with `LiveToastProvider` 64-147). `shell.jsx:292` only mounts it. |
| Shortcuts dialog: confirm whether one exists | None exists. `shell.jsx:392` has a dead "Keyboard shortcuts" profile row (hint `⌘K · ⌘I · ⌘D`); `settings.jsx:430-431` has "Keyboard shortcuts" and "Show keyboard hints" toggles. Designed as W3. |
| Offline banner / 409 dialog: `realtime-empty-skel.jsx` may hold state patterns | It holds empty/skeleton/live-toast patterns only. Nothing for offline or 409 on web. Mobile has the patterns (`m-system.jsx`, section 4). Designed as W1, W2. |
| `ai.jsx` prominence front/normal/quiet | `shell.jsx` uses front/normal/quiet; `ai.jsx` TweaksPanel uses quiet/visible. Two vocabularies (Q8). |

## 2. Audit: story -> screen/state -> jsx or board

Legend: EXISTS = jsx shows it (reproduced on the board for side-by-side, tile chip "EXISTING"); EXTENDS = jsx exists, state/variant added; NEW = no jsx, designed here.

### S1-1 New menu + CreateWizard

| Screen / state | Source |
|---|---|
| "New" button + type menu (admin, 4 types) | EXISTS `createwizard.jsx` `QuickCreateButton` 636-682 -> W7-A |
| Menu filtered by capability (inspector) / no button (viewer) | NEW -> W7-B, W7-C |
| Menu keyboard-highlight row | NEW -> W7-D (also W8-B) |
| Wizard 4 steps (Type, Details, Assignees, Review), step indicator, footer tip, Cancel/Back/Next | EXISTS `createwizard.jsx` `CreateWizard` 228-633 (binding, not redrawn beyond header chrome) |
| Submitting (spinner, double-click safe) | NEW -> W7-E |
| Offline (banner inside wizard, Create disabled + tooltip) | NEW -> W7-F |
| Server 422 mapped to failing step/fields | NEW -> W7-G |
| Create failed (network/stale), retry | NEW -> W7-H |
| Leave with dirty state (confirm) | NEW -> W7-I |
| After create: detail page + toast | EXISTS `createwizard.jsx` `Toast` 664-682 -> W7-J (emoji dropped, D-W1) |
| Save-draft control | None in jsx -> none designed, none to build (answers sprint section 6 last row) |
| Mobile | N/A per PO: mobile has own create flows (`m-ncr.jsx`, `m-capture.jsx`) |

### S1-2 Palette + shortcuts

| Screen / state | Source |
|---|---|
| Palette modal, groups, selected row, footer hints, "No results" | EXISTS `notifications.jsx` CommandPalette -> W4-A, W4-G |
| Quick actions group (New inspection/NCR/8D/document, toggle theme, shortcuts, AI) | EXTENDS (jsx `QUICK_ACTIONS`; "Keyboard shortcuts" row is new) -> W4-A |
| Records loading skeleton | NEW -> W4-B |
| Record rows incl. audit row (routable after Sprint 02) | NEW -> W4-C |
| Permission-filtered (viewer) | NEW -> W4-D |
| Offline (Records replaced by notice) | NEW -> W4-E |
| Search error + Retry | NEW -> W4-F |
| Dark theme | W4-H |
| Shortcuts dialog (default, Ctrl variant/dark, disabled-in-Preferences) | NEW -> W3-A, W3-B, W3-C |
| Shortcuts entry: profile row | EXISTS (dead row in `shell.jsx:392`) -> W3-D; palette action W4-A; `?` key |
| Mobile | N/A (no palette or hardware-keyboard requirement in `m-*.jsx`) |

### S1-3 Live mode

| Screen / state | Source |
|---|---|
| Toggle Off / On | EXISTS `realtime-empty-skel.jsx` LiveModeButton -> W5-A, W5-B |
| Reconnecting, Paused (offline), narrow dot-only | NEW -> W5-C, W5-D, W9-A |
| Toast (actor), toast (no actor), dark | EXISTS `LiveToastProvider` -> W5-E, W5-F, W5-G |
| Toggle in top bar in each state | EXISTS/EXTENDS `shell.jsx:292` -> W5-H |
| Mobile | Unaffected. Native already has realtime + notification list (`m-system.jsx` Notifications) |

### S1-4 AI assistant

| Screen / state | Source |
|---|---|
| Drawer welcome + suggestion chips + input | EXISTS `ai.jsx` AIDrawer 3-132 -> W6-A |
| Reply with confidence meter + source chips + action row (Copy / Pin to entity / Insert into field / Generate PDF) | EXTENDS `ai.jsx` + `trust-components.jsx` ConfidenceMeter/SourceChip -> W6-B |
| Streaming with Stop | NEW -> W6-C |
| Gateway error / PII blocked / budget exceeded | NEW -> W6-D, W6-E, W6-F |
| Offline (input + write actions disabled) | NEW -> W6-G |
| Action outcomes (copied, pinned, insert no-field, inserted, PDF preparing/ready/failed) | NEW -> W6-H |
| Top bar button: front / normal / open / offline / removed (quiet, tenant AI off, no capability) | EXTENDS `shell.jsx:294-307` -> W6-I |
| Phone width (full-screen drawer) | NEW -> W9-E |
| Tweaks panel (accent/density/AI prominence) | EXISTS `ai.jsx` 134-235; real and persisted per Q8 -> board W10 (see S1-9 below) |
| Mobile | Unaffected: no AI drawer in `m-*.jsx` |

### S1-5 Offline + stale write

| Screen / state | Source |
|---|---|
| Offline banner (offline / checking / back online, dark) | NEW web -> W1-A..D (Main board). Mobile analogue exists (`m-system.jsx:6-8` warn banner, `m-system.jsx:171` success banner) and is reused as the tone |
| Disabled write controls + tooltip | NEW -> W1-A, W8-C/D |
| 409 dialog: conflict, review merged (with/without conflicts), reload failed, deleted, dark | NEW web -> W2-A..F |
| Kanban 409 toast, copied toast, saved toast | EXTENDS Toast -> W2-G (adds optional second line) |
| Phone width: banner + sheet | NEW -> W9-B, W9-C |
| Mobile | Unaffected, already designed: offline banner `m-system.jsx` SyncQueue (6-8), `m-ncr.jsx:251`, sync pill `mobile-kit.jsx:66-87`, conflict card with "Keep server / Merge mine" `m-system.jsx:16-28` |

### S1-6 Radix menus

| Screen / state | Source |
|---|---|
| Profile menu, notifications popover, quick-create menu | EXISTS (`shell.jsx`, `notifications.jsx`, `createwizard.jsx`); zero visual change |
| Trigger focus ring, arrow-key highlighted row | NEW (tokens.css `:focus-visible` extended) -> W8-A, W8-B |
| Tooltip (light/dark) | NEW component -> W8-C, W8-D |
| Notification item with no detail route | NEW -> W8-E |

### S1-9 Appearance preferences (Tweaks panel) — board W10 (`W10-Appearance-Tweaks.dc.html`, canvas y=11000)

| Screen / state | Source |
|---|---|
| Entry point: profile-menu row "Appearance" + Settings > Preferences cards | EXTENDS `shell.jsx` profile menu; `settings.jsx:415-432` -> W10-A, W10-K |
| Panel default light / dark | EXISTS `ai.jsx` TweaksPanel 134-194 (fixed bottom-right, 300px) -> W10-B, W10-C |
| Saving / saved (optimistic) | NEW -> W10-D |
| Save error (revert + banner + Toast) | NEW -> W10-E |
| Offline (disabled 50% + W8 tooltip + warning banner) | NEW -> W10-F, W10-K |
| Loading skeleton, first-open fetch error, 409 (silent per-field re-apply, caption "Updated from another tab") | NEW -> W10-G |
| Accent set with contrast | NEW -> W10-H |
| Density comfortable/compact | EXISTS `Kaenal.html` `[data-density="dense"]` -> W10-I |
| AI prominence front/normal/quiet | EXISTS `shell.jsx:294-307` -> W10-J |
| Permission | N/A: self-scoped, every internal role. No permission-hidden state (AI row hidden only when AI is unavailable, then the top-bar button is removed per W6-I) |
| Phone width | Bottom sheet per W9 pattern (noted W10-L) |
| Native mobile | Unaffected: keeps `m-settings-detail.jsx` SettingsAppearance; new keys are additive and ignored |

Vocabulary (recorded, binding for build): `aiProminence = front | normal | quiet` (old ai.jsx `quiet | visible` retired, visible -> normal); `density = comfortable | compact`; `accent = ink | indigo | teal | orange`; `keyboardShortcuts`, `showKeyboardHints` booleans.

Accent contrast (white or #18181b text on accent): light ink 17.7, indigo #4f46e5 6.3, teal #0f766e 5.5, orange #c2410c 5.2; dark #fafafa 17.0, #818cf8 5.9, #5eead4 12.0, #fb923c 7.8 (all AA). Each sets `--accent`, `--accent-hover`, `--accent-soft`, `--ring`, `--sidebar-accent`, `--sidebar-active-bg` via `[data-accent]`; ink is the default and sets nothing.

Target behaviours (for PO to confirm): every control applies instantly and PATCHes preferences (no Save button); footer shows Saving.../Saved; failure reverts + banner "Try again" (same idempotency key) + Toast; offline disables controls; a 409 is re-read and only the changed field re-applied (no S1-5 dialog); the two keyboard toggles behave per O-4 / W3-C.

New deviations from the jsx (need user sign-off; not covered by the 7 already approved):

| ID | Deviation | Reason |
|---|---|---|
| D-A1 | Teal and orange use the jsx hover shades (#0f766e, #c2410c) as base; blue swatch replaced by ink (default); violet/red/green of `settings.jsx` dropped | jsx bases fail AA for 13px white text (3.7 and 3.6 : 1); red collides with danger semantics; blue superseded by ink |
| D-A2 | Panel omits jsx "Sidebar" and "Supplier scoring" rows; adds a Keyboard group | Not S1-9 scope / not persisted; keyboard toggles are S1-9 scope |
| D-A3 | Density has two values (comfortable, compact); "Spacious" dropped | jsx CSS exists only for dense; nothing to build for Spacious |

### S1-7 i18n, S1-8 ledger

No UI. No board needed.

## 3. Web at phone width (W9)

Not asked for in the sprint but required: the web shell is reached on phones/installed PWA and `shell.jsx` has no narrow rules beyond the drawer (`useIsMobile`, 860px). W9 defines 390px forms for the top bar (breadcrumb hidden, search/New/AI icon-only, Live dot-only, theme toggle moved to palette), offline banner + gated save (reason text instead of tooltip on touch), stale-write bottom sheet, palette sheet, full-screen AI drawer, New menu + toast. 16px gutters, 44px primary actions, 34px bottom inset. Visible chrome stays 34px; hit areas extended to 44px.

## 4. Native mobile mapping

No new mobile boards: each sprint mobile item is either unaffected or already designed.

| Sprint item | Mobile jsx |
|---|---|
| Offline banner | `m-system.jsx` SyncQueue top banner; `mobile-kit.jsx` SyncPill (offline/pending/failed/synced); `m-ncr.jsx:251`; `m-inspections.jsx` saved-on-device |
| 409 stale write | `m-system.jsx:16-28` conflict card (Keep server / Merge mine); Sprint 01 does not change native behaviour |
| Shortcuts dialog, palette, New menu, AI drawer | Not applicable / no design (per PO) |
| Live mode | Native realtime + push + `Notifications` (`m-system.jsx:65-101`) |

If the user wants a native mobile change in this sprint, the safe-area rules (top 52/bottom 26 iOS) are in `mobile-kit.jsx:63-64`.

## 5. Divergence report: built shell vs jsx (code-level)

The dev server was not running (`localhost:3000` refused), so no in-browser comparison was done. Findings come from reading `apps/web/src/components/shell/*`, `features/notifications/notifications-panel.tsx`, `components/ui/toast.tsx` against the jsx. `web-fidelity-reviewer` must confirm in-browser at desktop + 860px, light + dark.

Diverged: 14 items. Already-planned this sprint: 4 (D-01, D-P0, D-03, D-N2 partial). Unplanned: 10.

| ID | Screen | jsx | Built | Severity |
|---|---|---|---|---|
| D-01 | Top bar | New, Live, AI buttons (`shell.jsx:290-307`) | Absent | Planned (S1-1/3/4) |
| D-02 | Top bar | Header padding 0 20, gap 16 | `px-4`, `gap-3` (16/12) | Minor spacing |
| D-02b | Top bar | Search trigger 38px, bg-subtle, `r-md`, 0 8 0 14, sits right after breadcrumbs, kbd on surface | `k-input` 36px, centred with `mx-auto`, generic input look, kbd `.kbd` | Visible |
| D-02c | Top bar | Breadcrumbs from page (`breadcrumbs` prop): clickable parents, entity crumb on detail pages | Static "Workspace > module" only, no links | Visible |
| D-02d | Top bar | Bell 17px, badge 16px at top/right 4, always 5 | Bell 18px, badge 18px at -4/-4, hidden at 0 (hiding at 0 is acceptable) | Minor |
| D-02e | Top bar | Profile: divider left, name "Manjunath K." | No divider, full name, hidden below `sm` | Minor |
| D-P0 | Palette | Quick actions group + shortcut chips + placeholder "Search NCRs, 8Ds, audits, CAPAs · or run a command…" | Only "Navigation" (a curated nav list) + Records; placeholder differs; `#` hrefs for unroutable hits | Planned (S1-2) |
| D-P2 | Palette | Panel `r-lg` (5px), custom shadow, input 16px | `k-surface` `r-xl` (7px), `shadow-2xl`, input 15px | Minor |
| D-03 | Profile menu | Row "Keyboard shortcuts" hint `⌘K · ⌘I · ⌘D` | Row "Command palette" instead | Planned (S1-2) |
| D-04 | Profile menu | Sign out shows `⇧⌘Q` chip; "Tenant" label; `r-lg` container | No chip; label "Workspace"; `k-surface` `r-xl` | Minor; chip needs decision (O-3) |
| D-05 | Profile menu | "View as role" demo switcher | Omitted | Justified (jsx says demo control; role comes from session) — needs user sign-off to stay omitted |
| D-N1 | Notifications popover | Filters All / Unread / Mentions / Assigned | All / Unread / Assigned (no Mentions) | Visible; unplanned |
| D-N2 | Notifications popover | Footer "{n} total"; unroutable rows n/a | "{n} shown"; unroutable rows are dead clicks | Partial (S1-6 touches; W8-E defines the state) |
| D-06 | Sidebar | Lock icon on add-on-gated routes (`isRouteLocked`, `shell.jsx:173,196`) | No entitlement lock (no `entitle` in `apps/web/src`) | Unplanned; PO to decide if in scope |

Sidebar structure (brand, sections, badges, active border, footer status pill, 272px drawer) otherwise matches `shell.jsx`.

## 6. Open items blocking `APPROVED` (need PO or user)

Controls I introduced with no PO-named target behaviour yet. Proposed behaviour in the right column; PO must confirm or reject each.

| # | Control / decision | Proposed |
|---|---|---|
| O-1 | Palette rows in jsx `QUICK_ACTIONS` that the PO list omits: New CAPA, Schedule audit, Sign out | Include New CAPA (opens existing CAPA dialog) and Sign out (real mutation exists); omit Schedule audit until the audits module ships (Sprint 02). Boards draw only the PO list |
| O-2 | Shortcut chips: jsx shows N, 8, C, A, D, / | Show chips only for bound keys (⌘I, ⌘D, ?). Needs sign-off (D-P1) |
| O-3 | `⇧⌘Q` chip on Sign out in profile menu | Drop chip unless PO wants the shortcut bound |
| O-4 | `settings.jsx:430` toggles "Keyboard shortcuts" / "Show keyboard hints" | If built this sprint: off disables key bindings and shows W3-C; hints off hides `.kbd` chips. Else drop W3-C |
| O-5 | Stale dialog "Copy my changes" | Copies a text summary of the edited fields to the clipboard, then shows the "Copied" toast |
| O-6 | AI bubble "Copy request ID" / "Try again" | Clipboard / re-send with new idempotency key |
| O-7 | AI budget "Review AI governance" link | Routes to `/ai-governance`; shown only with that capability |
| O-8 | AI "Download PDF", "Retry PDF", "View comment" | Export job download / re-run export / open entity comments tab (Q7 must be answered: existing export pipeline) |
| O-9 | Offline banner "Retry" | Already named in sprint section 6 |
| O-10 | Palette "Retry" on search error | Refetch `/v1/search` |
| O-11 | Wizard error "Retry" | Re-post with same idempotency key |
| O-12 | Shortcuts dialog "Open Preferences" (W3-C) | Routes to `/settings` preferences section |
| O-13 | AI viewer-role permission and where prominence is edited | Q8; drawn as "removed" when unavailable |

Deviations from jsx (each needs user sign-off; none silently accepted):

| ID | Deviation | Reason |
|---|---|---|
| D-P1 | Palette shortcut chips only on bound keys | Show only real shortcuts (rule 10) |
| D-W1 | Creation toast without the emoji | No emoji in UI; toast already has the check icon |
| D-T1 | New component: tooltip (ink chip = existing Toast look) | Story requires disabled-control reasons; no jsx tooltip exists |
| D-T2 | Toast optional second line | Kanban 409 must list allowed transitions |
| D-F1 | Highlighted menu row adds an inset 2px focus ring | Radix keyboard navigation needs a visible focus state |
| D-R1 | Narrow top-bar rules (W9-A) incl. theme toggle moving to palette/profile | jsx has no phone-width top bar |
| D-S1 | Stale dialog has no X and ignores Esc | Prevents accidental loss of unsaved work |

## 7. Component / state inventory (all from existing tokens)

- Surfaces: `k-surface`, hairline borders, `r-md/lg/xl/2xl`, shadows `lg/xl` only for overlays.
- Buttons: `k-btn` primary/ghost/plain, `sm`, `icon`; disabled = 50% opacity.
- Chips/pills: `k-chip`; conflict/merge chips use danger/success soft fills (tokens `--danger-50/--success-50`, mobile dark equivalents).
- Banners: warning (`--warning-50` / `#b45309`; dark `rgba(245,158,11,.16)` / `#fbbf24`) and success, same values as mobile `warnBg/warnFg/successBg/successFg`.
- Kbd chips `.kbd`; overlines `.k-overline`; skeleton `.skeleton`; pulse dot; existing Toast ink chip; AI gradient tile (existing `ai.jsx`/`trust-components.jsx`).
- States covered per surface: default, loading/streaming, empty, error, permission-hidden, stale-write, offline, dark theme, phone width. No new colour, radius or font.

## 8. Sign-off

Every screen/state of S1-1..S1-8 is mapped to an existing jsx or a board (section 2). Not yet APPROVED because: (a) [resolved: user approved all visuals except W10, deviations D-P1..D-S1, and the omission of View as role; W10 and D-A1..D-A3 await user view], (b) O-1..O-13 lack PO-named behaviours, (c) Q1 (wizard replaces dialogs) and Q7/Q8 are open.

Designer sign-off: APPROVED pending user view of the Tweaks board
