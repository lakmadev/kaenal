"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import type { MemberDto } from "@kaenal/types";
import { Avatar } from "@/components/avatar";
import { Skeleton } from "@/components/ui";
import { useMembers } from "@/hooks/use-members";

/**
 * A single-select owner picker (search-and-replace), not the shared
 * Assignees step's multi-role add-many picker — first built for risk (Sprint
 * 04 R4 AC1(b)), extracted here so ECN's own Details step (Sprint 06 E3 AC1)
 * reuses the exact same component, not a re-implementation (design audit
 * §4.7: "reusing RiskDetailsStep's OwnerPicker component pattern verbatim").
 */
export function OwnerPicker({
  ownerId,
  onSelect,
  invalid,
  labelId,
}: {
  ownerId: string | null;
  onSelect: (userId: string) => void;
  invalid: boolean;
  /** The label element's own `id`, so this control stays reusable across
   *  callers without colliding `aria-labelledby` targets. */
  labelId: string;
}): React.ReactElement {
  const t = useTranslations("wizard");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useMembers();
  const byId = useMemo(() => new Map((data?.items ?? []).map((m) => [m.userId, m])), [data]);
  const owner: MemberDto | undefined = ownerId !== null ? byId.get(ownerId) : undefined;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (ref.current !== null && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const filtered = useMemo(() => {
    const all = data?.items ?? [];
    const query = q.trim().toLowerCase();
    return all.filter((u) => query === "" || u.name.toLowerCase().includes(query) || u.role.toLowerCase().includes(query));
  }, [data, q]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {owner !== undefined ? (
        <div className="flex items-center gap-2.5 rounded-md bg-bg-subtle px-3 py-2">
          <Avatar name={owner.name} size={28} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium">{owner.name}</div>
            <div className="text-[11px] text-muted">{owner.role}</div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="k-btn k-btn-ghost k-btn-sm"
            aria-label={t("changeOwner")}
          >
            {t("change")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          aria-labelledby={labelId}
          aria-invalid={invalid}
          onClick={() => setOpen((o) => !o)}
          className="k-input"
          style={{ textAlign: "left", color: "var(--text-muted)" }}
        >
          {t("chooseOwner")}
        </button>
      )}
      {open && (
        <div
          className="k-surface fade-in absolute z-[100] flex flex-col overflow-hidden"
          style={{ top: "calc(100% + 4px)", left: 0, right: 0, maxHeight: 280, boxShadow: "var(--shadow-lg)" }}
        >
          <div className="flex items-center border-b border-border p-2">
            <input
              className="k-input"
              placeholder={t("searchPeople")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("cancel")}
              className="k-btn k-btn-icon k-btn-plain ml-1"
              style={{ height: 28, width: 28 }}
            >
              <X size={14} aria-hidden />
            </button>
          </div>
          <div className="overflow-y-auto p-1">
            {isLoading && <Skeleton className="m-1 h-10 rounded-sm" />}
            {!isLoading && filtered.length === 0 && (
              <div className="p-3 text-center text-[12px] text-muted">{t("noMatches")}</div>
            )}
            {filtered.map((u) => (
              <button
                key={u.userId}
                type="button"
                onClick={() => {
                  onSelect(u.userId);
                  setOpen(false);
                  setQ("");
                }}
                aria-pressed={u.userId === ownerId}
                className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left hover:bg-bg-subtle"
              >
                <Avatar name={u.name} size={26} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">{u.name}</div>
                  <div className="text-[11px] text-muted">{u.role}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
