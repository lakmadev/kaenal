"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { SETTINGS_NAV, DEFAULT_SETTINGS_SECTION, settingsItem } from "./settings-nav";

/**
 * The settings section rail. Lives in the settings *layout* (not the page), so it
 * stays mounted while only the right-hand content swaps between sections — no
 * flicker or re-fetch on navigation. The active section is derived from the URL.
 */
export function SettingsNavRail(): React.ReactElement {
  const pathname = usePathname();
  const slug = pathname.split("/")[2];
  const active = slug !== undefined && settingsItem(slug) !== undefined ? slug : DEFAULT_SETTINGS_SECTION;

  const allItems = SETTINGS_NAV.flatMap((grp) => grp.items);

  return (
    <>
      {/* Mobile: a horizontal, scrollable strip of every section (groups flattened). */}
      <nav
        className="flex gap-1.5 overflow-x-auto border-b border-border bg-surface px-3 py-2.5 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
        aria-label="Settings sections"
      >
        {allItems.map((it) => {
          const Icon = it.icon;
          const isActive = it.id === active;
          return (
            <Link
              key={it.id}
              href={`/settings/${it.id}`}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                isActive ? "text-accent" : "text-text hover:bg-[var(--bg-subtle)]",
              )}
              style={isActive ? { background: "var(--accent-soft)", color: "var(--accent)" } : undefined}
            >
              <Icon size={14} strokeWidth={1.75} className="shrink-0" />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Desktop: the grouped vertical rail. */}
      <nav
        className="hidden w-60 shrink-0 overflow-y-auto border-r border-border bg-surface px-3 py-5 md:block"
        aria-label="Settings sections"
      >
        <div className="px-2 pb-3.5 text-[17px] font-bold">Settings</div>
        {SETTINGS_NAV.map((grp) => (
          <div key={grp.group} className="mb-[18px]">
            <div className="k-overline px-2 pb-1.5">{grp.group}</div>
            {grp.items.map((it) => {
              const Icon = it.icon;
              const isActive = it.id === active;
              return (
                <Link
                  key={it.id}
                  href={`/settings/${it.id}`}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "mb-px flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                    isActive ? "text-accent" : "text-text hover:bg-[var(--bg-subtle)]",
                  )}
                  style={isActive ? { background: "var(--accent-soft)", color: "var(--accent)" } : undefined}
                >
                  <Icon size={14} strokeWidth={1.75} className="shrink-0" />
                  <span className="flex-1 text-left">{it.label}</span>
                  {it.count !== undefined && <span className="text-[11px] text-subtle">{it.count}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </>
  );
}
