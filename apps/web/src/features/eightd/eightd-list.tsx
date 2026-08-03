"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Filter, GitBranch, Link2, Plus } from "lucide-react";
import type { EightDStatus } from "@kaenal/types";
import { shortDate } from "@/lib/format";
import { useMe, hasCapability } from "@/hooks/use-me";
import { useEightDs } from "@/hooks/use-eightd";
import { useMemberLookup } from "@/hooks/use-members";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/page-header";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { EightDStatusBadge, StepperMini } from "./eightd-bits";
import { EightDCreateDialog } from "./eightd-create-dialog";

export function EightDList(): React.ReactElement {
  const router = useRouter();
  const { data: me } = useMe();
  const canManage = hasCapability(me, "ncr:manage");
  const lookup = useMemberLookup();

  const [createOpen, setCreateOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<{ status: EightDStatus | "any"; lead: string }>({ status: "any", lead: "any" });
  const filterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!filtersOpen) return;
    const close = (e: MouseEvent): void => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFiltersOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [filtersOpen]);

  const query = useEightDs();
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  const uniqueLeads = useMemo(() => [...new Set(items.map((e) => e.teamLeadId).filter((x): x is string => x != null))], [items]);
  const activeFilterCount = (filters.status !== "any" ? 1 : 0) + (filters.lead !== "any" ? 1 : 0);
  const rows = useMemo(
    () =>
      items.filter(
        (e) => (filters.status === "any" || e.status === filters.status) && (filters.lead === "any" || e.teamLeadId === filters.lead),
      ),
    [items, filters],
  );

  return (
    <div className="fade-in flex flex-col gap-4" style={{ padding: "24px 28px" }}>
      <PageHeader
        title="8D Reports"
        description="Guided D1–D8 problem solving — Kaenal's quality differentiator"
        actions={
          <>
            <div className="relative">
              <button className="k-btn k-btn-ghost" onClick={() => setFiltersOpen((v) => !v)}>
                <Filter size={14} />Filters
                {activeFilterCount > 0 && (
                  <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white" style={{ background: "var(--accent)" }}>
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {filtersOpen && (
                <div ref={filterRef} className="k-surface absolute right-0 top-full z-30 mt-2 flex min-w-[280px] flex-col gap-3.5 p-4 text-left" style={{ boxShadow: "var(--shadow-lg)" }}>
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-semibold">Filters</div>
                    <button className="k-btn-plain text-[11px] text-muted" onClick={() => setFilters({ status: "any", lead: "any" })}>Reset</button>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="k-overline">Status</span>
                    <select className="k-input" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as EightDStatus | "any" }))}>
                      <option value="any">Any</option>
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="k-overline">Team Lead</span>
                    <select className="k-input" value={filters.lead} onChange={(e) => setFilters((f) => ({ ...f, lead: e.target.value }))}>
                      <option value="any">Any</option>
                      {uniqueLeads.map((id) => (
                        <option key={id} value={id}>{lookup.nameOf(id)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
            {canManage && (
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                <Plus size={14} />Start 8D
              </Button>
            )}
          </>
        }
      />

      {query.isLoading ? (
        <div className="k-surface flex flex-col gap-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="k-surface">
          <EmptyState icon={GitBranch} title="Couldn't load 8D reports" body="Something went wrong fetching the list." action={<Button variant="primary" onClick={() => void query.refetch()}>Retry</Button>} />
        </div>
      ) : (
        <div className="k-surface overflow-hidden p-0">
          <table className="k-table">
            <thead>
              <tr>
                <th style={{ width: 140 }}>ID</th>
                <th>Title</th>
                <th style={{ width: 130 }}>Linked NCR</th>
                <th style={{ width: 260 }}>Progress</th>
                <th style={{ width: 130 }}>Team Lead</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 110 }}>Target</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[13px] text-muted">No 8D reports match these filters.</td>
                </tr>
              )}
              {rows.map((e) => {
                const lead = lookup.memberOf(e.teamLeadId);
                const leadName = lookup.nameOf(e.teamLeadId);
                return (
                  <tr key={e.id} className="cursor-pointer" onClick={() => router.push(`/8d/${e.id}`)}>
                    <td>
                      <span className="mono text-[12px] font-semibold" style={{ color: "var(--accent)" }}>{e.code}</span>
                    </td>
                    <td className="font-medium">{e.title}</td>
                    <td>
                      {e.ncrId ? (
                        <span className="mono inline-flex items-center gap-1 text-[11px] text-muted"><Link2 size={11} />Linked</span>
                      ) : (
                        <span className="text-[11px] text-subtle">—</span>
                      )}
                    </td>
                    <td>
                      <StepperMini current={e.currentStep} />
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar name={lead?.name} size={22} />
                        <span className="text-[12px]">{leadName.split(" ")[0]}</span>
                      </div>
                    </td>
                    <td>
                      <EightDStatusBadge status={e.status} />
                    </td>
                    <td className="whitespace-nowrap text-[12px] text-muted">{shortDate(e.targetAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <EightDCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
