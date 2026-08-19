import { Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme";
import { Badge } from "./Header";
import { Icon } from "./Icon";
import { Text } from "./Text";
import type { TabItem } from "./TabBar";

/**
 * Tablet side rail (m-tablet.jsx SideRail) — the bottom tabs promoted to a
 * left-edge rail at ≥768pt. Fully keyboard/AT navigable: each destination is a
 * `tab` with a spoken label and selected state; the FAB is a labelled `button`.
 */
export function SideRail({ tabs, active, onPress }: { tabs: TabItem[]; active: string; onPress?: (id: string) => void }) {
  const { palette, radius } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        width: 84,
        flexShrink: 0,
        backgroundColor: palette.surface,
        borderRightWidth: 1,
        borderRightColor: palette.border,
        alignItems: "center",
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 16,
        gap: 4,
      }}
    >
      <View style={{ marginBottom: 12 }}>
        <Icon name="logo" size={26} color={palette.accent} />
      </View>
      {tabs.map((t) => {
        if (t.fab) {
          return (
            <Pressable
              key={t.id}
              onPress={() => onPress?.(t.id)}
              accessibilityRole="button"
              accessibilityLabel="Capture"
              hitSlop={6}
              style={({ pressed }) => ({
                width: 48,
                height: 48,
                marginVertical: 8,
                borderRadius: Platform.OS === "android" ? radius["2xl"] : 24,
                backgroundColor: palette.accent,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Icon name="plus" size={24} stroke={2.4} color={palette.accentFg} />
            </Pressable>
          );
        }
        const on = t.id === active;
        const color = on ? palette.accent : palette.subtle;
        return (
          <Pressable
            key={t.id}
            onPress={() => onPress?.(t.id)}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: on }}
            style={{ width: 64, alignItems: "center", gap: 4, paddingVertical: 10, borderRadius: radius.xl, backgroundColor: on ? palette.accentSoft : "transparent" }}
          >
            <View>
              {t.icon && <Icon name={t.icon} size={22} stroke={on ? 2.3 : 1.9} color={color} />}
              {t.badge ? <Badge count={t.badge} /> : null}
            </View>
            <Text size={10} weight={on ? "bold" : "medium"} color={color}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
      <View style={{ flex: 1 }} />
    </View>
  );
}
