"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, GitBranch, ChevronRight } from "lucide-react";
import type { EightDDto, EightDStatus } from "@kaenal/types";
import { shortDate } from "@/lib/format";
import { useMe, hasCapability } from "@/hooks/use-me";
import { useEightDs } from "@/hooks/use-eightd";
import { UserCell } from "@/features/documents/document-bits";
import { PageHeader } from "@/components/page-header";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { EightDStatusBadge, disciplineFor } from "./eightd-bits";
import { EightDCreateDialog } from "./eightd-create-dialog";

type Tab = EightDStatus | "all";

function completeCount(e: EightDDto): number {
  return Object.values(e.steps).filter((s) => s.status === "complete").length;
}

export function EightDList(): React.ReactElement {
  const router = useRouter();
  const { data: me } = useMe();
  const canManage = hasCapability(me, "ncr:manage");
  const meId = me?.userId;

  const [tab, setTab] = useState<Tab>("active");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const query = useEightDs();
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  const counts = useMemo(
    () => ({
      active: items.filter((e) => e.status === "active").length,
      completed: items.filter((e) => e.status === "completed").length,
      cancelled: items.filter((e) => e.status === "cancelled").length,
      all: items.length,
    }),
    [items],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((e) => {
      if (tab !== "all" && e.status !== tab) return false;
      if (q === "") return true;
      return `${e.title} ${e.code}`.toLowerCase().includes(q);
    });
  }, [items, tab, search]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "active", label: `Active (${counts.active})` },
    { id: "completed", label: `Completed (${counts.completed})` },
    { id: "cancelled", label: `Cancelled (${counts.cancelled})` },
    { id: "all", label: `All (${counts.all})` },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <PageHeader
        title="8D Problem Solving"
        description="Guided D1–D8 disciplines — the deep corrective-action tool, often raised from an NCR."
        actions={
          canManage ? (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> Open 8D
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative max-w-[320px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <input
            className="k-input"
            placeholder="Search title or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 34 }}
          />
        </div>
        <div className="k-tabs">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`k-tab ${tab === t.id ? "active" : ""}`}>
              {t.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[12px] text-muted">
          {rows.length} of {items.length}
        </span>
      </div>

      {query.isLoading ? (
        <div className="k-surface flex flex-col gap-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="k-surface">
          <EmptyState
            icon={GitBranch}
            title="Couldn't load 8D reports"
            body="Something went wrong fetching the list."
            action={
              <Button variant="primary" onClick={() => void query.refetch()}>
                Retry
              </Button>
            }
          />
        </div>
      ) : rows.length === 0 ? (
        <div className="k-surface">
          <EmptyState
            icon={GitBranch}
            title={search !== "" || tab !== "active" ? "No matching 8D reports" : "No active 8D reports"}
            body="Open an 8D to work a problem through the eight disciplines."
            action={
              canManage ? (
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  <Plus size={14} /> Open 8D
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="k-surface overflow-x-auto p-0">
          <table className="k-table">
            <thead>
              <tr>
                <th style={{ width: 120 }}>8D ID</th>
                <th>Title</th>
                <th style={{ width: 150 }}>Stage</th>
                <th style={{ width: 90 }}>Progress</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 130 }}>Team lead</th>
                <th style={{ width: 90 }}>Target</th>
                <th style={{ width: 28 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const done = completeCount(e);
                const stage = disciplineFor(e.currentStep);
                return (
                  <tr key={e.id} className="cursor-pointer" onClick={() => router.push(`/8d/${e.id}`)}>
                    <td className="mono text-[11.5px] font-semibold" style={{ color: "var(--accent)" }}>
                      {e.code}
                    </td>
                    <td className="text-[12.5px] font-medium">{e.title}</td>
                    <td className="text-[12px] text-muted">
                      {stage.code} · {stage.title}
                    </td>
                    <td className="mono text-[12px]">{done}/8</td>
                    <td>
                      <EightDStatusBadge status={e.status} />
                    </td>
                    <td>
                      <UserCell userId={e.teamLeadId} meId={meId} emptyLabel="—" />
                    </td>
                    <td className="whitespace-nowrap text-[12px] text-muted">{shortDate(e.targetAt)}</td>
                    <td>
                      <ChevronRight size={14} className="text-subtle" />
                    </td>
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
