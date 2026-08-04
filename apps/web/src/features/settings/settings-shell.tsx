"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/ui";
import { SETTINGS_NAV, settingsItem } from "./settings-nav";
import { SettingsPage } from "./settings-bits";
import { ProfileSection } from "./sections/profile";
import { NotificationsSection } from "./sections/notifications";
import { SecuritySection } from "./sections/security";
import { PreferencesSection } from "./sections/preferences";

/**
 * Settings (settings.jsx `Settings`): a two-pane shell — a grouped section nav on
 * the left, the active section's content on the right. Sections are addressable
 * (`/settings/<id>`) so they're linkable and back/forward works. The Personal
 * group is built; other sections render an in-shell "coming soon" placeholder so
 * the full settings map is present and navigable (design rule #9).
 */
export function SettingsShell({ section }: { section: string }): React.ReactElement {
  return (
    <div className="fade-in flex" style={{ height: "calc(100vh - 56px)" }}>
      <nav
        className="shrink-0 overflow-y-auto border-r border-border bg-surface px-3 py-5"
        style={{ width: 240 }}
        aria-label="Settings sections"
      >
        <div className="px-2 pb-3.5 text-[17px] font-bold">Settings</div>
        {SETTINGS_NAV.map((grp) => (
          <div key={grp.group} className="mb-[18px]">
            <div className="k-overline px-2 pb-1.5">{grp.group}</div>
            {grp.items.map((it) => {
              const Icon = it.icon;
              const active = it.id === section;
              return (
                <Link
                  key={it.id}
                  href={`/settings/${it.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "mb-px flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                    active ? "text-accent" : "text-text hover:bg-[var(--bg-subtle)]",
                  )}
                  style={active ? { background: "var(--accent-soft)", color: "var(--accent)" } : undefined}
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

      <div className="min-w-0 flex-1 overflow-y-auto">
        <SectionContent section={section} />
      </div>
    </div>
  );
}

function SectionContent({ section }: { section: string }): React.ReactElement {
  switch (section) {
    case "profile":
      return <ProfileSection />;
    case "notifications":
      return <NotificationsSection />;
    case "security":
      return <SecuritySection />;
    case "preferences":
      return <PreferencesSection />;
    default:
      return <ComingSoon section={section} />;
  }
}

function ComingSoon({ section }: { section: string }): React.ReactElement {
  const item = settingsItem(section);
  const label = item?.label ?? "This section";
  const Icon = item?.icon;
  return (
    <SettingsPage title={label} subtitle="Workspace &amp; enterprise settings">
      <div className="k-surface">
        <EmptyState
          {...(Icon !== undefined ? { icon: Icon } : {})}
          title={`${label} is coming soon`}
          body="This settings section is next on the build plan. The Personal group (Profile, Notifications, Security, Preferences) is available now."
        />
      </div>
    </SettingsPage>
  );
}
