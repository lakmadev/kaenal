"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiQueries } from "@kaenal/api-client";
import type { NcrDto, Page } from "@kaenal/types";
import { ClipboardCheck, TriangleAlert, ShieldCheck, FileText } from "lucide-react";
import { getApiClient } from "@/lib/api";
import { useMe } from "@/hooks/use-me";
import { Card, CardHeader, CardTitle, EmptyState, PriorityBadge, StatusBadge, Skeleton } from "@/components/ui";
import { KpiCard } from "./kpi-card";

/** `n` loaded, with a trailing `+` when the cursor shows there are more. */
function pageCount<T>(page: Page<T> | undefined): string | undefined {
  if (page === undefined) return undefined;
  return `${page.items.length}${page.nextCursor !== null ? "+" : ""}`;
}

/**
 * Dashboard (04 §5) — the foundation slice: KPI tiles + a recent-NCRs table, each
 * backed by a real cursor-paginated endpoint through the typed query factories,
 * with loading / empty / error states (04 §6). Charts, widget dnd, and role
 * presets layer on next.
 */
export function DashboardView(): React.ReactElement {
  const client = getApiClient();
  const { data: me } = useMe();

  const openNcrs = useQuery(apiQueries.ncrs.list(client, { query: { status: "open" } }));
  const inspections = useQuery(apiQueries.inspections.list(client));
  const capas = useQuery(apiQueries.capas.list(client));
  const documents = useQuery(apiQueries.documents.list(client));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header>
        <h1 className="text-[26px] font-bold tracking-tight text-text">Dashboard</h1>
        <p className="mt-1 text-[13px] text-muted">
          {me !== undefined ? (
            <>
              Signed in as <span className="font-medium text-text">{me.role}</span> ·{" "}
              <span className="mono">{me.tenantSlug}</span>
            </>
          ) : (
            <span className="inline-block h-4 w-40 align-middle">
              <Skeleton className="h-4 w-40" />
            </span>
          )}
        </p>
      </header>

      <section aria-label="Key metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Open NCRs"
          icon={TriangleAlert}
          value={pageCount(openNcrs.data)}
          loading={openNcrs.isLoading}
          isError={openNcrs.isError}
        />
        <KpiCard
          label="Inspections"
          icon={ClipboardCheck}
          value={pageCount(inspections.data)}
          loading={inspections.isLoading}
          isError={inspections.isError}
        />
        <KpiCard
          label="CAPAs"
          icon={ShieldCheck}
          value={pageCount(capas.data)}
          loading={capas.isLoading}
          isError={capas.isError}
        />
        <KpiCard
          label="Documents"
          icon={FileText}
          value={pageCount(documents.data)}
          loading={documents.isLoading}
          isError={documents.isError}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Recent NCRs</CardTitle>
          <Link href="/ncrs" className="k-link text-[13px]">
            View all
          </Link>
        </CardHeader>
        <RecentNcrs query={openNcrs} />
      </Card>
    </div>
  );
}

function RecentNcrs({
  query,
}: {
  query: ReturnType<typeof useQuery<Page<NcrDto>>>;
}): React.ReactElement {
  if (query.isLoading) {
    return (
      <div className="space-y-2 px-5 pb-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="px-5 pb-5">
        <EmptyState icon={TriangleAlert} title="Couldn't load NCRs" body="Please retry in a moment." />
      </div>
    );
  }

  const items = query.data?.items ?? [];
  if (items.length === 0) {
    return <EmptyState title="No open NCRs" body="Nonconformances you raise will appear here." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="k-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Title</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Raised</th>
          </tr>
        </thead>
        <tbody>
          {items.slice(0, 8).map((ncr) => (
            <tr key={ncr.id}>
              <td className="mono font-semibold">
                <Link href={`/ncrs/${ncr.id}`} className="k-link">
                  {ncr.code}
                </Link>
              </td>
              <td className="max-w-[320px] truncate" title={ncr.title}>
                {ncr.title}
              </td>
              <td>
                <PriorityBadge priority={ncr.priority} />
              </td>
              <td>
                <StatusBadge status={ncr.status} />
              </td>
              <td className="whitespace-nowrap text-muted">
                {new Date(ncr.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
