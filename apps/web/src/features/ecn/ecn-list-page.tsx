"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GitBranch, Plus } from "lucide-react";
import { useCan, useMe } from "@/hooks/use-me";
import { useMemberLookup } from "@/hooks/use-members";
import { useEcns, useEcnsSummary } from "@/hooks/use-ecn";
import { Avatar } from "@/components/avatar";
import { Button, Card, EmptyState, Skeleton } from "@/components/ui";
import { OfflineBanner } from "@/components/shell/offline-banner";
import { apiErrorInfo } from "@/lib/api-error";
import { shortDate } from "@/lib/format";
import { EcnHeader, type EcnView } from "./ecn-header";
import { EcnKanbanBoard } from "./ecn-kanban-page";
import { EcnDetailPage } from "./ecn-detail-page";
import { CHANGE_TYPE_LABEL, EcnRiskChip, EcnStageProgress } from "./ecn-bits";

/**
 * `/ecn` — `ECNWorkbench`/`ECNList` (`qms-modules.jsx:528-591`, corrected per
 * SPRINT-06 §0b/DESIGN-06 §2: "step X of 7" against the canonical 7-stage
 * pipeline incl. the real `ppap` gate, real data rather than the jsx's 5
 * static rows). Owns the List/Kanban toggle (jsx `ECNWorkbench`'s own
 * `useState('list')`) and the `?id=` deep-link swap to the full detail view,
 * mirroring `document-detail.tsx`'s own full-page swap.
 */
export function EcnListPage(): React.ReactElement {
  const { data: me, isLoading: meLoading } = useMe();
  const canView = useCan("ecn:view");
  const canManage = useCan("ecn:manage");
  const router = useRouter();
  const searchParams = useSearchParams();
  const members = useMemberLookup();
  const [view, setView] = useState<EcnView>("list");

  const urlId = searchParams.get("id");

  const all = useEcns({ limit: 100 });
  const summary = useEcnsSummary();

  if (urlId !== null) {
    return <EcnDetailPage id={urlId} />;
  }

  if (meLoading || all.isPending) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!canView && me !== undefined) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <Card>
          <EmptyState icon={GitBranch} title="No access" body="You don't have permission to view engineering change notices." />
        </Card>
      </div>
    );
  }

  if (all.isError) {
    const info = apiErrorInfo(all.error);
    if (info?.status === 403) {
      return (
        <div className="mx-auto max-w-7xl p-6">
          <Card>
            <EmptyState icon={GitBranch} title="No access" body="You don't have permission to view engineering change notices." />
          </Card>
        </div>
      );
    }
    const message = info?.message ?? "Something went wrong.";
    return (
      <div className="mx-auto max-w-7xl p-6">
        <Card>
          <EmptyState
            icon={GitBranch}
            title="Couldn't load engineering change notices"
            body={info?.requestId !== undefined ? `${message} (request ${info.requestId})` : message}
            action={
              <Button variant="ghost" onClick={() => void all.refetch()}>
                Retry
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const ecns = all.data?.items ?? [];
  const total = summary.data !== undefined ? Object.values(summary.data).reduce((n, c) => n + c, 0) : ecns.length;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <OfflineBanner />
      <EcnHeader view={view} onViewChange={setView} canManage={canManage} />

      {total === 0 ? (
        <Card>
          <EmptyState
            icon={GitBranch}
            title="No engineering change notices yet"
            body={canManage ? "Draft an ECN to start the multi-stage approval workflow." : "No engineering change notices have been raised yet."}
            {...(canManage
              ? {
                  action: (
                    <Button variant="primary" onClick={() => router.push("/create/ecn")}>
                      <Plus size={14} aria-hidden /> New ECN
                    </Button>
                  ),
                }
              : {})}
          />
        </Card>
      ) : view === "kanban" ? (
        <EcnKanbanBoard canManage={canManage} onOpen={(id) => router.push(`/ecn?id=${id}`)} />
      ) : (
        <Card>
          <div className="k-surface overflow-hidden">
            <table className="k-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>ECN ID</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Stage</th>
                  <th>Affected</th>
                  <th>Risk</th>
                  <th>Owner</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {ecns.map((e) => (
                  <tr key={e.id} className="cursor-pointer" onClick={() => router.push(`/ecn?id=${e.id}`)}>
                    <td className="mono" style={{ fontSize: 11.5 }}>
                      {e.code}
                    </td>
                    <td style={{ fontSize: 12.5, fontWeight: 500, maxWidth: 360 }}>{e.title}</td>
                    <td>
                      <span className="k-chip" style={{ background: "var(--bg-subtle)" }}>
                        {CHANGE_TYPE_LABEL[e.changeType]}
                      </span>
                    </td>
                    <td>
                      <EcnStageProgress stage={e.stage} />
                    </td>
                    <td className="mono" style={{ fontSize: 11.5 }}>
                      {e.linkedDocumentCount} docs
                    </td>
                    <td>
                      <EcnRiskChip risk={e.changeRisk} />
                    </td>
                    <td>
                      <Avatar name={members.nameOf(e.owner)} size={26} />
                    </td>
                    <td style={{ fontSize: 11.5 }}>{shortDate(e.effectiveDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {all.data?.nextCursor != null && (
            <p className="mt-2 text-center text-[12px] text-subtle">Showing the first {ecns.length}. Pagination lands with the shared table.</p>
          )}
        </Card>
      )}
    </div>
  );
}
