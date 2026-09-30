"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Link2, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiQueries } from "@kaenal/api-client";
import type { EcnDto } from "@kaenal/types";
import { getApiClient } from "@/lib/api";
import { useEcnLinks, useLinkEcn, useUnlinkEcn } from "@/hooks/use-ecn";
import { LinkPicker, type LinkPickerRecord } from "@/components/link-picker";
import { Button, EmptyState, Skeleton, useToast } from "@/components/ui";
import { entityHref, entityIcon, entityLabel } from "@/lib/entity-routes";
import { apiErrorInfo, errorMessage } from "@/lib/api-error";

const STAGE_FREEZE = new Set<EcnDto["stage"]>(["draft", "feasibility", "risk_review", "ppap", "cab_approval", "pilot"]);

/**
 * ECN's affected-records panel (E5 AC1-3, DESIGN-06 §4.5 State A/F) — reuses
 * `LinkPicker`'s exact search/select pattern (Sprint 04 R3), scoped to
 * `document`/`supplier` only, but writes through the ECN-specific
 * `link`/`unlink` routes (§0 B4) rather than the generic `entity_links`
 * write route, which rejects an ecn-kind link outright. Link/unlink is live
 * only while `ecn:manage` and `stage` is `draft`..`pilot` — frozen (removed
 * entirely, not disabled, State F) once the affected-set is locked in at
 * `implementation`/`closed`/`rejected`.
 */
export function EcnAffectedRecords({ ecn, canManage }: { ecn: EcnDto; canManage: boolean }): React.ReactElement {
  const toast = useToast();
  const router = useRouter();
  const links = useEcnLinks(ecn.id);
  const linkEcn = useLinkEcn();
  const unlinkEcn = useUnlinkEcn();
  const [pickerOpen, setPickerOpen] = useState(false);

  const canEdit = canManage && STAGE_FREEZE.has(ecn.stage);

  const client = getApiClient();
  const rows = links.data ?? [];
  const wantsDocuments = rows.some((l) => l.kind === "document");
  const wantsSuppliers = rows.some((l) => l.kind === "supplier");
  const documents = useQuery({ ...apiQueries.documents.list(client, { query: { limit: 100 } }), enabled: wantsDocuments });
  const suppliers = useQuery({ ...apiQueries.suppliers.list(client, { query: { limit: 100 } }), enabled: wantsSuppliers });

  const labelOf = useMemo(() => {
    const docById = new Map((documents.data?.items ?? []).map((d) => [d.id, `${d.code} — ${d.title}`]));
    const supById = new Map((suppliers.data?.items ?? []).map((s) => [s.id, `${s.code} — ${s.name}`]));
    return (kind: "document" | "supplier", id: string): string => {
      const map = kind === "document" ? docById : supById;
      return map.get(id) ?? `${id.slice(0, 8)}…`;
    };
  }, [documents.data, suppliers.data]);

  function onSelect(record: LinkPickerRecord): void {
    if (record.kind !== "document" && record.kind !== "supplier") return;
    linkEcn.mutate(
      { id: ecn.id, body: { kind: record.kind, targetId: record.id } },
      {
        onSuccess: () => {
          toast.success(`Linked ${entityLabel(record.kind)}`);
          setPickerOpen(false);
        },
        onError: (e) => toast.error(apiErrorInfo(e)?.message ?? "Couldn't create the link"),
      },
    );
  }

  function onUnlink(linkId: string): void {
    unlinkEcn.mutate(
      { id: ecn.id, linkId },
      { onError: (e) => toast.error(errorMessage(e)) },
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center">
        <div className="k-overline">Affected documents &amp; suppliers</div>
        {canEdit && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setPickerOpen(true)}>
            + Link a record
          </Button>
        )}
        {!canEdit && canManage && (
          <span className="ml-auto text-[11px] text-muted">
            Frozen — links can no longer change once the ECN reaches {ecn.stage}.
          </span>
        )}
      </div>

      {links.isPending ? (
        <Skeleton className="h-16 rounded-md" />
      ) : links.isError ? (
        <div className="k-surface p-3 text-[12px] text-muted">
          Couldn&apos;t load affected records.{" "}
          <button type="button" className="underline" onClick={() => void links.refetch()}>
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="k-surface">
          <EmptyState icon={Link2} title="No affected records" body="Documents and suppliers linked to this ECN appear here." />
        </div>
      ) : (
        <div className="k-surface overflow-hidden">
          <table className="k-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: 100 }}>Type</th>
                <th>Record</th>
                {canEdit && <th style={{ width: 32 }} />}
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const href = entityHref(l.kind, l.targetId);
                const Icon = entityIcon(l.kind);
                return (
                  <tr key={l.id}>
                    <td>
                      <span className="k-chip" style={{ background: "var(--bg-subtle)" }}>
                        <Icon size={11} aria-hidden /> {entityLabel(l.kind)}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {href !== null ? (
                        <button
                          type="button"
                          onClick={() => router.push(href)}
                          className="inline-flex items-center gap-1 hover:underline"
                        >
                          {labelOf(l.kind, l.targetId)} <ChevronRight size={12} aria-hidden />
                        </button>
                      ) : (
                        labelOf(l.kind, l.targetId)
                      )}
                    </td>
                    {canEdit && (
                      <td>
                        <button
                          type="button"
                          aria-label={`Unlink ${entityLabel(l.kind)}`}
                          onClick={() => onUnlink(l.id)}
                          className="k-btn k-btn-plain k-btn-icon"
                          style={{ height: 22, width: 22 }}
                        >
                          <X size={12} aria-hidden />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <LinkPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        kinds={["document", "supplier"]}
        onSelect={onSelect}
        busy={linkEcn.isPending}
      />
    </div>
  );
}
