"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, FileWarning } from "lucide-react";
import { shortDate } from "@/lib/format";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { usePortalScars } from "@/hooks/use-portal";
import { DSteps, PortalScarStatus, PortalSeverity } from "./portal-bits";

type Tab = "open" | "closed" | "all";
const ACTIVE = new Set(["draft", "open", "responded"]);

export function PortalScarList(): React.ReactElement {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("open");
  const query = usePortalScars();
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  const rows = useMemo(() => {
    if (tab === "open") return items.filter((s) => ACTIVE.has(s.status));
    if (tab === "closed") return items.filter((s) => !ACTIVE.has(s.status));
    return items;
  }, [items, tab]);

  const counts = {
    open: items.filter((s) => ACTIVE.has(s.status)).length,
    closed: items.filter((s) => !ACTIVE.has(s.status)).length,
    all: items.length,
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "open", label: `Open (${counts.open})` },
    { id: "closed", label: `Closed (${counts.closed})` },
    { id: "all", label: `All (${counts.all})` },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <div>
        <h1 className="text-[20px] font-bold tracking-tight">Corrective actions</h1>
        <p className="text-[13px] text-muted">Respond within the SLA to keep your scorecard intact.</p>
      </div>

      <div className="k-tabs">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`k-tab ${tab === t.id ? "active" : ""}`}>
            {t.label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <div className="flex flex-col gap-2 rounded-xl border p-4" style={{ background: "#fff", borderColor: "#e2e8f0" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="rounded-xl border" style={{ background: "#fff", borderColor: "#e2e8f0" }}>
          <EmptyState
            icon={FileWarning}
            title="Couldn't load your corrective actions"
            body="Something went wrong."
            action={
              <Button variant="primary" onClick={() => void query.refetch()}>
                Retry
              </Button>
            }
          />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border" style={{ background: "#fff", borderColor: "#e2e8f0" }}>
          <EmptyState icon={FileWarning} title="Nothing here" body="Corrective actions raised against you will appear here." />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border" style={{ background: "#fff", borderColor: "#e2e8f0" }}>
          {rows.map((s) => (
            <button
              key={s.id}
              onClick={() => router.push(`/portal/scars/${s.id}`)}
              className="flex w-full items-center gap-4 border-b px-4 py-3 text-left last:border-b-0 hover:bg-[color:var(--bg-subtle)]"
              style={{ borderColor: "#e2e8f0" }}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{s.title ?? s.code}</div>
                <div className="mono text-[11px] text-muted">
                  {s.code} · raised {shortDate(s.raisedDate)} · due{" "}
                  <span style={{ color: s.overdue ? "#dc2626" : "inherit" }}>{shortDate(s.dueDate)}</span>
                </div>
              </div>
              <DSteps current={s.currentD} />
              <PortalSeverity severity={s.severity} />
              <PortalScarStatus status={s.status} />
              <ChevronRight size={15} className="text-subtle" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
