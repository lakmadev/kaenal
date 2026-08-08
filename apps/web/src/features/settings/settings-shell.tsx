"use client";

import { EmptyState } from "@/components/ui";
import { settingsItem } from "./settings-nav";
import { SettingsPage } from "./settings-bits";
import { ProfileSection } from "./sections/profile";
import { NotificationsSection } from "./sections/notifications";
import { SecuritySection } from "./sections/security";
import { PreferencesSection } from "./sections/preferences";
import { MembersSection } from "./sections/members";
import { WhiteLabelSection } from "./sections/white-label";
import { ValidationRulesSection } from "./sections/validation-rules";
import { SessionPoliciesSection } from "./sections/session-policies";
import { LegalHoldSection } from "./sections/legal-hold";
import { DlpPoliciesSection } from "./sections/dlp-policies";
import { CostCentersSection } from "./sections/cost-centers";

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
    case "white-label":
      return <WhiteLabelSection />;
    case "validation":
      return <ValidationRulesSection />;
    case "sessions":
      return <SessionPoliciesSection />;
    case "legal-hold":
      return <LegalHoldSection />;
    case "dlp":
      return <DlpPoliciesSection />;
    case "cost-centers":
      return <CostCentersSection />;
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
