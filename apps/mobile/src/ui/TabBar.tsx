import { Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme";
import { Badge } from "./Header";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

export interface TabItem {
  id: string;
  icon?: IconName;
  label?: string;
  badge?: number;
  /** Center floating action button (capture / raise). */
  fab?: boolean;
}

/** Thumb-reachable bottom tab bar with an optional center FAB and per-tab badges. */
export function TabBar({
  tabs,
  active,
  onPress,
}: {
  tabs: TabItem[];
  active: string;
  onPress?: (id: string) => void;
}) {
  const { palette, radius } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        backgroundColor: palette.surface,
        borderTopWidth: 1,
        borderTopColor: palette.border,
        paddingTop: 8,
        paddingHorizontal: 6,
        paddingBottom: Math.max(insets.bottom, 6),
      }}
    >
      {tabs.map((t) => {
        if (t.fab) {
          return (
            <View key={t.id} style={{ flex: 1, alignItems: "center" }}>
              <Pressable
                onPress={() => onPress?.(t.id)}
                style={({ pressed }) => ({
                  width: 48,
                  height: 48,
                  marginTop: -22,
                  borderRadius: Platform.OS === "android" ? radius["2xl"] : 24,
                  backgroundColor: palette.accent,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.85 : 1,
                  shadowColor: "#000",
                  shadowOpacity: 0.35,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 6,
                })}
              >
                <Icon name="plus" size={24} stroke={2.4} color={palette.accentFg} />
              </Pressable>
            </View>
          );
        }
        const on = t.id === active;
        const color = on ? palette.accent : palette.subtle;
        return (
          <Pressable
            key={t.id}
            onPress={() => onPress?.(t.id)}
            style={{ flex: 1, alignItems: "center", gap: 3, paddingVertical: 2 }}
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
    </View>
  );
}
