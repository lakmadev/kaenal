"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Repeat, ClipboardCheck, CalendarClock } from "lucide-react";
import type { InspectionDto, InspectionStatus } from "@kaenal/types";
import { useInspections } from "@/hooks/use-inspections";
import { PageHeader } from "@/components/page-header";
import { Button, Chip, EmptyState, Segmented, Skeleton } from "@/components/ui";

type CalView = "month" | "week" | "list";

/**
 * Inspection schedule (04 §5) — a real calendar (month grid / week / list) over
 * scheduled inspections, matching `schedule.jsx`. Recurring series and their
 * generated occurrences (materialised by the `schedule` job, 06) are marked.
 * Audits share this calendar in the prototype, but that module isn't built yet,
 * so this is inspections-only; the fabricated iCal-sync feed is omitted too.
 */
export function ScheduleView(): React.ReactElement {
  const router = useRouter();
  const [view, setView] = useState<CalView>("month");
  const [cursor, setCursor] = useState<Date>(() => startOfToday());

  // The calendar needs every status (scheduled = blue, completed = green,
  // overdue = red), so it fetches unfiltered and keeps only dated inspections.
  const query = useInspections();
  const events = useMemo<CalEvent[]>(() => {
    return (query.data?.items ?? [])
      .filter((i): i is InspectionDto & { scheduledAt: string } => i.scheduledAt !== null)
      .map((i) => ({
        id: i.id,
        code: i.code,
        title: i.title,
        at: new Date(i.scheduledAt),
        dayKey: localKey(new Date(i.scheduledAt)),
        status: i.status,
        recurring: i.recurrence !== null,
        occurrence: i.seriesId !== null,
        color: eventColor(i.status, new Date(i.scheduledAt)),
      }))
      .sort((a, b) => a.at.getTime() - b.at.getTime());
  }, [query.data]);

  const open = (id: string): void => router.push(`/inspections/${id}`);

  const shift = (dir: -1 | 1): void =>
    setCursor((c) =>
      view === "month"
        ? new Date(c.getFullYear(), c.getMonth() + dir, 1)
        : addDays(c, dir * 7),
    );

  const label =
    view === "week"
      ? weekLabel(cursor)
      : cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <PageHeader title="Schedule" description="Upcoming and recurring inspections." />

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1.5">
          <Button size="sm" aria-label="Previous" onClick={() => shift(-1)}>
            <ChevronLeft size={15} />
          </Button>
          <Button size="sm" onClick={() => setCursor(startOfToday())}>
            Today
          </Button>
          <Button size="sm" aria-label="Next" onClick={() => shift(1)}>
            <ChevronRight size={15} />
          </Button>
        </div>
        {view !== "list" && <h2 className="text-[17px] font-semibold tracking-tight">{label}</h2>}
        <div className="ml-auto">
          <Segmented
            ariaLabel="Calendar view"
            value={view}
            onChange={setView}
            options={[
              { value: "month", label: "Month" },
              { value: "week", label: "Week" },
              { value: "list", label: "List" },
            ]}
          />
        </div>
      </div>

      <Legend count={events.length} />

      {query.isLoading ? (
        <Skeleton className="h-[560px] rounded-xl" />
      ) : query.isError ? (
        <div className="k-surface">
          <EmptyState icon={CalendarClock} title="Couldn't load the schedule" />
        </div>
      ) : events.length === 0 ? (
        <div className="k-surface">
          <EmptyState icon={CalendarClock} title="Nothing scheduled" body="Scheduled inspections appear here on the calendar." />
        </div>
      ) : view === "month" ? (
        <MonthGrid cursor={cursor} events={events} onOpen={open} />
      ) : view === "week" ? (
        <WeekGrid cursor={cursor} events={events} onOpen={open} />
      ) : (
        <AgendaList events={events} onOpen={open} />
      )}
    </div>
  );
}

// ── data ────────────────────────────────────────────────────────────────────

interface CalEvent {
  id: string;
  code: string;
  title: string;
  at: Date;
  dayKey: string;
  status: InspectionStatus;
  recurring: boolean;
  occurrence: boolean;
  color: string;
}

/** Blue = scheduled ahead, red = scheduled but past-due, green = completed. */
function eventColor(status: InspectionStatus, at: Date): string {
  if (status === "completed") return "#16a34a";
  if (status === "cancelled") return "#64748b";
  if (status === "scheduled" && at.getTime() < Date.now()) return "#dc2626";
  return "#2563eb";
}

function groupByDay(events: CalEvent[]): Map<string, CalEvent[]> {
  const map = new Map<string, CalEvent[]>();
  for (const e of events) {
    const list = map.get(e.dayKey) ?? [];
    list.push(e);
    map.set(e.dayKey, list);
  }
  return map;
}

// ── month ─────────────────────────────────────────────────────────────────

function MonthGrid({
  cursor,
  events,
  onOpen,
}: {
  cursor: Date;
  events: CalEvent[];
  onOpen: (id: string) => void;
}): React.ReactElement {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const gridStart = new Date(year, month, 1 - firstWeekday);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const byDay = groupByDay(events);
  const todayKey = localKey(new Date());

  return (
    <div className="k-surface overflow-hidden p-0">
      <div className="grid grid-cols-7 border-b border-border bg-bg-subtle">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          const key = localKey(date);
          const dayEvents = byDay.get(key) ?? [];
          const otherMonth = date.getMonth() !== month;
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              className={`min-h-[112px] border-b border-r border-border p-2 last:border-r-0 ${
                otherMonth ? "bg-bg-subtle/50" : ""
              } ${i % 7 === 6 ? "border-r-0" : ""}`}
            >
              <div
                className={`mb-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] ${
                  isToday ? "font-bold text-white" : otherMonth ? "text-subtle" : "font-medium"
                }`}
                style={isToday ? { background: "var(--accent)" } : undefined}
              >
                {date.getDate()}
              </div>
              <div className="flex flex-col gap-1">
                {dayEvents.slice(0, 3).map((ev) => (
                  <EventPill key={ev.id} ev={ev} onOpen={onOpen} />
                ))}
                {dayEvents.length > 3 && (
                  <div className="px-1.5 text-[10px] font-medium text-muted">+ {dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventPill({ ev, onOpen }: { ev: CalEvent; onOpen: (id: string) => void }): React.ReactElement {
  return (
    <button
      onClick={() => onOpen(ev.id)}
      title={`${ev.code} · ${ev.title}`}
      className="flex items-center gap-1 truncate rounded-[3px] px-1.5 py-1 text-left text-[10.5px] font-medium"
      style={{ background: `${ev.color}18`, color: ev.color, borderLeft: `3px solid ${ev.color}` }}
    >
      {ev.recurring && <Repeat size={9} className="shrink-0" />}
      <span className="truncate">{ev.title}</span>
    </button>
  );
}

// ── week ──────────────────────────────────────────────────────────────────

function WeekGrid({
  cursor,
  events,
  onOpen,
}: {
  cursor: Date;
  events: CalEvent[];
  onOpen: (id: string) => void;
}): React.ReactElement {
  const start = addDays(cursor, -cursor.getDay());
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const byDay = groupByDay(events);
  const todayKey = localKey(new Date());

  return (
    <div className="k-surface overflow-hidden p-0">
      <div className="grid grid-cols-7">
        {days.map((date, i) => {
          const key = localKey(date);
          const dayEvents = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <div key={key} className={`min-h-[420px] border-border ${i < 6 ? "border-r" : ""}`}>
              <div className="flex flex-col items-center gap-0.5 border-b border-border bg-bg-subtle py-2.5">
                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i]}
                </span>
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[14px] ${
                    isToday ? "font-bold text-white" : "font-semibold"
                  }`}
                  style={isToday ? { background: "var(--accent)" } : undefined}
                >
                  {date.getDate()}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 p-2">
                {dayEvents.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => onOpen(ev.id)}
                    title={`${ev.code} · ${ev.title}`}
                    className="flex flex-col gap-0.5 rounded-md border p-2 text-left"
                    style={{ background: `${ev.color}12`, borderColor: `${ev.color}40`, borderLeftWidth: 3, borderLeftColor: ev.color }}
                  >
                    <span className="mono text-[10px] font-semibold" style={{ color: ev.color }}>
                      {ev.at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="line-clamp-2 text-[11.5px] font-medium leading-tight">{ev.title}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── list / agenda ───────────────────────────────────────────────────────────

function AgendaList({ events, onOpen }: { events: CalEvent[]; onOpen: (id: string) => void }): React.ReactElement {
  const groups = [...groupByDay(events).entries()];
  return (
    <div className="flex flex-col gap-4">
      {groups.map(([day, items]) => (
        <div key={day} className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-1">
            <CalendarClock size={14} className="text-muted" />
            <span className="text-[13px] font-semibold">{formatDay(day)}</span>
            <span className="text-[12px] text-muted">
              {items.length} inspection{items.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="k-surface overflow-hidden p-0">
            {items.map((ev, idx) => (
              <button
                key={ev.id}
                onClick={() => onOpen(ev.id)}
                className={`flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-bg-subtle ${idx > 0 ? "border-t border-border" : ""}`}
              >
                <span className="h-9 w-1 shrink-0 rounded-sm" style={{ background: ev.color }} />
                <ClipboardCheck size={16} className="shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="mono text-[11px] font-semibold" style={{ color: "var(--accent)" }}>
                      {ev.code}
                    </span>
                    {ev.recurring && (
                      <Chip bg="var(--accent-soft)" fg="var(--accent)">
                        <Repeat size={11} /> Recurring
                      </Chip>
                    )}
                    {ev.occurrence && (
                      <Chip bg="var(--bg-subtle)" fg="var(--text-muted)">
                        Occurrence
                      </Chip>
                    )}
                  </div>
                  <div className="truncate text-[13px] font-medium">{ev.title}</div>
                </div>
                <span className="mono whitespace-nowrap text-[12px] text-muted">
                  {ev.at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── bits ──────────────────────────────────────────────────────────────────

function Legend({ count }: { count: number }): React.ReactElement {
  const dot = (color: string, label: string): React.ReactElement => (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted">
      {dot("#2563eb", "Scheduled")}
      {dot("#16a34a", "Completed")}
      {dot("#dc2626", "Overdue")}
      <span className="ml-auto">{count} scheduled</span>
    </div>
  );
}

// ── date helpers (local-time, tz-stable) ──────────────────────────────────

function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function localKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function weekLabel(cursor: Date): string {
  const start = addDays(cursor, -cursor.getDay());
  const end = addDays(start, 6);
  const mon = (d: Date): string => d.toLocaleDateString(undefined, { month: "short" });
  const startPart = `${mon(start)} ${start.getDate()}`;
  const endPart = start.getMonth() === end.getMonth() ? `${end.getDate()}` : `${mon(end)} ${end.getDate()}`;
  return `${startPart} – ${endPart}, ${end.getFullYear()}`;
}

function formatDay(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
