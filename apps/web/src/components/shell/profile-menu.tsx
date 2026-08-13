"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  User,
  Settings,
  ClipboardList,
  Command,
  LogOut,
  Check,
  ShieldCheck,
} from "lucide-react";
import type { MeDto } from "@kaenal/types";
import { titleCase } from "@/lib/format";
import { Avatar } from "@/components/avatar";
import { useUiStore } from "@/lib/stores/ui";
import { useSignOut } from "@/hooks/use-sign-out";
import { useWorkspaces, useSwitchWorkspace } from "@/hooks/use-workspaces";

/**
 * The account menu (shell.jsx `TopBar` profile dropdown): an identity header,
 * quick facts (workspace / plant / open items / MFA), the account links, a
 * workspace switcher, and sign-out. Every value is real — resolved from
 * `GET /v1/me` and `GET /v1/me/workspaces`; nothing is placeholder.
 */
export function ProfileMenu({ me }: { me: MeDto | undefined }): React.ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const signOut = useSignOut();
  const openCommand = useUiStore((s) => s.setCommandOpen);
  const { data: workspaces } = useWorkspaces();
  const switchWorkspace = useSwitchWorkspace();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent): void => {
      if (ref.current !== null && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (href: string): void => {
    setOpen(false);
    router.push(href);
  };

  const name = me?.name ?? "—";
  const role = me?.role !== undefined ? titleCase(me.role) : "";
  const leadPlant = me !== undefined && me.plants.length > 0 ? me.plants[0] : undefined;
  const roleLine = leadPlant !== undefined ? `${role} · ${leadPlant.code}` : role;
  const openItems: string[] = [];
  if (me !== undefined) {
    if (me.openNcrs > 0) openItems.push(`${me.openNcrs} NCR${me.openNcrs === 1 ? "" : "s"}`);
    if (me.openCapas > 0) openItems.push(`${me.openCapas} CAPA${me.openCapas === 1 ? "" : "s"}`);
  }
  const openItemsLabel = openItems.length > 0 ? openItems.join(" · ") : "None open";
  const assignmentsHint = me !== undefined ? `${me.openNcrs + me.openCapas} open items` : "";

  const menuItems = [
    { label: "Your profile", icon: User, hint: "Name, photo, contact info", href: "/settings/profile" },
    { label: "Account settings", icon: Settings, hint: "Notifications, language, MFA", href: "/settings" },
    { label: "My assignments", icon: ClipboardList, hint: assignmentsHint, href: "/ncrs?view=mine" },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`ml-1 flex items-center gap-2 rounded-md p-1 pr-2 ${open ? "bg-bg-subtle" : ""}`}
      >
        <Avatar name={name} size={30} />
        <span className="hidden flex-col text-left leading-tight sm:flex">
          <span className="text-[12px] font-semibold text-text">{name}</span>
          {role !== "" && <span className="text-[10.5px] text-muted">{role}</span>}
        </span>
        <ChevronDown size={14} className="hidden text-muted sm:block" />
      </button>

      {open && (
        <div
          role="menu"
          className="k-surface fade-in absolute right-0 z-50 mt-2 w-[min(320px,calc(100vw-16px))] overflow-hidden p-0 shadow-xl"
        >
          {/* Identity header */}
          <div className="flex items-center gap-3 border-b border-border bg-bg-subtle px-4 py-3.5">
            <Avatar name={name} size={44} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold text-text">{name}</div>
              <div className="truncate text-[11.5px] text-muted">{me?.email ?? ""}</div>
              <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-border bg-accent-soft px-2 py-0.5 text-[10.5px] font-semibold text-accent">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#16a34a" }} />
                {roleLine}
              </div>
            </div>
          </div>

          {/* Quick facts */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-b border-border px-4 py-3">
            <Fact label="Workspace" value={me?.tenantName ?? me?.tenantSlug ?? "—"} />
            <Fact
              label="Plant"
              value={
                me === undefined
                  ? "—"
                  : me.plants.length === 0
                    ? "All plants"
                    : me.plants.length === 1
                      ? me.plants[0]!.name
                      : `${me.plants.length} plants`
              }
            />
            <Fact label="Open items" value={openItemsLabel} />
            <Fact
              label="MFA"
              value={
                <span className="inline-flex items-center gap-1">
                  {me?.mfaEnabled === true ? (
                    <>
                      <ShieldCheck size={11} style={{ color: "#16a34a" }} /> Enabled
                    </>
                  ) : (
                    "Not set"
                  )}
                </span>
              }
            />
          </div>

          {/* Menu */}
          <div className="p-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  onClick={() => go(item.href)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-bg-subtle"
                >
                  <Icon size={15} className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-medium text-text">{item.label}</span>
                    {item.hint !== "" && <span className="block text-[10.5px] text-muted">{item.hint}</span>}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                openCommand(true);
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-bg-subtle"
            >
              <Command size={15} className="shrink-0 text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-medium text-text">Command palette</span>
                <span className="block text-[10.5px] text-muted">Search & quick actions · ⌘K</span>
              </span>
            </button>
          </div>

          {/* Workspace switcher */}
          {workspaces !== undefined && workspaces.items.length > 0 && (
            <div className="border-t border-border p-1.5">
              <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">
                {workspaces.items.length > 1 ? "Switch workspace" : "Workspace"}
              </div>
              {workspaces.items.map((w) => (
                <button
                  key={w.tenantSlug}
                  type="button"
                  role="menuitem"
                  disabled={w.active || switchWorkspace.isPending}
                  onClick={() => switchWorkspace.mutate(w.tenantSlug)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left hover:bg-bg-subtle disabled:cursor-default"
                >
                  <span
                    className="flex h-5.5 w-5.5 items-center justify-center rounded border border-border text-[10px] font-bold"
                    style={{
                      width: 22,
                      height: 22,
                      background: w.active ? "var(--accent)" : "var(--bg-subtle)",
                      color: w.active ? "var(--accent-fg)" : "var(--text-muted)",
                    }}
                  >
                    {w.tenantName.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-text">{w.tenantName}</span>
                    <span className="block truncate text-[10.5px] text-muted">{titleCase(w.role)}</span>
                  </span>
                  {w.active && <Check size={13} className="shrink-0 text-accent" />}
                </button>
              ))}
            </div>
          )}

          {/* Sign out */}
          <div className="border-t border-border p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => signOut.mutate()}
              disabled={signOut.isPending}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[12.5px] font-medium hover:bg-[rgba(220,38,38,0.08)]"
              style={{ color: "var(--danger-600)" }}
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }): React.ReactElement {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">{label}</div>
      <div className="truncate text-[11.5px] font-medium text-text">{value}</div>
    </div>
  );
}
