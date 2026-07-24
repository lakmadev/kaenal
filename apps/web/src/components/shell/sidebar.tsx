"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeft, X } from "lucide-react";
import type { MeDto } from "@kaenal/types";
import { cn } from "@/lib/cn";
import { useUiStore } from "@/lib/stores/ui";
import { hasCapability } from "@/hooks/use-me";
import { NAV_GROUPS } from "@/config/navigation";

/** Is `href` the active route (exact, or a parent of the current detail route)? */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The always-dark sidebar (04 §3): 260px, collapses to 72px (persisted), and
 * below 860px becomes an off-canvas drawer with a scrim. Nav items the user
 * lacks the capability for are omitted, not disabled (04 §6.6).
 */
export function Sidebar({ me }: { me: MeDto | undefined }): React.ReactElement {
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const mobileOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileOpen = useUiStore((s) => s.setMobileNavOpen);

  return (
    <>
      {/* Scrim behind the mobile drawer */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={cn(
          "z-50 flex flex-col bg-sidebar-bg text-sidebar-fg transition-[width] duration-200",
          "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:w-[260px]",
          mobileOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
          "max-lg:transition-transform",
          collapsed ? "lg:w-[72px]" : "lg:w-[260px]",
        )}
      >
        {/* Brand + collapse toggle */}
        <div className="flex h-14 items-center gap-2.5 px-4">
          <Logo />
          {!collapsed && <span className="text-[15px] font-bold tracking-tight text-sidebar-fg-active">Kaenal</span>}
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="ml-auto hidden rounded-md p-1.5 text-sidebar-fg hover:bg-white/10 lg:block"
          >
            <PanelLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className="ml-auto rounded-md p-1.5 text-sidebar-fg hover:bg-white/10 lg:hidden"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter(
              (i) => i.capability === undefined || hasCapability(me, i.capability),
            );
            if (items.length === 0) return null;
            return (
              <div key={group.label} className="mb-4">
                {!collapsed && (
                  <div className="k-overline px-2 py-1.5 !text-[10px] text-sidebar-fg/60">{group.label}</div>
                )}
                <ul className="flex flex-col gap-0.5">
                  {items.map((item) => {
                    const active = isActive(pathname, item.href);
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          title={collapsed ? item.label : undefined}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                            active
                              ? "bg-white/[0.08] text-sidebar-fg-active"
                              : "text-sidebar-fg hover:bg-white/[0.05] hover:text-sidebar-fg-active",
                            collapsed && "justify-center px-0",
                          )}
                        >
                          <Icon size={17} strokeWidth={active ? 2.2 : 1.8} className="shrink-0" />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Status footer */}
        <div className={cn("border-t border-white/10 px-4 py-3", collapsed && "px-0 text-center")}>
          <div className="flex items-center gap-2 text-[12px] text-sidebar-fg">
            <span className="pulse-dot shrink-0" />
            {!collapsed && <span>All systems operational</span>}
          </div>
        </div>
      </aside>
    </>
  );
}

function Logo(): React.ReactElement {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" className="shrink-0 text-sidebar-fg-active" aria-hidden>
      <path d="M3 12 L12 3 L21 12 L12 21 Z" fill="currentColor" fillOpacity="0.15" />
      <path d="M3 12 L12 3 L21 12 L12 21 Z" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      <path d="M8 12 L12 8 L16 12 L12 16 Z" fill="currentColor" />
    </svg>
  );
}
