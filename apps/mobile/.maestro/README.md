# Maestro E2E smoke tests

End-to-end smoke flows for the Kaenal mobile app (spec `05-MOBILE-APP.md` §8). These run
against a **built app on a simulator/emulator or a real device** — Maestro drives the actual
UI, so they are not part of `pnpm test` (that's the Vitest logic layer). They gate a release
build in CI, not every commit.

## Prerequisites

- [Maestro](https://maestro.mobile.dev) installed (`curl -fsSL https://get.maestro.mobile.dev | bash`).
- A **development or preview build** installed on the target device:
  ```bash
  eas build --profile development --platform ios   # or android
  ```
  (`appId` in each flow is `com.kaenal.mobile`, matching `app.json`.)
- The API reachable at the build's `EXPO_PUBLIC_API_URL` (see `eas.json`), with a **seeded
  tenant + user** (e.g. the `acme` workspace / `admin@acme.test`).

## Running

```bash
# Sign-in flow — credentials passed as env (never hard-coded):
maestro test .maestro/sign-in.yaml -e WORKSPACE=acme -e EMAIL=admin@acme.test -e PASSWORD=…

# Post-sign-in navigation (reuses the signed-in state):
maestro test .maestro/smoke-nav.yaml

# Whole suite:
maestro test .maestro
```

## Flows

| File             | Covers                                                                    |
| ---------------- | ------------------------------------------------------------------------- |
| `sign-in.yaml`   | welcome → workspace → email/password → authenticated home (M4).           |
| `smoke-nav.yaml` | notification centre + deep-link (M13.1), capture FAB, tab round-trip.     |

## Notes

- Selectors use on-screen **text** where possible and **accessibility labels** (`id:`) for
  icon-only controls (the bell = `Notifications`, the FAB = `Capture`). If a platform renders
  an accessibility id differently, adjust the `id:` selector — the labels are defined on the
  shared `Button`/`BellButton`/`TabBar` primitives.
- Middle tabs are **role-dependent** (Home/Tasks/NCRs vs Records/Alerts vs Review), so the
  flows only assert on the always-present anchors (`Home`, `Me`, `Sign in`).
- **Push-token registration is not asserted** — the shared API contract has no device-token
  endpoint yet (see `features/notifications/push.ts`), so server-originated push can't be
  driven end-to-end. The local sync-failed alert + deep-link-on-tap path is covered by unit +
  navigation tests instead.
