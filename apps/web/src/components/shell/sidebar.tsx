"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { PanelLeft, X, ChevronDown } from "lucide-react";
import type { MeDto } from "@kaenal/types";
import { cn } from "@/lib/cn";
import { useUiStore } from "@/lib/stores/ui";
import { hasCapability } from "@/hooks/use-me";
import { NAV_GROUPS, type NavItem } from "@/config/navigation";

/** A parent item is active when the current path is it or a child route of it. */
function isParentActive(pathname: string, href: string): boolean {
  const base = href.split("?")[0] ?? href;
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * The always-dark sidebar (04 §3), matching `shell.jsx`: grouped items, some with
 * expandable sub-navigation (chevron), an accent left-border on the active item,
 * 260px collapsing to 72px, and an off-canvas drawer below 860px. Items the user
 * lacks the capability for are omitted, not disabled (04 §6.6).
 */
export function Sidebar({ me }: { me: MeDto | undefined }): React.ReactElement {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = searchParams.toString() === "" ? pathname : `${pathname}?${searchParams.toString()}`;

  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const mobileOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileOpen = useUiStore((s) => s.setMobileNavOpen);

  // Manual expand overrides; a section defaults to open when its route is active.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  return (
    <>
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
        <div className="flex h-14 items-center gap-2.5 px-4">
          <Logo />
          {!collapsed && <span className="text-[15px] font-bold tracking-[0.08em] text-sidebar-fg-active">KAENAL</span>}
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
            const items = group.items.filter((i) => i.capability === undefined || hasCapability(me, i.capability));
            if (items.length === 0) return null;
            return (
              <div key={group.label} className="mb-4">
                {!collapsed && <div className="k-overline px-2 py-1.5 !text-[10px] text-sidebar-fg/60">{group.label}</div>}
                <ul className="flex flex-col gap-0.5">
                  {items.map((item) => (
                    <NavRow
                      key={item.href}
                      item={item}
                      collapsed={collapsed}
                      active={isParentActive(pathname, item.href)}
                      currentUrl={currentUrl}
                      open={overrides[item.href] ?? isParentActive(pathname, item.href)}
                      onToggle={() =>
                        setOverrides((o) => ({ ...o, [item.href]: !(o[item.href] ?? isParentActive(pathname, item.href)) }))
                      }
                      onNavigate={() => setMobileOpen(false)}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

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

function NavRow({
  item,
  collapsed,
  active,
  currentUrl,
  open,
  onToggle,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
  currentUrl: string;
  open: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}): React.ReactElement {
  const Icon = item.icon;
  const hasChildren = item.children !== undefined && item.children.length > 0 && !collapsed;

  return (
    <li>
      <div
        className={cn(
          "group flex items-center rounded-md text-[13px] font-medium transition-colors",
          active ? "bg-white/[0.08] text-sidebar-fg-active" : "text-sidebar-fg hover:bg-white/[0.05]",
        )}
        style={active && !collapsed ? { borderLeft: "3px solid var(--sidebar-accent)" } : { borderLeft: "3px solid transparent" }}
      >
        <Link
          href={item.href}
          onClick={onNavigate}
          title={collapsed ? item.label : undefined}
          aria-current={active ? "page" : undefined}
          className={cn("flex flex-1 items-center gap-3 px-2.5 py-2", collapsed && "justify-center px-0")}
        >
          <Icon size={17} strokeWidth={active ? 2.2 : 1.8} className="shrink-0" />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </Link>
        {hasChildren && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={open ? `Collapse ${item.label}` : `Expand ${item.label}`}
            aria-expanded={open}
            className="px-2 py-2 text-sidebar-fg/70 hover:text-sidebar-fg-active"
          >
            <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
          </button>
        )}
      </div>

      {hasChildren && open && (
        <ul className="mt-0.5 flex flex-col gap-0.5">
          {item.children!.map((child) => {
            const childActive = currentUrl === child.href;
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  onClick={onNavigate}
                  aria-current={childActive ? "page" : undefined}
                  className={cn(
                    "block rounded-md py-1.5 pl-[42px] pr-3 text-[12.5px] transition-colors",
                    childActive
                      ? "bg-white/[0.05] text-sidebar-fg-active"
                      : "text-sidebar-fg/75 hover:text-sidebar-fg-active",
                  )}
                >
                  {child.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
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
