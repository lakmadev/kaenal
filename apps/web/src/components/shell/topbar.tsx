"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, PanelLeft, Search, Moon, Sun, Bell, LogOut, ChevronRight } from "lucide-react";
import type { MeDto } from "@kaenal/types";
import { useTheme } from "@/lib/theme";
import { useUiStore } from "@/lib/stores/ui";
import { useSignOut } from "@/hooks/use-sign-out";
import { ROUTE_LABELS } from "@/config/navigation";
import { Button } from "@/components/ui";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const signOut = useSignOut();

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
          className="k-input flex items-center gap-2 text-left text-muted"
          aria-label="Search"
        >
          <Search size={15} />
          <span className="text-[13px]">Search inspections, NCRs, 8Ds…</span>
          <span className="kbd ml-auto">⌘K</span>
        </button>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button type="button" aria-label="Notifications" className="k-btn k-btn-plain k-btn-icon relative">
          <Bell size={18} />
        </button>
        <button
          type="button"
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          onClick={toggleTheme}
          className="k-btn k-btn-plain k-btn-icon"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Profile menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            {(me?.tenantSlug ?? "K").slice(0, 2).toUpperCase()}
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setMenuOpen(false)}
              />
              <div
                role="menu"
                className="k-surface fade-in absolute right-0 z-50 mt-2 w-56 p-1 shadow-lg"
              >
                <div className="px-3 py-2">
                  <div className="text-[13px] font-semibold text-text">{me?.role ?? "—"}</div>
                  <div className="mono text-[11px] text-muted">{me?.tenantSlug ?? ""}</div>
                </div>
                <div className="my-1 h-px bg-border" />
                <Button
                  variant="plain"
                  className="w-full justify-start"
                  loading={signOut.isPending}
                  onClick={() => signOut.mutate()}
                  role="menuitem"
                >
                  <LogOut size={15} />
                  Sign out
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
