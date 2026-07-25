"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Download, Search, Filter, ShieldCheck } from "lucide-react";
import type { CapaDto, CapaType } from "@kaenal/types";
import { shortDate, titleCase } from "@/lib/format";
import { useMe, hasCapability } from "@/hooks/use-me";
import { useCapas } from "@/hooks/use-capas";
import { PageHeader } from "@/components/page-header";
import { Button, Segmented, RiskBadge, EmptyState, Skeleton } from "@/components/ui";
import { CAPA_PHASES, phaseIndex, TypeChip, PhaseProgress, OwnerCell } from "./capa-bits";
import { CapaCreateDialog } from "./capa-create-dialog";

type Tab = "all" | "open" | "closed" | "mine";

const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "mine", label: "My CAPAs" },
];

export function CapaList(): React.ReactElement {
  const router = useRouter();
  const { data: me } = useMe();
  const canManage = hasCapability(me, "capa:manage");

  const [tab, setTab] = useState<Tab>("all");
  const [type, setType] = useState<CapaType | "any">("any");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // The list spans all seven phases and both source scopes, so we load one page
  // and narrow it client-side (mirrors the NCR module until virtualized paging).
  const query = useCapas();

  const rows = useMemo(() => {
    const items = query.data?.items ?? [];
    const q = search.trim().toLowerCase();
    return items.filter(
      (c) =>
        (tab !== "open" || c.status !== "closed") &&
        (tab !== "closed" || c.status === "closed") &&
        (tab !== "mine" || (me !== undefined && c.ownerId === me.userId)) &&
        (type === "any" || c.type === type) &&
        (q === "" || c.title.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)),
    );
  }, [query.data, search, tab, type, me]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <PageHeader
        title="CAPA"
        description="Corrective & Preventive Actions — root cause to effectiveness verification"
        actions={
          <>
            <Button onClick={() => exportCsv(rows)}>
              <Download size={14} /> Export
            </Button>
            {canManage && (
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                <Plus size={14} /> New CAPA
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative max-w-[320px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <input
            className="k-input"
            placeholder="Search CAPAs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 34 }}
          />
        </div>

        <Segmented options={TABS} value={tab} onChange={setTab} ariaLabel="Filter CAPAs" />

        <div className="inline-flex items-center gap-1.5">
          <Filter size={14} className="text-muted" />
          <select
            className="k-input"
            value={type}
            onChange={(e) => setType(e.target.value as CapaType | "any")}
            aria-label="Filter by type"
            style={{ width: 150 }}
          >
            <option value="any">All types</option>
            <option value="corrective">Corrective</option>
            <option value="preventive">Preventive</option>
          </select>
        </div>

        <span className="ml-auto text-[12px] text-muted">
          {rows.length} of {query.data?.items.length ?? 0}
        </span>
      </div>

      {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <ErrorCard onRetry={() => void query.refetch()} />
      ) : rows.length === 0 ? (
        <div className="k-surface">
          <EmptyState
            icon={ShieldCheck}
            title={search !== "" || type !== "any" || tab !== "all" ? "No matching CAPAs" : "No CAPAs yet"}
            body="Open a corrective or preventive action to start tracking it."
            action={
              canManage ? (
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  <Plus size={14} /> New CAPA
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
                <th style={{ width: 130 }}>ID / Type</th>
                <th>Title</th>
                <th style={{ width: 160 }}>Phase</th>
                <th style={{ width: 130 }}>Owner</th>
                <th style={{ width: 130 }}>Source</th>
                <th style={{ width: 90 }}>Due</th>
                <th style={{ width: 90 }}>Risk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="cursor-pointer" onClick={() => router.push(`/capa/${c.id}`)}>
                  <td>
                    <div className="mono text-[11.5px] font-semibold" style={{ color: "var(--accent)" }}>
                      {c.code}
                    </div>
                    <div className="mt-1">
                      <TypeChip type={c.type} />
                    </div>
                  </td>
                  <td className="max-w-[360px] font-medium">
                    <div className="truncate" title={c.title}>
                      {c.title}
                    </div>
                  </td>
                  <td>
                    <div className="text-[12px]">{CAPA_PHASES[phaseIndex(c.status)]?.label ?? titleCase(c.status)}</div>
                    <PhaseProgress phase={c.status} />
                  </td>
                  <td>
                    <OwnerCell ownerId={c.ownerId} meId={me?.userId} />
                  </td>
                  <td className="text-[12px] text-muted">
                    {c.sourceKind !== null ? (
                      <span className="capitalize">{titleCase(c.sourceKind)}</span>
                    ) : (
                      <span className="text-subtle">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-[12px] text-muted">{shortDate(c.dueAt)}</td>
                  <td>
                    <RiskBadge risk={c.risk} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {query.data?.nextCursor != null && (
        <p className="text-center text-[12px] text-subtle">
          Showing the first {rows.length}. Pagination & virtualization land with the shared table.
        </p>
      )}

      <CapaCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
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
        icon={ShieldCheck}
        title="Couldn't load CAPAs"
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

/** Client-side CSV of the filtered rows (the server-rendered, plant-scoped export
 *  pipeline is the reports module). */
function exportCsv(rows: CapaDto[]): void {
  const header = ["Code", "Title", "Type", "Phase", "Priority", "Risk", "Due"];
  const esc = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const body = rows.map((c) =>
    [c.code, c.title, c.type, c.status, c.priority, c.risk ?? "", c.dueAt ?? ""].map((v) => esc(String(v))).join(","),
  );
  const csv = [header.join(","), ...body].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `capas-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
