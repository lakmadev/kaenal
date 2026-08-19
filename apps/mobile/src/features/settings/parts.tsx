import { type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme";
import { Card, Icon, Text, type IconName } from "@/ui";

/** Compact back-header for settings sub-pages (m-settings-detail.jsx SubHeader). */
export function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 6, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingBottom: 12 }}>
        <Pressable onPress={onBack} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="chevronLeft" size={24} stroke={2} color={palette.text} />
        </Pressable>
        <Text size={20} weight="bold" style={{ letterSpacing: -0.4 }}>
          {title}
        </Text>
      </View>
    </View>
  );
}

export function Toggle({ on, onPress }: { on: boolean; onPress?: () => void }) {
  const { palette } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={onPress === undefined} hitSlop={6}>
      <View style={{ width: 42, height: 25, borderRadius: 999, backgroundColor: on ? palette.accent : palette.borderStrong, justifyContent: "center" }}>
        <View style={{ width: 21, height: 21, borderRadius: 999, backgroundColor: "#ffffff", marginLeft: on ? 19 : 2 }} />
      </View>
    </Pressable>
  );
}

export interface SettingRowProps {
  icon?: IconName;
  title: string;
  sub?: string;
  value?: string;
  toggle?: boolean;
  onToggle?: () => void;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
}

export function SettingRow({ icon, title, sub, value, toggle, onToggle, onPress, danger, last }: SettingRowProps) {
  const { palette, radius } = useTheme();
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: palette.border }}>
      {icon && (
        <View style={{ width: 30, height: 30, borderRadius: radius.md, backgroundColor: palette.bgSubtle, alignItems: "center", justifyContent: "center" }}>
          <Icon name={icon} size={16} color={danger ? palette.dangerFg : palette.text} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={14} weight="medium" color={danger ? palette.dangerFg : palette.text}>
          {title}
        </Text>
        {sub && (
          <Text size={11.5} tone="muted" style={{ marginTop: 1 }}>
            {sub}
          </Text>
        )}
      </View>
      {value !== undefined && (
        <Text size={12.5} tone="muted">
          {value}
        </Text>
      )}
      {toggle !== undefined ? <Toggle on={toggle} onPress={onToggle} /> : onPress ? <Icon name="chevronRight" size={16} color={palette.subtle} /> : null}
    </View>
  );
  if (onPress && toggle === undefined) return <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>{body}</Pressable>;
  return body;
}

export function SettingsGroup({ children, style }: { children: ReactNode; style?: object }) {
  return <Card style={[{ marginHorizontal: 16, marginBottom: 14 }, style]}>{children}</Card>;
}
