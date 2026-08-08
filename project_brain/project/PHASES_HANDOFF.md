# KAENAL — Prototype Functional Phases → Handoff

Context for Claude Code. This covers **only** the 5-phase work that made the existing
KAENAL prototype (`Kaenal.html` + `src/*.jsx`) functional. The rest of the codebase you
already built. Full per-file log lives in `IMPLEMENTATION_PROGRESS.md` — read that for
exact diffs; this is the port checklist.

The prototype loads modular JSX from `src/` as separate Babel script scopes; shared
components/helpers are exposed via `Object.assign(window, {...})`.

---

## 1. New shared primitive

`src/primitives.jsx` adds:

```js
window.kConfirm({ title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false })
// → Promise<boolean>
```

A destructive-action confirm modal: Esc / backdrop click = cancel, Enter or confirm
button = confirm; injects its own keyframes once (`#k-confirm-anim`). Pairs with the
existing `window.kToast(msg)` feedback helper.

**Port:** replace with your real dialog/toast components; keep the same call sites.

---

## 2. Persisted config (localStorage → real state/backend)

| Key | What | Owner screen |
|---|---|---|
| `k_session` | Session policy: web idle/absolute timeout, mobile idle, max concurrent sessions, remember-device, step-up re-auth window | Session policies (`identity-advanced.jsx`) |
| `k_brand_cfg` | White-label branding: name, short, primary/bg color, domain, login copy, font, support email, footer, from-name/email. Defaults in `BRAND_DEFAULTS` | `WhiteLabelEditor` (`multi-tenancy.jsx`) |
| `k_ops_valrule` | NCR validation-rule builder draft (ifValue, thenMsg) | `ValidationRules` (`operations.jsx`) |

These are prototype persistence stand-ins — wire to your real settings API/state store.

---

## 3. Cross-screen consistency wired

- **Session policy → personal security.** `Security` (Security & devices page in
  `settings.jsx`) reads `k_session` via `readSessionCfg()` and renders it read-only;
  active-sessions caption reflects the max-concurrent limit.
- **Branding → shell.** `readBrandCfg()` is exported from `multi-tenancy.jsx`; `TopBar`
  in `shell.jsx` uses it for the tenant quick-fact label and workspace-switcher names.
- **Cost-center chargeback.** `CostCenters` (`multi-tenancy.jsx`) recomputes the monthly
  chargeback table live from three allocation-rule controls — seat (user-CC / pro-rated
  by usage / corporate), AI (caller / record-owner / 50-50 split), storage (record-owner
  / corporate). Corporate-shared line appears for `corp` modes; **grand total is
  conserved** — reallocation only changes the split. This is the allocation algorithm to
  reproduce server-side.

---

## 4. Filters made real (were dead selectors/search)

Each now filters real rows and has an empty state:

- FMEA part selector drives the workbench table (`qms-risk-spc.jsx`)
- Notifications center search over title/body/target-id (`notifications-center.jsx`)
- DLP policies: search + Block/Warn/Watermark action filter (`compliance-extra.jsx`)
- Legal hold: search over id/name/matter/scope (`compliance-extra.jsx`)
- NCR validation rules: search + Block/Warn/Escalate action filter (`operations.jsx`)

---

## 5. Destructive actions now confirm (via `kConfirm`)

- Legal hold **Release** (`compliance-extra.jsx`)
- Child workspace **Detach** (`multi-tenancy.jsx`)
- Notifications **bulk delete** (`notifications-center.jsx`)

---

## 6. Form validation

`ValidationRules` builder (`operations.jsx`) validates IF-value + THEN-message before
save — inline error message + red input borders when empty; success toast only when valid.

---

### Port priorities
1. Real dialog/toast to replace `kConfirm`/`kToast` (touches every confirm + save).
2. Persist the three config objects to real APIs.
3. Server-side cost-center allocation (the conserved-total algorithm in §3).

---

## Claude Code build note (not from Claude Design)

In the real app **none of these screens exist yet** — they are placeholders
(`apps/web/src/config/planned-modules.ts` + `settings-nav.ts` `built:false`), with **no
backend**. So each item above is a **net-new vertical slice** (migration + RLS + ts-rest
contract + service + tests + audit events + UI), not a port. Build one slice at a time,
backend-first, per CLAUDE.md rules 5 & 7. The `localStorage` stand-ins are the *design of
behaviour*, not something to copy into the production app.
