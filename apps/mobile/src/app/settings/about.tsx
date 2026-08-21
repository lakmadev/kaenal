import { Image, Linking, Platform, Pressable, View } from "react-native";

import { SubHeader } from "@/features/settings/parts";
import { useLayout } from "@/hooks/use-layout";
import { APP_BUILD, APP_CHANNEL, APP_NAME, APP_VERSION, RUNTIME } from "@/lib/app-info";
import { useSession } from "@/stores/session";
import { useTheme } from "@/theme";
import { Body, Card, Icon, Screen, SectionLabel, Text, type IconName } from "@/ui";

const ICON = require("../../../assets/images/icon.png") as number;

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { palette } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.border,
      }}
    >
      <Text size={14} style={{ flex: 1 }}>
        {label}
      </Text>
      <Text size={13} tone="muted">
        {value}
      </Text>
    </View>
  );
}

function LinkRow({ icon, title, url, last }: { icon: IconName; title: string; url: string; last?: boolean }) {
  const { palette, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={title}
      onPress={() => void Linking.openURL(url).catch(() => {})}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.border,
        backgroundColor: pressed ? palette.bgSubtle : "transparent",
      })}
    >
      <View
        style={{ width: 30, height: 30, borderRadius: radius.md, backgroundColor: palette.bgSubtle, alignItems: "center", justifyContent: "center" }}
      >
        <Icon name={icon} size={16} color={palette.text} />
      </View>
      <Text size={14} weight="medium" style={{ flex: 1 }}>
        {title}
      </Text>
      <Icon name="chevronRight" size={16} color={palette.subtle} />
    </Pressable>
  );
}

// About & version (m-system.jsx SettingsRoot "About & version" row → real detail).
// Everything here is REAL — version/build/channel come from expo-constants, workspace
// from the live session; no placeholder strings.
export default function About() {
  const { contentMaxWidth } = useLayout();
  const me = useSession((s) => s.me);

  return (
    <Screen>
      <SubHeader title="About" />
      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth, paddingTop: 8 }}>
          <View style={{ alignItems: "center", gap: 10, paddingVertical: 22 }}>
            <Image source={ICON} style={{ width: 76, height: 76, borderRadius: 18 }} />
            <View style={{ alignItems: "center" }}>
              <Text size={19} weight="bold">
                {APP_NAME}
              </Text>
              <Text size={13} tone="muted" style={{ marginTop: 3 }}>
                Version {APP_VERSION} ({APP_BUILD})
              </Text>
            </View>
          </View>

          <SectionLabel style={{ paddingHorizontal: 20, paddingBottom: 8 }}>Build</SectionLabel>
          <Card style={{ marginHorizontal: 16 }}>
            <InfoRow label="Version" value={APP_VERSION} />
            <InfoRow label="Build" value={APP_BUILD} />
            <InfoRow label="Release channel" value={APP_CHANNEL} />
            <InfoRow label="Runtime" value={RUNTIME} last />
          </Card>

          <SectionLabel style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>Workspace</SectionLabel>
          <Card style={{ marginHorizontal: 16 }}>
            <InfoRow label="Workspace" value={me?.tenantName ?? "—"} />
            <InfoRow label="Signed in as" value={me?.email ?? "—"} last />
          </Card>

          <SectionLabel style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>Legal</SectionLabel>
          <Card style={{ marginHorizontal: 16 }}>
            <LinkRow icon="shield" title="Privacy policy" url="https://kaenal.app/privacy" />
            <LinkRow icon="doc" title="Terms of service" url="https://kaenal.app/terms" />
            <LinkRow icon="globe" title="kaenal.app" url="https://kaenal.app" last />
          </Card>

          <Text size={11.5} tone="muted" style={{ textAlign: "center", paddingTop: 18, paddingHorizontal: 24, lineHeight: 17 }}>
            © {new Date().getFullYear()} Kaenal · Quality & Safety Management{Platform.OS === "web" ? " · installed web app" : ""}
          </Text>
          <View style={{ height: 24 }} />
        </View>
      </Body>
    </Screen>
  );
}
