# Kaenal — Mobile & Tablet App design brief (prompt for Claude Design)

> Hand this to Claude Design to generate the mobile app design bundle under the
> Kaenal project. It deliberately widens the canonical `implementation/05-MOBILE-APP.md`
> scope (which is inspector-only) to add a role-aware dashboard, 8D follow-up, and
> manager/admin oversight surfaces — everything genuinely web-only is kept OUT.
> After delivery, the Expo app is built per `05-MOBILE-APP.md`; jsx is never copied
> into the codebase (design rule #9), it's a pixel-for-pixel binding reference.

---

Create a NEW folder in the Kaenal project called `mobile/` and design the Kaenal
mobile app inside it. Deliver it like the earlier bundles: a browsable gallery
(`Mobile App.html`) plus one `src/*.jsx` file per screen group, each screen rendered
in a realistic device frame. Show iOS AND Android frames where a pattern differs,
render every screen in light AND dark, and include a TABLET frame for the key
adaptive screens (see §2). Add a cover page: app scope, the role-based surfaces,
the offline model, and a device/role legend.

## 0. Non-negotiable: match the existing Kaenal design system
Same product as the Kaenal web app — a native family member, not a new brand.
- Use `styles/tokens.css` verbatim. Accent is INK/near-black `--accent:#18181b`
  (light) / `#fafafa` (dark) — NOT blue. Type `--font-sans:'Archivo'`; record
  codes in `--font-mono:'JetBrains Mono'`. Tight radii `--r-sm:3px … --r-2xl:9px`,
  `--r-full` pills. Semantic success/warning/danger scales (50/100/500/600/700).
  Full light + dark; neutral zinc surfaces/borders.
- Reuse web idioms (chips, cards, section headers, status pills, avatars, mono
  codes like `NCR-2026-0142`) but ADAPT to native — no desktop tables or dense rows.
- Build ON TOP OF the existing mobile designs: `src/mobile-inspector.jsx` (Daily
  work, Running checklist, Camera + AI defect, Voice-to-NCR, NCR create, NCR detail,
  Offline sync) and `src/quicklog-mobile.jsx` (capture sheet, annotate, auto-context).
  Keep and refine them, then add the new screens so the whole set reads as one app.

## 1. Platform, native patterns & modern standards (Expo + NativeWind)
- Primary nav = BOTTOM TAB BAR (thumb-reachable), with badges for pending/approvals.
- Follow the current platform guidelines: iOS Human Interface Guidelines (large-title
  headers, sheets, SF-style spacing) and Android Material 3 (FAB, top app bar,
  navigation bar) — that's why both frames are shown.
- Respect SAFE AREAS and edge-to-edge layout: notch / Dynamic Island / status bar /
  home indicator / gesture areas — content never sits under system UI.
- Touch targets ≥44pt; one primary action per screen, placed in the lower/thumb zone;
  FAB for "capture / raise" actions.
- Native gestures: swipe-back, pull-to-refresh, bottom sheets for create/pick, sticky
  bottom action bars on detail/runner screens, keyboard-avoidance + input accessory bar.
- Design EMPTY, LOADING (skeletons), ERROR, and OFFLINE states for every screen.
- Note haptics + micro-interactions (submit, pass/fail toggle, sync success).

## 2. Tablet & adaptive layout (must support tablets, not just phones)
The same app must scale to iPad / Android tablets and landscape — do not letterbox a
phone UI.
- Breakpoint-driven: PHONE = single column + bottom tabs; TABLET = two-pane
  MASTER–DETAIL (persistent list on the left, detail on the right) and the bottom tab
  bar may become a side rail. Support portrait AND landscape, and iPad Split View /
  multitasking (react to reduced width).
- Apply master-detail to the highest-value flows and show them in a tablet frame:
  Inspections list + runner, My Tasks + item, Approvals inbox + item, Dashboard as a
  multi-column KPI board.
- Larger content max-widths and multi-column grids on tablet; never a single stretched
  column. Signature + photo annotation should take advantage of the larger canvas
  (and stylus) — note this.

## 3. Roles & RBAC (curate every surface by role)
The web app is capability-gated (roles: admin, manager, auditor, inspector, viewer;
external "partner"/supplier is WEB-ONLY and NOT a user of this app). Mirror that here.
- The mobile UI CURATES by role, but this is presentation only — the server enforces
  the real capability on every request; never rely on hiding for security, and there
  is no client-side role switcher (role comes from the authenticated session).
- Match the web capability model (verb:module), e.g. `inspection:perform`, `ncr:create`,
  `ncr:verify`, `document:approve`, `capa:manage`, `auditlog:read`.
- LABEL each screen in the gallery with the role(s) that see it, and show at least one
  example of a role-reduced view. When a role lacks a capability, the action is ABSENT
  (not a disabled teaser), exactly like the web nav.
- Role → surface map to design:
  - **Inspector:** Dashboard (my queue), My Tasks, Inspections (perform), Quick-Log,
    Camera/Voice capture, NCR create + detail, Notifications, Settings.
  - **Viewer:** read-only Dashboard + records they may see, Notifications, Settings —
    no perform/create/approve.
  - **Auditor:** Inspections (view), NCR view + **verify**, 8D follow-up, read-oriented
    dashboard, Notifications, Settings.
  - **Manager:** all Inspector surfaces PLUS Approvals inbox, Assign/reassign, Team &
    plant snapshot, 8D follow-up, CAPA action management.
  - **Admin:** everything above PLUS Workspace pulse + read-only audit-log highlights,
    and a clear "Open in web app" path for config-heavy areas (see §5a).

## 4. Offline-first is the signature UX (factory-floor app)
- Persistent SYNC PILL in the header on every screen: `Synced · 12:04` / `3 pending` /
  `2 failed` / `Offline`; tap → sync queue.
- Offline completion shows "Saved on device — will sync" in GREEN, never red.
- Dedicated Sync screen: per-item queue (pending / in-flight / failed), storage gauge,
  and a clear conflict "needs review" card ("This NCR was closed by Anna while you were
  offline") with a one-tap resolve. Never block fieldwork on connectivity.

## 5. Auth, onboarding & core features (role-aware — design "necessary + allowed" only)
Auth/onboarding:
- Welcome → Workspace (tenant slug + recent-workspace chips) → Sign in (email +
  password) → MFA challenge (6-digit boxes + "use a recovery code", matching the web
  MFA visual language).
- New user via invite link: set name + password (same strength/requirements UI as web),
  then PERMISSION PRIMING (why, before the OS prompt) for Camera, Location, Notifications.
- Offer BIOMETRIC unlock after first sign-in (tokens stored securely); later launches use
  biometric, not password. Workspace SWITCHER for multi-tenant users. Sign-out /
  tenant-switch warns on unsynced items.

Features (inspector-first, then oversight):
- **Dashboard/Home** — role-aware KPI header + Today's work queue.
- **Inspections** — list → section-by-section runner (pass/fail/score/photo/note,
  inline NCR flag) → submit; autosave-on-change, resume mid-inspection.
- **Camera + AI defect / Voice-to-NCR / Quick-Log** — refine existing designs.
- **NCR** — guided create (AI pre-fill, severity, containment) + read-mostly detail with
  an "escalate to 8D" banner.
- **My Tasks** — unified inbox of everything assigned to me across modules.
- **8D follow-up** (mobile subset, NOT full authoring) — view D1–D8 progress, advance/
  complete the steps I own, attach evidence, comment.
- **CAPA action check-off** — complete my assigned action + evidence.
- **Approvals inbox** (manager/admin) — approve/reject document approvals & NCR
  dispositions with a reason field; make this excellent.
- **Assign/reassign**, **Team & plant snapshot** (manager/admin).
- **Notifications** — assignment / due-soon / sync-failed, deep-linking to the record.

### 5a. Admin on mobile — show / don't show
An admin here is a supervisor in the field, not doing config. Give them the above PLUS a
**Workspace pulse** card (active people today, sign-in anomalies, failed syncs, items
awaiting approval) and a **read-only audit-log highlights** view (recent SENSITIVE
events only). Do NOT design on mobile: report builder, integrations/connectors, bulk
import, billing, member/role management, white-label, session-policy config, deep SPC
authoring — represent these as a tidy "Manage in web app" list, not native screens.

## 6. Settings (mobile-appropriate only)
Profile · Notification prefs · Security (MFA manage, biometric toggle, active sessions /
sign-out other devices, change password) · Offline & storage (cache size, gauge, clear
synced cache) · Appearance (light/dark/system) · Workspace switcher · About/version ·
Sign out (unsynced-items guard).

## 7. Quality bar — accessibility & modern UX
- Calm, polished, native-feeling; generous spacing; readable at arm's length on a floor
  (high contrast, big status colors, minimal chrome); consistent iconography and the same
  status vocabulary as web.
- Accessibility to current standards: support Dynamic Type / font scaling, reduced-motion,
  high-contrast, and screen-reader labels (VoiceOver / TalkBack); meet WCAG AA contrast.
- Show flows END-TO-END (offline inspection → capture → submit → "saved on device" →
  later "synced"), not isolated screens.

Deliver `mobile/Mobile App.html` (browsable gallery; iOS + Android + tablet frames;
light + dark; screens labeled by role) and `mobile/src/*.jsx` screen files, all using
tokens.css.
