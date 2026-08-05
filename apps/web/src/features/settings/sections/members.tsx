"use client";

import { useMemo, useState } from "react";
import { Search, Upload, Plus, ShieldCheck, MoreHorizontal, AlertTriangle } from "lucide-react";
import type { MemberDto } from "@kaenal/types";
import { titleCase } from "@/lib/format";
import { useMembers } from "@/hooks/use-members";
import { Avatar } from "@/components/avatar";
import { Segmented, Spinner, EmptyState, useToast } from "@/components/ui";
import { SettingsPage } from "../settings-bits";

type StatusFilter = "all" | "active" | "invited" | "suspended";

/**
 * Members & teams (settings.jsx `Members`). Wired to the real people directory
 * (`/v1/members`), which is read-only and returns name + role only. Every person
 * it lists is an active member of this tenant, so status renders "Active"; the
 * columns the directory can't back — teams, MFA state, last-active — show a
 * neutral placeholder rather than fabricated values, and Invite / Bulk import
 * surface honestly that the membership-admin API isn't exposed yet (rule #9 +
 * the no-fabricated-data guardrail, same pattern as Profile and Inspection media).
 */
export function MembersSection(): React.ReactElement {
  const toast = useToast();
  const { data, isLoading, isError } = useMembers();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const members = useMemo<MemberDto[]>(() => data?.items ?? [], [data]);
  const notWired = () =>
    toast.toast("Managing membership isn't wired to the backend yet — the directory is read-only", "info");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      // Every directory member is active; invited/suspended have no rows yet.
      if (status !== "all" && status !== "active") return false;
      if (q === "") return true;
      return m.name.toLowerCase().includes(q) || titleCase(m.role).toLowerCase().includes(q);
    });
  }, [members, query, status]);

  const total = members.length;

  return (
    <SettingsPage
      title="Members & teams"
      subtitle={
        isLoading
          ? "Loading directory…"
          : `${total} active member${total === 1 ? "" : "s"} · directory is read-only (name + role)`
      }
      actions={
        <>
          <button className="k-btn k-btn-ghost" onClick={notWired}>
            <Upload size={14} /> Bulk import (CSV)
          </button>
          <button className="k-btn k-btn-primary" onClick={notWired}>
            <Plus size={14} /> Invite
          </button>
        </>
      }
    >
      <div className="mb-3.5 flex items-center gap-2">
        <div className="relative max-w-[320px] flex-1">
          <input
            className="k-input"
            placeholder="Search by name or role…"
            style={{ paddingLeft: 34 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="pointer-events-none absolute left-3 top-[11px] text-subtle">
            <Search size={14} />
          </div>
        </div>
        <Segmented
          size="sm"
          value={status}
          onChange={setStatus}
          ariaLabel="Filter by status"
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "invited", label: "Invited" },
            { value: "suspended", label: "Suspended" },
          ]}
        />
      </div>

      <div className="k-surface overflow-x-auto p-0">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : isError ? (
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load members"
            body="The people directory failed to load. Refresh to try again."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={query.trim() !== "" || status !== "all" ? "No members match" : "No members yet"}
            body={
              query.trim() !== "" || status !== "all"
                ? "Try a different search or filter."
                : "This tenant has no members in the directory."
            }
          />
        ) : (
          <table className="k-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Teams</th>
                <th>MFA</th>
                <th>Status</th>
                <th>Last active</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.userId}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={m.name} size={30} />
                      <div className="text-[13px] font-semibold">{m.name}</div>
                    </div>
                  </td>
                  <td>
                    <span className="k-chip" style={{ background: "var(--bg-subtle)", color: "var(--text)" }}>
                      {titleCase(m.role)}
                    </span>
                  </td>
                  <td className="text-[12px] text-subtle">—</td>
                  <td className="text-[12px] text-subtle">—</td>
                  <td>
                    <span className="inline-flex items-center gap-1.5 text-[12px]">
                      <span
                        className="shrink-0 rounded-full"
                        style={{ width: 6, height: 6, background: "var(--success-500, #16a34a)" }}
                      />
                      Active
                    </span>
                  </td>
                  <td className="text-[12px] text-subtle">—</td>
                  <td>
                    <button
                      className="k-btn-icon k-btn-plain"
                      aria-label={`Manage ${m.name}`}
                      onClick={notWired}
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
        <ShieldCheck size={12} className="shrink-0" />
        Teams, MFA state, and last-active come from the membership-admin API, which isn&rsquo;t exposed
        yet — this view reads the read-only people directory.
      </p>
    </SettingsPage>
  );
}
