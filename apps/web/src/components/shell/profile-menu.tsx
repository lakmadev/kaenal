"use client";

import { useRef } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ChevronDown,
  User,
  Settings,
  ClipboardList,
  Keyboard,
  SlidersHorizontal,
  LogOut,
  Check,
  ShieldCheck,
} from "lucide-react";
import type { MeDto } from "@kaenal/types";
import { shortName, titleCase } from "@/lib/format";
import { Avatar } from "@/components/avatar";
import { Tooltip } from "@/components/ui";
import { useUiStore } from "@/lib/stores/ui";
import { useSignOut } from "@/hooks/use-sign-out";
import { useWorkspaces, useSwitchWorkspace } from "@/hooks/use-workspaces";

/**
 * The account menu (shell.jsx `TopBar` profile dropdown): an identity header,
 * quick facts (workspace / plant / open items / MFA), the account links, a
 * workspace switcher, and sign-out. Every value is real — resolved from
 * `GET /v1/me` and `GET /v1/me/workspaces`; nothing is placeholder.
 */
export function ProfileMenu({
  me,
}: {
  me: MeDto | undefined;
}): React.ReactElement {
  const t = useTranslations("profile");
  const router = useRouter();
  const signOut = useSignOut();
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);
  const setTweaksOpen = useUiStore((s) => s.setTweaksOpen);
  const { data: workspaces } = useWorkspaces();
  const switchWorkspace = useSwitchWorkspace();
  // Set right before opening the Tweaks panel from a menu item: Radix's default
  // "return focus to the trigger" on menu close fires a focusout that the
  // Dialog's own focus-scope reads as an outside interaction and dismisses it
  // in the same tick. Skipping that one auto-focus avoids the race.
  const skipCloseAutoFocus = useRef(false);

  const go = (href: string): void => {
    router.push(href);
  };

  const name = me?.name ?? "—";
  const role = me?.role !== undefined ? titleCase(me.role) : "";
  const leadPlant =
    me !== undefined && me.plants.length > 0 ? me.plants[0] : undefined;
  const roleLine =
    leadPlant !== undefined ? `${role} · ${leadPlant.code}` : role;
  const openItems: string[] = [];
  if (me !== undefined) {
    if (me.openNcrs > 0)
      openItems.push(t("openNcrs", { count: me.openNcrs }));
    if (me.openCapas > 0)
      openItems.push(t("openCapas", { count: me.openCapas }));
  }
  const openItemsLabel =
    openItems.length > 0 ? openItems.join(" · ") : t("noneOpen");
  const assignmentsHint =
    me !== undefined ? t("openItemsHint", { count: me.openNcrs + me.openCapas }) : "";

  const menuItems = [
    {
      label: t("yourProfile"),
      icon: User,
      hint: t("yourProfileHint"),
      href: "/settings/profile",
    },
    {
      label: t("accountSettings"),
      icon: Settings,
      hint: t("accountSettingsHint"),
      href: "/settings",
    },
    {
      label: t("myAssignments"),
      icon: ClipboardList,
      hint: assignmentsHint,
      href: "/ncrs?view=mine",
    },
  ];

  return (
    <DropdownMenu.Root>
      <Tooltip content={t("account")}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-md border border-transparent p-1 pr-2 data-[state=open]:border-border data-[state=open]:bg-bg-subtle"
          >
            <Avatar name={name} size={30} />
            <span className="hidden flex-col text-left leading-tight sm:flex">
              <span className="text-[12px] font-semibold text-text">
                {shortName(name)}
              </span>
              {role !== "" && (
                <span className="text-[10.5px] text-muted">{role}</span>
              )}
            </span>
            <ChevronDown size={14} className="hidden text-muted sm:block" />
          </button>
        </DropdownMenu.Trigger>
      </Tooltip>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          collisionPadding={8}
          className="k-surface fade-in z-50 w-[min(312px,calc(100vw-16px))] overflow-hidden p-0 shadow-xl"
          style={{ borderRadius: "var(--r-lg)" }}
          onCloseAutoFocus={(event) => {
            if (skipCloseAutoFocus.current) {
              event.preventDefault();
              skipCloseAutoFocus.current = false;
            }
          }}
        >
          {/* Identity header */}
          <div className="flex items-center gap-3 border-b border-border bg-bg-subtle px-4 py-3.5">
            <Avatar name={name} size={44} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold text-text">
                {name}
              </div>
              <div className="truncate text-[11.5px] text-muted">
                {me?.email ?? ""}
              </div>
              <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-border bg-accent-soft px-2 py-0.5 text-[10.5px] font-semibold text-accent">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: "#16a34a" }}
                />
                {roleLine}
              </div>
            </div>
          </div>

          {/* Quick facts */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-b border-border px-4 py-3">
            <Fact
              label={t("tenant")}
              value={me?.tenantName ?? me?.tenantSlug ?? "—"}
            />
            <Fact
              label={t("plant")}
              value={
                me === undefined
                  ? "—"
                  : me.plants.length === 0
                    ? t("allPlants")
                    : me.plants.length === 1
                      ? me.plants[0]!.name
                      : t("plantCount", { count: me.plants.length })
              }
            />
            <Fact label={t("openItems")} value={openItemsLabel} />
            <Fact
              label={t("mfa")}
              value={
                <span className="inline-flex items-center gap-1">
                  {me?.mfaEnabled === true ? (
                    <>
                      <ShieldCheck size={11} style={{ color: "#16a34a" }} />{" "}
                      {t("mfaEnabled")}
                    </>
                  ) : (
                    t("mfaNotSet")
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
                <DropdownMenu.Item
                  key={item.label}
                  onSelect={() => go(item.href)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-bg-subtle"
                >
                  <Icon size={15} className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-medium text-text">
                      {item.label}
                    </span>
                    {item.hint !== "" && (
                      <span className="block text-[10.5px] text-muted">
                        {item.hint}
                      </span>
                    )}
                  </span>
                </DropdownMenu.Item>
              );
            })}
            <DropdownMenu.Item
              onSelect={() => {
                // The menu's own onCloseAutoFocus (above) skips returning focus
                // to the trigger this one time — that focus-return is what was
                // closing the Tweaks panel in the same tick (see the ref above).
                skipCloseAutoFocus.current = true;
                setTimeout(() => setTweaksOpen(true), 0);
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-bg-subtle"
            >
              <SlidersHorizontal size={15} className="shrink-0 text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-medium text-text">{t("appearance")}</span>
                <span className="block text-[10.5px] text-muted">{t("appearanceHint")}</span>
              </span>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => setShortcutsOpen(true)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-bg-subtle"
            >
              <Keyboard size={15} className="shrink-0 text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-medium text-text">{t("keyboardShortcuts")}</span>
                <span className="block text-[10.5px] text-muted">{t("keyboardShortcutsHint")}</span>
              </span>
            </DropdownMenu.Item>
          </div>

          {/* Workspace switcher */}
          {workspaces !== undefined && workspaces.items.length > 0 && (
            <div className="border-t border-border p-1.5">
              <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">
                {workspaces.items.length > 1 ? t("switchWorkspace") : t("workspace")}
              </div>
              {workspaces.items.map((w) => (
                <DropdownMenu.Item
                  key={w.tenantSlug}
                  disabled={w.active || switchWorkspace.isPending}
                  onSelect={() => switchWorkspace.mutate(w.tenantSlug)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left hover:bg-bg-subtle disabled:cursor-default"
                >
                  <span
                    className="flex h-5.5 w-5.5 items-center justify-center rounded border border-border text-[10px] font-bold"
                    style={{
                      width: 22,
                      height: 22,
                      background: w.active
                        ? "var(--accent)"
                        : "var(--bg-subtle)",
                      color: w.active
                        ? "var(--accent-fg)"
                        : "var(--text-muted)",
                    }}
                  >
                    {w.tenantName.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-text">
                      {w.tenantName}
                    </span>
                    <span className="block truncate text-[10.5px] text-muted">
                      {titleCase(w.role)}
                    </span>
                  </span>
                  {w.active && (
                    <Check size={13} className="shrink-0 text-accent" />
                  )}
                </DropdownMenu.Item>
              ))}
            </div>
          )}

          {/* Sign out */}
          <div className="border-t border-border p-1.5">
            <DropdownMenu.Item
              onSelect={() => signOut.mutate()}
              disabled={signOut.isPending}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[12.5px] font-medium hover:bg-[rgba(220,38,38,0.08)]"
              style={{ color: "var(--danger-600)" }}
            >
              <LogOut size={15} /> {t("signOut")}
            </DropdownMenu.Item>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function Fact({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">
        {label}
      </div>
      <div className="truncate text-[11.5px] font-medium text-text">
        {value}
      </div>
    </div>
  );
}
