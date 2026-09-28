"use client";

import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import type { AuditDto } from "@kaenal/types";
import { Chip, StatusBadge } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { useMemberLookup } from "@/hooks/use-members";
import { AUDIT_TYPES, PHASE_ORDER, PHASE_LABELS, auditStatusBadgeValue } from "./audit-types";

/** `audits.jsx` `AuditCard` (lines 120-177) — pixel-for-pixel: type chip, code,
 *  status badge, title, standard/location line, phase progress bar (segments
 *  coloured to the audit's type up to its current phase, `AuditDto.progress`
 *  is server-computed, never a client tally), and a footer with the lead
 *  auditor's avatar + name and colour-coded major/minor finding counts. */
export function AuditCard({ audit }: { audit: AuditDto }): React.ReactElement {
  const router = useRouter();
  const lookup = useMemberLookup();
  const t = AUDIT_TYPES[audit.type];
  const TypeIcon = t.icon;
  const lead = lookup.memberOf(audit.leadAuditorId);
  const phaseIdx = PHASE_ORDER.indexOf(audit.status);

  const open = (): void => router.push(`/audits/${audit.id}`);

  return (
    <div
      onClick={open}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") open();
      }}
      className="k-surface flex cursor-pointer flex-col gap-3 p-[18px] text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <Chip bg={t.bg} fg={t.color}>
              <TypeIcon size={11} /> {t.label}
            </Chip>
            <span className="mono text-[11px] text-muted">{audit.code}</span>
            <StatusBadge status={auditStatusBadgeValue(audit.status)} />
          </div>
          <div className="mb-1 text-[14.5px] font-semibold leading-snug">{audit.title}</div>
          <div className="text-[12px] text-muted">
            {audit.standard ?? "—"} · {audit.location ?? "—"}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted">
          <span className="font-semibold text-text">{PHASE_LABELS[audit.status]}</span>
          <span>{audit.progress}% complete</span>
        </div>
        <div className="flex gap-1">
          {PHASE_ORDER.map((p, i) => (
            <div
              key={p}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{ background: i <= phaseIdx ? t.color : "var(--border)" }}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-2">
        <div className="flex items-center gap-2">
          <Avatar name={lead?.name} size={22} />
          <div className="text-[11.5px] leading-tight">
            <div className="font-medium">{lead?.name ?? "Unassigned"}</div>
            <div className="text-muted">Lead auditor</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11.5px]">
          {audit.findingsSummary.major > 0 && (
            <span className="font-semibold" style={{ color: "#dc2626" }}>
              {audit.findingsSummary.major} major
            </span>
          )}
          {audit.findingsSummary.minor > 0 && (
            <span className="font-semibold" style={{ color: "#ea580c" }}>
              {audit.findingsSummary.minor} minor
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-muted">
            <Calendar size={11} /> {monthDay(audit.startAt)}–{monthDay(audit.endAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

/** `audit.plannedStart.slice(5)` in the jsx: "YYYY-MM-DD…" → "MM-DD". */
function monthDay(iso: string | null): string {
  if (iso === null) return "—";
  return iso.slice(5, 10);
}
