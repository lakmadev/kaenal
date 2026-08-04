"use client";

import { EmptyState } from "@/components/ui";
import { settingsItem } from "./settings-nav";
import { SettingsPage } from "./settings-bits";
import { ProfileSection } from "./sections/profile";
import { NotificationsSection } from "./sections/notifications";
import { SecuritySection } from "./sections/security";
import { PreferencesSection } from "./sections/preferences";
import { MembersSection } from "./sections/members";

/**
 * The active settings section's content. The section rail lives in the settings
 * layout (`SettingsNavRail`), so this component is the only thing that swaps on
 * navigation. The Personal group is built; other sections render an in-shell
 * "coming soon" placeholder so the full settings map stays navigable (rule #9).
 */
export function SettingsContent({ section }: { section: string }): React.ReactElement {
  switch (section) {
    case "profile":
      return <ProfileSection />;
    case "notifications":
      return <NotificationsSection />;
    case "security":
      return <SecuritySection />;
    case "preferences":
      return <PreferencesSection />;
    case "members":
      return <MembersSection />;
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
