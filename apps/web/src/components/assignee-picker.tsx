"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, UserMinus, Check } from "lucide-react";
import { titleCase } from "@/lib/format";
import { useMembers } from "@/hooks/use-members";
import { Avatar } from "@/components/avatar";
import { MemberCell } from "@/components/member-cell";
import { Spinner } from "@/components/ui";

/**
 * Assignee control (P25). Read-only for viewers — just a `MemberCell`. For
 * managers it becomes a dropdown over the members directory with search and an
 * Unassign row; picking a member (or clearing) fires `onAssign(userId | null)`.
 * Generic over the caller's entity: the parent owns the mutation + `version`, so
 * NCR / Inspection / 8D / SCAR reuse this unchanged.
 */
export function AssigneePicker({
  userId,
  meId,
  onAssign,
  canManage,
  busy = false,
  allowUnassign = true,
  emptyLabel = "Unassigned",
}: {
  userId: string | null;
  meId?: string | undefined;
  onAssign: (userId: string | null) => void;
  canManage: boolean;
  busy?: boolean;
  allowUnassign?: boolean;
  emptyLabel?: string;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useMembers();

  // Close on outside-click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (ref.current !== null && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const members = useMemo(() => data?.items ?? [], [data]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return members;
    return members.filter((m) => m.name.toLowerCase().includes(q) || m.role.toLowerCase().includes(q));
  }, [members, query]);

  if (!canManage) {
    return <MemberCell userId={userId} meId={meId} size={18} emptyLabel={emptyLabel} />;
  }

  const pick = (id: string | null): void => {
    setOpen(false);
    setQuery("");
    if (id !== userId) onAssign(id);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-[var(--bg-subtle)] disabled:opacity-60"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <MemberCell userId={userId} meId={meId} size={18} emptyLabel={emptyLabel} />
        {busy ? <Spinner size={12} /> : <ChevronDown size={13} className="text-subtle" />}
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-1 w-60 overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
          role="listbox"
        >
          <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-2">
            <Search size={13} className="text-subtle" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search members…"
              className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-subtle"
            />
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {allowUnassign && userId !== null && (
              <button
                type="button"
                onClick={() => pick(null)}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12.5px] text-muted hover:bg-[var(--bg-subtle)]"
              >
                <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[var(--bg-subtle)]">
                  <UserMinus size={12} />
                </span>
                Unassign
              </button>
            )}

            {isLoading ? (
              <div className="flex justify-center py-4">
                <Spinner size={14} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-2.5 py-3 text-center text-[12px] text-subtle">No members match</div>
            ) : (
              filtered.map((m) => {
                const selected = m.userId === userId;
                return (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => pick(m.userId)}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-[var(--bg-subtle)]"
                    role="option"
                    aria-selected={selected}
                  >
                    <Avatar name={m.name} size={20} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium">
                        {m.name}
                        {meId === m.userId ? " (you)" : ""}
                      </span>
                      <span className="block text-[10.5px] text-muted">{titleCase(m.role)}</span>
                    </span>
                    {selected && <Check size={13} className="text-accent" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
