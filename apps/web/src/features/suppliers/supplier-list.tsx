"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Truck, LayoutList, Trophy, Grid3x3, ChevronRight } from "lucide-react";
import type { SupplierDto } from "@kaenal/types";
import { useMe, hasCapability } from "@/hooks/use-me";
import { useSuppliers } from "@/hooks/use-suppliers";
import { PageHeader } from "@/components/page-header";
import { Button, Segmented, EmptyState, Skeleton, Chip } from "@/components/ui";
import {
  RiskTierBadge,
  SupplierLogo,
  KpiCell,
  FlagChip,
  tierOf,
  profileNum,
  type SupplierTier,
} from "./suppliers-bits";
import { SupplierScorecardsView } from "./supplier-scorecards";
import { SupplierRiskMatrix } from "./supplier-risk-matrix";
import { SupplierCreateDialog } from "./supplier-create-dialog";

type View = "list" | "scorecards" | "matrix";
type Tab = "all" | SupplierTier | "flagged";
type Sort = "score" | "risk" | "ppm" | "name";

const VIEWS = [
  { value: "list" as const, label: "List", icon: LayoutList },
  { value: "scorecards" as const, label: "Scorecards", icon: Trophy },
  { value: "matrix" as const, label: "Risk matrix", icon: Grid3x3 },
];

const SORTS = [
  { value: "score" as const, label: "Score" },
  { value: "risk" as const, label: "Risk" },
  { value: "ppm" as const, label: "PPM" },
  { value: "name" as const, label: "Name" },
];

/** Flags other than the two "good" badges count a supplier as flagged. */
function isFlagged(s: SupplierDto): boolean {
  return s.flags.some((f) => f !== "preferred" && f !== "benchmark");
}

export function SupplierList(): React.ReactElement {
  const router = useRouter();
  const { data: me } = useMe();
  const canManage = hasCapability(me, "supplier:manage");

  const [view, setView] = useState<View>("list");
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("score");
  const [createOpen, setCreateOpen] = useState(false);

  const query = useSuppliers();
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  const counts = useMemo(() => {
    const c: Record<SupplierTier, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const s of items) c[tierOf(s.riskTier)]++;
    return c;
  }, [items]);

  const flaggedCount = useMemo(() => items.filter(isFlagged).length, [items]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = items.filter((s) => {
      if (tab === "flagged") return isFlagged(s);
      if (tab !== "all" && tierOf(s.riskTier) !== tab) return false;
      if (q === "") return true;
      return `${s.name} ${s.code} ${s.category ?? ""} ${s.country ?? ""}`.toLowerCase().includes(q);
    });
    return [...filtered].sort((a, b) => {
      if (sort === "score") return (b.score ?? -1) - (a.score ?? -1);
      if (sort === "risk") return tierOf(a.riskTier).localeCompare(tierOf(b.riskTier));
      if (sort === "ppm") return (a.scorecard.ppm ?? Infinity) - (b.scorecard.ppm ?? Infinity);
      return a.name.localeCompare(b.name);
    });
  }, [items, tab, search, sort]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "all", label: `All (${items.length})` },
    { id: "A", label: `Preferred (${counts.A})` },
    { id: "B", label: `Approved (${counts.B})` },
    { id: "C", label: `Conditional (${counts.C})` },
    { id: "D", label: `Critical (${counts.D})` },
    { id: "flagged", label: `Flagged (${flaggedCount})` },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <PageHeader
        title="Suppliers"
        description="Supplier quality — scorecards, risk tiers, and the hub every PPAP, SCAR, complaint, and audit links to."
        actions={
          canManage ? (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> New supplier
            </Button>
          ) : undefined
        }
      />

      <KpiStrip items={items} criticalCount={counts.D} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented options={VIEWS} value={view} onChange={setView} ariaLabel="Supplier view" />
        {view === "list" && (
          <div className="inline-flex items-center gap-2">
            <span className="text-[11.5px] text-muted">Sort by</span>
            <Segmented size="sm" options={SORTS} value={sort} onChange={setSort} ariaLabel="Sort suppliers" />
          </div>
        )}
      </div>

      {view === "scorecards" ? (
        <SupplierScorecardsView />
      ) : view === "matrix" ? (
        query.isLoading ? (
          <Skeleton className="h-[440px]" />
        ) : (
          <SupplierRiskMatrix suppliers={items} />
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative max-w-[320px] flex-1">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
              <input
                className="k-input"
                placeholder="Search by name, code, country…"
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
            <ListSkeleton />
          ) : query.isError ? (
            <div className="k-surface">
              <EmptyState
                icon={Truck}
                title="Couldn't load suppliers"
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
                icon={Truck}
                title={search !== "" || tab !== "all" ? "No matching suppliers" : "No suppliers yet"}
                body="Onboard a supplier to start tracking its quality performance."
                action={
                  canManage ? (
                    <Button variant="primary" onClick={() => setCreateOpen(true)}>
                      <Plus size={14} /> New supplier
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
                    <th>Supplier</th>
                    <th style={{ width: 150 }}>Tier / Risk</th>
                    <th style={{ width: 110 }}>PPM</th>
                    <th style={{ width: 110 }}>OTD %</th>
                    <th style={{ width: 80 }}>OQE</th>
                    <th style={{ width: 80 }}>Score</th>
                    <th style={{ width: 140 }}>Flags</th>
                    <th style={{ width: 28 }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} className="cursor-pointer" onClick={() => router.push(`/suppliers/${s.id}`)}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <SupplierLogo name={s.name} code={s.code} profile={s.profile} size={32} />
                          <div>
                            <div className="text-[13px] font-semibold">{s.name}</div>
                            <div className="text-[10.5px] text-muted">
                              <span className="mono">{s.code}</span>
                              {s.country !== null && ` · ${s.country}`}
                              {s.category !== null && ` · ${s.category}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col items-start gap-1">
                          {s.tier !== null && (
                            <Chip bg="var(--bg-subtle)" style={{ fontSize: 10.5 }}>
                              Tier {s.tier}
                            </Chip>
                          )}
                          <RiskTierBadge riskTier={s.riskTier} />
                        </div>
                      </td>
                      <td>
                        <KpiCell
                          value={s.scorecard.ppm}
                          target={s.scorecard.ppmTarget}
                          lowerIsBetter
                          spark={s.scorecard.ppmTrend}
                          mini
                        />
                      </td>
                      <td>
                        <KpiCell
                          value={s.scorecard.otd}
                          target={s.scorecard.otdTarget}
                          suffix="%"
                          spark={s.scorecard.otdTrend}
                          mini
                        />
                      </td>
                      <td>
                        <KpiCell value={s.scorecard.oqe} target={s.scorecard.oqeTarget} mini />
                      </td>
                      <td>
                        {s.score === null ? (
                          <span className="text-subtle">—</span>
                        ) : (
                          <span className="mono text-[13px] font-bold">{s.score}</span>
                        )}
                      </td>
                      <td>
                        {isFlagged(s) ? (
                          <div className="flex flex-wrap gap-1">
                            {s.flags.slice(0, 2).map((f) => (
                              <FlagChip key={f} flag={f} />
                            ))}
                          </div>
                        ) : (
                          <span className="text-subtle">—</span>
                        )}
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

          {query.data?.nextCursor != null && (
            <p className="text-center text-[12px] text-subtle">
              Showing the first {rows.length}. Pagination lands with the shared table.
            </p>
          )}
        </>
      )}

      <SupplierCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}


function KpiStrip({ items, criticalCount }: { items: SupplierDto[]; criticalCount: number }): React.ReactElement {
  const activeCount = items.filter((s) => s.status === "active").length;
  const ppms = items.map((s) => s.scorecard.ppm).filter((v): v is number => v != null);
  const avgPpm = ppms.length > 0 ? Math.round(ppms.reduce((a, b) => a + b, 0) / ppms.length) : null;
  const spend = items.reduce((sum, s) => sum + (profileNum(s.profile, "spendYtd") ?? 0), 0);
  const chargebacks = items.reduce((sum, s) => sum + (profileNum(s.profile, "chargebacksYtd") ?? 0), 0);

  const cards: { label: string; value: string; sub: string; color?: string }[] = [
    { label: "Active suppliers", value: String(activeCount), sub: `${items.length} total` },
    { label: "YTD spend", value: spend > 0 ? `$${(spend / 1_000_000).toFixed(1)}M` : "—", sub: "from profiles" },
    { label: "Average PPM", value: avgPpm === null ? "—" : String(avgPpm), sub: "target ≤ 75", color: "#b45309" },
    { label: "Critical-tier", value: String(criticalCount), sub: "risk tier D", color: "#b91c1c" },
    {
      label: "Chargebacks YTD",
      value: chargebacks > 0 ? `$${(chargebacks / 1000).toFixed(0)}k` : "—",
      sub: "from profiles",
      color: "#6d28d9",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((k) => (
        <div key={k.label} className="k-surface p-3">
          <div className="text-[10.5px] font-semibold uppercase text-muted">{k.label}</div>
          <div className="text-[22px] font-bold" style={{ color: k.color ?? "var(--text)" }}>
            {k.value}
          </div>
          <div className="text-[10.5px] text-muted">{k.sub}</div>
        </div>
      ))}
    </div>
  );
}

function ListSkeleton(): React.ReactElement {
  return (
    <div className="k-surface flex flex-col gap-2 p-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  );
}
