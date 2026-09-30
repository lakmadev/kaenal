# DESIGN-07C — Staff console (web, `apps/staff` + tenant support-view mode)

Author: UI Lead Designer. Date: 2026-09-30. Sprint: `docs/sprints/SPRINT-07C-staff-console.md` §2
(C1-C11, CX), §5 (Design needs, D-C1 through D-C12). Ceremony 2 (Design audit) of `SCRUM.md`.

**Continuation note.** A prior session drew the first 6 boards (D-C1 staff sign-in, D-C2 account setup,
D-C3 console shell, D-C4 access dialog, D-C5 directory/detail, D-C6 plan editing) before hitting a rate
limit; no design doc was written. This pass **reviewed those 6 for quality and consistency, found one real
gap (below), fixed it in place, and drew D-C7 through D-C12** to complete the sprint's full design-needs
list. No board was redrawn from scratch.

Canvas (12 boards: D-C1 through D-C12): **https://claude.ai/artifact/Fy6sT5XMHotAy34iW6nn4Z**

---

## 0. Quality review of the 6 carried-over boards, and the one gap found

D-C1 (sign-in), D-C2 (account setup), D-C3 (console shell), D-C5 (directory/detail) and D-C6 (plan editing)
were read in full and found consistent and complete against their stories: correct generic-failure /
lockout / rate-limit copy (C2's exact security requirements), the mandatory-TOTP setup flow with
one-time-shown recovery codes (C1), the deliberately distinct dark/amber staff chrome with the global grant
banner (C3, D3 in §3 below), the effective-modules table with `core`/`framework`/`pack`/`trial` reason
chips mirroring the tenant's own `/v1/entitlements` shape (C4), and the change-reason confirm + trial-reset
flow (C5/C6, PO-SC6).

**Gap found and fixed:** D-C4 (access-reason dialog) drew the Amendment 2 scope choice (Commercial /
Workspace content) and its plain-language warning step, but **did not draw the Amendment 3 (SR2) step-up
re-authentication** that the sprint explicitly requires before a `content`-scope grant is created — the
security-reviewer's pre-build finding that the highest-privilege action in the console was gated only by an
hours-old session. This is named in the sprint file itself as part of D-C4's own scope ("the access-reason
dialog (incl. the step-up prompt for the content scope)", §5). This was a real, verifiable gap, not a
judgment call, so it was fixed in place on the existing board (touch-up, matching the DESIGN-06 precedent
of editing an existing board rather than redrawing it): a new **State B** (password-or-TOTP re-entry,
5-minute single-use token, same lockout counter as sign-in) was inserted between the scope-choice step and
the content-scope warning step, and the rate-limit (SR3, 5 grants/rolling-hour) state was added alongside
the existing grant-expired state. States renumbered B→C→D→E accordingly; nothing else on the board changed.

## 1. Audit — jsx precedent

**None exists for any staff screen**, confirmed independently this session (re-grep of every
`project_brain/project/src/*.jsx` and `project_brain/mobile/src/m-*.jsx` for
`staff|operator|backoffice|superadmin|impersonat|support access|kaenal support`: only shop-floor "operator"
strings, e.g. `operations.jsx:586`, `trust-center.jsx:37` — none is a console). Every one of the 12 boards
below is therefore original design work, in the existing `tokens.css` visual system, per the sprint's own
§5 statement. **Divergence count: n/a** — there is nothing to diverge from; `apps/staff` does not exist yet
(confirmed: no `apps/staff` directory on disk).

## 2. Design language: deliberately distinct from the tenant product

Per the sprint's own requirement (07C is "unmistakably separate," §1) and this task's instruction, the
console uses `tokens.css` as its base system (same Archivo/JetBrains Mono, same radii, same `.k-*`
component shapes — `k-surface`, `k-btn`, `k-chip`, `k-input`, `k-table`, `k-tabs` all render identically)
but wraps them in a **distinct chrome**: a dark ink ground (`--staff-bg #0b0c10`, `--staff-fg #e4e4e7`) with
an amber accent (`--staff-accent #f0b429`) for the sign-in screen, account setup and the console shell's
sidebar/header, versus the tenant app's light ink-on-white ground. These three tokens are additive to
`tokens.css`, layered on top of it (never replacing a tenant-facing value), scoped to `apps/staff`'s own
chrome only — table rows, dialogs and form controls inside the console body stay on the standard light
`k-surface` so dense data (the tenant directory, the catalog editor) reads exactly like every other Kaenal
data table, and the distinctness lives in the frame around it (sidebar, top bar, sign-in/setup pages), not
in a second component language. This is the "AWS/GCP console vs. product console" pattern named in the
task: unmistakable at a glance, never a second design system to maintain. D-C12 is the one deliberate
**exception** by design: it renders entirely in the tenant app's own light visual language, because that
page is physically inside `apps/web` and must never look like a staff tool has replaced the tenant's
product — the distinctness there is the persistent red banner, not the chrome.

## 3. The twelve boards

| ID | Board | What it covers | Security-UX precedent it follows |
|---|---|---|---|
| D-C1 | Staff sign-in | Email+password → TOTP/recovery-code step, generic failure, lockout, rate-limit, session-expired (target URL preserved), sign-out confirmation, env badge | Standing credential-failure convention (generic message, no account-state leak) |
| D-C2 | Account setup (one-time link) | Password policy hints, TOTP enrol (QR + manual key), recovery codes (grid, download, confirm checkbox), expired-link state | Mirrors the tenant app's own MFA-enrolment shape, re-themed to staff chrome |
| D-C3 | Console shell | Left nav (Tenants, Sales inbox + count, Workspace requests + count, Catalog, Price book, Audit log, Staff — last two admin-only), header (name/role, env badge, account menu), the **global active-grant banner** | AWS/GCP console shell shape: persistent nav + always-visible session/role context |
| D-C4 | Access-reason dialog, grant banner, expiry | Scope choice (Commercial / Workspace content), **step-up re-auth for content scope (touch-up, §0)**, content-scope warning step, persistent banner with both scopes held, grant-expired, **rate-limited (touch-up, §0)** | AWS cross-account role assumption / GCP "impersonate user": explicit consent step + unmissable persistent banner with live countdown |
| D-C5 | Tenant directory & detail | Search/filter/paginated table; detail header + Plan/Requests/Profile(+declaration history)/History tabs; no-grant/empty/loading/error states | Standard admin-console list→detail pattern; declaration history for D2 "abuse visibility" |
| D-C6 | Plan editing | Pack toggles, bundle apply (incl. Enterprise), self-service switch, contract/CSM form, change-reason confirm with diff, trial-used→Reset-trial (PO-SC6), 409/running-trial/read-only states | Diff-before-write confirm, same convention as the tenant's own downgrade confirm (D-S8) |
| D-C7 | Sales inbox & workspace requests | Filtered inbox list, resolve dialog (Fulfil/Decline + reason), withdrawn-meanwhile (409), workspace-request triage (Decline/Spam, provisioning-command row), empty/error | Reuses D-C5's table chrome and D-C6's confirm-dialog shape — no new dialog shape |
| D-C8 | Catalog editor | Packs (edit form + module-map editor), Frameworks & rules (per-framework module-rule grid: level/clause/note), Industries (suggested frameworks + priors), **impact-preview confirm** (gained/lost tenants, no cross-tenant record counts, typed-count confirm for lossy changes), floor-guaranteed 422 / 409 / retire-keeps-inclusions states | RC5: blast-radius preview before a global change, modeled on feature-flag/IAM consoles; typed-count confirm for an irreversible multi-tenant change |
| D-C9 | Price book | Versions list (published/draft/archived), draft item editor, estimate preview (sample profile / real tenant composition), publish confirm with diff, discard/422/409 states | RC4: prices as immutable, versioned rows (Stripe Price precedent) — never edited in place |
| D-C10 | Platform audit log & accountability | Filterable log with a **Flagged filter** for `content_grant_anomaly` (AM3 SR3/SR4), row detail (before/after), export-over-cap message, My sessions, My active grants, My activity (own rows, Export CSV) | Immutable append-only audit convention; self-service "my activity" export as standard support-ops tooling (PO-SC8) |
| D-C11 | Staff account management | Staff list (role/status/MFA/last sign-in), Invite dialog, Resend setup email, Change role/Deactivate/Reactivate/Reset with reason confirm, last-admin/self-change refusals (disabled-with-explanation, never a silent 422), empty (bootstrap-only) | Standard admin-user-management pattern; disabled-with-explanation over a silent failure (Nielsen error prevention) |
| D-C12 | Tenant app support-view mode | `/support-view` exchange (loading/expired/member-session-present), the **persistent read-only banner** over a real screen with mutating controls simply absent, hidden personal account items, single-attachment-open-and-audited, ended/expired state, the tenant audit-log rows rendering support access | AWS/GCP impersonation banner rigor, but rendered in the **tenant's own** visual language since this page lives inside the customer product, not the console |

## 4. The content-access grant: making the stakes obvious (this sprint's headline UX requirement)

The task named this explicitly, so it is called out on its own. The full flow, across D-C3/D-C4/D-C12:

1. **Before the grant exists:** D-C4 State A separates the two scopes side by side with different weight
   ("Commercial" is a plain option; "Workspace content (read-only)" is labelled with its exposure in the
   same control) and requires a reference (not just a reason) for content — visible friction proportional
   to the privilege.
2. **Step-up re-authentication (D-C4 State B, the fixed gap, §0):** content-scope creation cannot proceed
   on session trust alone; the same password/TOTP the person signed in with must be re-entered, single-use,
   5-minute window, counted against the same lockout as sign-in — mirroring 07-SECURITY-COMPLIANCE.md's
   e-signature step-up principle applied to the single highest-privilege console action.
3. **Explicit plain-language consent (D-C4 State C):** names exactly what becomes visible (NCRs, documents,
   suppliers, inspection results, "every other record"), that the tenant admin sees it immediately, that
   every record opened is logged by name, and that it cannot write anything — before the "I understand —
   open access" commit, styled in the warning colour, not the primary accent, so it reads as a decision
   point rather than a routine confirm.
4. **While active, everywhere:** D-C3's global banner (staff side) and D-C12's persistent red banner
   (tenant side, inside `apps/web`) both show tenant name, reason/reference, and a live countdown with an
   "End access" / "End support view" control — visible on every screen either party looks at for the
   duration, exactly the AWS role-assumption / GCP impersonate-user pattern the task asked to apply. Holding
   both scopes at once (D-C4 State D) shows two independent banners, never collapsed into one, since they
   are two independently-scoped, independently-timed grants.
5. **Rate-limited and watched (D-C4 State E, the fixed gap, §0):** a 429 state names the 5-grants-per-hour
   ceiling in plain language and offers the lesser-privileged Commercial scope as an alternative; the
   anomaly signal itself (3+ distinct tenants in a rolling hour) surfaces to an admin via D-C10's Flagged
   filter, not to the staff member opening the grant (they are not told they tripped it — that would defeat
   the control).
6. **Read-only made visually obvious, not just functionally true (D-C12):** rather than rendering every
   normal button in a disabled state (which the sprint's own AC explicitly rejects — "no visual 'disabled'
   noise"), mutating controls are simply **absent**: no New NCR button, no row actions, no account-menu
   personal items. The only affordance retained is opening a record or a single attachment (which is
   genuinely useful for support and is itself audited per-record) — this keeps the read-only surface
   legible as "the real product, minus write" rather than "a crippled product," while never offering a
   control that would 403.

## 5. WCAG 2.1 AA + Nielsen heuristics

- **Contrast:** the staff-only tokens (`--staff-bg`/`--staff-fg`/`--staff-accent`) are checked at
  4.5:1 body text (`#e4e4e7` on `#0b0c10`) and the amber accent on dark ground for large/bold text; the
  env-badge colours (PROD red, staging/dev variants) are legible at their small size. D-C10's Flagged row
  highlight uses the existing `--danger-100`/`--danger-700` pair already AA-audited in prior sprints, not a
  new colour.
- **Focus order:** sign-in → TOTP step (D-C1); directory search → filters → table → detail tabs (D-C5);
  access dialog → scope → step-up → warning → confirm (D-C4) — each step is a natural tab stop, and the
  countdown banners are `aria-live="polite"` (stated on D-C4/D-C12) so they announce without interrupting.
- **Labels:** every icon-only control (grant banner's lock icon, support-view banner's eye icon) needs a
  real `aria-label` — flagged for `react-coder`, same standing note every prior sprint's audit has made for
  icon-only affordances.
- **Touch targets:** desktop-first tool (1280px, usable at 1024px per the sprint's own scope — mobile
  layouts are explicitly not required for this internal tool), all controls reuse `.k-btn`/`.k-btn-sm`.
- **Error prevention:** D-C8's impact preview and typed-count confirm, D-C9's publish-diff confirm, and
  D-C11's last-admin/self-change guards all name the exact consequence and require an explicit, non-trivial
  action before an irreversible or wide-blast-radius write — consistent with the standing destructive-action
  convention and RC5's "preview before a global change" pattern.
- **Visibility of system status:** the grant banner (staff and tenant sides) is the clearest instance of
  this heuristic in the whole sprint — a security-sensitive state that must never be silently forgotten
  about, always on screen with a live countdown.
- **Consistency:** every dense data view (directory, catalog, price book, audit log) uses the same
  `k-table`/`k-tabs`/`k-surface` shapes as the tenant app's own equivalents, so staff reading them and
  engineers building them are working in one familiar component language even while the chrome around it
  signals "this is not the tenant product."

## 6. Component/state inventory (existing patterns only, plus the 3 additive staff tokens)

`k-surface`, `k-chip`, `k-overline`, `k-btn`/`-primary`/`-ghost`/`-sm`, `k-input`, `k-tabs`, `k-table`,
`mono`, `env-badge`, the standing `.state`/`.board` canvas scaffold — reused verbatim from Sprints 01-06's
own canvases. New, additive-only tokens: `--staff-bg`, `--staff-fg`, `--staff-accent`, `--staff-accent-soft`
(chrome-only, never used inside a data table or form control). States covered across the full 12-board
surface: default/populated, loading (skeleton), empty (no tenants match, bootstrap-admin-only staff list),
error/retry (with requestId), permission (role without the capability: read-only, no dead buttons — D-C5's
`support`-role read-only Plan tab, D-C7's `support`-role read-only inbox), expired-grant, 409 (stale write,
withdrawn-meanwhile, concurrent-publish), rate-limited (429), step-up-required, and the grant/support-view
lifecycle states unique to this sprint (open → active countdown → ended/expired → re-open).

## 7. Mobile

No staff console on mobile — confirmed as the sprint's own explicit scope (an internal desktop tool; "no
design"). The mobile app is otherwise unaffected: entitlement changes already arrive through Sprint 07's
realtime/notification paths, and support-access audit events render through the mobile oversight feed's
existing generic row (`apps/mobile/src/app/(app)/audit.tsx:11-22`) with no new mobile screen required. D-C12
is web-only by construction (staff work at a desktop; the sprint states this explicitly).

## 8. Open questions (non-blocking)

- **Q-D1.** D-C4's step-up dialog (the fixed gap) places the password/TOTP fields as two stacked options
  with an "— or —" divider rather than a tabbed choice; this designer's smallest-reasonable reuse of the
  sign-in board's own two-factor shape (D-C1). Flagged in case the PO prefers a tabbed variant.
- **Q-D2.** D-C8's module-map editor is drawn as a flat list with a pack chip per module rather than a
  drag-and-drop grid; a full drag interaction has no precedent anywhere in this codebase's admin surfaces
  (the ECN Kanban's drag is a *tenant*-facing pattern, DESIGN-06 §4.6) and this designer judged a staff tool
  used a handful of times a quarter does not warrant inventing one. Flagged for the PO/architect in case a
  richer interaction is wanted later.

## 9. Sign-off

Every one of the 12 boards named in the sprint file's own §5 design-needs list (D-C1 through D-C12) is
drawn, in the existing `tokens.css` visual language with three additive, chrome-only staff tokens and no
other new colour/radius/font/component style. The one real gap found in the 6 carried-over boards (D-C4's
missing AM3 step-up re-authentication state) was identified and fixed in place, not silently left. The
content-access grant flow — this sprint's headline security-UX requirement — is designed end to end across
D-C3/D-C4/D-C12 with the stakes made explicit before the grant (scope choice, step-up, plain-language
warning) and visible throughout (persistent banners on both the staff and tenant sides, rate-limit and
anomaly handling). WCAG 2.1 AA and Nielsen heuristics are checked (§5). Two non-blocking, already-resolved
judgment calls are named in §8.

Per the user's blanket pre-approval for new visual designs, no separate sign-off pause was needed for these
12 boards.

**Designer sign-off: APPROVED**, unconditionally — every screen and state of every story in this increment
is mapped to an approved board (mobile is out of scope per §7, confirmed not assumed), no new colour/radius/
font/component style is introduced beyond the three additive, chrome-only staff tokens, the console reads as
unmistakably distinct from the tenant product while staying built on the same design system, and the two
flagged items in §8 are non-blocking. The `planner` agent's architecture-review pass and the mandatory
`security-reviewer` pass on this design remain the next steps before implementation, per `SCRUM.md`'s
ordering and this sprint file's own APPROVAL GATE.
