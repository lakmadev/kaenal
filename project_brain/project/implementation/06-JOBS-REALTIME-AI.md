# 06 — Background Jobs, Real-time, AI Gateway

## 1. Jobs (BullMQ + Redis) — `apps/api/src/jobs/`
Every job payload includes `tenantId` and opens a tenant-scoped transaction (01 §3.3). Queues:

| Queue | Jobs | Schedule / trigger |
|---|---|---|
| `sla` | `recomputeSlaStates` (per tenant: mark at_risk at 75% elapsed, breached past due; write audit + notify + escalate per `sla_configs.escalate_to_role`) | every 5 min, fan-out per active tenant |
| `notify` | `deliverNotification` (in-app row → email via provider (Resend/SES), push via Expo, SMS via Twilio — per user `notification_prefs`; digest mode batches non-urgent into daily email) | on event |
| `schedule` | `materializeRecurringInspections` (expand `recurrence` rules 14 days ahead; idempotent — skip existing occurrence keys `(seriesId, date)`) | hourly |
| `reports` | `runScheduledReport`, `runExport` (render CSV/XLSX/PDF server-side; PDF via headless Chromium against print routes; upload to S3, presigned link in notification/email) | cron per saved report + on demand |
| `files` | `scanFile` (AV via ClamAV container; infected → status + notify uploader + admin), `cleanupOrphanedUploads` | on upload / nightly |
| `docs` | `documentExpiryCheck` (notify at 90/30/7 days; auto-flag compliance dashboard) | daily |
| `ai` | `generateSummary`, `draftEightD`, `transcribeQuickLog` | on demand |
| `housekeeping` | `purgeSoftDeleted` (>90 days, minus legal holds), `offboardTenant` steps, `auditEventPartitionRoll` | nightly |

Job rules: retries 5× exponential backoff; failed → dead-letter queue + Sentry alert; every job idempotent (re-run must not double-notify — dedupe key in Redis, e.g. `notify:{eventId}:{userId}:{channel}` 48h). Concurrency per queue tuned; `sla` fan-out uses one job per tenant so a huge tenant can't starve others. Repeatable jobs registered once at boot (guard against duplicate schedulers with a Redis lock).

## 2. Real-time (WebSockets)
- Soketi (Pusher protocol) or native ws gateway in NestJS. Channel naming: `private-tenant.{tenantId}` (broadcast entity updates) and `private-user.{userId}` (notifications). Channel auth endpoint verifies membership — a user may ONLY subscribe to their own tenant/user channels.
- Server publishes AFTER commit (transactional outbox table `outbox_events` drained by a worker — never publish inside the transaction, never lose events on crash).
- Payloads are thin: `{kind, id, updatedAt}` — clients refetch via API (keeps RLS authoritative; no data in the socket that bypasses permission checks).
- Presence optional Phase 4 ("Anna is viewing this NCR").

## 3. AI Gateway — one chokepoint for ALL model calls
A single module `apps/api/src/ai/gateway.ts`. NO other code imports the Anthropic/OpenAI SDK. The gateway provides:

```
aiGateway.run({ tenantId, userId, feature: 'eightd_draft'|'root_cause'|'doc_summary'|'compliance_qa'|'quicklog_structuring'|'report_narrative',
                input, entityRefs: [{kind,id}], maxTokens })
```

Responsibilities (these implement the AI Governance module for real):
1. **Entitlement + budget check:** feature requires the `intelligence` pack; per-tenant monthly token budget in `ai_budgets`; over budget → 402-style error surfaced in UI ("AI credits exhausted").
2. **PII redaction (pre-flight):** configurable per tenant — mask emails/phones/names of non-team members before sending to the model; reversible token map applied to the response.
3. **Data controls:** tenant flags: `allow_ai=false` kills all features; `allow_cross_entity_context` gates whether e.g. 8D drafting may read similar past NCRs.
4. **Prompt assembly:** feature-specific system prompts versioned in code; context fetched through the SAME tenant-scoped repositories (RLS applies to AI context too — this is the #1 leak vector).
5. **Audit trail:** every call logged to `ai_invocations(tenant_id, user_id, feature, model, input_tokens, output_tokens, entity_refs, latency_ms, redactions_applied, created_at)` — powers the "AI audit trail" and "Cost & budgets" tabs.
6. **Provenance:** responses that draft fields return `{value, confidence: high|medium|low, sources: [{kind,id,quote}]}` — the UI renders the provenance strip (see `src/eightd-agentic.jsx`). AI NEVER writes to an entity directly; it returns drafts the user explicitly accepts (acceptance = normal mutation + audit event `action='ai_draft_accepted'`).
7. **Model routing:** per-feature model choice (fast/cheap for structuring, strong for 8D drafting), override per tenant plan; provider failover.

AI features by phase: doc summaries + Quick-Log structuring first (bounded, high value), then root-cause suggestions, then full 8D copilot, then compliance Q&A (needs doc retrieval — pgvector embeddings over document chunks, per-tenant, respecting RLS).

## 4. Edge cases
- Model timeout/failure → graceful UI degradation ("AI unavailable"), never block the underlying manual workflow.
- Prompt-injection via document content (a PDF containing "ignore previous instructions") → treat ALL tenant content as untrusted data: delimit clearly, instruct model to treat as data, never allow tool-use/actions from summarization features.
- Streaming responses: SSE endpoint; on disconnect, the invocation still completes + is billed + stored so refresh shows the result.
- Duplicate scheduled-report emails after a worker crash → outbox + dedupe key (see §1 rules).
- Redis outage: API keeps serving (rate limiting fails OPEN for authenticated users, CLOSED for auth endpoints); jobs resume from persisted queues on recovery.
