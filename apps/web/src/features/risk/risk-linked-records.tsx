"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Link2 } from "lucide-react";
import type { EntityKind, RiskDto } from "@kaenal/types";
import { useEntityLinks } from "@/hooks/use-entity-links";
import { useCreateEntityLink } from "@/hooks/use-create-entity-link";
import { LinkPicker, type LinkPickerRecord } from "@/components/link-picker";
import { Button, EmptyState, Skeleton, useToast } from "@/components/ui";
import { entityHref, entityIcon, entityLabel } from "@/lib/entity-routes";
import { apiErrorInfo } from "@/lib/api-error";

/**
 * R1 [AMENDED — B3] — the risk detail card's linked-records panel. Reads
 * `entity_links` for the selected risk via the same `useEntityLinks` hook
 * `capa-detail.tsx`/`supplier-detail.tsx`/`document-detail.tsx` already read
 * with, using the server-resolved `label` field rather than a truncated raw
 * id. "Link to FMEA" (R3 AC6) opens the shared `LinkPicker` scoped to
 * `kinds={["fmea"]}` and writes a real `entity_links` row.
 */
export function RiskLinkedRecords({ risk, canManage }: { risk: RiskDto; canManage: boolean }): React.ReactElement {
  const toast = useToast();
  const router = useRouter();
  const links = useEntityLinks("risk", risk.id);
  const createLink = useCreateEntityLink();
  const [pickerOpen, setPickerOpen] = useState(false);

  const rows = (links.data?.items ?? []).map((l) => {
    const opp = l.fromKind === "risk" && l.fromId === risk.id ? { kind: l.toKind, id: l.toId } : { kind: l.fromKind, id: l.fromId };
    return { key: l.id, kind: opp.kind, id: opp.id, label: l.label ?? null };
  });

  function onSelect(record: LinkPickerRecord): void {
    createLink.mutate(
      { fromKind: "risk", fromId: risk.id, toKind: record.kind, toId: record.id, relation: "linked" },
      {
        onSuccess: () => {
          toast.success("Linked to FMEA");
          setPickerOpen(false);
        },
        onError: (e) => toast.error(apiErrorInfo(e)?.message ?? "Couldn't create the link"),
      },
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center">
        <div className="k-overline">Linked records</div>
        {canManage && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setPickerOpen(true)}>
            + Link to FMEA
          </Button>
        )}
      </div>

      {links.isPending ? (
        <Skeleton className="h-16 rounded-md" />
      ) : links.isError ? (
        <div className="k-surface p-3 text-[12px] text-muted">
          Couldn&apos;t load linked records.{" "}
          <button type="button" className="underline" onClick={() => void links.refetch()}>
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="k-surface">
          <EmptyState
            icon={Link2}
            title="No linked records"
            body="FMEAs, NCRs, 8Ds, audits and suppliers linked to this risk appear here."
          />
        </div>
      ) : (
        <div className="k-surface overflow-hidden">
          <table className="k-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: 110 }}>Type</th>
                <th>Record</th>
                <th style={{ width: 24 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const href = entityHref(r.kind, r.id);
                const Icon = entityIcon(r.kind);
                const recordLabel = r.label ?? `${r.id.slice(0, 8)}…`;
                return (
                  <tr key={r.key}>
                    <td colSpan={3} style={{ padding: 0 }}>
                      <button
                        type="button"
                        disabled={href === null}
                        onClick={href !== null ? () => router.push(href) : undefined}
                        className="grid w-full items-center gap-2 px-2.5 py-2 text-left enabled:hover:bg-[var(--bg-subtle)] disabled:cursor-default"
                        style={{ gridTemplateColumns: "110px 1fr 24px" }}
                        aria-label={`${entityLabel(r.kind)} ${recordLabel}`}
                      >
                        <span className="k-chip" style={{ background: "var(--bg-subtle)" }}>
                          <Icon size={11} aria-hidden /> {entityLabel(r.kind)}
                        </span>
                        <span className="mono" style={{ fontSize: 11.5 }}>
                          {recordLabel}
                        </span>
                        {href !== null && <ChevronRight size={13} className="text-muted" aria-hidden />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <LinkPicker open={pickerOpen} onOpenChange={setPickerOpen} kinds={["fmea"] as EntityKind[]} onSelect={onSelect} busy={createLink.isPending} />
    </div>
  );
}
