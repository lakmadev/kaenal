"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, Calendar, MapPin, TriangleAlert } from "lucide-react";
import type { NcrDto, NcrStatus, NcrTransition } from "@kaenal/types";
import { cn } from "@/lib/cn";
import { longDate, titleCase } from "@/lib/format";
import { errorMessage } from "@/lib/api-error";
import { useMe } from "@/hooks/use-me";
import { useNcr, useTransitionNcr, useVerifyNcr } from "@/hooks/use-ncrs";
import { Button, StatusBadge, PriorityBadge, Skeleton, EmptyState, useToast } from "@/components/ui";
import { SlaIndicator, OwnerCell } from "./ncr-bits";
import { NcrActionsTab } from "./ncr-actions";

type Tab = "details" | "actions" | "history";

/** Contextual transitions per status — the server is the final guard, so an
 *  illegal attempt surfaces as a toast; this just offers the sensible next steps. */
function transitionsFor(status: NcrStatus): { to: NcrTransition; label: string; needsOwner?: boolean }[] {
  switch (status) {
    case "draft":
      return [{ to: "open", label: "Open" }];
    case "open":
      return [
        { to: "in_progress", label: "Start work" },
        { to: "assigned", label: "Assign to me", needsOwner: true },
      ];
    case "assigned":
      return [{ to: "in_progress", label: "Start work" }];
    case "in_progress":
      return [{ to: "resolved", label: "Resolve" }];
    case "resolved":
      return [{ to: "reopened", label: "Reopen" }];
    case "verified":
      return [
        { to: "closed", label: "Close" },
        { to: "reopened", label: "Reopen" },
      ];
    case "closed":
    case "escalated":
    case "reopened":
      return [{ to: "in_progress", label: "Resume" }];
    default:
      return [];
  }
}

export function NcrDetail({ id }: { id: string }): React.ReactElement {
  const router = useRouter();
  const { data: me } = useMe();
  const { data: ncr, isLoading, isError } = useNcr(id);

  if (isLoading) return <DetailSkeleton />;
  if (isError || ncr === undefined) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <BackLink onClick={() => router.push("/ncrs")} />
        <div className="k-surface mt-4">
          <EmptyState icon={TriangleAlert} title="NCR not found" body="It may have been removed, or you may not have access." />
        </div>
      </div>
    );
  }

  return <NcrDetailView ncr={ncr} meId={me?.userId} />;
}

function NcrDetailView({ ncr, meId }: { ncr: NcrDto; meId: string | undefined }): React.ReactElement {
  const router = useRouter();
  const toast = useToast();
  const transition = useTransitionNcr();
  const verify = useVerifyNcr();
  const [tab, setTab] = useState<Tab>("details");

  const busy = transition.isPending || verify.isPending;

  const runTransition = (to: NcrTransition, needsOwner?: boolean): void => {
    const body =
      needsOwner === true
        ? { to, version: ncr.lockVersion, ...(meId !== undefined ? { ownerId: meId } : {}) }
        : { to, version: ncr.lockVersion };
    transition.mutate(
      { id: ncr.id, body },
      { onSuccess: () => toast.success(`Moved to ${titleCase(to)}`), onError: (e) => toast.error(errorMessage(e)) },
    );
  };

  const runVerify = (): void =>
    verify.mutate(
      { id: ncr.id, body: { version: ncr.lockVersion } },
      { onSuccess: () => toast.success("NCR verified"), onError: (e) => toast.error(errorMessage(e)) },
    );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <BackLink onClick={() => router.push("/ncrs")} />

      <div className="k-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2.5">
              <span className="mono text-[13px] font-semibold" style={{ color: "var(--accent)" }}>
                {ncr.code}
              </span>
              <StatusBadge status={ncr.status} />
              <PriorityBadge priority={ncr.priority} />
              <SlaIndicator state={ncr.slaState} />
            </div>
            <h1 className="text-[22px] font-bold tracking-tight">{ncr.title}</h1>
            <div className="mt-1.5 flex flex-wrap gap-4 text-[12px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                Source: <span className="capitalize text-text">{titleCase(ncr.source)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={13} /> Due {longDate(ncr.dueAt)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock size={13} /> Raised {longDate(ncr.createdAt)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {ncr.status === "resolved" && (
              <Button variant="primary" loading={busy} onClick={runVerify}>
                Verify
              </Button>
            )}
            {transitionsFor(ncr.status).map((t, i) => (
              <Button
                key={t.to}
                variant={i === 0 && ncr.status !== "resolved" ? "primary" : "ghost"}
                loading={busy}
                onClick={() => runTransition(t.to, t.needsOwner)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="k-tabs">
        {(["details", "actions", "history"] as Tab[]).map((t) => (
          <button key={t} type="button" className={cn("k-tab", tab === t && "active")} onClick={() => setTab(t)}>
            {titleCase(t)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <div>
          {tab === "details" && <DetailsTab ncr={ncr} />}
          {tab === "actions" && <NcrActionsTab ncrId={ncr.id} />}
          {tab === "history" && (
            <div className="k-surface">
              <EmptyState icon={Clock} title="Activity timeline" body="The audit trail view lands with the shared history component." />
            </div>
          )}
        </div>

        <aside className="k-surface flex h-fit flex-col gap-3.5 p-4">
          <Meta label="Status">
            <StatusBadge status={ncr.status} />
          </Meta>
          <Meta label="Owner">
            <OwnerCell ownerId={ncr.ownerId} meId={meId} />
          </Meta>
          <Meta label="Priority">
            <PriorityBadge priority={ncr.priority} />
          </Meta>
          <Meta label="SLA">
            <SlaIndicator state={ncr.slaState} />
          </Meta>
          <Meta label="Due">
            <span className="mono text-[12px]">{longDate(ncr.dueAt)}</span>
          </Meta>
          <Meta label="Source">
            <span className="text-[12px] capitalize">{titleCase(ncr.source)}</span>
          </Meta>
        </aside>
      </div>
    </div>
  );
}

function DetailsTab({ ncr }: { ncr: NcrDto }): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <div className="k-surface p-5">
        <div className="k-overline mb-2">Description</div>
        <p className="text-[13.5px] leading-relaxed">
          {ncr.description !== null && ncr.description !== "" ? ncr.description : "No description provided."}
        </p>
      </div>
      {ncr.sourceId !== null && (
        <div className="k-surface flex items-center gap-3 p-4">
          <div
            className="flex items-center justify-center rounded-md"
            style={{ width: 36, height: 36, background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            <MapPin size={18} />
          </div>
          <div>
            <div className="k-overline">Source</div>
            <div className="mt-0.5 text-[13px]">
              Raised from a <span className="capitalize">{titleCase(ncr.source)}</span> ·{" "}
              <span className="mono text-muted">{ncr.sourceId.slice(0, 8)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="k-overline">{label}</span>
      {children}
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }): React.ReactElement {
  return (
    <button type="button" onClick={onClick} className="k-btn k-btn-plain self-start px-0 text-[13px] text-muted">
      <ArrowLeft size={14} /> Back to NCRs
    </button>
  );
}

function DetailSkeleton(): React.ReactElement {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
