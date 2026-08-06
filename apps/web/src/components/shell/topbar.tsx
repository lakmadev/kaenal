"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, PanelLeft, Search, Moon, Sun, Bell, ChevronRight } from "lucide-react";
import type { MeDto } from "@kaenal/types";
import { useTheme } from "@/lib/theme";
import { useUiStore } from "@/lib/stores/ui";
import { useUnreadCount } from "@/hooks/use-notifications";
import { ROUTE_LABELS } from "@/config/navigation";
import { NotificationsPanel } from "@/features/notifications/notifications-panel";
import { ProfileMenu } from "./profile-menu";

function Breadcrumbs({ pathname }: { pathname: string }): React.ReactElement {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0] ?? "dashboard";
  const label = ROUTE_LABELS[first] ?? first.charAt(0).toUpperCase() + first.slice(1);
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px]">
      <span className="text-muted">Workspace</span>
      <ChevronRight size={14} className="text-subtle" />
      <span className="font-medium text-text">{label}</span>
    </nav>
  );
}

/**
 * Sticky 56px top bar (04 §3): mobile nav toggle, breadcrumbs, the global search
 * that opens the command palette (⌘K — wired in a later slice), live-mode/AI
 * affordances (later), notifications, theme toggle, and the profile menu.
 */
export function Topbar({ me }: { me: MeDto | undefined }): React.ReactElement {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const setMobileOpen = useUiStore((s) => s.setMobileNavOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const openCommand = useUiStore((s) => s.setCommandOpen);
  const [notifOpen, setNotifOpen] = useState(false);
  const { data: unread } = useUnreadCount();
  const unreadCount = unread?.count ?? 0;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
      {/* Sidebar toggle (04 §3 / shell.jsx) — collapse on desktop, open drawer on mobile. */}
      <button
        type="button"
        aria-label="Collapse sidebar"
        onClick={toggleSidebar}
        className="k-btn k-btn-plain k-btn-icon hidden lg:flex"
      >
        <PanelLeft size={18} />
      </button>
      <button
        type="button"
        aria-label="Open navigation"
        onClick={() => setMobileOpen(true)}
        className="k-btn k-btn-plain k-btn-icon lg:hidden"
      >
        <Menu size={18} />
      </button>

      <Breadcrumbs pathname={pathname} />

      <div className="mx-auto hidden w-full max-w-[400px] md:block">
        <button
          type="button"
          onClick={() => openCommand(true)}
          className="k-input flex w-full items-center gap-2 text-left text-muted"
          aria-label="Search"
        >
          <Search size={15} />
          <span className="text-[13px]">Search inspections, NCRs, 8Ds…</span>
          <span className="kbd ml-auto">⌘K</span>
        </button>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          aria-label="Search"
          onClick={() => openCommand(true)}
          className="k-btn k-btn-plain k-btn-icon md:hidden"
        >
          <Search size={18} />
        </button>
        <button
          type="button"
          aria-label="Notifications"
          onClick={() => setNotifOpen((v) => !v)}
          aria-expanded={notifOpen}
          className="k-btn k-btn-plain k-btn-icon relative"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span
              className="pointer-events-none absolute -right-1 -top-1 z-10 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-[5px] text-[10px] font-bold leading-none text-white"
              style={{ border: "2px solid var(--surface)" }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
        {notifOpen && <NotificationsPanel onClose={() => setNotifOpen(false)} />}
        <button
          type="button"
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          onClick={toggleTheme}
          className="k-btn k-btn-plain k-btn-icon"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Profile menu */}
        <ProfileMenu me={me} />
      </div>
    </header>
  );
}
