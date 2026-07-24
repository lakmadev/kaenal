"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { List, LayoutGrid, Plus, Download, Search, User, ClipboardCheck } from "lucide-react";
import type { InspectionDto, InspectionStatus } from "@kaenal/types";
import { shortDate } from "@/lib/format";
import { useMe } from "@/hooks/use-me";
import { useInspections } from "@/hooks/use-inspections";
import { PageHeader } from "@/components/page-header";
import { Button, Segmented, StatusBadge, RiskBadge, EmptyState, Skeleton } from "@/components/ui";
import { InspectionCreateDialog } from "./inspection-create-dialog";

type View = "list" | "grid";
type StatusFilter = "all" | InspectionStatus;

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

function InspectorCell({ id, meId }: { id: string | null; meId: string | undefined }): React.ReactElement {
  if (id === null) return <span className="text-subtle">Unassigned</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px]">
      <span className="inline-flex items-center justify-center rounded-full" style={{ width: 20, height: 20, background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
        <User size={12} />
      </span>
      {meId !== undefined && id === meId ? "You" : <span className="mono text-muted">{id.slice(0, 8)}</span>}
    </span>
  );
}

export function InspectionList(): React.ReactElement {
  const router = useRouter();
  const { data: me } = useMe();
  const [view, setView] = useState<View>("list");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const query = useInspections(status !== "all" ? { status } : undefined);

  const rows = useMemo(() => {
    const items = query.data?.items ?? [];
    const q = search.trim().toLowerCase();
    return q === "" ? items : items.filter((i) => i.title.toLowerCase().includes(q) || i.code.toLowerCase().includes(q));
  }, [query.data, search]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <PageHeader
        title="Inspections"
        description="Manage audits, process checks, and safety walks"
        actions={
          <>
            <Button onClick={() => exportCsv(rows)}>
              <Download size={14} /> Export
            </Button>
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> New Inspection
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative max-w-[320px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <input className="k-input" placeholder="Search by code or title…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 34 }} />
        </div>
        <Segmented options={STATUS_TABS} value={status} onChange={setStatus} ariaLabel="Filter by status" />
        <div className="ml-auto">
          <Segmented
            size="sm"
            ariaLabel="View"
            value={view}
            onChange={setView}
            options={[
              { value: "list", icon: List, label: "" },
              { value: "grid", icon: LayoutGrid, label: "" },
            ]}
          />
        </div>
      </div>

      {query.isLoading ? (
        <div className="k-surface flex flex-col gap-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="k-surface">
          <EmptyState icon={ClipboardCheck} title="Couldn't load inspections" body="Something went wrong." action={<Button variant="primary" onClick={() => void query.refetch()}>Retry</Button>} />
        </div>
      ) : rows.length === 0 ? (
        <div className="k-surface">
          <EmptyState
            icon={ClipboardCheck}
            title={search !== "" || status !== "all" ? "No matching inspections" : "No inspections yet"}
            body="Schedule an inspection from a published template."
            action={<Button variant="primary" onClick={() => setCreateOpen(true)}><Plus size={14} /> New Inspection</Button>}
          />
        </div>
      ) : view === "list" ? (
        <div className="k-surface overflow-x-auto p-0">
          <table className="k-table">
            <thead>
              <tr>
                <th style={{ width: 130 }}>Code</th>
                <th>Title</th>
                <th style={{ width: 120 }}>Status</th>
                <th style={{ width: 90 }}>Risk</th>
                <th style={{ width: 130 }}>Inspector</th>
                <th style={{ width: 100 }}>Scheduled</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className="cursor-pointer" onClick={() => router.push(`/inspections/${i.id}`)}>
                  <td>
                    <span className="mono text-[12px] font-semibold" style={{ color: "var(--accent)" }}>{i.code}</span>
                  </td>
                  <td className="max-w-[380px] font-medium">
                    <div className="truncate" title={i.title}>{i.title}</div>
                  </td>
                  <td><StatusBadge status={i.status} /></td>
                  <td><RiskBadge risk={i.risk} /></td>
                  <td><InspectorCell id={i.inspectorId} meId={me?.userId} /></td>
                  <td className="whitespace-nowrap text-[12px] text-muted">{shortDate(i.scheduledAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {rows.map((i) => (
            <button key={i.id} onClick={() => router.push(`/inspections/${i.id}`)} className="k-surface flex flex-col gap-2.5 p-4 text-left">
              <div className="flex items-start justify-between gap-2">
                <span className="mono text-[11px] font-semibold" style={{ color: "var(--accent)" }}>{i.code}</span>
                <StatusBadge status={i.status} />
              </div>
              <div className="min-h-[38px] text-[14px] font-semibold leading-snug">{i.title}</div>
              <div className="my-0.5 h-px bg-border" />
              <div className="flex items-center justify-between text-[11.5px]">
                <RiskBadge risk={i.risk} />
                <span className="inline-flex items-center gap-1 text-muted">{shortDate(i.scheduledAt)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <InspectionCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function exportCsv(rows: InspectionDto[]): void {
  const header = ["Code", "Title", "Status", "Risk", "Scheduled", "Score"];
  const esc = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const body = rows.map((i) =>
    [i.code, i.title, i.status, i.risk ?? "", i.scheduledAt ?? "", i.score ?? ""].map((v) => esc(String(v))).join(","),
  );
  const csv = [header.join(","), ...body].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `inspections-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
