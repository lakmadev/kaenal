"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Info, Plus, X } from "lucide-react";
import { PERSON_ROLE_OPTIONS, WIZARD_TYPES, type WizardType } from "@kaenal/core";
import type { EntityPersonInput, EntityPersonRole, MemberDto } from "@kaenal/types";
import { Avatar } from "@/components/avatar";
import { useMembers } from "@/hooks/use-members";
import { Skeleton } from "@/components/ui";

function PersonRow({
  member,
  role,
  onChangeRole,
  onRemove,
}: {
  member: MemberDto;
  role: EntityPersonRole;
  onChangeRole: (role: EntityPersonRole) => void;
  onRemove: () => void;
}): React.ReactElement {
  const t = useTranslations("wizard");
  return (
    <div className="flex items-center gap-2.5 rounded-md bg-bg-subtle px-3 py-2">
      <Avatar name={member.name} size={28} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{member.name}</div>
        <div className="text-[11px] text-muted">{member.role}</div>
      </div>
      <select
        aria-label={t("roleFor", { name: member.name })}
        value={role}
        onChange={(e) => onChangeRole(e.target.value as EntityPersonRole)}
        className="k-input"
        style={{ height: 28, width: "auto", padding: "0 8px", fontSize: 12 }}
      >
        {PERSON_ROLE_OPTIONS.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("removePerson", { name: member.name })}
        className="k-btn k-btn-icon k-btn-plain"
        style={{ height: 28, width: 28 }}
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}

function PeoplePicker({ exclude, onAdd }: { exclude: readonly string[]; onAdd: (userId: string) => void }): React.ReactElement {
  const t = useTranslations("wizard");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useMembers();

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
    return all.filter(
      (u) => !exclude.includes(u.userId) && (query === "" || u.name.toLowerCase().includes(query) || u.role.toLowerCase().includes(query)),
    );
  }, [data, exclude, q]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="k-btn k-btn-ghost"
        style={{ width: "100%", justifyContent: "flex-start" }}
      >
        <Plus size={14} aria-hidden /> {t("addPerson")}
      </button>
      {open && (
        <div
          className="k-surface fade-in absolute z-[100] flex flex-col overflow-hidden"
          style={{ top: "calc(100% + 4px)", left: 0, right: 0, maxHeight: 280, boxShadow: "var(--shadow-lg)" }}
        >
          <div className="border-b border-border p-2">
            <input
              className="k-input"
              placeholder={t("searchPeople")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
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
                  onAdd(u.userId);
                  setOpen(false);
                  setQ("");
                }}
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

/**
 * Step 2 — Assignees & approvals (createwizard.jsx `renderStep2`): person rows
 * with a role select, an empty-state hint, the add-person picker, and the
 * notification info panel.
 */
export function AssigneesStep({
  type,
  people,
  onAdd,
  onChangeRole,
  onRemove,
}: {
  type: WizardType;
  people: readonly EntityPersonInput[];
  onAdd: (userId: string) => void;
  onChangeRole: (userId: string, role: EntityPersonRole) => void;
  onRemove: (userId: string) => void;
}): React.ReactElement {
  const t = useTranslations("wizard");
  const { data } = useMembers();
  const byId = useMemo(() => new Map((data?.items ?? []).map((m) => [m.userId, m])), [data]);
  const label = WIZARD_TYPES[type].label.toLowerCase();

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 32px" }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, marginBottom: 4 }}>{t("assigneesTitle")}</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>{t("assigneesSub")}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {people.map((p) => {
          const member = byId.get(p.userId);
          if (member === undefined) return null;
          return (
            <PersonRow
              key={p.userId}
              member={member}
              role={p.role}
              onChangeRole={(role) => onChangeRole(p.userId, role)}
              onRemove={() => onRemove(p.userId)}
            />
          );
        })}
        {people.length === 0 && (
          <div className="rounded-md border border-dashed border-border-strong px-4 py-6 text-center">
            <div className="text-[13px] text-muted">{t("noAssignees")}</div>
          </div>
        )}
        <PeoplePicker exclude={people.map((p) => p.userId)} onAdd={onAdd} />
      </div>

      <div className="mt-7 flex gap-3 rounded-md bg-bg-subtle p-4">
        <Info size={16} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0" />
        <div className="text-[12px] leading-relaxed text-muted">
          {t.rich("notification", { type: label, b: (chunks) => <strong className="text-text">{chunks}</strong> })}
        </div>
      </div>
    </div>
  );
}
