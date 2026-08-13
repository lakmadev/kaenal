"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, FileCheck } from "lucide-react";
import { shortDate } from "@/lib/format";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { usePortalPpapList } from "@/hooks/use-portal";
import { PortalPpapStatus } from "./portal-bits";

export function PortalPpapList(): React.ReactElement {
  const router = useRouter();
  const query = usePortalPpapList();
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <div>
        <h1 className="text-[20px] font-bold tracking-tight">PPAP submissions</h1>
        <p className="text-[13px] text-muted">Production Part Approval packages — review element feedback and re-submit.</p>
      </div>

      {query.isLoading ? (
        <div className="flex flex-col gap-2 rounded-xl border p-4" style={{ background: "#fff", borderColor: "#e2e8f0" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="rounded-xl border" style={{ background: "#fff", borderColor: "#e2e8f0" }}>
          <EmptyState
            icon={FileCheck}
            title="Couldn't load your PPAP submissions"
            body="Something went wrong."
            action={
              <Button variant="primary" onClick={() => void query.refetch()}>
                Retry
              </Button>
            }
          />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border" style={{ background: "#fff", borderColor: "#e2e8f0" }}>
          <EmptyState icon={FileCheck} title="No PPAP submissions" body="Packages requested from you will appear here." />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border" style={{ background: "#fff", borderColor: "#e2e8f0" }}>
          {items.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/portal/ppap/${p.id}`)}
              className="flex w-full items-center gap-4 border-b px-4 py-3 text-left last:border-b-0 hover:bg-[color:var(--bg-subtle)]"
              style={{ borderColor: "#e2e8f0" }}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">
                  {p.partNumber}
                  {p.partRev !== null ? ` · rev ${p.partRev}` : ""}
                </div>
                <div className="mono text-[11px] text-muted">
                  {p.code ?? p.id.slice(0, 8)} · Level {p.level}
                  {p.dueDate !== null ? ` · due ${shortDate(p.dueDate)}` : ""}
                </div>
              </div>
              <span className="mono text-[12px] text-muted">
                {p.completeness.approved}/{p.completeness.required}
              </span>
              <PortalPpapStatus status={p.status} />
              <ChevronRight size={15} className="text-subtle" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
