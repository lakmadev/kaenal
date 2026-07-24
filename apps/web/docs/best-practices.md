# Frontend best practices

The _why_ behind the [rules](rules.md). Read this once; it explains the shape of
the app so new screens look like the existing ones.

## 1. Styling is centralised — change it in one place

The design is a **token system**, not per-component CSS.

- `src/styles/tokens.css` holds every design decision as a CSS variable
  (`--surface`, `--text`, `--accent`, `--r-xl`, `--shadow-sm`, `--font-sans`…),
  with a full remap under `[data-theme="dark"]`. It is a verbatim port of the
  visual spec. **To restyle the product, edit this file — nothing else.**
- `src/styles/globals.css` bridges those variables into Tailwind v4 via
  `@theme inline`, so utilities (`bg-surface`, `text-muted`, `border-border`,
  `rounded-lg`, `font-mono`) resolve to the same themed variables. It also
  defines the `.k-*` component classes (`.k-btn`, `.k-input`, `.k-table`, …)
  the visual spec uses.
- Components in `src/components/ui` compose those classes/utilities. They accept
  colour only as tokens, never literals. A KPI card doesn't know it's grey — it
  knows it's `--surface`.

**Result:** a rebrand is a token edit; a new theme is a `[data-theme]` block; no
component changes either way.

### Dark mode

Attribute-driven (`<html data-theme="…">`), persisted per user. A tiny blocking
script in the root layout sets the attribute before first paint (no flash);
`ThemeProvider` keeps React in sync. Accent/density preferences (from
`GET /v1/me`) slot in the same way later.

## 2. Components are unified and layered

- **`components/ui/`** — the design system. Primitives only (Button, Card, Chip,
  Badges, Input, Field, Skeleton, Spinner, EmptyState, Toast), exported from one
  barrel (`ui/index.ts`). This is the single source for "how a button looks".
- **`components/shell/`** — the app frame (sidebar, topbar, shell + session
  guard). Composed once by the `(app)` layout.
- **`features/<module>/`** — screen-specific composition (e.g. `dashboard/`).
  Features compose `ui` primitives and hooks; they do not re-implement
  primitives or hard-code colour.

If two screens need the same widget, it moves down into `ui` (or a shared
`components/`), never copy-pasted.

## 3. Data flow: the typed client, always

The API is contract-first (`packages/types`), and `@kaenal/api-client` exposes:

- **query factories** — `apiQueries.ncrs.list(client, args)` returns
  `{ queryKey, queryFn }`, fed straight to `useQuery`;
- **`unwrap`** — turns a ts-rest discriminated response into value-or-throw for
  `queryFn`/`mutationFn`;
- **stable `queryKeys`** — so invalidation is targeted.

Rules of thumb:

- One API client instance (`lib/api.ts`), `credentials: "include"`, tenant read
  from a cookie getter so it follows a workspace switch. CSRF is automatic.
- Reads live in `src/hooks` (e.g. `useMe`); components call the hook, never
  `fetch`. Mutations use `useMutation({ mutationFn: () => unwrap(client.x(...)) })`.
- 4xx never retries (it's a decision); 5xx/network retries twice
  (`lib/query-client.ts`).

## 4. Server vs client components

Default to **Server Components** (static chrome, layouts, data that can be
fetched on the server). Reach for `"use client"` only for interactivity, hooks,
or browser APIs. Pages that are mostly static export `metadata` and render a
small client view (e.g. `dashboard/page.tsx` → `DashboardView`).

## 5. Forms

React Hook Form + `@hookform/resolvers/zod`, with the **schema imported from
`@kaenal/types`** where one exists (the API validates against the same schema).
Wire controls through the `Field` primitive so label association, `aria-invalid`,
and `aria-describedby` error wiring are automatic. Submit handlers are wrapped
`(e) => void handle(e)` to satisfy `no-misused-promises`.

## 6. The six UI states (04 §6)

Every list/detail handles: **loading** (layout-matched skeletons, never a
full-page spinner), **empty** (icon + one line + primary CTA), **error**
(inline retry, requestId; toast for mutation failures), **stale write** (409 →
reload-and-reapply), **offline** (banner; queue-safe mutations or disable), and
**permission-hidden** (gate on capabilities). The dashboard slice demonstrates
loading/empty/error; new modules follow the same pattern.

## 7. Accessibility

Keyboard-first, visible `--ring` focus, associated labels, focus-trapped dialogs,
text alongside every colour signal. Interactive widgets that need real
accessibility machinery (command palette, menus, dialogs, tooltips) will be built
on **Radix primitives** (the market-standard accessible headless layer) reskinned
with our tokens — the same way shadcn/ui does — rather than hand-rolled.

## 8. Performance

Self-hosted fonts via `next/font` (no layout shift, no third-party request).
Lean client bundles (RSC by default). 10k-row lists use server cursor pagination
+ virtualization (TanStack Virtual) — never unbounded DOM. Images via
`next/image`.

## 9. Deliberate deferrals (tracked, not forgotten)

These are specified (04) but intentionally not in the foundation slice, to keep
it reviewable. Each lands with its module:

- **i18n** (`next-intl`, 04 §8) — strings are currently inline `en`. Wire the
  provider before the copy volume grows.
- **Real-time** (WebSocket invalidation + live mode, 04 §7).
- **Command palette** (⌘K over `/v1/search`, 04 §3) — the search field is a
  placeholder.
- **Radix-based** dialogs/menus/tooltips (§7 above).
- **Sentry/OpenTelemetry** observability — the error boundary has the hook point.

See `/PROGRESS.md` Known issues for the authoritative list.
