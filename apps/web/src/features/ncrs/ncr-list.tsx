"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { List, LayoutGrid, Plus, Download, Search, Filter, Link2, TriangleAlert } from "lucide-react";
import type { NcrDto, NcrStatus, NcrPriority, NcrSource } from "@kaenal/types";
import { shortDate, titleCase } from "@/lib/format";
import { useMe } from "@/hooks/use-me";
import { useNcrs } from "@/hooks/use-ncrs";
import { useMemberLookup } from "@/hooks/use-members";
import { PageHeader } from "@/components/page-header";
import { MemberCell } from "@/components/member-cell";
import { Button, Segmented, StatusBadge, PriorityBadge, EmptyState, Skeleton } from "@/components/ui";
import { SlaIndicator } from "./ncr-bits";
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

const VIEWS = {
  mine: { title: "My NCR Assignments", description: "Non-conformities assigned to you" },
  overdue: { title: "NCRs — At Risk", description: "SLA breached or at risk" },
} as const;

interface ExtraFilters {
  priority: NcrPriority | "any";
  source: NcrSource | "any";
  owner: string; // owner-id, or the "any" sentinel
}
const EMPTY_FILTERS: ExtraFilters = { priority: "any", source: "any", owner: "any" };

export function NcrList(): React.ReactElement {
  const router = useRouter();
  const { data: me } = useMe();
  const lookup = useMemberLookup();
  const searchParams = useSearchParams();
  const view_ = searchParams.get("view");
  const savedView = view_ === "mine" || view_ === "overdue" ? view_ : null;

  const [view, setView] = useState<View>("list");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [extra, setExtra] = useState<ExtraFilters>(EMPTY_FILTERS);
  const filterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!filtersOpen) return;
    const close = (e: MouseEvent): void => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFiltersOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [filtersOpen]);

  const serverStatus = view === "list" && status !== "all" ? status : undefined;
  const query = useNcrs(serverStatus !== undefined ? { status: serverStatus } : undefined);
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  const uniqueSources = useMemo(() => [...new Set(items.map((n) => n.source))], [items]);
  const uniqueOwners = useMemo(() => [...new Set(items.map((n) => n.ownerId).filter((x): x is string => x != null))], [items]);
  const activeFilterCount = (extra.priority !== "any" ? 1 : 0) + (extra.source !== "any" ? 1 : 0) + (extra.owner !== "any" ? 1 : 0);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (n) =>
        (extra.priority === "any" || n.priority === extra.priority) &&
        (extra.source === "any" || n.source === extra.source) &&
        (extra.owner === "any" || n.ownerId === extra.owner) &&
        (savedView !== "mine" || (me !== undefined && n.ownerId === me.userId)) &&
        (savedView !== "overdue" || n.slaState !== "on_track") &&
        (q === "" || n.title.toLowerCase().includes(q) || n.code.toLowerCase().includes(q)),
    );
  }, [items, search, extra, savedView, me]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <PageHeader
        title={savedView !== null ? VIEWS[savedView].title : "Non-Conformities"}
        description={savedView !== null ? VIEWS[savedView].description : "Track, investigate, and close quality & safety issues"}
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
                    <button className="k-btn-plain text-[11px] text-muted" onClick={() => setExtra(EMPTY_FILTERS)}>Reset</button>
                  </div>
                  <FilterField label="Priority">
                    <select className="k-input" value={extra.priority} onChange={(e) => setExtra((f) => ({ ...f, priority: e.target.value as NcrPriority | "any" }))}>
                      <option value="any">Any</option>
                      <option value="critical">Critical</option>
                      <option value="major">Major</option>
                      <option value="minor">Minor</option>
                    </select>
                  </FilterField>
                  <FilterField label="Source">
                    <select className="k-input" value={extra.source} onChange={(e) => setExtra((f) => ({ ...f, source: e.target.value as NcrSource | "any" }))}>
                      <option value="any">Any</option>
                      {uniqueSources.map((s) => (
                        <option key={s} value={s}>{titleCase(s)}</option>
                      ))}
                    </select>
                  </FilterField>
                  <FilterField label="Owner">
                    <select className="k-input" value={extra.owner} onChange={(e) => setExtra((f) => ({ ...f, owner: e.target.value }))}>
                      <option value="any">Any</option>
                      {uniqueOwners.map((id) => (
                        <option key={id} value={id}>{lookup.nameOf(id)}</option>
                      ))}
                    </select>
                  </FilterField>
                </div>
              )}
            </div>
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
          <input className="k-input" placeholder="Search NCRs…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 34 }} />
        </div>
        {view === "list" && <Segmented options={STATUS_TABS} value={status} onChange={setStatus} ariaLabel="Filter by status" />}
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
            title={search !== "" || activeFilterCount > 0 || status !== "all" ? "No matching NCRs" : "No NCRs yet"}
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
                <th style={{ width: 130 }}>ID</th>
                <th>Title</th>
                <th style={{ width: 110 }}>Source</th>
                <th style={{ width: 90 }}>Priority</th>
                <th style={{ width: 120 }}>Status</th>
                <th style={{ width: 130 }}>Owner</th>
                <th style={{ width: 90 }}>Due</th>
                <th style={{ width: 90 }}>SLA</th>
                <th style={{ width: 90 }}>Linked 8D</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => (
                <tr key={n.id} className="cursor-pointer" onClick={() => router.push(`/ncrs/${n.id}`)}>
                  <td>
                    <span className="mono text-[12px] font-semibold" style={{ color: "var(--accent)" }}>{n.code}</span>
                  </td>
                  <td className="max-w-[380px] font-medium">
                    <div className="truncate" title={n.title}>{n.title}</div>
                  </td>
                  <td className="text-[12px] capitalize text-muted">{titleCase(n.source)}</td>
                  <td><PriorityBadge priority={n.priority} /></td>
                  <td><StatusBadge status={n.status} /></td>
                  <td><MemberCell userId={n.ownerId} meId={me?.userId} firstNameOnly emptyLabel="—" /></td>
                  <td className="whitespace-nowrap text-[12px] text-muted">{shortDate(n.dueAt)}</td>
                  <td><SlaIndicator state={n.slaState} /></td>
                  <td>
                    {n.eightDId ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/8d/${n.eightDId}`); }}
                        className="mono inline-flex items-center gap-1 text-[11px] font-semibold"
                        style={{ color: "var(--accent)" }}
                      >
                        <Link2 size={11} />8D
                      </button>
                    ) : (
                      <span className="text-subtle">—</span>
                    )}
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
          Showing the first {rows.length}. Pagination &amp; virtualization land with the shared table.
        </p>
      )}

      <NcrCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <span className="k-overline">{label}</span>
      {children}
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

function exportCsv(rows: NcrDto[]): void {
  const header = ["Code", "Title", "Source", "Priority", "Status", "Due", "SLA", "Linked 8D"];
  const esc = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const body = rows.map((n) =>
    [n.code, n.title, n.source, n.priority, n.status, n.dueAt ?? "", n.slaState, n.eightDId ?? ""].map((v) => esc(String(v))).join(","),
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
