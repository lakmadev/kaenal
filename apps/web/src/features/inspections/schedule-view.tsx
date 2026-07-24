"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Repeat, ClipboardCheck } from "lucide-react";
import type { InspectionDto } from "@kaenal/types";
import { useInspections } from "@/hooks/use-inspections";
import { PageHeader } from "@/components/page-header";
import { Chip, EmptyState, RiskBadge, Skeleton } from "@/components/ui";

/**
 * Inspection schedule (04 §5) — an agenda of upcoming scheduled inspections,
 * grouped by day, with recurring series and generated occurrences marked. The
 * recurrence rule that drives them lives on the series head (`recurrence`); the
 * `schedule` job materialises occurrences (06). A month/week calendar grid is a
 * later refinement; this is the functional list against the real data.
 */
export function ScheduleView(): React.ReactElement {
  const router = useRouter();
  const query = useInspections({ status: "scheduled" });

  const groups = useMemo(() => {
    const items = [...(query.data?.items ?? [])].sort(
      (a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""),
    );
    const byDay = new Map<string, InspectionDto[]>();
    for (const i of items) {
      const day = i.scheduledAt !== null ? i.scheduledAt.slice(0, 10) : "Unscheduled";
      const list = byDay.get(day) ?? [];
      list.push(i);
      byDay.set(day, list);
    }
    return [...byDay.entries()];
  }, [query.data]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <PageHeader title="Inspection Schedule" description="Upcoming and recurring inspections." />

      {query.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="k-surface">
          <EmptyState icon={CalendarClock} title="Couldn't load the schedule" />
        </div>
      ) : groups.length === 0 ? (
        <div className="k-surface">
          <EmptyState icon={CalendarClock} title="Nothing scheduled" body="Scheduled inspections will appear here as an agenda." />
        </div>
      ) : (
        groups.map(([day, items]) => (
          <div key={day} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-1">
              <CalendarClock size={14} className="text-muted" />
              <span className="text-[13px] font-semibold">{formatDay(day)}</span>
              <span className="text-[12px] text-muted">
                {items.length} inspection{items.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="k-surface overflow-hidden p-0">
              {items.map((i, idx) => (
                <button
                  key={i.id}
                  onClick={() => router.push(`/inspections/${i.id}`)}
                  className={`flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-bg-subtle ${idx > 0 ? "border-t border-border" : ""}`}
                >
                  <ClipboardCheck size={16} className="shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="mono text-[11px] font-semibold" style={{ color: "var(--accent)" }}>{i.code}</span>
                      {i.recurrence !== null && (
                        <Chip bg="var(--accent-soft)" fg="var(--accent)">
                          <Repeat size={11} /> Recurring
                        </Chip>
                      )}
                      {i.seriesId !== null && (
                        <Chip bg="var(--bg-subtle)" fg="var(--text-muted)">
                          Occurrence
                        </Chip>
                      )}
                    </div>
                    <div className="truncate text-[13px] font-medium">{i.title}</div>
                  </div>
                  <RiskBadge risk={i.risk} />
                  <span className="mono whitespace-nowrap text-[12px] text-muted">
                    {i.scheduledAt !== null ? new Date(i.scheduledAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function formatDay(day: string): string {
  if (day === "Unscheduled") return "Unscheduled";
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
