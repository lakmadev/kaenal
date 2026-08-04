"use client";

import { History, ClipboardList, ArrowRight, Link2, Download, Check, type LucideIcon } from "lucide-react";
import type { AuditEventDto, EntityKind } from "@kaenal/types";
import { longDate } from "@/lib/format";
import { useAuditEvents } from "@/hooks/use-audit-events";
import { useMemberLookup } from "@/hooks/use-members";
import { Avatar } from "@/components/avatar";
import { EmptyState, Spinner } from "@/components/ui";

/**
 * A record's real activity trail, straight from `audit_events` (07 §1). Every
 * mutation writes an event in the same transaction (`withAudit`), so this is the
 * authoritative history — never a fabricated timeline. Shared across the CAPA,
 * NCR and Inspection details (the "shared history component" their stubs named).
 *
 * `noun` shapes the sentence ("created this NCR"); actors resolve through the
 * members directory ("You" / name), and a null actor (a system job) reads as
 * "System" rather than leaking a raw id.
 */
export function ActivityFeed({
  entityKind,
  entityId,
  meId,
  noun = "record",
  emptyBody = "Every change to this record is recorded here as it happens.",
}: {
  entityKind: EntityKind;
  entityId: string;
  meId: string | undefined;
  noun?: string;
  emptyBody?: string;
}): React.ReactElement {
  const query = useAuditEvents(entityKind, entityId);
  const { memberOf } = useMemberLookup();

  if (query.isLoading) {
    return (
      <div className="k-surface flex items-center justify-center py-10">
        <Spinner />
      </div>
    );
  }

  const events = [...(query.data?.items ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  if (events.length === 0) {
    return (
      <div className="k-surface">
        <EmptyState icon={History} title="No activity yet" body={emptyBody} />
      </div>
    );
  }

  const actorName = (e: AuditEventDto): string => {
    if (e.actorId === null) return e.actorKind === "system" ? "System" : "Automated";
    if (meId !== undefined && e.actorId === meId) return "You";
    return memberOf(e.actorId)?.name ?? `${e.actorId.slice(0, 8)}…`;
  };

  return (
    <div className="k-surface p-[18px]">
      <h4 className="mb-3.5 text-[13px] font-semibold">Activity history</h4>
      <div className="flex flex-col gap-3">
        {events.map((e) => {
          const Icon = iconFor(e.action);
          const name = actorName(e);
          return (
            <div key={e.id} className="flex items-start gap-2.5">
              <span
                className="mt-0.5 flex shrink-0 items-center justify-center rounded-full"
                style={{ width: 26, height: 26, background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                <Icon size={13} />
              </span>
              <div className="min-w-0 flex-1 text-[12.5px]">
                <div>
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    {e.actorId !== null && <Avatar name={memberOf(e.actorId)?.name ?? null} size={16} />}
                    {name}
                  </span>{" "}
                  <span className="text-muted">{verbFor(e.action, noun)}</span>
                </div>
                {e.reason !== null && e.reason !== "" && <div className="mt-0.5 text-[11.5px] text-muted">“{e.reason}”</div>}
                <div className="mt-0.5 text-[11px] text-subtle">{longDate(e.createdAt)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Timeline glyph for an audit action; a neutral clock/history dot by default. */
function iconFor(action: AuditEventDto["action"]): LucideIcon {
  switch (action) {
    case "created":
      return ClipboardList;
    case "status_changed":
      return ArrowRight;
    case "signed":
      return Check;
    case "file_attached":
    case "file_downloaded":
    case "linked":
    case "unlinked":
      return Link2;
    case "exported":
      return Download;
    default:
      return History;
  }
}

/** Human verb phrase for an audit action; `{noun}` slots the entity name in. */
function verbFor(action: AuditEventDto["action"], noun: string): string {
  switch (action) {
    case "created":
      return `created this ${noun}`;
    case "updated":
      return `updated the ${noun}`;
    case "status_changed":
      return "changed the status";
    case "assigned":
      return `reassigned the ${noun}`;
    case "commented":
      return "commented";
    case "file_attached":
      return "attached a file";
    case "file_downloaded":
      return "downloaded a file";
    case "signed":
      return "signed off";
    case "exported":
      return `exported the ${noun}`;
    case "linked":
      return "linked a record";
    case "unlinked":
      return "unlinked a record";
    case "deleted":
      return `deleted the ${noun}`;
    case "restored":
      return `restored the ${noun}`;
    default:
      return action.replace(/_/g, " ");
  }
}
