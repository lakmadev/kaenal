"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, Search } from "lucide-react";
import type { ScarDto } from "@kaenal/types";
import { shortDate } from "@/lib/format";
import { useMe, hasCapability } from "@/hooks/use-me";
import { useScarList } from "@/hooks/use-scar";
import { PageHeader } from "@/components/page-header";
import { Button, Card, EmptyState, Skeleton } from "@/components/ui";
import { ChargebackBadge, DSteps, SeverityChip, formatMoney } from "./scar-bits";
import { ScarCreateDialog } from "./scar-create-dialog";

type Tab = "active" | "overdue" | "closed" | "chargebacks";

const ACTIVE = new Set(["draft", "open", "responded"]);

export function ScarList(): React.ReactElement {
  const router = useRouter();
  const { data: me } = useMe();
  const canManage = hasCapability(me, "scar:manage");

  const [tab, setTab] = useState<Tab>("active");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const query = useScarList();
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  const counts = useMemo(() => {
    const active = items.filter((s) => ACTIVE.has(s.status));
    const closed = items.filter((s) => s.status === "closed");
    const overdue = items.filter((s) => s.overdue);
    const totalCharge = items.reduce((sum, s) => sum + (s.chargeback.amount ?? 0), 0);
    const pendingCharge = items
      .filter((s) => s.chargeback.status === "pending")
      .reduce((sum, s) => sum + (s.chargeback.amount ?? 0), 0);
    const closedDays = closed.map((s) => s.daysOpen).filter((d): d is number => d !== null);
    const avgClosure = closedDays.length > 0 ? Math.round(closedDays.reduce((a, b) => a + b, 0) / closedDays.length) : null;
    return {
      active: active.length,
      closed: closed.length,
      overdue: overdue.length,
      total: items.length,
      totalCharge,
      pendingCharge,
      avgClosure,
    };
  }, [items]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((s) => {
      if (tab === "active" && !ACTIVE.has(s.status)) return false;
      if (tab === "overdue" && !s.overdue) return false;
      if (tab === "closed" && s.status !== "closed") return false;
      if (q === "") return true;
      return `${s.title ?? ""} ${s.code} ${s.supplierName ?? ""}`.toLowerCase().includes(q);
    });
  }, [items, tab, search]);

  const chargebackRows = useMemo(() => items.filter((s) => s.chargeback.status !== null), [items]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "active", label: `Active (${counts.active})` },
    { id: "overdue", label: `Overdue (${counts.overdue})` },
    { id: "closed", label: `Closed (${counts.closed})` },
    { id: "chargebacks", label: "Chargebacks" },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <PageHeader
        title="SCAR & chargebacks"
        description="Supplier Corrective Action Requests — 8D-style problem solving with the supplier, with cost recovery."
        actions={
          canManage ? (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <AlertTriangle size={14} /> Raise SCAR
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Kpi label="Active SCARs" value={String(counts.active)} sub={`${counts.overdue} overdue`} color="#b45309" />
        <Kpi
          label="Chargebacks YTD"
          value={formatMoney(counts.totalCharge)}
          sub={`across ${counts.total} SCARs`}
          color="#7c3aed"
        />
        <Kpi
          label="Pending recovery"
          value={formatMoney(counts.pendingCharge)}
          sub="debit not yet issued"
          color="#b91c1c"
        />
        <Kpi
          label="Avg closure time"
          value={counts.avgClosure !== null ? `${counts.avgClosure}d` : "—"}
          sub="closed SCARs"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative max-w-[320px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <input
            className="k-input"
            placeholder="Search issue, SCAR, supplier…"
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
        {tab !== "chargebacks" && (
          <span className="ml-auto text-[12px] text-muted">
            {rows.length} of {items.length}
          </span>
        )}
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
            icon={AlertTriangle}
            title="Couldn't load SCARs"
            body="Something went wrong fetching the list."
            action={
              <Button variant="primary" onClick={() => void query.refetch()}>
                Retry
              </Button>
            }
          />
        </div>
      ) : tab === "chargebacks" ? (
        <ChargebackLedger rows={chargebackRows} onOpen={(id) => router.push(`/scars/${id}`)} />
      ) : rows.length === 0 ? (
        <div className="k-surface">
          <EmptyState
            icon={AlertTriangle}
            title={search !== "" || tab !== "active" ? "No matching SCARs" : "No active SCARs"}
            body="Raise a SCAR against a supplier to drive an 8D-style corrective action with cost recovery."
            action={
              canManage ? (
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  <AlertTriangle size={14} /> Raise SCAR
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
                <th style={{ width: 130 }}>SCAR</th>
                <th style={{ width: 150 }}>Supplier</th>
                <th>Issue</th>
                <th style={{ width: 150 }}>8D progress</th>
                <th style={{ width: 90 }}>Severity</th>
                <th style={{ width: 110 }}>Due</th>
                <th style={{ width: 120 }}>Chargeback</th>
                <th style={{ width: 28 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="cursor-pointer" onClick={() => router.push(`/scars/${s.id}`)}>
                  <td className="mono text-[11.5px] font-semibold" style={{ color: "var(--accent)" }}>
                    {s.code}
                  </td>
                  <td className="text-[12.5px] font-medium">{s.supplierName ?? "—"}</td>
                  <td>
                    <div className="text-[12.5px] font-medium">{s.title ?? "—"}</div>
                    <div className="text-[10.5px] text-muted">
                      {s.affectedLots !== null ? `${s.affectedLots} lots affected · ` : ""}
                      raised {shortDate(s.raisedDate)}
                    </div>
                  </td>
                  <td>
                    <DSteps current={s.currentD} />
                  </td>
                  <td>
                    <SeverityChip severity={s.severity} />
                  </td>
                  <td className="mono whitespace-nowrap text-[11.5px]" style={{ color: s.overdue ? "#dc2626" : "var(--text)" }}>
                    {shortDate(s.dueDate)}
                    <div className="text-[10px] text-muted">{s.daysOpen !== null ? `${s.daysOpen}d open` : ""}</div>
                  </td>
                  <td>
                    <div className="text-[12.5px] font-semibold tabular-nums">{formatMoney(s.chargeback.amount, s.chargeback.currency)}</div>
                    <div className="mt-0.5">
                      <ChargebackBadge status={s.chargeback.status} />
                    </div>
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

      <ScarCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

// (ScarStatusBadge is used on the detail view; the list uses the D-step stepper.)

function ChargebackLedger({ rows, onOpen }: { rows: ScarDto[]; onOpen: (id: string) => void }): React.ReactElement {
  if (rows.length === 0) {
    return (
      <div className="k-surface">
        <EmptyState icon={AlertTriangle} title="No chargebacks raised" body="Chargebacks appear here once a SCAR raises one." />
      </div>
    );
  }
  return (
    <Card className="p-0">
      <div className="border-b border-border p-4">
        <h3 className="text-[14px] font-semibold">Chargeback ledger</h3>
        <p className="text-[12px] text-muted">Cost recovery raised against suppliers — track pending → debit issued → recovered.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="k-table">
          <thead>
            <tr>
              <th style={{ width: 130 }}>SCAR</th>
              <th>Supplier</th>
              <th>Issue</th>
              <th style={{ width: 120 }}>Amount</th>
              <th style={{ width: 120 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="cursor-pointer" onClick={() => onOpen(s.id)}>
                <td className="mono text-[11.5px] font-semibold" style={{ color: "var(--accent)" }}>
                  {s.code}
                </td>
                <td className="text-[12.5px] font-medium">{s.supplierName ?? "—"}</td>
                <td className="text-[12px] text-muted">{s.title ?? "—"}</td>
                <td className="text-[13px] font-bold tabular-nums">{formatMoney(s.chargeback.amount, s.chargeback.currency)}</td>
                <td>
                  <ChargebackBadge status={s.chargeback.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }): React.ReactElement {
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
