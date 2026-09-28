import { useSafeBack } from "@/hooks/use-safe-back";
import { useState } from "react";
import { Linking, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLayout } from "@/hooks/use-layout";
import { API_BASE_URL } from "@/lib/api";
import { webUrl } from "@/lib/web-links";
import { useTheme } from "@/theme";
import { Body, Card, Icon, Screen, Text, type IconName } from "@/ui";

// `path` = the built web route/section (verified against apps/web routes and
// settings-nav.ts `built: true`).
const AREAS: { icon: IconName; title: string; desc: string; path: string }[] = [
  { icon: "reports", title: "Report builder", desc: "Custom SPC & compliance reports", path: "/reports" },
  { icon: "plug", title: "Integrations & connectors", desc: "ERP, MES, webhooks", path: "/settings/integrations" },
  { icon: "upload", title: "Bulk import", desc: "Assets, templates, users", path: "/settings/bulk-import" },
  { icon: "user", title: "Members & roles", desc: "RBAC, invitations, groups", path: "/settings/members" },
  { icon: "shield", title: "Session & security policy", desc: "MFA rules, IP allowlists", path: "/settings/sessions" },
  { icon: "palette", title: "White-label & branding", desc: "Logos, domains, themes", path: "/settings/white-label" },
  { icon: "lineChart", title: "SPC authoring", desc: "Control charts & rules", path: "/spc" },
];

// m-oversight.jsx ManageInWeb — config-heavy areas that live in the desktop app.
export default function ManageInWeb() {
  const goBack = useSafeBack("/(app)/home");
  const insets = useSafeAreaInsets();
  const { palette, radius } = useTheme();
  const { contentMaxWidth } = useLayout();

  const [error, setError] = useState<string | null>(null);

  async function openWeb(a: (typeof AREAS)[number]): Promise<void> {
    const url = webUrl(a.path, process.env.EXPO_PUBLIC_WEB_URL, API_BASE_URL);
    if (!url) {
      setError("The web app address isn't configured for this build (set EXPO_PUBLIC_WEB_URL).");
      return;
    }
    try {
      if (Platform.OS === "web") {
        const w = window.open(url, "_blank", "noopener");
        if (!w) window.location.assign(url);
      } else {
        await Linking.openURL(url);
      }
      setError(null);
    } catch {
      setError(`Couldn't open ${a.title} in the web app. Open ${url} in a browser instead.`);
    }
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
          {error ? (
            <Card style={{ padding: 12, marginBottom: 12, backgroundColor: palette.dangerBg, borderWidth: 0 }}>
              <Text size={12.5} weight="semibold" color={palette.dangerFg} accessibilityRole="alert">
                {error}
              </Text>
            </Card>
          ) : null}
          {AREAS.map((a, i, arr) => (
            <Pressable key={a.title} onPress={() => void openWeb(a)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
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
