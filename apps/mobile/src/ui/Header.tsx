import type { ReactNode } from "react";
import { Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme";
import { Icon } from "./Icon";
import { SyncPill, type SyncState } from "./pills";
import { Text } from "./Text";

export interface HeaderProps {
  title: string;
  overline?: string;
  sub?: string;
  sync?: SyncState;
  right?: ReactNode;
  onBack?: () => void;
  onSyncPress?: () => void;
}

/** Big-title header (iOS HIG large title / Android top bar) with the sync pill inline. */
export function Header({ title, overline, sub, sync = "synced", right, onBack, onSyncPress }: HeaderProps) {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top + 6,
        backgroundColor: palette.surface,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16 }}>
        {onBack && (
          <Pressable onPress={onBack} hitSlop={8} style={{ marginLeft: -6, padding: 4 }}>
            <Icon name="chevronLeft" size={24} stroke={2} color={palette.text} />
          </Pressable>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          {overline && (
            <Text size={11.5} weight="semibold" tone="muted">
              {overline}
            </Text>
          )}
        </View>
        <SyncPill state={sync} onPress={onSyncPress} />
        {right}
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 12 }}>
        <Text size={Platform.OS === "android" ? 24 : 27} weight="bold" style={{ letterSpacing: -0.5 }}>
          {title}
        </Text>
        {sub && (
          <Text size={12.5} tone="muted" style={{ marginTop: 3 }}>
            {sub}
          </Text>
        )}
      </View>
    </View>
  );
}

/** Notifications bell (top-right of tab-root screens) with an unread badge. */
export function BellButton({ count = 0, onPress }: { count?: number; onPress?: () => void }) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surface,
      }}
    >
      <Icon name="bell" size={18} color={palette.text} />
      {count > 0 && <Badge count={count} />}
    </Pressable>
  );
}

/** Small red count badge, positioned top-right of its parent. */
export function Badge({ count }: { count: number }) {
  const { palette } = useTheme();
  return (
    <View
      style={{
        position: "absolute",
        top: -3,
        right: -3,
        minWidth: 16,
        height: 16,
        paddingHorizontal: 4,
        borderRadius: 8,
        backgroundColor: palette.danger,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
        borderColor: palette.surface,
      }}
    >
      <Text size={9.5} weight="bold" color="#ffffff">
        {count}
      </Text>
    </View>
  );
}
