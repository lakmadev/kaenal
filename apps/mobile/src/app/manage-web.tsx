import { useSafeBack } from "@/hooks/use-safe-back";
import { Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLayout } from "@/hooks/use-layout";
import { useTheme } from "@/theme";
import { Body, Card, Icon, Screen, Text, type IconName } from "@/ui";

const AREAS: { icon: IconName; title: string; desc: string }[] = [
  { icon: "reports", title: "Report builder", desc: "Custom SPC & compliance reports" },
  { icon: "plug", title: "Integrations & connectors", desc: "ERP, MES, webhooks" },
  { icon: "upload", title: "Bulk import", desc: "Assets, templates, users" },
  { icon: "user", title: "Members & roles", desc: "RBAC, invitations, groups" },
  { icon: "shield", title: "Session & security policy", desc: "MFA rules, IP allowlists" },
  { icon: "palette", title: "White-label & branding", desc: "Logos, domains, themes" },
  { icon: "lineChart", title: "SPC authoring", desc: "Control charts & rules" },
];

// m-oversight.jsx ManageInWeb — config-heavy areas that live in the desktop app.
export default function ManageInWeb() {
  const goBack = useSafeBack("/(app)/home");
  const insets = useSafeAreaInsets();
  const { palette, radius } = useTheme();
  const { contentMaxWidth } = useLayout();

  function openWeb(title: string): void {
    if (Platform.OS === "web") window.alert(`${title} opens in the desktop app with your session.`);
  }

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 6, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingBottom: 10 }}>
          <Pressable onPress={goBack} hitSlop={8} style={{ padding: 4 }}>
            <Icon name="chevronLeft" size={24} stroke={2} color={palette.text} />
          </Pressable>
          <View>
            <Text size={11.5} weight="semibold" tone="muted">
              Admin
            </Text>
            <Text size={17} weight="bold">
              Manage in web app
            </Text>
          </View>
        </View>
      </View>

      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth, padding: 16 }}>
          <Card style={{ padding: 14, flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: palette.bgSubtle, borderWidth: 0, marginBottom: 16 }}>
            <Icon name="info" size={18} color={palette.muted} />
            <Text size={12.5} tone="muted" style={{ flex: 1, lineHeight: 18 }}>
              These config-heavy areas live in the desktop app. We'll open them there with your session.
            </Text>
          </Card>
          {AREAS.map((a, i, arr) => (
            <Pressable key={a.title} onPress={() => openWeb(a.title)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: palette.border }}>
                <View style={{ width: 34, height: 34, borderRadius: radius.lg, backgroundColor: palette.bgSubtle, alignItems: "center", justifyContent: "center" }}>
                  <Icon name={a.icon} size={17} color={palette.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text size={14} weight="semibold">
                    {a.title}
                  </Text>
                  <Text size={11.5} tone="muted">
                    {a.desc}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <Text size={11.5} weight="semibold" color={palette.accent}>
                    Web
                  </Text>
                  <Icon name="arrowRight" size={13} color={palette.accent} />
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </Body>
    </Screen>
  );
}
