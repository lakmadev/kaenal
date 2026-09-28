"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardList, FileText, ListChecks, TriangleAlert, Users } from "lucide-react";
import { useAudit } from "@/hooks/use-audits";
import { titleCase } from "@/lib/format";
import { Skeleton, EmptyState, StatusBadge } from "@/components/ui";

type Tab = "team" | "evidence" | "report" | "checklist" | "findings";

const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: "checklist", label: "Checklist", icon: ListChecks },
  { id: "findings", label: "Findings", icon: TriangleAlert },
  { id: "team", label: "Team & Plan", icon: Users },
  { id: "evidence", label: "Evidence", icon: FileText },
  { id: "report", label: "Report", icon: ClipboardList },
];

/**
 * `/audits/[id]` shell (Sprint 02, slice W0). Fetches the real audit (loading /
 * not-found states are genuine infra, not a TODO) and lays out the tab strip
 * every later slice hangs its content off: Checklist (S2-4), Findings (S2-5),
 * Team & Plan / Evidence / Report (S2-2). The header (type chip, phase tracker,
 * sidebar cards, Export/Continue-audit buttons) and every tab's real content
 * are NOT built here — that's S2-2/S2-4/S2-5's slice. This file only proves the
 * route resolves to real data instead of `ModulePlaceholder`.
 */
export function AuditDetailShell({ id }: { id: string }): React.ReactElement {
  const router = useRouter();
  const { data: audit, isLoading, isError } = useAudit(id);
  const [tab, setTab] = useState<Tab>("checklist");

  if (isLoading) return <DetailSkeleton />;
  if (isError || audit === undefined) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <BackLink onClick={() => router.push("/audits")} />
        <div className="k-surface mt-4">
          <EmptyState icon={TriangleAlert} title="Audit not found" body="It may have been removed, or you may not have access." />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <BackLink onClick={() => router.push("/audits")} />

      {/* TODO(S2-2, next slice): header (type chip, code, StatusBadge, title,
          description, Export + Continue-audit buttons), 5-step phase tracker,
          and the 3 sidebar cards (audit details / findings summary / audit
          team) — audits.jsx AuditDetail 213-374. */}
      <div className="k-surface flex flex-wrap items-center justify-between gap-2 p-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">{audit.code}</div>
          <h1 className="text-lg font-semibold text-text">{audit.title}</h1>
        </div>
        <StatusBadge status={titleCase(audit.status)} />
      </div>

      <div role="tablist" aria-label="Audit sections" className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`k-btn k-btn-ghost k-btn-sm ${tab === t.id ? "border-b-2 border-ink" : ""}`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* TODO(next slices, per tab): checklist scoring (S2-4), findings +
          raise-NCR/CAPA (S2-5), team/plan (S2-2), evidence upload/list — reuse
          of the generic files pipeline (S2-2), report + export (S2-2). */}
      <div className="k-surface p-8 text-sm text-muted">
        {TABS.find((t) => t.id === tab)?.label} — coming in a later Sprint 02 slice.
      </div>
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }): React.ReactElement {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
      <ArrowLeft size={14} /> Back to audits
    </button>
  );
}

function DetailSkeleton(): React.ReactElement {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="mt-4 h-20 w-full" />
      <Skeleton className="mt-4 h-64 w-full" />
    </div>
  );
}
