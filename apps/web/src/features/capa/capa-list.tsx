"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Download,
  Search,
  Filter,
  ShieldCheck,
  ClipboardList,
  AlertTriangle,
  Clock,
} from "lucide-react";
import type { CapaDto, CapaType } from "@kaenal/types";
import { shortDate, titleCase } from "@/lib/format";
import { useMe, hasCapability } from "@/hooks/use-me";
import { useMemberLookup } from "@/hooks/use-members";
import { useCapas } from "@/hooks/use-capas";
import { PageHeader } from "@/components/page-header";
import { Avatar } from "@/components/avatar";
import { Button, Segmented, Chip, RiskBadge, EmptyState, Skeleton } from "@/components/ui";
import { CAPA_PHASES, phaseIndex, TypeChip, PhaseProgress } from "./capa-bits";
import { CapaCreateDialog } from "./capa-create-dialog";

type Tab = "all" | "open" | "at_risk" | "closed" | "mine";

const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "at_risk", label: "At risk" },
  { value: "closed", label: "Closed" },
  { value: "mine", label: "My CAPAs" },
];

const DAY_MS = 86_400_000;

/** SLA state derived from the real due date (no server SLA field yet): overdue =
 *  past due, at-risk = due within 7 days. Closed / undated CAPAs are neutral. */
function slaState(c: CapaDto): "overdue" | "at_risk" | "none" {
  if (c.status === "closed" || c.dueAt === null) return "none";
  const delta = new Date(c.dueAt).getTime() - Date.now();
  if (delta < 0) return "overdue";
  if (delta <= 7 * DAY_MS) return "at_risk";
  return "none";
}

function daysOpen(createdAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / DAY_MS));
}

export function CapaList(): React.ReactElement {
  const router = useRouter();
  const { data: me } = useMe();
  const { nameOf } = useMemberLookup();
  const canManage = hasCapability(me, "capa:manage");

  const [tab, setTab] = useState<Tab>("all");
  const [type, setType] = useState<CapaType | "any">("any");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // The list spans all seven phases and both source scopes, so we load one page
  // and narrow it client-side (mirrors the NCR module until virtualized paging).
  const query = useCapas();
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  // KPIs are computed over the whole loaded set (not the active tab), matching
  // the design. All four are derived from real fields; see `stats` note below.
  const stats = useMemo(() => {
    const open = items.filter((c) => c.status !== "closed");
    const atRisk = open.filter((c) => slaState(c) !== "none").length;
    const inEff = items.filter((c) => c.status === "effectiveness").length;
    // The design's 4th card is "avg closure days" (hard-coded 38) — there's no
    // reliable closure timestamp on the DTO, so we surface a real, sound metric:
    // mean days the currently-open CAPAs have been open.
    const avgOpen =
      open.length === 0 ? 0 : Math.round(open.reduce((s, c) => s + daysOpen(c.createdAt), 0) / open.length);
    return { open: open.length, atRisk, inEff, avgOpen };
  }, [items]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (c) =>
        (tab !== "open" || c.status !== "closed") &&
        (tab !== "closed" || c.status === "closed") &&
        (tab !== "at_risk" || slaState(c) !== "none") &&
        (tab !== "mine" || (me !== undefined && c.ownerId === me.userId)) &&
        (type === "any" || c.type === type) &&
        (q === "" || c.title.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)),
    );
  }, [items, search, tab, type, me]);

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

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <KpiCard label="Open CAPAs" value={stats.open} icon={ClipboardList} color="#2563eb" loading={query.isLoading} />
        <KpiCard label="At risk / overdue" value={stats.atRisk} icon={AlertTriangle} color="#dc2626" loading={query.isLoading} />
        <KpiCard label="In effectiveness check" value={stats.inEff} icon={ShieldCheck} color="#9333ea" loading={query.isLoading} />
        <KpiCard label="Avg days open" value={stats.avgOpen} icon={Clock} color="#ea580c" loading={query.isLoading} />
      </div>

      {/* Trend */}
      <CapaTrendCard items={items} loading={query.isLoading} />

      {/* Filters */}
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
          {rows.length} of {items.length}
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
                <th style={{ width: 140 }}>Owner</th>
                <th style={{ width: 120 }}>Source</th>
                <th style={{ width: 120 }}>Due</th>
                <th style={{ width: 90 }}>Risk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const sla = slaState(c);
                return (
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
                      <div className="text-[12px]">
                        {CAPA_PHASES[phaseIndex(c.status)]?.label ?? titleCase(c.status)}
                      </div>
                      <PhaseProgress phase={c.status} />
                    </td>
                    <td>
                      <OwnerName ownerId={c.ownerId} meId={me?.userId} nameOf={nameOf} />
                    </td>
                    <td>
                      {c.sourceKind !== null ? (
                        <Chip bg="var(--bg-subtle)" fg="var(--text-muted)">
                          <span className="uppercase">
                            {c.sourceKind === "8d" ? "8D" : c.sourceKind.replace(/_/g, " ")}
                          </span>
                        </Chip>
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="text-[12px] text-muted">{shortDate(c.dueAt)}</div>
                      <SlaLine sla={sla} createdAt={c.createdAt} />
                    </td>
                    <td>
                      <RiskBadge risk={c.risk} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {query.data?.nextCursor != null && (
        <p className="text-center text-[12px] text-subtle">
          Showing the first {rows.length}. KPIs & trend reflect the loaded page; pagination lands with the shared table.
        </p>
      )}

      <CapaCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

/** One KPI tile — icon in a tinted square + label + value, per `capa.jsx`. */
function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  loading,
}: {
  label: string;
  value: number;
  icon: typeof ShieldCheck;
  color: string;
  loading: boolean;
}): React.ReactElement {
  return (
    <div className="k-surface flex items-center gap-3.5 p-4">
      <div
        className="flex shrink-0 items-center justify-center rounded-[10px]"
        style={{ width: 40, height: 40, background: `${color}18`, color }}
      >
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <div className="k-overline text-muted">{label}</div>
        {loading ? (
          <Skeleton className="mt-1 h-6 w-10" />
        ) : (
          <div className="text-[24px] font-bold leading-tight">{value}</div>
        )}
      </div>
    </div>
  );
}

const OPENED_COLOR = "var(--accent)";
const CLOSED_COLOR = "var(--success-600, #16a34a)";

/** Owner as avatar + first name via the real member directory; falls back to
 *  "You" / a neutral placeholder rather than a fabricated name. */
function OwnerName({
  ownerId,
  meId,
  nameOf,
}: {
  ownerId: string | null;
  meId: string | undefined;
  nameOf: (id: string | null | undefined) => string;
}): React.ReactElement {
  if (ownerId === null) return <span className="text-subtle">Unassigned</span>;
  const name = meId !== undefined && ownerId === meId ? "You" : nameOf(ownerId);
  const first = name.split(" ")[0] ?? name;
  return (
    <span className="inline-flex items-center gap-2 text-[12px]">
      <Avatar name={name} size={20} />
      <span className="truncate">{first}</span>
    </span>
  );
}

function SlaLine({ sla, createdAt }: { sla: "overdue" | "at_risk" | "none"; createdAt: string }): React.ReactElement {
  if (sla === "overdue") {
    return (
      <div className="flex items-center gap-1 text-[10.5px]" style={{ color: "var(--danger-600)" }}>
        <AlertTriangle size={10} /> overdue
      </div>
    );
  }
  if (sla === "at_risk") {
    return (
      <div className="flex items-center gap-1 text-[10.5px]" style={{ color: "var(--warning-600)" }}>
        <AlertTriangle size={10} /> at risk
      </div>
    );
  }
  return <div className="text-[10.5px] text-subtle">{daysOpen(createdAt)}d open</div>;
}

/**
 * "Opened vs closed — last 6 months" (capa.jsx `CapaTrendChart`). The design used
 * mock trend data; there is no CAPA metrics endpoint, so both series are derived
 * from the loaded CAPAs — `opened` from `createdAt`, and `closed` approximated by
 * the last-update month of CAPAs now in the closed phase. The caption states this
 * so the chart is never mistaken for a server-side aggregation (rule #9 + the
 * no-fabricated-data guardrail).
 */
function CapaTrendCard({ items, loading }: { items: CapaDto[]; loading: boolean }): React.ReactElement {
  const months = useMemo(() => {
    const base = new Date();
    base.setDate(1);
    const out: { key: string; label: string; opened: number; closed: number }[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      out.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleString("en-US", { month: "short" }),
        opened: 0,
        closed: 0,
      });
    }
    const idx = new Map(out.map((m, i) => [m.key, i]));
    const bump = (iso: string, field: "opened" | "closed"): void => {
      const d = new Date(iso);
      const i = idx.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (i !== undefined) out[i]![field] += 1;
    };
    for (const c of items) {
      bump(c.createdAt, "opened");
      if (c.status === "closed") bump(c.updatedAt, "closed");
    }
    return out;
  }, [items]);

  const max = Math.max(1, ...months.map((m) => Math.max(m.opened, m.closed)));
  const W = 720;
  const H = 160;
  const PAD = 24;
  const xStep = months.length > 1 ? (W - PAD * 2) / (months.length - 1) : 0;
  const y = (v: number): number => H - PAD - (v / max) * (H - PAD * 2);
  const pts = (field: "opened" | "closed"): string =>
    months.map((m, i) => `${PAD + i * xStep},${y(m[field])}`).join(" ");

  return (
    <div className="k-surface p-[18px]">
      <div className="mb-3.5 flex items-center justify-between">
        <h3 className="m-0 text-[14px] font-semibold">CAPA opened vs closed — last 6 months</h3>
        <div className="flex gap-3.5 text-[11px]">
          <LegendDot color={OPENED_COLOR} label="Opened" />
          <LegendDot color={CLOSED_COLOR} label="Closed" />
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-[160px] w-full" />
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-[160px] w-full" role="img" aria-label="CAPA opened vs closed trend">
          {[0.25, 0.5, 0.75, 1].map((t) => (
            <line
              key={t}
              x1={PAD}
              x2={W - PAD}
              y1={H - PAD - t * (H - PAD * 2)}
              y2={H - PAD - t * (H - PAD * 2)}
              stroke="var(--border)"
              strokeDasharray="2 4"
            />
          ))}
          <polyline fill="none" stroke={OPENED_COLOR} strokeWidth={2} points={pts("opened")} />
          <polyline fill="none" stroke={CLOSED_COLOR} strokeWidth={2} points={pts("closed")} />
          {months.map((m, i) => (
            <g key={m.key}>
              <circle cx={PAD + i * xStep} cy={y(m.opened)} r={3} fill={OPENED_COLOR} />
              <circle cx={PAD + i * xStep} cy={y(m.closed)} r={3} fill={CLOSED_COLOR} />
              <text x={PAD + i * xStep} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
                {m.label}
              </text>
            </g>
          ))}
        </svg>
      )}
      <p className="mt-2 text-[11px] text-subtle">
        Derived from the loaded CAPAs — “closed” is approximated by each CAPA&rsquo;s last-update month; a server-side
        metric replaces this once the CAPA analytics endpoint lands.
      </p>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block rounded-[2px]" style={{ width: 8, height: 8, background: color }} />
      {label}
    </span>
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
