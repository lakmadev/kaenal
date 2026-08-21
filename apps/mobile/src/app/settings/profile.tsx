import { View } from "react-native";

import { SettingRow, SettingsGroup, SubHeader } from "@/features/settings/parts";
import { useLayout } from "@/hooks/use-layout";
import { useSession } from "@/stores/session";
import { useTheme } from "@/theme";
import { Avatar, Body, Card, Icon, Screen, SectionLabel, Text } from "@/ui";

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : "")).toUpperCase() || "?";
}

// m-settings-detail.jsx ProfileEdit — read-mostly on mobile (identity is the shared
// account; name/email are managed by the account/SSO provider, not per-tenant).
export default function Profile() {
  const { palette } = useTheme();
  const { contentMaxWidth } = useLayout();
  const me = useSession((s) => s.me);

  return (
    <Screen>
      <SubHeader title="Profile" />
      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth, paddingTop: 18 }}>
          <View style={{ alignItems: "center", gap: 10, paddingBottom: 20 }}>
            <Avatar initials={me ? initials(me.name) : "?"} size={76} tone="accent" />
          </View>

          <SectionLabel style={{ paddingHorizontal: 16, paddingBottom: 8 }}>Identity</SectionLabel>
          <SettingsGroup>
            <SettingRow icon="user" title="Full name" value={me?.name ?? "—"} />
            <SettingRow icon="mail" title="Email" value={me?.email ?? "—"} />
            <SettingRow icon="shieldCheck" title="Two-factor" value={me?.mfaEnabled ? "On" : "Off"} last />
          </SettingsGroup>

          <Card style={{ marginHorizontal: 16, padding: 14, backgroundColor: palette.bgSubtle, borderWidth: 0, flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Icon name="lock" size={16} color={palette.muted} />
            <Text size={12.5} tone="muted" style={{ flex: 1, lineHeight: 18 }}>
              Your name and email belong to your Kaenal account and are managed at sign-in / SSO — not per
              workspace. Update them from account settings on the web.
            </Text>
          </Card>
        </View>
      </Body>
    </Screen>
  );
}
