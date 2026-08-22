"use client";

import type { PresenceEntity } from "@kaenal/types";
import { Pencil } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { useMe } from "@/hooks/use-me";
import { useMemberLookup } from "@/hooks/use-members";
import { usePresence } from "@/hooks/use-presence";

/**
 * Live presence (Phase R4): who else is on this record right now, and who has
 * the edit form open. Renders an overlapping avatar stack plus a soft-lock hint
 * ("Sarah is editing") so a second editor sees the collision coming instead of
 * hitting an optimistic-concurrency 409. Shows nothing when you're alone.
 *
 * `editing` reflects whether YOU currently have the edit form open — it's sent
 * up so others see your intent; it does not affect what this renders.
 */
export function PresenceBar({
  type,
  id,
  editing = false,
}: {
  type: PresenceEntity;
  id: string;
  editing?: boolean;
}): React.ReactElement | null {
  const viewers = usePresence(type, id, editing);
  const { data: me } = useMe();
  const lookup = useMemberLookup();

  const others = viewers.filter((v) => v.userId !== me?.userId);
  if (others.length === 0) return null;

  const nameOf = (userId: string): string => lookup.memberOf(userId)?.name ?? "Someone";
  const editors = others.filter((v) => v.editing);
  const shown = others.slice(0, 4);

  return (
    <div
      className="flex items-center gap-2"
      title={`${others.map((v) => nameOf(v.userId)).join(", ")} here now`}
    >
      <div className="flex -space-x-1.5">
        {shown.map((v) => (
          <span
            key={v.userId}
            className="inline-flex rounded-full"
            style={{ boxShadow: "0 0 0 2px var(--surface)" }}
          >
            <Avatar name={nameOf(v.userId)} size={26} />
          </span>
        ))}
        {others.length > shown.length && (
          <span
            className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full bg-bg-subtle text-[11px] font-semibold text-muted"
            style={{ boxShadow: "0 0 0 2px var(--surface)" }}
          >
            +{others.length - shown.length}
          </span>
        )}
      </div>
      {editors.length > 0 ? (
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: "var(--warning-bg, #fef3c7)", color: "var(--warning-fg, #92400e)" }}
        >
          <Pencil size={11} />
          {nameOf(editors[0]!.userId)}
          {editors.length > 1 ? ` +${editors.length - 1}` : ""} editing
        </span>
      ) : (
        <span className="text-[12px] text-muted">
          {others.length === 1 ? "1 person here" : `${others.length} people here`}
        </span>
      )}
    </div>
  );
}
