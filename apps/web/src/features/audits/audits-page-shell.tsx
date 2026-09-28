"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuditCreateDialog } from "./audit-create-dialog";
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
 *
 * The create-audit dialog (S2-3, `AuditCreateDialog`) is owned here so both
 * `AuditList`'s "New audit" header button and `?new=1` (command-palette
 * "Schedule audit" quick action) open the same instance.
 */
export function AuditsPageShell(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = parseView(searchParams.get("view"));

  const [createOpen, setCreateOpen] = useState(searchParams.get("new") === "1");
  const onCreateOpenChange = (open: boolean): void => {
    setCreateOpen(open);
    if (!open && searchParams.get("new") === "1") router.replace("/audits");
  };

  return (
    <>
      {view === "schedule" ? (
        <AuditScheduleView />
      ) : (
        <AuditList initialTab={view === "mine" ? "mine" : "all"} onNewAudit={() => setCreateOpen(true)} />
      )}
      <AuditCreateDialog open={createOpen} onOpenChange={onCreateOpenChange} />
    </>
  );
}
