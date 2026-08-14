# MFA UI — Claude Design → implementation handoff

Give this file back to me (Claude Code) together with the Claude Design output (the
`*.jsx` for the MFA screens). It pins the **already-shipped backend contract** to
the designed screens so I can wire them up without re-deriving anything.

The MFA **backend is done and merged-ready** (PR #7): TOTP enroll/activate/verify/
disable, AES-256-GCM secret at rest, single-use recovery codes, and a two-step
sign-in. What's missing is only the **designed UI** — enrollment + challenge +
the settings panel. A functional-but-unstyled sign-in code step exists today and
should be **replaced** by the designed version.

---

## Design-fidelity rule (non-negotiable — CLAUDE.md rule #9)

The Claude Design `*.jsx` is a **pixel-for-pixel binding design**. Reproduce every
screen, panel, and state it contains — not a subset — using the real design system
(`styles/tokens.css`: ink accent, Archivo/Inter/mono), matching the existing
`auth.jsx` and `settings.jsx`. Verify in-browser side-by-side. Do not simplify or
drop a designed element without surfacing it first.

## Where it goes

- **Sign-in challenge step:** `apps/web/src/app/(auth)/sign-in/sign-in-form.tsx`
  (the `login` stage already has a temporary code field — replace it).
- **Settings › Security › Two-factor:** a new section under the Settings shell
  (`apps/web/src/app/(app)/settings/...`), matching how other settings sections
  render. Add it to the settings nav config.
- **Web API client:** add typed wrappers in `apps/web/src/lib/auth.ts` (these auth
  calls live OUTSIDE ts-rest, like `signIn`/`forgotPassword`).

## Business logic lives in the API, never the UI (rule #5)

The screens only render state and POST codes. No secret handling, no verification
logic, no code generation in the client.

---

## The backend contract (already built — wire the screens to these)

All MFA-management routes are **authenticated** (cookie session + `x-csrf-token`
double-submit, same as every other mutation), capability-free, and reachable by
**every** role including `partner`.

| Method + path | Body | Response | Notes |
|---|---|---|---|
| `POST /v1/auth/sign-in` | `{ email, password, code? }` | `201 { userId, role, expiresAt }` **or** `201 { mfaRequired: true }` **or** `401` | `code` only on the 2nd step. `mfaRequired` = password OK, factor needed (no session set). `401` = bad credentials or bad code. |
| `GET /v1/auth/mfa` | — | `{ enrolled, pending, recoveryCodesRemaining }` | Panel status. |
| `POST /v1/auth/mfa/enroll` | — | `{ otpauthUri, qrDataUri }` | `qrDataUri` is a ready-to-`<img>` PNG data-URI. Refused (409) if already enrolled. |
| `POST /v1/auth/mfa/activate` | `{ code }` | `{ recoveryCodes: string[] }` (10, shown **once**) | Verifies the first code; on success MFA is active. |
| `POST /v1/auth/mfa/disable` | `{ code }` | `{ ok: true }` | Requires a current TOTP or recovery code. |

Web helpers already present: `signIn(...)` and `isMfaRequired(res)` in
`apps/web/src/lib/auth.ts`. Add `mfaStatus()`, `mfaEnroll()`, `mfaActivate(code)`,
`mfaDisable(code)` alongside them.

### Enforcement rules (drive the copy)

- **Enrolled ⇒ enforced:** once a user activates MFA, every future sign-in requires
  a code. There is no "remember this device".
- **Partners are mandatory:** an external `partner` who is not enrolled is blocked
  at sign-in with a clear message. Their settings panel should nudge enrolment.
- A wrong code at sign-in counts toward account lockout (same 10-attempt lock as a
  bad password).

## Backend gaps to flag (I'll add these if the design uses them)

- **Regenerate recovery codes** — no endpoint yet. If the designed panel has a
  "Regenerate recovery codes" action, I'll add
  `POST /v1/auth/mfa/recovery-codes/regenerate { code } → { recoveryCodes }`
  (the service logic already exists; it's a thin controller add).
- **Per-tenant "require MFA for all/admins" policy** — not built; MFA is voluntary
  for internal users today (enforced once enrolled). If the design shows an admin
  toggle to mandate MFA org-wide, that's a small settings + sign-in-gate follow-up.

## Screens/states the design should cover (so I can reproduce all of them)

1. **Sign-in challenge** — code entry after password, with the workspace context,
   a "use a recovery code instead" affordance, invalid-code error, and the
   partner-not-enrolled blocked message.
2. **Settings › Two-factor — not enrolled:** explainer + "Enable" CTA.
3. **Enrollment flow:** QR + manual setup key → confirm-with-code → **recovery
   codes** grid (copy/download/print + "I saved these" gate).
4. **Enrolled/active:** status, "N recovery codes remaining" (low warning), and
   "Turn off" / "Regenerate codes" (each requiring a current code).

## Definition of done (per feature)

Designed screens reproduced pixel-for-pixel + wired to the endpoints above +
web API client wrappers + tests (component/interaction) + browser-verified. No new
business logic in the UI.
