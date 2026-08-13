# KAENAL — Prototype Functional Implementation Progress

Tracks the phased work to make the previously-presentational admin/platform screens
genuinely functional in the **front-end prototype** (`Kaenal.html`). No backend wiring.

This file is the source of truth for what changed and where, so Claude Code can pick
up any phase and know exactly which files were touched. **Do not hallucinate** — only
files actually edited are listed, with the specific change.

---

## Pre-phase (already done before phasing)

**Goal:** make dead toggles/segmented controls respond; wire the highest-value list filters.

| File | Change |
|---|---|
| `src/primitives.jsx` | `Segmented` made self-stateful when uncontrolled (seeds from `value`, tracks internal selection, still forwards `onChange`). |
| `src/settings.jsx` | `Toggle` made self-stateful when uncontrolled; `Members` search + status filter wired to filter the `members` array. |
| `src/qms-modules.jsx` | `TrainingMatrix` search + All/Mandatory/Gaps filter wired; `CalibrationManagement` search + All/Due/Overdue filter wired. |
| `src/ai-governance.jsx` | `AIAuditTrail` search + model filter wired over the `events` array; empty-state + safe selection clamp. |
| `src/dev-platform.jsx` | `ApiReference` endpoint search wired; `RateLimits` debug console search + 4xx/5xx/slow filter wired. |

Result: all toggles/segmented controls across Identity, Multi-tenancy, Compliance,
Operations, AI Governance, Dev Platform, Adoption, and Report builder now hold state.

---

## Phase 1 — Persist admin config forms  (STATUS: ✅ complete)

**Goal:** convert uncontrolled `defaultValue` inputs/selects/textareas in the admin config
screens to controlled state persisted to `localStorage`, so values survive navigation/reload.

**Mechanism:** new `usePersistedForm(storageKey, defaults)` hook in `src/primitives.jsx`
(exported to `window`). Returns `{ state, set, bind }`; `bind(field, default)` supplies
`{value, onChange}` for a control; `set(field, value)` updates one field. Verified: a field
edit saves to localStorage, survives route change, and rehydrates on return.

### Files changed in Phase 1
| File | Change | localStorage key(s) |
|---|---|---|
| `src/primitives.jsx` | Added `usePersistedForm` hook + export. | — |
| `src/identity-advanced.jsx` | `SsoConfig`: SAML metadata/sign-in/sign-out URLs, IdP cert, signature algorithm, OIDC discovery/client-id/secret, attribute-mapping claim inputs, JIT default-role select → persisted. `SessionPolicies`: web idle/absolute timeout + units, remember-device, mobile idle, max-sessions, step-up threshold → persisted; Save button fires confirm toast. | `k_sso`, `k_session` |
| `src/multi-tenancy.jsx` | `WhiteLabelEditor`: folded support email, footer text, sender From-name, From-email into the existing `brand` state and made `brand` persist to localStorage. | `k_brand_cfg` |
| `src/operations.jsx` | `BackupRestore`: retention days + years persisted. `ValidationRules`: IF-value and THEN-message inputs persisted. | `k_ops_cfg`, `k_ops_valrule` |

**Not converted (intentionally, deferred to Phase 2/left as native):** SCIM bearer-token
display field (read-only copy field); step-up "required for" checkboxes (native
`defaultChecked`, interactive); Network policy rule-list rows and Service-account rows
(list editors — Phase 3 scope).

---

## Phase 2 — Config save actions commit + confirm  (STATUS: ✅ complete)

**Goal:** every config-screen Save/commit button that had no handler now fires a
confirmation `kToast(...)`. Combined with Phase 1 persistence, edits both save and confirm.

### Files changed in Phase 2
| File | Buttons wired |
|---|---|
| `src/identity-advanced.jsx` | SSO "Save & enable", SCIM "Save", Network "Save policy", "Add range". |
| `src/multi-tenancy.jsx` | "Publish branding". |
| `src/operations.jsx` | "Save rule". |
| `src/settings-extra.jsx` | Email template "Save", SLA "Save changes", "Add category". |
| `src/settings.jsx` | Profile "Save changes", Sites "Add site", API "Create token". |
| `src/dev-platform.jsx` | Webhooks "Add endpoint". |
| `src/ai-governance.jsx` | Routing "Add rule", PII "Not PII" + "Confirm". |
| `src/compliance-extra.jsx` | DSAR "Generate package" + "Send to legal", BYOK "Add key". |
| `src/pdf-designer.jsx` | "Publish template". |

Note: `SessionPolicies` Save was already wired in Phase 1.

## Phase 3 — Remaining list filters  (STATUS: ✅ complete)

**Goal:** wire remaining dead selectors/search boxes so they filter real rows.

### Files changed in Phase 3
| File | Change |
|---|---|
| `src/qms-risk-spc.jsx` | `FMEAWorkbench`: added `part` field to each `FMEA_ROWS` entry + `FMEA_PARTS` list; part `<select>` now controlled (`part` state) and filters the workbench table; selecting a part resets the active row to that part's first row; header count reflects filtered rows. |
| `src/notifications-center.jsx` | Wired the previously-dead search input to a `query` state filtering title/body/target-id (composes with the All/Unread/Starred + by-type filters); removed the stray duplicate search icon. |
| `src/compliance-extra.jsx` | `LegalHold`: holds extracted to `LEGAL_HOLDS`; added search over id/name/matter/scope + empty state. `DLPPolicies`: policies extracted to `DLP_POLICIES`; added search + Block/Warn/Watermark action segmented filter + empty state. |
| `src/operations.jsx` | `ValidationRules`: NCR rules extracted to `NCR_VAL_RULES`; added rule search + Block/Warn/Escalate action segmented filter + empty state. |

SPC (segmented chart type) and MSA already held state / had no part selector, so no change needed there.

## Phase 4 — Cross-screen data consistency  (STATUS: ✅ complete)

**Goal:** persisted config changes reflect on the screens that reference them.

### Files changed in Phase 4
| File | Change |
|---|---|
| `src/settings.jsx` | `Security` (Security & devices page) now reads the persisted `k_session` policy (`readSessionCfg`) and renders a read-only "Session policy" summary card (idle/absolute/mobile timeout, max concurrent, remember-device, step-up); the "Active sessions" desc reflects the max-concurrent limit. Editing Session policies (admin) now shows through on the personal security page. |
| `src/multi-tenancy.jsx` | `CostCenters`: chargeback table extracted to `CC_ROWS` and made a live computation driven by the three allocation-rule Segmented controls (seat: user-CC / pro-rated by usage / corporate; AI: caller / record-owner / 50-50 split; storage: record-owner / corporate). Totals + grand total recompute; corporate-shared line appears for `corp` modes; total is conserved. Export/Send/Finalize buttons wired to toasts. `WhiteLabelEditor`: brand defaults extracted to `BRAND_DEFAULTS` + `readBrandCfg()` (exported to window); "Reset to default" and "Preview as user" buttons wired; login-preview footer reads `brand.footer`. |
| `src/shell.jsx` | `TopBar` profile menu now reads `window.readBrandCfg()` — the "Tenant" quick-fact and workspace-switcher names reflect the persisted white-label display name. |

## Phase 5 — Empty/edge/loading states  (STATUS: ✅ complete)

**Goal:** empty states on filtered lists, form-validation feedback, and confirm
dialogs on destructive actions.

**Mechanism:** new `window.kConfirm({title, body, confirmLabel, cancelLabel, danger})`
imperative primitive in `src/primitives.jsx` — returns a Promise<boolean>, renders a
modal overlay (Esc = cancel, Enter/click = confirm, backdrop click = cancel), with its
own keyframes injected once.

### Files changed in Phase 5
| File | Change |
|---|---|
| `src/primitives.jsx` | Added `kConfirm` promise-based confirm modal + one-time `k-confirm-anim` keyframes. |
| `src/compliance-extra.jsx` | `LegalHold` "Release" now guards behind `kConfirm` (danger) before confirming; "View custodians" / "Export" row buttons wired to toasts. |
| `src/multi-tenancy.jsx` | `OrgHierarchy` "Detach" child-workspace now guards behind `kConfirm` (danger). |
| `src/notifications-center.jsx` | Bulk delete now confirms via `kConfirm` before removing. |
| `src/operations.jsx` | `ValidationRules` rule builder validates IF-value + THEN-message on Save — inline error message + red input borders when empty; only toasts success when valid. |

Empty states for the newly-filtered lists (DLP, Legal hold, Validation rules,
Notifications, FMEA) were added in Phase 3; the notifications center already had one.

---

## Phasing complete
All five phases (Pre-phase + Phase 1–5) are done. The prototype's admin/platform screens
now persist config, confirm saves, filter real rows, reflect config cross-screen, and
guard destructive actions.

---

## Rewrite log
_(If a later phase rewrites a file already listed in an earlier phase, it is noted here
with the reason.)_

- _none yet_
