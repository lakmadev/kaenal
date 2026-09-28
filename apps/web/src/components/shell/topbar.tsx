"use client";

import { Suspense, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Menu,
  PanelLeft,
  Search,
  Moon,
  Sun,
  Bell,
  ChevronRight,
} from "lucide-react";
import type { MeDto } from "@kaenal/types";
import { useTheme } from "@/lib/theme";
import { useUiStore } from "@/lib/stores/ui";
import { useUnreadCount } from "@/hooks/use-notifications";
import { useEntityCode } from "@/hooks/use-entity-code";
import { breadcrumbsFor } from "@/config/breadcrumbs";
import { Tooltip } from "@/components/ui";
import { NotificationsPanel } from "@/features/notifications/notifications-panel";
import { AiButton } from "@/features/ai/ai-button";
import { ProfileMenu } from "./profile-menu";
import { QuickCreateButton } from "./quick-create";
import { LiveModeButton } from "./live-mode-button";

function Breadcrumbs({ pathname }: { pathname: string }): React.ReactElement {
  const view = useSearchParams().get("view");
  const entityCode = useEntityCode(pathname);
  const crumbs = breadcrumbsFor(pathname, view, entityCode);
  const base =
    "max-w-[280px] truncate whitespace-nowrap rounded-sm px-1.5 py-1";
  return (
    <ol className="m-0 flex min-w-0 list-none items-center gap-2 p-0">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <li
            key={`${c.label}-${i}`}
            className="flex min-w-0 items-center gap-2"
          >
            {i > 0 && (
              <ChevronRight
                size={14}
                strokeWidth={1.5}
                className="shrink-0 text-subtle"
              />
            )}
            {c.href !== undefined ? (
              <Link
                href={c.href}
                className={`${base} text-muted hover:bg-bg-subtle`}
              >
                {c.label}
              </Link>
            ) : (
              <span
                className={`${base} ${last ? "font-semibold text-text" : "text-muted"}`}
                aria-current={last ? "page" : undefined}
              >
                {c.label}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Sticky 56px top bar (04 §3): mobile nav toggle, breadcrumbs, the global search
 * that opens the command palette (⌘K — wired in a later slice), live-mode/AI
 * affordances (later), notifications, theme toggle, and the profile menu.
 */
export function Topbar({ me }: { me: MeDto | undefined }): React.ReactElement {
  const t = useTranslations("topbar");
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const setMobileOpen = useUiStore((s) => s.setMobileNavOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const openCommand = useUiStore((s) => s.setCommandOpen);
  const [notifOpen, setNotifOpen] = useState(false);
  const { data: unread } = useUnreadCount();
  const unreadCount = unread?.count ?? 0;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-surface px-5">
      {/* Sidebar toggle (04 §3 / shell.jsx) — collapse on desktop, open drawer on mobile. */}
      <button
        type="button"
        aria-label={t("collapseSidebar")}
        onClick={toggleSidebar}
        className="k-btn k-btn-plain k-btn-icon hidden lg:flex"
      >
        <PanelLeft size={18} />
      </button>
      <button
        type="button"
        aria-label={t("openNavigation")}
        onClick={() => setMobileOpen(true)}
        className="k-btn k-btn-plain k-btn-icon lg:hidden"
      >
        <Menu size={18} />
      </button>

      <nav aria-label={t("breadcrumb")} className="min-w-0 flex-1 text-[13px]">
        {/* useSearchParams needs a Suspense boundary; the fallback is the path without a view. */}
        <Suspense fallback={<span className="px-1.5 text-muted">…</span>}>
          <Breadcrumbs pathname={pathname} />
        </Suspense>
      </nav>

      <button
        type="button"
        onClick={() => openCommand(true)}
        aria-label={t("search")}
        className="hidden h-[38px] w-[400px] max-w-[40vw] items-center gap-2.5 rounded-md border border-border bg-bg-subtle pl-3.5 pr-2 text-left text-[13px] text-muted md:inline-flex"
      >
        <Search size={16} strokeWidth={1.75} />
        <span className="flex-1 truncate">{t("searchPlaceholder")}</span>
        <kbd className="shrink-0 rounded border border-border bg-surface px-[7px] py-[3px] font-mono text-[10.5px] text-muted">
          ⌘K
        </kbd>
      </button>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={t("search")}
          onClick={() => openCommand(true)}
          className="k-btn k-btn-plain k-btn-icon md:hidden"
        >
          <Search size={18} />
        </button>
        {/* Quick-create "New" menu (S1-1, shell.jsx line 290 placement) — sits
            before Live/AI. */}
        <QuickCreateButton />
        {me !== undefined && <LiveModeButton userId={me.userId} />}
        <AiButton />
        <Popover.Root open={notifOpen} onOpenChange={setNotifOpen}>
          {/* Anchor pinned 18px from the right edge under the 56px bar, as in notifications.jsx. */}
          <Popover.Anchor asChild>
            <span className="pointer-events-none fixed right-2 top-14 h-0 w-0 sm:right-[18px]" />
          </Popover.Anchor>
          <Tooltip content={t("notifications")}>
            <Popover.Trigger asChild>
              <button
                type="button"
                aria-label={t("notifications")}
                className="k-btn k-btn-plain k-btn-icon relative"
              >
                <Bell size={17} strokeWidth={1.75} />
                {unreadCount > 0 && (
                  <span
                    className="pointer-events-none absolute right-1 top-1 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9.5px] font-bold leading-none text-white"
                    style={{ border: "2px solid var(--surface)" }}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            </Popover.Trigger>
          </Tooltip>
          <Popover.Portal>
            <Popover.Content
              side="bottom"
              align="end"
              sideOffset={0}
              collisionPadding={8}
              className="k-surface fade-in z-50 flex max-h-[calc(100vh-80px)] w-[min(420px,calc(100vw-16px))] flex-col p-0 shadow-xl"
              style={{ borderRadius: "var(--r-lg)" }}
            >
              <NotificationsPanel onClose={() => setNotifOpen(false)} />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <Tooltip content={t("toggleTheme")}>
          <button
            type="button"
            aria-label={
              theme === "dark"
                ? t("switchToLight")
                : t("switchToDark")
            }
            onClick={toggleTheme}
            className="k-btn k-btn-plain k-btn-icon"
          >
            {theme === "dark" ? (
              <Sun size={17} strokeWidth={1.75} />
            ) : (
              <Moon size={17} strokeWidth={1.75} />
            )}
          </button>
        </Tooltip>

        {/* Profile menu (divider on its left, shell.jsx) */}
        <div className="ml-1 border-l border-border pl-2">
          <ProfileMenu me={me} />
        </div>
      </div>
    </header>
  );
}
