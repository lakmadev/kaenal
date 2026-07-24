# @kaenal/web

The Kaenal web admin surface — Next.js (App Router) over the contract-first API.
Spec: `project_brain/project/implementation/04-WEB-APP.md`. Visual spec:
`project_brain/project/Kaenal.html` + `project_brain/project/src/*.jsx` +
`project_brain/project/styles/tokens.css`.

> **Read before contributing:** [`docs/rules.md`](docs/rules.md) (non-negotiables)
> and [`docs/best-practices.md`](docs/best-practices.md) (how and why).

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router, RSC), React 19, TypeScript strict |
| Styling | Tailwind CSS v4 on the design tokens (`src/styles`) |
| Server state | TanStack Query v5 (via `@kaenal/api-client` query factories) |
| Client state | Zustand (UI chrome only) |
| Forms | React Hook Form + Zod (schemas shared from `@kaenal/types`) |
| Icons | `lucide-react` |
| Class utility | `clsx` + `tailwind-merge` (`cn`) |

Every dependency is a market-standard, widely-adopted library — no bespoke or
fringe packages.

## Run it

```bash
corepack pnpm install
docker compose up -d                 # Postgres/Redis/MinIO for the API
pnpm --filter @kaenal/api dev        # API on :3001
pnpm --filter @kaenal/web dev        # web on :3000  →  http://localhost:3000
```

The browser talks to the API through a **same-origin proxy** (`/api/*` → the API,
see `next.config.mjs`), so the httpOnly session cookie + CSRF token need no CORS.
Point the proxy elsewhere with `API_ORIGIN` (default `http://localhost:3001`).

Sign in with a provisioned workspace slug (`pnpm provision-tenant --slug acme …`),
the member's email, and password.

## Scripts

```bash
pnpm --filter @kaenal/web dev         # dev server (:3000)
pnpm --filter @kaenal/web build       # production build
pnpm --filter @kaenal/web typecheck   # tsc --noEmit (strict)
pnpm --filter @kaenal/web test        # vitest
pnpm lint                             # ESLint (root flat config)
```

## Layout

```
src/
├── app/                  # App Router
│   ├── (auth)/           #   unauthenticated: sign-in, reset, invite
│   ├── (app)/            #   authenticated: rendered inside the shell
│   ├── layout.tsx        #   root: fonts, theme init, providers
│   └── not-found.tsx
├── components/
│   ├── ui/               # the design system — the ONE place primitives live
│   ├── shell/            # sidebar, topbar, app shell + session guard
│   └── providers.tsx     # Query + Theme + Toast providers
├── features/             # screen-specific composition (e.g. dashboard/)
├── hooks/                # data hooks over the api-client query factories
├── lib/                  # api client, auth, theme, query client, tenant, cn
├── config/               # navigation/route map
└── styles/               # tokens.css (values) + globals.css (theme + .k-* classes)
```

## Where things live (so a change is one edit)

- **Restyle the product** → `src/styles/tokens.css` (colours/radii/shadows/type).
  Nothing else hard-codes colour.
- **Add/adjust a primitive** → `src/components/ui/*` (exported from `ui/index.ts`).
- **Add a nav item / route label** → `src/config/navigation.ts`.
- **Talk to the API** → a hook in `src/hooks` using `@kaenal/api-client`
  factories; never `fetch` in a component.
