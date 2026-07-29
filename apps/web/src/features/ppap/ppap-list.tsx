"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, FileCheck, ChevronRight } from "lucide-react";
import type { PpapStatus } from "@kaenal/types";
import { shortDate } from "@/lib/format";
import { useMe, hasCapability } from "@/hooks/use-me";
import { usePpapList } from "@/hooks/use-ppap";
import { PageHeader } from "@/components/page-header";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { PpapStatusBadge, LevelChip, AiPredictionPill } from "./ppap-bits";
import { PpapCreateDialog } from "./ppap-create-dialog";

type Tab = "active" | "approved" | "rejected" | "all";

const ACTIVE: ReadonlySet<PpapStatus> = new Set<PpapStatus>(["pending", "in_review", "interim"]);

export function PpapList(): React.ReactElement {
  const router = useRouter();
  const { data: me } = useMe();
  const canManage = hasCapability(me, "ppap:manage");

  const [tab, setTab] = useState<Tab>("active");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const query = usePpapList();
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  const counts = useMemo(
    () => ({
      active: items.filter((p) => ACTIVE.has(p.status)).length,
      approved: items.filter((p) => p.status === "approved").length,
      rejected: items.filter((p) => p.status === "rejected").length,
      all: items.length,
      delays: items.filter((p) => p.aiPrediction.willMissDeadline === true).length,
    }),
    [items],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((p) => {
      if (tab === "active" && !ACTIVE.has(p.status)) return false;
      if (tab === "approved" && p.status !== "approved") return false;
      if (tab === "rejected" && p.status !== "rejected") return false;
      if (q === "") return true;
      return `${p.partNumber} ${p.code ?? ""} ${p.programName ?? ""} ${p.supplierName ?? ""} ${p.customer ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [items, tab, search]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "active", label: `Active (${counts.active})` },
    { id: "approved", label: `Approved (${counts.approved})` },
    { id: "rejected", label: `Rejected (${counts.rejected})` },
    { id: "all", label: `All (${counts.all})` },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <PageHeader
        title="PPAP submissions"
        description="Production Part Approval Process — 18-element workpackages from suppliers (AIAG levels 1–5)."
        actions={
          canManage ? (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> Request PPAP
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <Kpi label="In review / active" value={String(counts.active)} sub="pending, in review, interim" color="#b45309" />
        <Kpi label="AI-predicted delays" value={String(counts.delays)} sub="likely to miss customer date" color="#b91c1c" />
        <Kpi label="Approved" value={String(counts.approved)} sub="first-time approvals" color="#15803d" />
        <Kpi label="Total" value={String(counts.all)} sub="all submissions" />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative max-w-[320px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <input
            className="k-input"
            placeholder="Search part, program, supplier, customer…"
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
            icon={FileCheck}
            title="Couldn't load PPAP submissions"
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
            icon={FileCheck}
            title={search !== "" || tab !== "active" ? "No matching submissions" : "No active PPAP submissions"}
            body="Request a PPAP package from a supplier to start tracking its 18 elements."
            action={
              canManage ? (
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  <Plus size={14} /> Request PPAP
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
                <th style={{ width: 130 }}>PPAP ID</th>
                <th>Part / Program</th>
                <th style={{ width: 160 }}>Supplier</th>
                <th style={{ width: 80 }}>Level</th>
                <th style={{ width: 130 }}>Customer</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 120 }}>AI</th>
                <th style={{ width: 90 }}>Due</th>
                <th style={{ width: 80 }}>Elements</th>
                <th style={{ width: 28 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="cursor-pointer" onClick={() => router.push(`/ppap/${p.id}`)}>
                  <td className="mono text-[11.5px] font-semibold" style={{ color: "var(--accent)" }}>
                    {p.code ?? p.id.slice(0, 8)}
                  </td>
                  <td>
                    <div className="text-[12.5px] font-medium">{p.partNumber}</div>
                    {p.programName !== null && <div className="text-[10.5px] text-muted">{p.programName}</div>}
                  </td>
                  <td className="text-[12.5px] font-medium">{p.supplierName ?? "—"}</td>
                  <td>
                    <LevelChip level={p.level} />
                  </td>
                  <td className="text-[12px]">{p.customer ?? "—"}</td>
                  <td>
                    <PpapStatusBadge status={p.status} />
                  </td>
                  <td>
                    <AiPredictionPill
                      willMissDeadline={p.aiPrediction.willMissDeadline}
                      confidence={p.aiPrediction.confidence}
                      daysLikelyOver={p.aiPrediction.daysLikelyOver}
                    />
                  </td>
                  <td className="whitespace-nowrap text-[12px] text-muted">{shortDate(p.dueDate)}</td>
                  <td className="mono text-[12px]">
                    {p.completeness.approved}/{p.completeness.required}
                  </td>
                  <td>
                    <ChevronRight size={14} className="text-subtle" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PpapCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color?: string;
}): React.ReactElement {
  return (
    <div className="k-surface p-3">
      <div className="text-[10.5px] font-semibold uppercase text-muted">{label}</div>
      <div className="text-[22px] font-bold" style={{ color: color ?? "var(--text)" }}>
        {value}
      </div>
      <div className="text-[10.5px] text-muted">{sub}</div>
    </div>
  );
}
