"use client";

import { useSearchParams } from "next/navigation";
import { CalendarRange, ClipboardList, ShieldCheck, User } from "lucide-react";
import { useMe, hasCapability } from "@/hooks/use-me";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui";

export type AuditsView = "all" | "mine" | "schedule";

function parseView(raw: string | null): AuditsView {
  if (raw === "mine" || raw === "schedule") return raw;
  return "all";
}

const VIEW_COPY: Record<AuditsView, { description: string; icon: typeof ShieldCheck; title: string; body: string }> = {
  all: {
    description: "IATF/ISO audit programme",
    icon: ShieldCheck,
    title: "Audit list — coming next",
    body: "The KPI strip, filters, audit cards, and frequency chart (Sprint 02 S2-1) land in the next slice.",
  },
  mine: {
    description: "Audits where you're lead auditor, on the team, or an auditee",
    icon: User,
    title: "My audits — coming next",
    body: "The same list, filtered to your audits (Sprint 02 S2-1) lands in the next slice.",
  },
  schedule: {
    description: "Planned and in-progress audits by date",
    icon: CalendarRange,
    title: "Audit schedule — coming next",
    body: "A calendar/timeline view of dated audits (Sprint 02 S2-1, DESIGN-02-audits.md board) lands in the next slice.",
  },
};

/**
 * `/audits` shell (Sprint 02, slice W0). Reads `?view=all|mine|schedule` —
 * mirrors the existing `/8d?view=…` and `/capa?new=1` conventions of one route
 * with a query-param view switch, rather than a separate `/audits/schedule`
 * route (nothing in `audits.jsx` or FEATURES.md asks for a standalone URL, and
 * this keeps the sidebar's existing three nav children — `navigation.ts` — real
 * instead of dead). `?new=1` is reserved for the Create Audit dialog (S2-3);
 * this slice only defines the convention, a later slice renders the dialog.
 *
 * The KPI strip / filters / `AuditList` / `AuditCard` / frequency chart /
 * schedule calendar content itself is NOT built here — that's Sprint 02 S2-1's
 * slice. This file is scaffolding only: query-param routing + capability gate
 * + a labelled TODO slot per view, so nav never points at a dead placeholder.
 */
export function AuditsPageShell(): React.ReactElement {
  const searchParams = useSearchParams();
  const view = parseView(searchParams.get("view"));
  const { data: me } = useMe();
  const canManage = hasCapability(me, "audit:manage");
  const copy = VIEW_COPY[view];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <PageHeader title="Audits" description={copy.description} />

      {/* View switch itself already lives in the sidebar (navigation.ts: All
          Audits / My Audits / Schedule → ?view=…); no in-page duplicate control
          per audits.jsx (its own tab strip is the status/type filter, S2-1). */}

      {/* TODO(S2-1, next slice): KPI strip, filters (status/type/search/mine),
          AuditList + AuditCard, AuditFrequencyChart (view=all|mine), or the
          audit schedule calendar grid (view=schedule). See
          docs/sprints/SPRINT-02-audits.md and
          apps/web/src/features/inspections/schedule-view.tsx for the schedule
          visual precedent this view restyles. `canManage` (audit:manage) gates
          the "New audit" entry point once the create dialog (S2-3) exists —
          not rendered yet, so this slice introduces no dead button. */}
      <EmptyState
        icon={canManage ? copy.icon : ClipboardList}
        title={copy.title}
        body={copy.body}
      />
    </div>
  );
}
