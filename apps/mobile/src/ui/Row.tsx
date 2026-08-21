import { memo, type ReactNode } from "react";
import { View } from "react-native";

import { useTheme } from "../theme";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import { Touchable } from "./Touchable";

export interface RowProps {
  title: string;
  sub?: string;
  icon?: IconName;
  /** Tint for the leading icon tile; defaults to the accent color. */
  iconTone?: string;
  right?: ReactNode;
  chevron?: boolean;
  last?: boolean;
  onPress?: () => void;
}

/** List item with an optional leading icon tile, title/subtitle, and trailing slot.
 *  Memoised — list rows re-render only when their own props change (05 §9 perf). */
function RowBase({ title, sub, icon, iconTone, right, chevron, last, onPress }: RowProps) {
  const { palette, radius } = useTheme();
  const tint = iconTone ?? palette.accent;
  const body = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.border,
      }}
    >
      {icon && (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.lg,
            backgroundColor: tint + (palette.dark ? "26" : "16"),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icon} size={18} color={tint} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={14} weight="semibold">
          {title}
        </Text>
        {sub && (
          <Text size={11.5} tone="muted" style={{ marginTop: 1 }}>
            {sub}
          </Text>
        )}
      </View>
      {right}
      {chevron && <Icon name="chevronRight" size={16} color={palette.subtle} />}
    </View>
  );

  if (!onPress) return body;
  return (
    <Touchable onPress={onPress} accessibilityRole="button" accessibilityLabel={sub ? `${title}, ${sub}` : title}>
      {body}
    </Touchable>
  );
}

export const Row = memo(RowBase);
