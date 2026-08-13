"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Database,
  Link2,
  Link2Off,
  Loader2,
  Lock,
  Plug,
  Search,
  Trash2,
} from "lucide-react";
import {
  CONNECTOR_META,
  type ConnectorCategory,
  type ConnectorMeta,
} from "@kaenal/core";
import { INTEGRATION_PROVIDERS, type IntegrationDto, type IntegrationProvider } from "@kaenal/types";
import { ApiRequestError } from "@kaenal/api-client";
import { useCan } from "@/hooks/use-me";
import {
  useConnectIntegration,
  useConnectorSchema,
  useCreateIntegration,
  useDeleteIntegration,
  useDisconnectIntegration,
  useIntegrationEvents,
  useIntegrations,
} from "@/hooks/use-integrations";
import { EmptyState, Spinner, useToast } from "@/components/ui";
import { SettingsPage } from "../settings-bits";

/**
 * Integrations settings (settings.jsx `Integrations`, design rule #9) wired to the
 * real connector registry (09 §1). The prototype's static vendor grid becomes a
 * live card per registry provider, grouped by category; each card reflects the
 * tenant's actual integration status and connects/disconnects through the
 * admin-only (`integration:manage`) API. Secrets never reach the client — a card
 * only ever knows `hasCredentials`. Data-source providers expose their declared
 * field schema (what the report builder reads); every card can open its delivery
 * log. Whole surface is admin-gated: a non-admin 403s even on read, so we show a
 * restricted state rather than an error.
 */

/** Display groups over the registry's fine-grained categories (design order). */
const GROUPS: { label: string; cats: ConnectorCategory[] }[] = [
  { label: "Data sources", cats: ["erp", "warehouse", "bi"] },
  { label: "Notifications & messaging", cats: ["messaging"] },
  { label: "Files & storage", cats: ["file"] },
  { label: "APIs & webhooks", cats: ["api"] },
  { label: "Email", cats: ["email"] },
];

/** A stable brand-ish colour per provider for the card monogram. */
const PROVIDER_COLOR: Record<IntegrationProvider, string> = {
  slack: "#4a154b",
  ms_teams: "#5059c9",
  ms365: "#0078d4",
  google: "#1a73e8",
  smtp: "#0f766e",
  sap: "#0070b5",
  snowflake: "#29b5e8",
  oracle: "#c74634",
  powerbi: "#f2c811",
  sheets: "#0f9d58",
  rest: "#475569",
  csv: "#16a34a",
  generic_webhook: "#7c3aed",
};

function monogram(meta: ConnectorMeta): string {
  return meta.origin.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase();
}

export function IntegrationsSection(): React.ReactElement {
  const canManage = useCan("integration:manage");
  const { data: page, isPending, isError } = useIntegrations();

  // The registry (all providers), and the tenant's integrations keyed by provider.
  const byProvider = useMemo(() => {
    const map = new Map<IntegrationProvider, IntegrationDto>();
    for (const it of page?.items ?? []) if (!map.has(it.provider)) map.set(it.provider, it);
    return map;
  }, [page]);

  const [openId, setOpenId] = useState<string | null>(null);

  // Admin-only surface: reads 403 for everyone else. Show a restricted state
  // rather than an error envelope (matches the server's default-deny posture).
  if (!canManage || (isError && !isPending)) {
    return (
      <SettingsPage title="Integrations" subtitle="Connect Kaenal to your manufacturing stack">
        <div className="k-surface">
          <EmptyState
            icon={Lock}
            title="Restricted to administrators"
            body="Connecting external systems requires the Integrations capability. Ask a workspace admin to manage connectors."
          />
        </div>
      </SettingsPage>
    );
  }

  if (isPending) {
    return (
      <SettingsPage title="Integrations" subtitle="Connect Kaenal to your manufacturing stack">
        <div className="flex items-center justify-center py-20 text-muted">
          <Spinner /> <span className="ml-2 text-[13px]">Loading connectors…</span>
        </div>
      </SettingsPage>
    );
  }

  return (
    <SettingsPage
      title="Integrations"
      subtitle="Connect Kaenal to your manufacturing stack"
      actions={
        <button className="k-btn k-btn-ghost" title="A curated connector marketplace is on the roadmap">
          <Search size={14} /> Browse marketplace
        </button>
      }
    >
      {GROUPS.map((group) => {
        const providers = INTEGRATION_PROVIDERS.filter((p) => group.cats.includes(CONNECTOR_META[p].category));
        if (providers.length === 0) return null;
        return (
          <div key={group.label} className="mb-6">
            <div className="k-overline mb-2.5">{group.label}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {providers.map((provider) => (
                <ConnectorCard
                  key={provider}
                  meta={CONNECTOR_META[provider]}
                  integration={byProvider.get(provider)}
                  open={openId !== null && byProvider.get(provider)?.id === openId}
                  onToggle={(id) => setOpenId((cur) => (cur === id ? null : id))}
                />
              ))}
            </div>
          </div>
        );
      })}
    </SettingsPage>
  );
}

function ConnectorCard({
  meta,
  integration,
  open,
  onToggle,
}: {
  meta: ConnectorMeta;
  integration: IntegrationDto | undefined;
  open: boolean;
  onToggle: (id: string) => void;
}): React.ReactElement {
  const toast = useToast();
  const create = useCreateIntegration();
  const connect = useConnectIntegration();
  const disconnect = useDisconnectIntegration();
  const remove = useDeleteIntegration();

  const busy = create.isPending || connect.isPending || disconnect.isPending || remove.isPending;
  const status = integration?.status ?? "unregistered";

  const onError = (err: unknown, fallback: string): void => {
    if (err instanceof ApiRequestError && err.status === 403) toast.error("Requires an administrator");
    else toast.error(fallback);
  };

  /** Register (if needed) then connect — one click from the card. */
  const doConnect = (): void => {
    if (integration !== undefined) {
      connect.mutate(
        { id: integration.id, body: {} },
        { onSuccess: () => toast.success(`${meta.label} connected`), onError: (e) => onError(e, "Couldn't connect") },
      );
      return;
    }
    create.mutate(
      { provider: meta.provider, name: meta.label },
      {
        onSuccess: (created) =>
          connect.mutate(
            { id: created.id, body: {} },
            { onSuccess: () => toast.success(`${meta.label} connected`), onError: (e) => onError(e, "Couldn't connect") },
          ),
        onError: (e) => onError(e, "Couldn't register connector"),
      },
    );
  };

  const doDisconnect = (): void => {
    if (integration === undefined) return;
    disconnect.mutate(integration.id, {
      onSuccess: () => toast.success(`${meta.label} disconnected`),
      onError: (e) => onError(e, "Couldn't disconnect"),
    });
  };

  const doRemove = (): void => {
    if (integration === undefined) return;
    remove.mutate(integration.id, {
      onSuccess: () => toast.success(`${meta.label} removed`),
      onError: (e) => onError(e, "Couldn't remove"),
    });
  };

  return (
    <div className="k-surface p-0">
      <div className="flex items-center gap-3 p-3.5">
        <div
          className="flex shrink-0 items-center justify-center font-bold text-white"
          style={{ width: 44, height: 44, borderRadius: "var(--r-md, 8px)", background: PROVIDER_COLOR[meta.provider], fontSize: 11, letterSpacing: "0.04em" }}
        >
          {monogram(meta)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold">
            {meta.label}
            {meta.dataSource && (
              <span className="k-chip" title="Available as a report data source" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                <Database size={9} /> Source
              </span>
            )}
          </div>
          <div className="truncate text-[11px] text-muted">{meta.description}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusChip status={status} />
          {integration !== undefined && (
            <button className="k-btn-icon k-btn-plain" title="Delivery log & schema" onClick={() => onToggle(integration.id)}>
              <Plug size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 border-t border-border px-3.5 py-2.5" style={{ background: "var(--bg-subtle)" }}>
        {status === "connected" ? (
          <button className="k-btn k-btn-sm k-btn-ghost" onClick={doDisconnect} disabled={busy}>
            {disconnect.isPending ? <Loader2 size={12} className="animate-spin" /> : <Link2Off size={12} />} Disconnect
          </button>
        ) : (
          <button className="k-btn k-btn-sm k-btn-primary" onClick={doConnect} disabled={busy}>
            {busy && !remove.isPending ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />} Connect
          </button>
        )}
        {integration !== undefined && (
          <button className="k-btn k-btn-sm k-btn-ghost ml-auto" onClick={doRemove} disabled={busy} title="Remove connector — purges its credential">
            {remove.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Remove
          </button>
        )}
      </div>

      {open && integration !== undefined && <ConnectorDetail integration={integration} isSource={meta.dataSource} />}
    </div>
  );
}

function StatusChip({ status }: { status: IntegrationDto["status"] | "unregistered" }): React.ReactElement {
  if (status === "connected")
    return (
      <span className="k-chip" style={{ background: "var(--success-100, rgba(22,163,74,0.12))", color: "var(--success-700, #15803d)" }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--success-500, #22c55e)" }} /> Connected
      </span>
    );
  if (status === "error")
    return (
      <span className="k-chip" style={{ background: "var(--danger-100, rgba(220,38,38,0.12))", color: "var(--danger-700, #b91c1c)" }}>
        <AlertTriangle size={10} /> Error
      </span>
    );
  if (status === "disconnected")
    return (
      <span className="k-chip" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
        Disconnected
      </span>
    );
  return (
    <span className="k-chip" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
      Available
    </span>
  );
}

/** The delivery log + declared schema for one connector (expands under a card). */
function ConnectorDetail({ integration, isSource }: { integration: IntegrationDto; isSource: boolean }): React.ReactElement {
  const events = useIntegrationEvents(integration.id, true);
  const schema = useConnectorSchema(integration.id, isSource);

  return (
    <div className="border-t border-border p-3.5">
      {isSource && (
        <div className="mb-3">
          <div className="k-overline mb-1.5">Declared fields</div>
          {schema.isPending ? (
            <div className="text-[12px] text-muted">Loading schema…</div>
          ) : (schema.data?.fields.length ?? 0) === 0 ? (
            <div className="text-[12px] text-muted">No fields declared.</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {schema.data?.fields.map((field) => (
                <span key={field.key} className="k-chip" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                  {field.label}
                  <span style={{ opacity: 0.6 }}>· {field.type}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="k-overline mb-1.5">Delivery log</div>
      {events.isPending ? (
        <div className="text-[12px] text-muted">Loading events…</div>
      ) : (events.data?.items.length ?? 0) === 0 ? (
        <div className="text-[12px] text-muted">No deliveries yet.</div>
      ) : (
        <div className="flex flex-col gap-1">
          {events.data?.items.map((ev) => (
            <div key={ev.id} className="flex items-center gap-2 text-[12px]">
              <span
                className="k-chip"
                style={
                  ev.status === "ok"
                    ? { background: "var(--success-100, rgba(22,163,74,0.12))", color: "var(--success-700, #15803d)" }
                    : ev.status === "failed"
                      ? { background: "var(--danger-100, rgba(220,38,38,0.12))", color: "var(--danger-700, #b91c1c)" }
                      : { background: "var(--bg-subtle)", color: "var(--text-muted)" }
                }
              >
                {ev.kind}
              </span>
              <span className="text-muted">{ev.direction === "out" ? "→" : "←"}</span>
              <span className="flex-1 truncate text-muted">{ev.detail ?? "—"}</span>
              <span className="text-muted">{new Date(ev.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
