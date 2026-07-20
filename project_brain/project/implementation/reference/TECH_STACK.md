# KAENAL — Technology Stack & Architecture

> Companion to `FEATURES.md`. This is the recommended modern stack for building Kaenal for real.
>
> **Guiding principles:** TypeScript end-to-end (shared types front-to-back) · the right renderer per surface · one monorepo so the *layers that matter* (schemas, API client, tokens, business logic) are shared — not forced UI reuse.

---

## 1. The Decision

**Primary recommendation: Next.js web app + Expo mobile app, sharing a TypeScript core in a monorepo, over a NestJS/Postgres backend.**

Kaenal's two surfaces have opposite needs:

- The **web/desktop admin surface is huge** (~50 modules of dense tables, settings, report builder, governance). It needs a real DOM, full access to the web ecosystem (tables, drag-drop, charts), and first-class accessibility.
- The **mobile surface is a focused field-inspector app** (5–10 screens) that needs camera, GPS, signatures, and offline sync.

Forcing both through one React Native codebase (RN Web) optimizes the small surface at the expense of the big one. Instead, share the contract and logic layers — Zod schemas, API client + TanStack Query hooks, design tokens, domain logic — and let each surface use its best renderer. Duplicating some pure UI between two React codebases is cheap; fighting RN Web's DOM abstraction across a data-dense enterprise app is not.

---

## 2. Frontend — right renderer per surface, shared core

### 2.1 Web & desktop — Next.js
| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router, TypeScript)** | Real DOM, best ecosystem for data-dense admin UIs, RSC for fast first loads |
| Styling | **Tailwind CSS + shadcn/ui** | Matches the existing token system and prototype components |
| Server state | **TanStack Query** | Caching, optimistic updates; hooks shared with mobile |
| Client state | **Zustand** | Lightweight UI/auth/notification stores |
| Forms | **React Hook Form + Zod** | The dynamic inspection-form engine maps onto Zod schemas |
| Tables | **TanStack Table** | Sorting/filtering/virtualization for NCR, inspection, supplier lists |
| Charts | **Recharts** (or visx for SPC precision) | KPI cards, trends, donuts, control charts |
| Drag & drop | **dnd-kit** | Dashboard widgets, template editor, report builder, kanban |
| Desktop | **Tauri** wrapping the web build | Tiny, secure native shell for Win/macOS/Linux |
| PWA | Installable web app | Covers tablets & kiosk stations on the shop floor |

### 2.2 Mobile — Expo (React Native)
| Concern | Choice | Why |
|---|---|---|
| Framework | **Expo + Expo Router** (TypeScript) | iOS + Android from one codebase; deep links |
| Styling | **NativeWind** | Same Tailwind token vocabulary as web |
| Offline store | **Expo SQLite + Drizzle** (or WatermelonDB) | Offline field inspections with a sync queue — non-negotiable |
| Native modules | Expo **Camera, FileSystem, Location, Notifications** | Covers the mobile inspector module out of the box |
| Build & release | **EAS Build + EAS Update** (OTA) | Ship fixes without app-store review |
| Server/client state | **TanStack Query + Zustand** | Same shared hooks as web |

### 2.3 What is actually shared (the point of the monorepo)
- `types/` — **Zod schemas + domain types** (validate inspection forms on client and server)
- `api-client/` — typed API client + TanStack Query hooks
- `config/` — Tailwind tokens, ESLint, tsconfig
- `core/` — pure business logic (scoring, SLA math, 8D step rules, supplier weighting)
- UI is intentionally **not** shared across web/mobile — each uses idiomatic components on the same tokens.

---

## 3. Backend — TypeScript, regulated-industry ready

| Concern | Choice | Why |
|---|---|---|
| Runtime / framework | **Node.js + NestJS** (or **Hono/Fastify** for a lighter core) | Modular structure suits a 50-module domain; DI + guards for RBAC |
| API contract | **One contract-first API: ts-rest or Hono + zod-openapi** | A single OpenAPI-described surface serves the apps *and* the public Developer Platform — end-to-end types without maintaining tRPC + OpenAPI in parallel |
| Database | **PostgreSQL** | Relational integrity across NCR ↔ 8D ↔ CAPA ↔ Audit; **Row-Level Security** for multi-tenancy |
| ORM | **Drizzle** (or Prisma) | TS-native schema; types flow to the front-end |
| Object storage | **S3 / Cloudflare R2 / MinIO** | Evidence photos, PDFs, signatures |
| Background jobs | **BullMQ + Redis** | SLA escalations, notifications, scheduled reports/exports |
| Real-time | **WebSockets** (Soketi / Pusher-compatible) | Live mode, real-time toast notifications |
| Auth | **WorkOS** (or Auth.js for MVP) | Enterprise SSO/SCIM later without a rebuild |
| Search (later) | **Postgres FTS → Typesense / Meilisearch** | Command palette + global search |
| Graph (later) | **Postgres recursive CTEs → Neo4j** | Powers the Knowledge Graph Explorer at scale |
| AI | **Anthropic / OpenAI SDK** behind a gateway | Root-cause suggestions, summaries, 8D copilot — centralized for the AI Governance module |

### Regulated-industry must-haves (build from day one)
- **Immutable audit trail** on every entity (who/what/when/before→after).
- **RBAC** (admin / manager / auditor / inspector / viewer) enforced in API guards.
- **Multi-tenancy** via Postgres Row-Level Security.
- **File integrity** + access logs on evidence documents.

### Tenancy models — shared by default, dedicated on demand

Two isolation models, one codebase. Isolation lives in the **data layer**, so app code never changes between them.

| | Model A — Shared (default) | Model B — Dedicated (Enterprise add-on) |
|---|---|---|
| Who | All Core/Professional tenants | Vestas/Bosch/Siemens-class customers |
| Isolation | One Postgres, every row has `tenant_id`, **RLS policies** enforce isolation even against app bugs | Dedicated Postgres instance (and optionally region / customer cloud) |
| Cost & ops | Cheap; one migration run covers everyone | Priced as an add-on; provisioning is scripted, migrations fan out per instance |
| Routing | `bosch.kaenal.app` → sets `app.tenant_id` on the connection | `bosch.kaenal.app` → resolves to Bosch's connection string via a tenant registry |

Rules that make this work:
1. **Every tenant-owned table carries `tenant_id`** with an RLS policy — no exceptions, enforced by a schema lint in CI.
2. **App code never writes raw tenant filters**; the DB session sets `app.tenant_id` once per request and RLS does the rest. Code is therefore already "single-tenant-shaped" and runs unchanged against a dedicated instance.
3. **Tenant provisioning is a script, not a project** — creating a tenant (shared) or an instance (dedicated) is one automated command incl. seed data, RLS check, and smoke test.
4. **Data residency** is a tenant-registry attribute (region → connection string), not code.
5. **Exports/backup per tenant** must exist in both models (DSAR, offboarding, legal hold).

---

## 4. The Glue — a monorepo

Use **Turborepo (or Nx) + pnpm workspaces**:

```
kaenal/
├── apps/
│   ├── web/            # Next.js — web admin surface (+ PWA)
│   ├── mobile/         # Expo — field inspector (iOS/Android)
│   ├── desktop/        # Tauri shell wrapping the web build
│   └── api/            # NestJS backend (contract-first OpenAPI)
├── packages/
│   ├── types/          # Zod schemas + shared domain types
│   ├── core/           # Pure business logic (scoring, SLA, 8D rules)
│   ├── db/             # Drizzle schema, migrations, RLS policies
│   ├── api-client/     # Typed client + TanStack Query hooks
│   └── config/         # ESLint, tsconfig, tailwind tokens
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## 5. Cross-cutting tooling

| Concern | Choice |
|---|---|
| Language | **TypeScript** everywhere (strict mode) |
| Validation | **Zod** (shared FE/BE — the inspection form engine + API DTOs) |
| Testing | **Vitest** (unit), **Playwright** (web e2e), **Maestro** (mobile e2e) |
| Linting/format | **ESLint + Prettier** (shared config package) |
| CI/CD | **GitHub Actions** → Vercel/Fly/Render (web+api), EAS (mobile), Tauri release pipeline |
| Observability | **Sentry** (errors, all platforms) + **OpenTelemetry** → Grafana/Datadog |
| Infra | **Docker** + **Postgres/Redis** managed (Neon/Supabase, Upstash) or self-hosted |

---

## 6. Scaling philosophy — don't over-engineer

A QMS is hundreds of tenants doing thousands of transactions a day, not consumer-scale traffic. **One Postgres + one API service carries the first few hundred customers.** The real risks are correctness risks, not throughput:

- **Query discipline under RLS** — every query is tenant-scoped; index accordingly and test policies.
- **Mobile sync conflicts** — design the offline sync queue (last-write-wins vs. field-level merge) early.
- **Audit-trail integrity** — append-only tables, never UPDATE history.

Defer until a customer forces it: microservices, Kafka/event bus, Neo4j, dedicated search cluster, read replicas. Postgres covers FTS, job queues (initially), and graph traversal (recursive CTEs) on day one.

---

## 7. Why this fits Kaenal specifically
- **Web/desktop admin surface is huge** → Next.js gives it a real DOM, native accessibility, and the full web-library ecosystem (tables, dnd, charts) that a QMS UI lives on.
- **Field inspections are mobile + offline** (camera, GPS, photos) → Expo native modules + on-device SQLite sync.
- **Regulated domain** → Postgres relational integrity, RLS multi-tenancy, immutable audit trails.
- **Developer Platform is a headline module** → one contract-first OpenAPI surface serves internal apps and external customers alike.
- **AI is woven throughout** → a single AI gateway feeds the 8D copilot, summaries, and AI Governance controls.
- **Existing React design system** → tokens and component patterns port straight into Next.js + shadcn/ui.

---

## 8. Alternative considered: single RN-Web codebase (previous recommendation)

Expo + React Native Web *can* serve all surfaces from literally one codebase, and remains reasonable if the mobile experience dominates. It was dropped as the primary because RN Web taxes exactly what matters most here: canvas-free DOM output, web accessibility, and third-party web libraries for a 50-module data-dense admin app. (Flutter has the same trade-off, plus a language split from the TS backend.)

---

## 9. Suggested stack summary (TL;DR)

```
Web        Next.js · Tailwind + shadcn/ui · TanStack Query/Table · Zustand ·
           React Hook Form + Zod · Recharts · dnd-kit
Mobile     Expo · Expo Router · NativeWind · Expo SQLite + sync queue
Desktop    Tauri (wraps the web build)
Backend    NestJS · contract-first OpenAPI (ts-rest / zod-openapi) ·
           PostgreSQL (RLS) · Drizzle · Redis + BullMQ · WebSockets · S3/R2 · WorkOS
Shared     TypeScript · Zod schemas · core business logic · Turborepo + pnpm
DevOps     GitHub Actions · Vercel + EAS · Sentry · Docker
```
