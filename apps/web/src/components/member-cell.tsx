"use client";

import { Avatar } from "./avatar";
import { useMemberLookup } from "@/hooks/use-members";

/**
 * Renders a person by id: avatar + name, resolved through the members directory.
 * Falls back to "You" for the current user and a short id when the directory
 * hasn't loaded them — never a fabricated name. Replaces the old id-only cells
 * now that `/v1/members` exists.
 */
export function MemberCell({
  userId,
  meId,
  size = 22,
  firstNameOnly = false,
  emptyLabel = "Unassigned",
}: {
  userId: string | null | undefined;
  meId?: string | undefined;
  size?: number;
  firstNameOnly?: boolean;
  emptyLabel?: string;
}): React.ReactElement {
  const lookup = useMemberLookup();
  if (userId == null) return <span className="text-[12px] text-subtle">{emptyLabel}</span>;
  const member = lookup.memberOf(userId);
  const resolved = member?.name ?? (meId === userId ? "You" : `${userId.slice(0, 8)}…`);
  const shown = firstNameOnly ? resolved.split(" ")[0] : resolved;
  return (
    <span className="inline-flex items-center gap-2 text-[12px]">
      <Avatar name={member?.name} size={size} />
      {shown}
    </span>
  );
}
