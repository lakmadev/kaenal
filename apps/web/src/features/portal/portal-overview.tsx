"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, FileWarning } from "lucide-react";
import { shortDate } from "@/lib/format";
import { EmptyState, Skeleton } from "@/components/ui";
import { usePortalIdentity, usePortalScars, usePortalPpapList } from "@/hooks/use-portal";
import { DSteps, PortalScarStatus, PortalSeverity, TEAL, TEAL_DARK } from "./portal-bits";

const ACTIVE_SCAR = new Set(["draft", "open", "responded"]);

export function PortalOverview(): React.ReactElement {
  const router = useRouter();
  const { data: identity } = usePortalIdentity();
  const scars = usePortalScars();
  const ppap = usePortalPpapList();

  const scarItems = useMemo(() => scars.data?.items ?? [], [scars.data]);
  const ppapItems = useMemo(() => ppap.data?.items ?? [], [ppap.data]);

  const openScars = scarItems.filter((s) => ACTIVE_SCAR.has(s.status));
  const overdue = scarItems.filter((s) => s.overdue).length;
  const ppapInReview = ppapItems.filter((p) => p.status === "in_review" || p.status === "pending").length;
  const needsAck = openScars.filter((s) => !s.supplierAcknowledged).length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 p-6">
      {/* Welcome banner */}
      <div
        className="flex items-center gap-5 rounded-xl p-5 text-white"
        style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})` }}
      >
        <div className="flex-1">
          <div className="mb-1 text-[12px] font-medium uppercase" style={{ opacity: 0.85 }}>
            Welcome back
          </div>
          <div className="mb-1.5 text-[22px] font-bold tracking-tight">
            {identity?.supplierName ?? "Your dashboard"}
          </div>
          <div className="text-[13px]" style={{ opacity: 0.9 }}>
            {openScars.length > 0
              ? `${openScars.length} corrective action${openScars.length === 1 ? "" : "s"} need your attention${overdue > 0 ? `, ${overdue} overdue` : ""}.`
              : "No open corrective actions — you're all caught up."}
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <Kpi label="Open corrective actions" value={String(openScars.length)} sub={`${needsAck} awaiting your acknowledgement`} color="#b45309" />
        <Kpi label="Overdue" value={String(overdue)} sub="past the response date" color="#dc2626" />
        <Kpi label="PPAP in review" value={String(ppapInReview)} sub="submissions with the customer" color={TEAL} />
        <Kpi label="Total SCARs" value={String(scarItems.length)} sub="all time" />
      </div>

      {/* Recent corrective actions */}
      <div className="rounded-xl border" style={{ background: "#fff", borderColor: "#e2e8f0" }}>
        <div className="flex items-center justify-between border-b px-4 py-3.5" style={{ borderColor: "#e2e8f0" }}>
          <div className="text-[14px] font-semibold">Your corrective actions</div>
          <Link href="/portal/scars" className="text-[12px] font-semibold" style={{ color: TEAL_DARK }}>
            View all →
          </Link>
        </div>
        {scars.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : openScars.length === 0 ? (
          <EmptyState icon={FileWarning} title="Nothing open" body="Corrective actions raised against you will appear here." />
        ) : (
          <div>
            {openScars.slice(0, 5).map((s) => (
              <button
                key={s.id}
                onClick={() => router.push(`/portal/scars/${s.id}`)}
                className="flex w-full items-center gap-4 border-b px-4 py-3 text-left last:border-b-0 hover:bg-[color:var(--bg-subtle)]"
                style={{ borderColor: "#e2e8f0" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{s.title ?? s.code}</div>
                  <div className="mono text-[11px] text-muted">
                    {s.code} · due {shortDate(s.dueDate)}
                    {s.overdue ? " · overdue" : ""}
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
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }): React.ReactElement {
  return (
    <div className="rounded-xl border p-3.5" style={{ background: "#fff", borderColor: "#e2e8f0" }}>
      <div className="text-[10.5px] font-semibold uppercase text-muted">{label}</div>
      <div className="text-[24px] font-bold" style={{ color: color ?? "var(--text)" }}>
        {value}
      </div>
      <div className="text-[10.5px] text-muted">{sub}</div>
    </div>
  );
}
