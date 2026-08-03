"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { X, ChevronDown } from "lucide-react";
import type { MeDto } from "@kaenal/types";
import { cn } from "@/lib/cn";
import { useUiStore } from "@/lib/stores/ui";
import { hasCapability } from "@/hooks/use-me";
import { NAV, SETTINGS_ITEM, isDivider, type NavItem } from "@/config/navigation";

/** A parent item is active when the current path is it or a child route of it. */
function isParentActive(pathname: string, href: string): boolean {
  const base = href.split("?")[0] ?? href;
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Sections that render expanded on first load, matching `shell.jsx`. */
const DEFAULT_OPEN = new Set(["inspections", "ncrs", "8d", "audits", "capa", "reports"]);

/** One section = an optional overline label + the items beneath it, capability-filtered. */
interface Section {
  label: string | null;
  items: NavItem[];
}

/** Collapse the flat NAV (dividers + items) into capability-filtered sections. */
function buildSections(me: MeDto | undefined): Section[] {
  const sections: Section[] = [{ label: null, items: [] }];
  for (const entry of NAV) {
    if (isDivider(entry)) {
      sections.push({ label: entry.label, items: [] });
      continue;
    }
    if (entry.capability !== undefined && !hasCapability(me, entry.capability)) continue;
    sections[sections.length - 1]!.items.push(entry);
  }
  return sections.filter((s) => s.items.length > 0);
}

/**
 * The always-dark sidebar (04 §3) — a faithful port of `shell.jsx` (design rule #9):
 * an ungrouped top cluster, then "Supply chain / Quality system / Platform / External"
 * sections; count badges, expandable sub-navigation, an accent left-border on the
 * active item, Settings pinned to the footer with a status pill. 260px collapses to
 * 72px (persisted) and becomes an off-canvas drawer below the `lg` breakpoint. Items
 * the user lacks the capability for are omitted, not disabled (04 §6.6).
 */
export function Sidebar({ me }: { me: MeDto | undefined }): React.ReactElement {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = searchParams.toString() === "" ? pathname : `${pathname}?${searchParams.toString()}`;

  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const mobileOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileOpen = useUiStore((s) => s.setMobileNavOpen);

  // Manual expand overrides; a section defaults to open per DEFAULT_OPEN.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const sections = buildSections(me);
  const settingsActive = isParentActive(pathname, SETTINGS_ITEM.href);

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
          "z-50 flex h-screen flex-col bg-sidebar-bg text-sidebar-fg transition-[width] duration-200",
          "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:w-[272px]",
          mobileOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
          "max-lg:transition-transform",
          collapsed ? "lg:w-[72px]" : "lg:w-[260px]",
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            "flex h-14 items-center gap-2.5 border-b border-white/[0.06]",
            collapsed ? "justify-center px-0" : "px-5",
          )}
        >
          <Logo />
          {!collapsed && (
            <span className="text-[16px] font-bold tracking-[0.08em] text-white">KAENAL</span>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className="ml-auto rounded-md p-1.5 text-sidebar-fg hover:bg-white/10 lg:hidden"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className={cn("flex-1 overflow-y-auto py-3", collapsed ? "px-2" : "px-3")}>
          {sections.map((section, si) => (
            <div key={section.label ?? `top-${si}`}>
              {section.label !== null &&
                (collapsed ? (
                  <div className="mx-2 my-2.5 h-px bg-white/[0.08]" />
                ) : (
                  <div className="px-3 pb-1.5 pt-3.5 text-[10px] font-bold uppercase tracking-[0.1em] text-sidebar-fg/50">
                    {section.label}
                  </div>
                ))}
              {section.items.map((item) => (
                <NavRow
                  key={item.id}
                  item={item}
                  collapsed={collapsed}
                  active={isParentActive(pathname, item.href)}
                  currentUrl={currentUrl}
                  open={overrides[item.id] ?? DEFAULT_OPEN.has(item.id)}
                  onToggle={() =>
                    setOverrides((o) => ({ ...o, [item.id]: !(o[item.id] ?? DEFAULT_OPEN.has(item.id)) }))
                  }
                  onNavigate={() => setMobileOpen(false)}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* Footer: Settings + status pill */}
        <div className={cn("border-t border-white/[0.06]", collapsed ? "p-2" : "p-3")}>
          <Link
            href={SETTINGS_ITEM.href}
            onClick={() => setMobileOpen(false)}
            title={collapsed ? "Settings" : undefined}
            aria-current={settingsActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-colors",
              collapsed ? "justify-center px-0 py-2.5" : "px-2.5 py-2",
              settingsActive
                ? "bg-white/[0.08] text-sidebar-fg-active"
                : "text-sidebar-fg hover:bg-white/[0.05]",
            )}
          >
            <SETTINGS_ITEM.icon size={18} strokeWidth={1.75} className="shrink-0" />
            {!collapsed && <span>Settings</span>}
          </Link>
          {!collapsed && (
            <div className="mt-3 flex items-center gap-2 rounded-md bg-white/[0.04] px-3 py-2.5 text-[11px] text-sidebar-fg/70">
              <span className="pulse-dot shrink-0" />
              <span>All systems operational</span>
            </div>
          )}
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
  const showBadge = item.badge !== undefined && !collapsed;

  return (
    <div className="mb-0.5">
      <div
        className={cn(
          "group flex items-center rounded-md text-[13px] font-medium transition-colors",
          active ? "text-sidebar-fg-active" : "text-sidebar-fg hover:bg-white/[0.04]",
        )}
        style={{
          background: active ? "var(--sidebar-active-bg)" : undefined,
          borderLeft: active && !collapsed ? "3px solid var(--sidebar-accent)" : "3px solid transparent",
        }}
      >
        <Link
          href={item.href}
          onClick={onNavigate}
          title={collapsed ? item.label : undefined}
          aria-current={active ? "page" : undefined}
          className={cn("flex flex-1 items-center gap-2.5 py-2", collapsed ? "justify-center px-0" : "pl-2.5 pr-2")}
        >
          <Icon size={18} strokeWidth={1.75} className="shrink-0" />
          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
          {showBadge && <Badge value={item.badge!} accent={item.badgeAccent} />}
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
        <div className="mt-0.5">
          {item.children!.map((child) => {
            const childActive = currentUrl === child.href;
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                aria-current={childActive ? "page" : undefined}
                className={cn(
                  "mb-px block rounded-md py-[7px] pl-[42px] pr-3 text-[12.5px] transition-colors",
                  childActive
                    ? "bg-white/[0.04] text-sidebar-fg-active"
                    : "text-sidebar-fg/75 hover:text-white",
                )}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Count pill. Danger = solid red; everything else = subtle white (matches shell.jsx). */
function Badge({ value, accent }: { value: number; accent?: "danger" | "warn" | undefined }): React.ReactElement {
  const danger = accent === "danger";
  return (
    <span
      className="ml-1 min-w-[18px] rounded-full px-1.5 text-center text-[10px] font-bold"
      style={{
        background: danger ? "#dc2626" : "rgba(255,255,255,0.14)",
        color: danger ? "white" : "var(--sidebar-fg-active)",
      }}
    >
      {value}
    </span>
  );
}

function Logo(): React.ReactElement {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" className="shrink-0 text-sidebar-accent" aria-hidden>
      <path d="M3 12 L12 3 L21 12 L12 21 Z" fill="currentColor" fillOpacity="0.15" />
      <path d="M3 12 L12 3 L21 12 L12 21 Z" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      <path d="M8 12 L12 8 L16 12 L12 16 Z" fill="currentColor" />
    </svg>
  );
}
