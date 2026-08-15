# @kaenal/mobile

The Kaenal field app (Expo + React Native) — inspector-first, **offline-first**, role-aware, and
tablet-adaptive. Part of the Kaenal Turborepo; shares the API contract with web/API via
`@kaenal/api-client` + `@kaenal/types` (one ts-rest/Zod source of truth, no drift).

> Design source (pixel-for-pixel, rule #9): `project_brain/mobile/`. Canonical spec:
> `project_brain/project/implementation/05-MOBILE-APP.md`. Build tracker: `progress_mobile.md` (repo root).

## Stack

- **Expo SDK 57** (RN 0.86, React 19), **Expo Router** (file-based nav).
- **Theme-object UI kit** (`src/theme` + `src/ui`) — a `ThemeProvider`/`useTheme()` over a light/dark
  palette derived from `styles/tokens.css`. Swap the palette → the whole tree recolors. This is the
  themeable common library the app is built on (not NativeWind — see `progress_mobile.md` decision #3).
- **TanStack Query** (server cache, persisted to SQLite) + **Zustand** (session/appearance/sync state).
- **Offline:** Expo SQLite + Drizzle local DB; delta-pull read path + `mutation_queue` push with
  idempotency keys and explicit conflict resolution (spec §2.3).
- **Ports/adapters** (`src/services`): every device capability (SecureStore, SQLite, Files, Camera,
  Location, Notifications, Biometric) sits behind an interface with an Expo adapter — swap a service
  by swapping one adapter. Features depend on the port, never the SDK.

## Run

```bash
# Web preview (fastest inner loop; runs in the Browser pane)
pnpm --filter @kaenal/mobile web        # → http://localhost:8082

# Native
pnpm --filter @kaenal/mobile ios        # iOS Simulator
pnpm --filter @kaenal/mobile android    # Android emulator

pnpm --filter @kaenal/mobile typecheck  # tsc --noEmit (part of `pnpm typecheck`)
pnpm --filter @kaenal/mobile lint        # expo lint (RN app is excluded from root eslint)
```

## Layout

```
src/
  app/          Expo Router routes (auth stack + role-aware tabs)
  theme/        tokens (light/dark) + ThemeProvider + useTheme
  ui/           the component common library (Screen, Header, TabBar, Card, buttons, pills, …)
  services/     ports + Expo adapters (secure store, db, files, camera, location, notifications, biometric)
  features/     one folder per module (inspections, ncr, capture, tasks, oversight, settings)
  offline/      SQLite schema (Drizzle), sync engine (pull/push), mutation queue, conflict resolution
  stores/       Zustand stores (session, appearance, sync-status)
```

Metro is configured for the monorepo in `metro.config.js` (watches the repo root, resolves the shared
TS workspace packages, and maps their ESM `.js` import specifiers back to `.ts` sources).
