import { Pressable, View } from "react-native";

import { SettingRow, SettingsGroup, SubHeader } from "@/features/settings/parts";
import { useLayout } from "@/hooks/use-layout";
import { tapMedium } from "@/services/haptics";
import { useHaptics } from "@/stores/haptics";
import type { ThemeMode } from "@/theme";
import { useTheme, useThemeContext } from "@/theme";
import { Body, Card, Icon, Screen, SectionLabel, Text, type IconName } from "@/ui";

const THEMES: { mode: ThemeMode; label: string; icon: IconName }[] = [
  { mode: "light", label: "Light", icon: "sun" },
  { mode: "dark", label: "Dark", icon: "moon" },
  { mode: "system", label: "System", icon: "smartphone" },
];

// m-settings-detail.jsx SettingsAppearance — the real theme selector (wired to the
// appearance store, recolors the whole app instantly).
export default function Appearance() {
  const { palette, radius } = useTheme();
  const { contentMaxWidth } = useLayout();
  // The theme context owns the live mode (and persists via onModeChange → the
  // appearance store); writing the store alone wouldn't recolor the app.
  const { mode, setMode } = useThemeContext();
  const hapticsOn = useHaptics((s) => s.enabled);
  const setHaptics = useHaptics((s) => s.setEnabled);

  return (
    <Screen>
      <SubHeader title="Appearance" />
      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth, paddingTop: 16 }}>
          <SectionLabel style={{ paddingHorizontal: 20, paddingBottom: 8 }}>Theme</SectionLabel>
          <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingBottom: 16 }}>
            {THEMES.map((t) => {
              const on = mode === t.mode;
              return (
                <Pressable key={t.mode} onPress={() => setMode(t.mode)} style={{ flex: 1 }}>
                  <Card
                    style={{
                      paddingVertical: 16,
                      paddingHorizontal: 8,
                      alignItems: "center",
                      gap: 8,
                      borderWidth: 1.5,
                      borderColor: on ? palette.accent : palette.border,
                      backgroundColor: on ? palette.accentSoft : palette.surface,
                    }}
                  >
                    <Icon name={t.icon} size={22} color={on ? palette.accent : palette.muted} />
                    <Text size={12.5} weight="semibold" color={on ? palette.accent : palette.text}>
                      {t.label}
                    </Text>
                  </Card>
                </Pressable>
              );
            })}
          </View>

          <SectionLabel style={{ paddingHorizontal: 20, paddingBottom: 8, paddingTop: 8 }}>Feedback</SectionLabel>
          <SettingsGroup>
            <SettingRow
              icon="smartphone"
              title="Haptic feedback"
              sub="A subtle vibration on taps and actions"
              toggle={hapticsOn}
              onToggle={() => {
                const next = !hapticsOn;
                setHaptics(next);
                if (next) tapMedium(); // confirm the new setting immediately
              }}
              last
            />
          </SettingsGroup>

          <Card style={{ marginHorizontal: 16, marginTop: 16, padding: 14, backgroundColor: palette.bgSubtle, borderWidth: 0, flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Icon name="info" size={16} color={palette.muted} />
            <Text size={12.5} tone="muted" style={{ flex: 1, lineHeight: 18 }}>
              System follows your device's light/dark setting. Dynamic Type, reduce-motion and larger touch
              targets follow your OS accessibility settings (M12). Haptics are silent on the web.
            </Text>
          </Card>
          <View style={{ height: radius.md }} />
        </View>
      </Body>
    </Screen>
  );
}
