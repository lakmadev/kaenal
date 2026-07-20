# 09 — Integrations (Slack, Microsoft, Google, Email, ERP)

## 1. Integration framework (build this once, every connector uses it)
All connectors sit on one substrate — never bespoke plumbing per service.

```
integrations(id, tenant_id, provider: slack|ms_teams|ms365|google|smtp|sap|generic_webhook,
  status: connected|error|disconnected, config jsonb,          -- non-secret settings (channel ids, mappings)
  credentials_ref text,                                        -- pointer into secret manager, NEVER tokens in DB
  connected_by uuid, connected_at, last_ok_at, last_error text)
integration_events(id, tenant_id, integration_id, direction: out|in, kind, payload_digest,
  status: ok|failed|retrying, attempts, created_at)            -- per-delivery log, powers the Integrations settings UI
```

Rules:
- **OAuth connect flow:** `GET /v1/integrations/:provider/connect` → provider consent (admin-only, state param = signed `{tenantId, userId, nonce}`) → callback validates state, stores tokens in the **secret manager** (KMS-encrypted), writes `integrations` row + audit event. Disconnect revokes the token upstream AND deletes the secret.
- **Token refresh** handled centrally (one `getAccessToken(integrationId)` helper with locking so parallel jobs don't double-refresh); refresh failure → `status='error'` + admin notification, features degrade gracefully.
- **All outbound deliveries go through the `notify`/`integrations` job queues** (06 §1): retries, backoff, dedupe keys, dead-letter. Never call a third-party API inline in a request handler.
- **Per-tenant isolation:** credentials and config are tenant rows under RLS like everything else. A worker resolves the integration inside the tenant-scoped transaction.
- Feature-gate: integrations beyond SMTP require the `platform` entitlement pack (mirrors pricing).

## 2. Slack
- **Connect:** Slack OAuth v2, bot token, scopes: `chat:write`, `chat:write.public`, `commands`, `users:read.email`.
- **Notification routing (core value):** in `notification_prefs` / tenant settings, map event kinds → channels: e.g. `ncr.created(priority=critical)` → `#quality-critical`; `sla.breached` → `#plant-a-quality`. Message = Block Kit card: entity code (monospace), title, priority/risk badges as fields, deep link button "Open in Kaenal". One message per event; **thread follow-ups** (status changes on the same NCR reply in-thread — store `slack_ts` on the entity's integration metadata).
- **User matching:** match Slack users by verified email to Kaenal users for @-mentions on assignment; unmatched → plain text name.
- **Interactivity (Phase 4.5):** message buttons `Acknowledge` / `Assign to me` → Slack interactivity endpoint → verify `X-Slack-Signature` (HMAC, 5-min ts window) → maps Slack user → Kaenal user → normal API mutation (RBAC applies; failure → ephemeral error message). Slash command `/kaenal NCR-2026-0089` → entity summary card.
- Edge cases: channel archived/deleted → mark route broken, notify admin, fall back to email; rate limit (1 msg/sec/channel) → queue paces per channel; workspace uninstalls app → webhook `app_uninstalled` sets status disconnected.

## 3. Microsoft (three distinct integrations — don't conflate)
### 3.1 Entra ID — SSO + SCIM (identity)
Via WorkOS (03 §2): SAML/OIDC sign-in, SCIM provisioning (create/deactivate users, group→role mapping table in settings: "QA-Managers" → `manager`). Edge cases: SCIM deactivation of a user with open items → same reassignment rule as 02 §7; group in two mappings → highest role wins, log warning.

### 3.2 Teams — notifications & cards
- **Connect:** Microsoft 365 OAuth (Graph), admin consent flow; or the lightweight path first: **Incoming Webhook / Workflows URL per channel** (no OAuth, ship in days — start here, config = webhook URL per routing rule).
- Full app (later): Teams bot with Adaptive Cards, same routing model as Slack, action buttons via Bot Framework `invoke` → verified → API mutation.
- Adaptive Card layout mirrors the Slack card (code, title, badges, "Open in Kaenal" openUrl action).
- Edge cases: Teams webhook URLs rotate when moved/renamed → delivery 4xx marks route broken + admin notify; Graph throttling (429 + Retry-After) honored by the queue.

### 3.3 Outlook / Microsoft 365 (Graph, later)
- **Calendar sync:** scheduled inspections/audits → Graph calendar events on the assignee's calendar (subject = `[INS-2026-0342] title`, body deep link). Store `graph_event_id`; update/cancel follows the entity. One-way (Kaenal → calendar) only — two-way sync is a tarpit, don't build it.
- **SharePoint/OneDrive export** (Enterprise ask): scheduled report outputs optionally copied to a configured drive folder via Graph.

## 4. Google Workspace
Same pattern, lower priority: Google SSO (already via WorkOS/OIDC), Google Calendar sync mirroring 3.3, Gmail = just SMTP/provider email. Build only when a customer asks.

## 5. Email (the integration every tenant uses)
- Provider: Resend/SES through the `notify` queue. Templates versioned in code (the 12 email templates module), MJML/react-email, per-tenant branding (logo, accent) from white-label settings.
- Deliverability: dedicated sending domain `mail.kaenal.app` (SPF/DKIM/DMARC); Enterprise custom sending domain = DNS verification flow in settings.
- **Inbound email (complaints intake, Phase 4):** `quality@<slug>.mail.kaenal.app` → inbound parse webhook → creates a Customer Complaint draft with attachments (files pipeline incl. AV scan applies). Edge cases: spam filtering before entity creation; loop protection (ignore auto-replies via `Auto-Submitted` header); sender not a known contact → held in a triage queue, not auto-created.
- Bounce/complaint webhooks mark the user's email `undeliverable` → in-app banner prompting correction; suppression list respected before every send.

## 6. ERP / MES (SAP QM etc. — Enterprise, services-led)
Do NOT build point connectors early. Provide the substrate and treat each as a paid onboarding project:
- **Outbound:** the public webhooks (03 §8) already emit `ncr.created`, `inspection.completed`… — an SAP middleware (customer's iPaaS: Boomi/MuleSoft/SAP CPI) consumes them.
- **Inbound:** public REST API with API keys + a **Bulk Import wizard** (CSV/XLSX: source → field mapping → validate → dry run → commit, per the prototype's operations module) for masters data (suppliers, parts, users) — the mapping stored as a reusable `import_profiles` row for scheduled re-import from SFTP/S3 drop.
- Edge cases: duplicate detection on import (match by supplier code/part number, `merge|skip|create` policy per profile); partial-failure report downloadable; imports are jobs with row-level results, capped 50k rows/run.

## 7. Integrations settings UI (per prototype `dev-platform` / settings → Integrations)
Grid of provider cards: status dot, connected-by/when, last delivery, error banner with last_error, per-integration event log (from `integration_events`) with redelivery, Connect/Disconnect (admin only, audited). Routing rules editor: event kind + filters (priority, plant) → destination (channel/webhook/calendar).

## 8. Cross-cutting edge cases
- Secrets never in `config jsonb`, logs, or exports; disconnect purges them.
- All inbound endpoints (Slack interactivity, Teams invoke, inbound email, provider webhooks) verify signatures + timestamp windows and are rate-limited per source.
- A tenant disconnecting mid-queue: pending deliveries for that integration are cancelled, not errored.
- Sandbox/staging tenants must never deliver to production channels — environment tag on integration rows, staging blocks non-allowlisted destinations.
- Every outbound message contains only what the recipient channel is entitled to see: titles/codes yes, but respect a tenant flag `external_message_detail: full|minimal` for channels that may include non-Kaenal users.
