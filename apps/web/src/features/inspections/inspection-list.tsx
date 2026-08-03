"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { List, LayoutGrid, Plus, Download, Search, Filter, TriangleAlert, Calendar, ClipboardCheck } from "lucide-react";
import type { InspectionDto, InspectionStatus, RiskLevel } from "@kaenal/types";
import { shortDate } from "@/lib/format";
import { useMe } from "@/hooks/use-me";
import { useInspections } from "@/hooks/use-inspections";
import { useMemberLookup } from "@/hooks/use-members";
import { PageHeader } from "@/components/page-header";
import { MemberCell } from "@/components/member-cell";
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

interface ExtraFilters {
  risk: RiskLevel | "any";
  template: string; // template name, or the "any" sentinel
  inspector: string; // inspector-id, or the "any" sentinel
}
const EMPTY_FILTERS: ExtraFilters = { risk: "any", template: "any", inspector: "any" };

/** Findings = failed checklist items (a real metric off the persisted responses). */
function findingsCount(i: InspectionDto): number {
  return Object.values(i.responses).filter((v) => v === "fail").length;
}

export function InspectionList(): React.ReactElement {
  const router = useRouter();
  const { data: me } = useMe();
  const lookup = useMemberLookup();
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

  const query = useInspections(status !== "all" ? { status } : undefined);
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  const uniqueTemplates = useMemo(
    () => [...new Map(items.filter((i) => i.templateName).map((i) => [i.templateName!, true])).keys()],
    [items],
  );
  const uniqueInspectors = useMemo(() => [...new Set(items.map((i) => i.inspectorId).filter((x): x is string => x != null))], [items]);
  const activeFilterCount = (extra.risk !== "any" ? 1 : 0) + (extra.template !== "any" ? 1 : 0) + (extra.inspector !== "any" ? 1 : 0);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        (extra.risk === "any" || i.risk === extra.risk) &&
        (extra.template === "any" || i.templateName === extra.template) &&
        (extra.inspector === "any" || i.inspectorId === extra.inspector) &&
        (q === "" || i.title.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)),
    );
  }, [items, search, extra]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <PageHeader
        title="Inspections"
        description="Manage audits, process checks, and safety walks"
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
                  <FilterField label="Risk">
                    <select className="k-input" value={extra.risk} onChange={(e) => setExtra((f) => ({ ...f, risk: e.target.value as RiskLevel | "any" }))}>
                      <option value="any">Any</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </FilterField>
                  <FilterField label="Template">
                    <select className="k-input" value={extra.template} onChange={(e) => setExtra((f) => ({ ...f, template: e.target.value }))}>
                      <option value="any">Any</option>
                      {uniqueTemplates.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </FilterField>
                  <FilterField label="Inspector">
                    <select className="k-input" value={extra.inspector} onChange={(e) => setExtra((f) => ({ ...f, inspector: e.target.value }))}>
                      <option value="any">Any</option>
                      {uniqueInspectors.map((id) => (
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
            title={search !== "" || activeFilterCount > 0 || status !== "all" ? "No matching inspections" : "No inspections yet"}
            body="Schedule an inspection from a published template."
            action={<Button variant="primary" onClick={() => setCreateOpen(true)}><Plus size={14} /> New Inspection</Button>}
          />
        </div>
      ) : view === "list" ? (
        <div className="k-surface overflow-x-auto p-0">
          <table className="k-table">
            <thead>
              <tr>
                <th style={{ width: 130 }}>ID</th>
                <th>Title</th>
                <th style={{ width: 160 }}>Template</th>
                <th style={{ width: 140 }}>Inspector</th>
                <th style={{ width: 120 }}>Status</th>
                <th style={{ width: 90 }}>Risk</th>
                <th style={{ width: 80 }}>Findings</th>
                <th style={{ width: 100 }}>Scheduled</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const findings = findingsCount(i);
                return (
                  <tr key={i.id} className="cursor-pointer" onClick={() => router.push(`/inspections/${i.id}`)}>
                    <td>
                      <span className="mono text-[12px] font-semibold" style={{ color: "var(--accent)" }}>{i.code}</span>
                    </td>
                    <td className="max-w-[360px] font-medium">
                      <div className="truncate" title={i.title}>{i.title}</div>
                    </td>
                    <td className="text-[12px] text-muted">{i.templateName ?? "—"}</td>
                    <td><MemberCell userId={i.inspectorId} meId={me?.userId} firstNameOnly /></td>
                    <td><StatusBadge status={i.status} /></td>
                    <td><RiskBadge risk={i.risk} /></td>
                    <td>
                      {findings > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: findings >= 3 ? "var(--danger-600)" : "var(--warning-600)" }}>
                          <TriangleAlert size={12} />{findings}
                        </span>
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-[12px] text-muted">{shortDate(i.scheduledAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {rows.map((i) => {
            const findings = findingsCount(i);
            return (
              <button key={i.id} onClick={() => router.push(`/inspections/${i.id}`)} className="k-surface flex flex-col gap-2.5 p-4 text-left">
                <div className="flex items-start justify-between gap-2">
                  <span className="mono text-[11px] font-semibold" style={{ color: "var(--accent)" }}>{i.code}</span>
                  <StatusBadge status={i.status} />
                </div>
                <div className="min-h-[38px] text-[14px] font-semibold leading-snug">{i.title}</div>
                <div className="text-[11.5px] text-muted">{i.templateName ?? "—"}</div>
                <div className="flex items-center gap-1.5 text-[12px]">
                  <MemberCell userId={i.inspectorId} meId={me?.userId} size={20} />
                </div>
                <div className="my-0.5 h-px bg-border" />
                <div className="flex items-center justify-between text-[11.5px]">
                  <RiskBadge risk={i.risk} />
                  {findings > 0 ? (
                    <span className="inline-flex items-center gap-1 font-semibold" style={{ color: findings >= 3 ? "var(--danger-600)" : "var(--warning-600)" }}>
                      <TriangleAlert size={12} />{findings} findings
                    </span>
                  ) : (
                    <span className="text-subtle">No findings</span>
                  )}
                  <span className="inline-flex items-center gap-1 text-muted">
                    <Calendar size={11} />{shortDate(i.scheduledAt)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between text-[12px] text-muted">
        <span>Showing {rows.length} of {items.length} inspections</span>
      </div>

      <InspectionCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
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

function exportCsv(rows: InspectionDto[]): void {
  const header = ["Code", "Title", "Template", "Status", "Risk", "Findings", "Scheduled", "Score"];
  const esc = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const body = rows.map((i) =>
    [i.code, i.title, i.templateName ?? "", i.status, i.risk ?? "", String(findingsCount(i)), i.scheduledAt ?? "", i.score ?? ""].map((v) => esc(String(v))).join(","),
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
