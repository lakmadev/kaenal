import { ActivityIndicator, Pressable, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "../theme";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

export interface ButtonProps {
  children: string;
  onPress?: () => void;
  variant?: "primary" | "ghost" | "danger";
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** The single primary/secondary action control. 48pt tall → ≥44pt touch target. */
export function Button({
  children,
  onPress,
  variant = "primary",
  icon,
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const { palette, radius } = useTheme();
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  const isGhost = variant === "ghost";
  const bg = isPrimary ? palette.accent : isDanger ? palette.danger : palette.surface;
  const fg = isPrimary ? palette.accentFg : isDanger ? "#ffffff" : palette.text;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={children}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        {
          height: 48,
          borderRadius: radius.xl,
          backgroundColor: bg,
          borderWidth: variant === "ghost" ? 1 : 0,
          borderColor: palette.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          // Full-width in a column (design PrimaryBtn/GhostBtn), fixed 48pt tall.
          // NOT flex:1 — that expands to flex-basis:0 and collapses the height in a
          // vertical stack, rendering the 12pt radius as a pill. Callers that place
          // buttons side-by-side in a row pass `style={{ flex: 1 }}` (spread last).
          alignSelf: "stretch",
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {/* Design (mobile-kit.jsx): PrimaryBtn/DangerBtn are bold (700) with a
              thicker 2.2 icon stroke; GhostBtn is semibold (600) with the default
              icon stroke. Keep these two weights distinct — don't flatten them. */}
          {icon && <Icon name={icon} size={18} stroke={isGhost ? undefined : 2.2} color={fg} />}
          <Text size={15} weight={isGhost ? "semibold" : "bold"} color={fg}>
            {children}
          </Text>
        </>
      )}
    </Pressable>
  );
}
