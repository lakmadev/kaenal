"use client";

import { Building2, Info } from "lucide-react";
import type { Query } from "@kaenal/types";
import { useQueryMetric } from "@/hooks/use-query";
import { Spinner } from "@/components/ui";
import { SettingsPage } from "../settings-bits";

/**
 * Cross-tenant analytics (multi-tenancy.jsx, design rule #9). Current-tenant KPIs
 * are computed LIVE through the Phase G query engine (`/v1/query/metric`) — the
 * same injection-safe compiler behind reports and dashboards. Corporate roll-ups
 * *across* child tenants need a tenant hierarchy that doesn't exist yet, so those
 * are honestly flagged, not faked (consistent with prior phases).
 */

const KPIS: { label: string; query: Query; hint: string }[] = [
  { label: "Non-conformities", query: { sourceId: "ncr", agg: "count" }, hint: "Total NCRs in this workspace" },
  { label: "Inspections", query: { sourceId: "inspection", agg: "count" }, hint: "Total inspections" },
  { label: "CAPAs", query: { sourceId: "capa", agg: "count" }, hint: "Total corrective actions" },
  { label: "Audits", query: { sourceId: "audit", agg: "count" }, hint: "Total audits" },
  { label: "Suppliers", query: { sourceId: "supplier", agg: "count" }, hint: "Registered suppliers" },
  { label: "8D reports", query: { sourceId: "eightd", agg: "count" }, hint: "Total 8D investigations" },
];

export function CrossTenantSection(): React.ReactElement {
  return (
    <SettingsPage
      title="Cross-tenant analytics"
      subtitle="Live quality KPIs for this workspace, computed through the query engine"
    >
      <div className="mb-4 flex items-start gap-2.5 rounded-md border border-border p-3.5" style={{ background: "var(--bg-subtle)" }}>
        <Info size={16} className="mt-0.5 shrink-0 text-muted" />
        <div className="text-[12px] text-muted">
          These are <strong>current-workspace</strong> figures, each computed live via the same query engine that
          powers reports and dashboards. <strong>Corporate roll-ups across child tenants</strong> require an
          org-hierarchy that isn&apos;t modelled yet — that view is on the roadmap, not shown here.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {KPIS.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} query={kpi.query} hint={kpi.hint} />
        ))}
      </div>
    </SettingsPage>
  );
}

function KpiCard({ label, query, hint }: { label: string; query: Query; hint: string }): React.ReactElement {
  const metric = useQueryMetric(query);
  return (
    <div className="k-surface p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted">
        <Building2 size={11} /> {label}
      </div>
      <div className="mt-1 text-[26px] font-bold tabular-nums">
        {metric.isPending ? (
          <Spinner />
        ) : metric.isError ? (
          <span className="text-[13px] font-normal text-muted">—</span>
        ) : (
          (metric.data?.value ?? 0).toLocaleString()
        )}
      </div>
      <div className="mt-0.5 text-[11px] text-muted">{hint}</div>
    </div>
  );
}
