"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { List, LayoutGrid, Plus, Download, Search, Filter, TriangleAlert } from "lucide-react";
import type { NcrDto, NcrStatus, NcrPriority } from "@kaenal/types";
import { shortDate, titleCase } from "@/lib/format";
import { useMe } from "@/hooks/use-me";
import { useNcrs } from "@/hooks/use-ncrs";
import { PageHeader } from "@/components/page-header";
import { Button, Segmented, StatusBadge, PriorityBadge, EmptyState, Skeleton } from "@/components/ui";
import { SlaIndicator, OwnerCell } from "./ncr-bits";
import { NcrKanban } from "./ncr-kanban";
import { NcrCreateDialog } from "./ncr-create-dialog";

type View = "list" | "kanban";
type StatusFilter = "all" | NcrStatus;

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export function NcrList(): React.ReactElement {
  const router = useRouter();
  const { data: me } = useMe();

  const [view, setView] = useState<View>("list");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [priority, setPriority] = useState<NcrPriority | "any">("any");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // Table view filters by status server-side; kanban needs every column, so it
  // fetches unfiltered. Search + priority narrow the loaded page client-side.
  const serverStatus = view === "list" && status !== "all" ? status : undefined;
  const query = useNcrs(serverStatus !== undefined ? { status: serverStatus } : undefined);

  const rows = useMemo(() => {
    const items = query.data?.items ?? [];
    const q = search.trim().toLowerCase();
    return items.filter(
      (n) =>
        (priority === "any" || n.priority === priority) &&
        (q === "" || n.title.toLowerCase().includes(q) || n.code.toLowerCase().includes(q)),
    );
  }, [query.data, search, priority]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <PageHeader
        title="Non-Conformities"
        description="Track, investigate, and close quality & safety issues"
        actions={
          <>
            <Button onClick={() => exportCsv(rows)}>
              <Download size={14} /> Export
            </Button>
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> New NCR
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative max-w-[320px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <input
            className="k-input"
            placeholder="Search NCRs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 34 }}
          />
        </div>

        {view === "list" && <Segmented options={STATUS_TABS} value={status} onChange={setStatus} ariaLabel="Filter by status" />}

        <div className="inline-flex items-center gap-1.5">
          <Filter size={14} className="text-muted" />
          <select
            className="k-input"
            value={priority}
            onChange={(e) => setPriority(e.target.value as NcrPriority | "any")}
            aria-label="Filter by priority"
            style={{ width: 130 }}
          >
            <option value="any">Any priority</option>
            <option value="critical">Critical</option>
            <option value="major">Major</option>
            <option value="minor">Minor</option>
          </select>
        </div>

        <div className="ml-auto">
          <Segmented
            size="sm"
            ariaLabel="View"
            value={view}
            onChange={setView}
            options={[
              { value: "list", icon: List, label: "" },
              { value: "kanban", icon: LayoutGrid, label: "" },
            ]}
          />
        </div>
      </div>

      {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <ErrorCard onRetry={() => void query.refetch()} />
      ) : rows.length === 0 ? (
        <div className="k-surface">
          <EmptyState
            icon={TriangleAlert}
            title={search !== "" || priority !== "any" || status !== "all" ? "No matching NCRs" : "No NCRs yet"}
            body="Raise a non-conformity to start tracking it."
            action={
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                <Plus size={14} /> New NCR
              </Button>
            }
          />
        </div>
      ) : view === "list" ? (
        <div className="k-surface overflow-x-auto p-0">
          <table className="k-table">
            <thead>
              <tr>
                <th style={{ width: 130 }}>Code</th>
                <th>Title</th>
                <th style={{ width: 110 }}>Source</th>
                <th style={{ width: 90 }}>Priority</th>
                <th style={{ width: 120 }}>Status</th>
                <th style={{ width: 130 }}>Owner</th>
                <th style={{ width: 90 }}>Due</th>
                <th style={{ width: 90 }}>SLA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => (
                <tr key={n.id} className="cursor-pointer" onClick={() => router.push(`/ncrs/${n.id}`)}>
                  <td>
                    <span className="mono text-[12px] font-semibold" style={{ color: "var(--accent)" }}>
                      {n.code}
                    </span>
                  </td>
                  <td className="max-w-[380px] font-medium">
                    <div className="truncate" title={n.title}>
                      {n.title}
                    </div>
                  </td>
                  <td className="text-[12px] capitalize text-muted">{titleCase(n.source)}</td>
                  <td>
                    <PriorityBadge priority={n.priority} />
                  </td>
                  <td>
                    <StatusBadge status={n.status} />
                  </td>
                  <td>
                    <OwnerCell ownerId={n.ownerId} meId={me?.userId} />
                  </td>
                  <td className="whitespace-nowrap text-[12px] text-muted">{shortDate(n.dueAt)}</td>
                  <td>
                    <SlaIndicator state={n.slaState} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <NcrKanban ncrs={rows} meId={me?.userId} />
      )}

      {query.data?.nextCursor != null && view === "list" && (
        <p className="text-center text-[12px] text-subtle">
          Showing the first {rows.length}. Pagination & virtualization land with the shared table.
        </p>
      )}

      <NcrCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function ListSkeleton(): React.ReactElement {
  return (
    <div className="k-surface flex flex-col gap-2 p-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-11" />
      ))}
    </div>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }): React.ReactElement {
  return (
    <div className="k-surface">
      <EmptyState
        icon={TriangleAlert}
        title="Couldn't load NCRs"
        body="Something went wrong fetching the list."
        action={
          <Button variant="primary" onClick={onRetry}>
            Retry
          </Button>
        }
      />
    </div>
  );
}

/** Client-side CSV export of the currently-filtered rows (the real export
 *  pipeline — server-rendered, plant-scoped — is the reports module). */
function exportCsv(rows: NcrDto[]): void {
  const header = ["Code", "Title", "Source", "Priority", "Status", "Due", "SLA"];
  const esc = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const body = rows.map((n) =>
    [n.code, n.title, n.source, n.priority, n.status, n.dueAt ?? "", n.slaState].map((v) => esc(String(v))).join(","),
  );
  const csv = [header.join(","), ...body].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `ncrs-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
