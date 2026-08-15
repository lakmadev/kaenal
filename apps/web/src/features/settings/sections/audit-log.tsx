"use client";

import { useState } from "react";
import { Filter, Download, Bot, X, ShieldAlert } from "lucide-react";
import { AuditAction, EntityKind, type AuditLogEntryDto } from "@kaenal/types";
import { useCan } from "@/hooks/use-me";
import { useMembers } from "@/hooks/use-members";
import { useAuditLog, downloadAuditLogCsv, type AuditLogFilters } from "@/hooks/use-audit-log";
import { Avatar } from "@/components/avatar";
import { EmptyState, useToast } from "@/components/ui";
import { SettingsPage } from "../settings-bits";

/**
 * Tenant-wide Audit log (settings.jsx `AuditLog`, binding design rule #9): the
 * When / Who / Action / Target / IP-Source table, sensitive rows highlighted,
 * with Filter + Export in the page actions. Wired to `/v1/audit-log`
 * (admin-only, `auditlog:read`) — the static jsx mock is replaced by the real,
 * filterable, cursor-paginated trail; the Filter and Export buttons, inert in
 * the design, are made functional here.
 */

/** Title-case a snake_case enum value for a filter label. */
function label(v: string): string {
  return v
    .split("_")
    .map((w) => (w.length === 0 ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Compact "When": today → HH:MM, yesterday → "Yest HH:MM", older → "MMM D". */
function whenLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const hhmm = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  if (d.toDateString() === now.toDateString()) return hhmm;
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return `Yest ${hhmm}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** IP column: the real source IP, or a source label when the actor has none. */
function sourceLabel(row: AuditLogEntryDto): string {
  if (row.ip !== null && row.ip !== "") return row.ip;
  switch (row.actorKind) {
    case "system":
      return "system";
    case "api_key":
      return "integration";
    case "support":
      return "support";
    default:
      return "—";
  }
}

/** Convert a date-input value to an ISO instant at the day's start/end (UTC). */
function dayStart(date: string): string | undefined {
  return date === "" ? undefined : `${date}T00:00:00.000Z`;
}
function dayEnd(date: string): string | undefined {
  return date === "" ? undefined : `${date}T23:59:59.999Z`;
}

export function AuditLogSection(): React.ReactElement {
  const canRead = useCan("auditlog:read");
  const toast = useToast();
  const { data: members } = useMembers();

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [exporting, setExporting] = useState(false);

  const query = useAuditLog(filters);
  const rows = query.data?.pages.flatMap((p) => p.items) ?? [];

  const onExport = async (): Promise<void> => {
    setExporting(true);
    try {
      await downloadAuditLogCsv(filters);
    } catch {
      toast.error("Couldn’t export the audit log. Try again.");
    } finally {
      setExporting(false);
    }
  };

  if (!canRead) {
    return (
      <SettingsPage title="Audit log" subtitle="7-year retention · IATF 16949 §7.5.3.2 compliant">
        <div className="k-surface">
          <EmptyState
            icon={ShieldAlert}
            title="You don’t have access to the audit log"
            body="Viewing the workspace audit log requires the audit-log reader permission. Ask a workspace admin if you need access."
          />
        </div>
      </SettingsPage>
    );
  }

  return (
    <SettingsPage
      title="Audit log"
      subtitle="7-year retention · IATF 16949 §7.5.3.2 compliant"
      actions={
        <>
          <button
            className="k-btn k-btn-ghost"
            aria-pressed={showFilters}
            onClick={() => setShowFilters((s) => !s)}
          >
            <Filter size={14} /> Filter
          </button>
          <button className="k-btn k-btn-ghost" disabled={exporting} onClick={() => void onExport()}>
            <Download size={14} /> {exporting ? "Exporting…" : "Export"}
          </button>
        </>
      }
    >
      {showFilters && (
        <FilterPanel
          filters={filters}
          members={members?.items ?? []}
          onChange={setFilters}
          onClose={() => setShowFilters(false)}
        />
      )}

      <div className="k-surface" style={{ overflow: "hidden" }}>
        <table className="k-table">
          <thead>
            <tr>
              <th style={{ width: 110 }}>When</th>
              <th>Who</th>
              <th>Action</th>
              <th>Target</th>
              <th>IP / Source</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading
              ? [0, 1, 2, 3, 4].map((i) => (
                  <tr key={i}>
                    <td colSpan={5} style={{ padding: 0 }}>
                      <div className="skeleton" style={{ height: 38, margin: 6 }} />
                    </td>
                  </tr>
                ))
              : rows.map((e) => <AuditRow key={e.id} e={e} />)}
          </tbody>
        </table>

        {!query.isLoading && rows.length === 0 && (
          <EmptyState
            icon={Filter}
            title="No audit events match"
            body="No activity matches these filters yet. Clear the filters to see the full trail."
          />
        )}
      </div>

      {query.hasNextPage && (
        <div className="mt-3 flex justify-center">
          <button
            className="k-btn k-btn-ghost"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </SettingsPage>
  );
}

function AuditRow({ e }: { e: AuditLogEntryDto }): React.ReactElement {
  const isSystem = e.actorKind === "system";
  const isAi = e.action === "ai_draft_accepted";
  const firstName = e.actorName.split(" ")[0] ?? e.actorName;
  return (
    <tr style={e.sensitive ? { background: "var(--warning-50)" } : undefined}>
      <td className="mono" style={{ fontSize: 12, color: "var(--text-muted)" }} title={new Date(e.createdAt).toLocaleString()}>
        {whenLabel(e.createdAt)}
      </td>
      <td>
        {isSystem ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <Bot size={14} /> System
          </span>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }} title={e.actorName}>
            <Avatar name={e.actorName} size={20} />
            <span style={{ fontSize: 12 }}>{firstName}</span>
          </div>
        )}
      </td>
      <td
        className="mono"
        style={{
          fontSize: 11,
          color: e.sensitive ? "var(--warning-700)" : "var(--text-muted)",
          fontWeight: e.sensitive ? 600 : 400,
        }}
      >
        {e.action}.{e.entityKind}
      </td>
      <td style={{ fontSize: 12 }}>
        {e.targetLabel}
        {isAi && (
          <span
            className="k-chip"
            style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", fontSize: 9, padding: "1px 5px", height: 16, marginLeft: 4 }}
          >
            AI
          </span>
        )}
        {e.reason !== null && e.reason !== "" && (
          <span style={{ marginLeft: 6, fontSize: 11, color: "var(--text-muted)" }}>· {e.reason}</span>
        )}
      </td>
      <td className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {sourceLabel(e)}
      </td>
    </tr>
  );
}

function FilterPanel({
  filters,
  members,
  onChange,
  onClose,
}: {
  filters: AuditLogFilters;
  members: { userId: string; name: string }[];
  onChange: (f: AuditLogFilters) => void;
  onClose: () => void;
}): React.ReactElement {
  // A patch may clear a key by passing `undefined`; strip those so the stored
  // filters object never carries explicit-undefined props (exactOptionalPropertyTypes).
  const set = (patch: { [K in keyof AuditLogFilters]?: AuditLogFilters[K] | undefined }): void => {
    const next: AuditLogFilters = { ...filters };
    for (const key of Object.keys(patch) as (keyof AuditLogFilters)[]) {
      const value = patch[key];
      if (value === undefined) delete next[key];
      else Object.assign(next, { [key]: value });
    }
    onChange(next);
  };
  const hasAny = Object.values(filters).some((v) => v !== undefined);

  return (
    <div className="k-surface mb-3" style={{ padding: 14 }}>
      <div className="mb-3 flex items-center justify-between">
        <span className="k-overline">Filters</span>
        <button aria-label="Close filters" className="k-btn-icon k-btn-plain" onClick={onClose}>
          <X size={15} />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <FilterField label="Actor">
          <select
            className="k-input"
            value={filters.actorId ?? ""}
            onChange={(ev) => set({ actorId: ev.target.value === "" ? undefined : ev.target.value })}
          >
            <option value="">Anyone</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Action">
          <select
            className="k-input"
            value={filters.action ?? ""}
            onChange={(ev) =>
              set({ action: ev.target.value === "" ? undefined : (ev.target.value as AuditLogFilters["action"]) })
            }
          >
            <option value="">Any action</option>
            {AuditAction.options.map((a) => (
              <option key={a} value={a}>
                {label(a)}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Module">
          <select
            className="k-input"
            value={filters.entityKind ?? ""}
            onChange={(ev) =>
              set({ entityKind: ev.target.value === "" ? undefined : (ev.target.value as AuditLogFilters["entityKind"]) })
            }
          >
            <option value="">All modules</option>
            {EntityKind.options.map((k) => (
              <option key={k} value={k}>
                {label(k)}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="From">
          <input
            type="date"
            className="k-input"
            value={filters.from?.slice(0, 10) ?? ""}
            onChange={(ev) => set({ from: dayStart(ev.target.value) })}
          />
        </FilterField>

        <FilterField label="To">
          <input
            type="date"
            className="k-input"
            value={filters.to?.slice(0, 10) ?? ""}
            onChange={(ev) => set({ to: dayEnd(ev.target.value) })}
          />
        </FilterField>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
          <input
            type="checkbox"
            checked={filters.sensitiveOnly === true}
            onChange={(ev) => set({ sensitiveOnly: ev.target.checked ? true : undefined })}
          />
          Sensitive events only
        </label>
        {hasAny && (
          <button className="k-btn k-btn-sm k-btn-ghost" onClick={() => onChange({})}>
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

function FilterField({ label: l, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div>
      <label className="k-overline mb-1 block">{l}</label>
      {children}
    </div>
  );
}
