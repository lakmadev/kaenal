# `providers/` — the external-service abstraction layer (Ports & Adapters)

Every third-party / cloud service the app depends on — email, antivirus, object
storage, secret storage, SMS, push — is reached **only** through a *port* defined
in this directory, never by importing a vendor SDK from business code. This is
what lets us move AWS → GCP → Azure (or swap Resend → SES → Postmark) by writing
one new adapter and flipping one env var, with **zero** changes to services,
controllers, or jobs.

The pattern is **Ports & Adapters** (Hexagonal Architecture / the "Plugin"
pattern). Its data-layer cousin is the Repository pattern; this is the same idea
applied to external *services*.

## The four parts of every provider

Each capability is a folder with the same shape:

```
providers/<capability>/
  <capability>.port.ts   # the PORT: an interface in OUR terms (send an email),
                         #   plus its DTOs. No vendor types leak through it.
  <vendor>.adapter.ts    # one ADAPTER per provider (ses.adapter.ts, …). The ONLY
                         #   place a vendor SDK is imported. Implements the port.
  console.adapter.ts     # a safe local/test adapter (logs / no-ops, never calls out)
  factory.ts             # createXPort(env): picks the adapter from `<CAP>_PROVIDER`
  index.ts               # barrel re-export
```

The DI **token** lives in `../tokens.ts` (e.g. `EMAIL_PORT`), and `app.module.ts`
+ `jobs/worker.ts` bind it via the factory:

```ts
{ provide: EMAIL_PORT, useFactory: (env: Env) => createEmailPort(env), inject: [ENV] }
```

## The rules (what keeps the switch cheap)

1. **Business code depends on the port token, never a concrete adapter.** Grep
   test: no file outside `providers/<cap>/` imports a vendor SDK for that
   capability.
2. **The port speaks the domain, not the vendor.** `send(EmailMessage)`, not
   `sendRawEmail(SESv2Command)`. If a vendor concept leaks into the port, the
   next vendor won't fit it.
3. **Adapters are config-selected, never code-selected.** One `<CAP>_PROVIDER`
   env var per capability. Adding a provider = new adapter + one `case` in the
   factory. No `if (provider === …)` anywhere else.
4. **A console/stub adapter always exists** so dev, tests, and a provider-less
   deploy all run end-to-end without credentials. It is the default.
5. **Vendor SDKs stay in `apps/api`** (this app), never in `packages/core|types`,
   which `web`/`mobile` share — that dependency-direction rule is enforced by
   `pnpm lint`.

## Status (migration is incremental — the seams already exist)

| Capability | Port | Adapters | Notes |
|---|---|---|---|
| Email | `EmailPort` | `ses`, `console` | ✅ this layer |
| Antivirus | `Scanner` (`jobs/ports.ts`) | `clamav`, `stub` | migrating into `providers/av/` |
| Object storage | `Storage` (`files/storage.ts`) | `S3Storage` | S3/MinIO/R2 today; GCS/Azure = one adapter |
| Secrets | `SecretResolver` (`tenant/`) | `EnvSecretResolver` | env today; AWS/GCP Secret Mgr = one adapter |
| SMS / Push | — | — | ports added when those channels ship |

Auth is abstracted the same way via the `Authenticator` port — if we ever offload
identity to Cognito/Auth0, that is the single seam.
