"use client";

import { useSearchParams } from "next/navigation";
import { AuditList } from "./audit-list";
import { AuditScheduleView } from "./audit-schedule-view";

export type AuditsView = "all" | "mine" | "schedule";

function parseView(raw: string | null): AuditsView {
  if (raw === "mine" || raw === "schedule") return raw;
  return "all";
}

/**
 * `/audits` — reads `?view=all|mine|schedule` (mirrors the existing
 * `/8d?view=…` and `/capa?new=1` conventions of one route with a query-param
 * view switch). `schedule` renders the calendar (`AuditScheduleView`); `all`
 * and `mine` render `AuditList` (Sprint 02 S2-1), whose own segmented
 * All/Active/Completed/My-audits control is `audits.jsx`'s in-page filter —
 * the outer nav just seeds its initial tab, it is not a duplicate switcher.
 */
export function AuditsPageShell(): React.ReactElement {
  const searchParams = useSearchParams();
  const view = parseView(searchParams.get("view"));

  if (view === "schedule") return <AuditScheduleView />;
  return <AuditList initialTab={view === "mine" ? "mine" : "all"} />;
}
