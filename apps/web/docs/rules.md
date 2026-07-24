# Frontend rules — non-negotiable

These mirror the repo-wide rules in `/CLAUDE.md` for the web surface. Every PR
must satisfy them; most are enforced by TypeScript strict + the root ESLint flat
config, and the rest by review.

1. **TypeScript strict, no `any`.** Inherited from `@kaenal/config/tsconfig.base`
   (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, …).
   `@typescript-eslint/no-explicit-any` is an error.

2. **No business logic in components.** It lives in `packages/core` or the API
   (repo rule 5). Components render state and dispatch mutations — they do not
   compute scores, SLA states, or transition rules.

3. **All data through the typed client.** Never `fetch` in a component. Reads use
   `@kaenal/api-client` query factories through a hook; mutations use the client
   method composed with `unwrap`. Auth calls (outside the ts-rest contract) go
   through `src/lib/auth.ts`, nowhere else.

4. **All validation via shared Zod schemas** from `@kaenal/types` (repo rule 4).
   A form's schema is the API's schema. Do not re-declare shapes.

5. **The web app may import only `types`, `core`, `api-client`** — never
   `packages/db` (enforced by `eslint-plugin-boundaries`). A UI package that
   could open a DB connection is one import away from bypassing RLS.

6. **Colour comes only from design tokens** (`src/styles/tokens.css` → Tailwind
   theme / `.k-*` classes). No hard-coded hex in components. This keeps the
   product restyleable from one file and keeps light/dark correct for free.

7. **Every list & detail implements all six UI states** (04 §6): loading
   (skeleton, never a full-page spinner), empty, error (+ retry / requestId),
   stale-write (409), offline, and permission-hidden.

8. **Never render a control the user can't use.** Gate actions and nav on
   `me.capabilities` (`GET /v1/me`); a button that would 403 must not appear
   (04 §6.6, repo rule 8 — never reveal what a user may not access).

9. **Accessibility is not optional** (04 §8): every interactive element is
   keyboard-reachable with a visible focus ring; labels are associated with
   controls; dialogs trap focus; colour is never the only signal (badges carry
   text). `eslint-plugin-react-hooks` + `jsx-a11y`-style review apply.

10. **Server Components by default; `"use client"` only when needed** — for
    interactivity, browser APIs, or hooks. Keep the client bundle lean.

11. **Optimistic concurrency + idempotency respected** (repo rule 6): mutations
    send `lockVersion`; a 409 triggers the stale-write reconcile flow, not a
    silent overwrite.

## Lint / typecheck / build gates

```bash
pnpm lint                             # ESLint flat config (root)
pnpm --filter @kaenal/web typecheck   # strict tsc
pnpm --filter @kaenal/web build       # must compile + pass Next's lint
pnpm --filter @kaenal/web test        # vitest
```

A change that fails any of these is not done.
