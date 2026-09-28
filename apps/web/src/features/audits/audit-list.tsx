"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarRange, CheckCircle2, Plus, Search, ShieldCheck, TriangleAlert } from "lucide-react";
import type { AuditType } from "@kaenal/types";
import { useAudits, useAuditStats, type AuditListQuery } from "@/hooks/use-audits";
import { useMe, hasCapability } from "@/hooks/use-me";
import { useDebouncedValue } from "@/hooks/use-search";
import { PageHeader } from "@/components/page-header";
import { Button, EmptyState, Segmented, Skeleton } from "@/components/ui";
import { AUDIT_TYPES } from "./audit-types";
import { AuditCard } from "./audit-card";
import { AuditFrequencyChart } from "./audit-frequency-chart";

type Tab = "all" | "active" | "completed" | "mine";

/**
 * `audits.jsx` `AuditList` (lines 23-118) — KPI strip, segmented filters, type
 * select, debounced search, audit cards, and the 6-month frequency chart, all
 * wired to real data: `GET /v1/audits/stats` (KPI strip, S2-1 AC5), `GET
 * /v1/audits` (`q`/`mine`/`status`/`type`, AC3), `GET /v1/audits/frequency`
 * (AC4). No client-side aggregation — filtering/counting is server-side.
 */
export function AuditList({
  initialTab = "all",
  onNewAudit,
}: {
  initialTab?: "all" | "mine";
  onNewAudit?: () => void;
}): React.ReactElement {
  const t = useTranslations("audits");
  const router = useRouter();
  const { data: me } = useMe();
  const canManage = hasCapability(me, "audit:manage");

  const [tab, setTab] = useState<Tab>(initialTab);
  const [typeFilter, setTypeFilter] = useState<AuditType | "all">("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const query: AuditListQuery = {};
  if (tab === "active") query.status = "active";
  else if (tab === "completed") query.status = "completed";
  else if (tab === "mine") query.mine = true;
  if (typeFilter !== "all") query.type = typeFilter;
  if (debouncedSearch.trim() !== "") query.q = debouncedSearch.trim();

  const auditsQuery = useAudits(query);
  const statsQuery = useAuditStats();
  const items = useMemo(() => auditsQuery.data?.items ?? [], [auditsQuery.data]);
  const isFiltered = tab !== "all" || typeFilter !== "all" || debouncedSearch.trim() !== "";

  const kpis = [
    { label: t("kpiActive"), value: statsQuery.data?.active, icon: ShieldCheck, color: "#2563eb" },
    { label: t("kpiPlannedNext90d"), value: statsQuery.data?.plannedNext90d, icon: CalendarRange, color: "#9333ea" },
    { label: t("kpiCompletedYtd"), value: statsQuery.data?.completedYtd, icon: CheckCircle2, color: "#16a34a" },
    { label: t("kpiOpenFindings"), value: statsQuery.data?.openFindings, icon: TriangleAlert, color: "#dc2626" },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 p-6">
      <PageHeader
        title={t("title")}
        description={tab === "mine" ? t("descriptionMine") : t("descriptionAll")}
        actions={
          <>
            <Button onClick={() => router.push("/audits?view=schedule")}>
              <CalendarRange size={14} /> {t("scheduleView")}
            </Button>
            {canManage && (
              <Button variant="primary" onClick={onNewAudit}>
                <Plus size={14} /> {t("newAudit")}
              </Button>
            )}
          </>
        }
      />

      {/* KPI strip (S2-1 AC5) */}
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="k-surface flex items-center gap-3.5 p-4">
            <div
              className="flex shrink-0 items-center justify-center rounded-[10px]"
              style={{ width: 40, height: 40, background: `${k.color}18`, color: k.color }}
            >
              <k.icon size={20} />
            </div>
            <div className="min-w-0">
              <div className="k-overline text-muted">{k.label}</div>
              {statsQuery.isLoading ? (
                <Skeleton className="mt-1 h-6 w-10" />
              ) : (
                <div className="text-[24px] font-bold leading-tight">{k.value ?? 0}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          ariaLabel={t("title")}
          value={tab}
          onChange={setTab}
          options={[
            { value: "all", label: t("filterAll") },
            { value: "active", label: t("filterActive") },
            { value: "completed", label: t("filterCompleted") },
            { value: "mine", label: t("filterMine") },
          ]}
        />
        <select
          className="k-input h-8 w-auto text-[12.5px]"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as AuditType | "all")}
        >
          <option value="all">{t("typeAny")}</option>
          {(Object.keys(AUDIT_TYPES) as AuditType[]).map((k) => (
            <option key={k} value={k}>
              {AUDIT_TYPES[k].label}
            </option>
          ))}
        </select>
        <div className="relative w-[280px]">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="k-input h-8 text-[12.5px]"
            style={{ paddingLeft: 32 }}
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t("searchPlaceholder")}
          />
        </div>
        <span className="ml-auto text-[12px] text-muted">
          {auditsQuery.isLoading ? "…" : `${items.length} audit${items.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {/* Audit cards */}
      {auditsQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[180px] rounded-xl" />
          ))}
        </div>
      ) : auditsQuery.isError ? (
        <ErrorCard
          onRetry={() => void auditsQuery.refetch()}
          {...(auditsQuery.error instanceof Error ? { requestId: auditsQuery.error.message } : {})}
        />
      ) : items.length === 0 ? (
        <div className="k-surface">
          <EmptyState
            icon={isFiltered ? Search : ShieldCheck}
            title={isFiltered ? t("emptyFilteredTitle") : t("emptyTitle")}
            body={isFiltered ? t("emptyFilteredBody") : t("emptyBody")}
            action={
              !isFiltered && canManage ? (
                <Button variant="primary" onClick={onNewAudit}>
                  <Plus size={14} /> {t("newAudit")}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {items.map((a) => (
            <AuditCard key={a.id} audit={a} />
          ))}
        </div>
      )}

      {/* Schedule timeline */}
      <div className="k-surface p-[18px]">
        <div className="mb-3.5 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold">{t("frequencyTitle")}</h3>
          <span className="text-[11px] text-muted">Internal · Supplier · Customer · Certification · Gap Analysis</span>
        </div>
        <AuditFrequencyChart />
      </div>
    </div>
  );
}

function ErrorCard({ onRetry, requestId }: { onRetry: () => void; requestId?: string }): React.ReactElement {
  const t = useTranslations("audits");
  return (
    <div className="k-surface">
      <EmptyState
        icon={TriangleAlert}
        title={t("errorTitle")}
        {...(requestId !== undefined ? { body: `Request ID: ${requestId}` } : {})}
        action={
          <Button variant="primary" onClick={onRetry}>
            {t("retry")}
          </Button>
        }
      />
    </div>
  );
}
