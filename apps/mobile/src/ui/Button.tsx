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
  const bg = isPrimary ? palette.accent : isDanger ? palette.danger : palette.surface;
  const fg = isPrimary ? palette.accentFg : isDanger ? "#ffffff" : palette.text;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
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
          flex: 1,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={18} stroke={2.2} color={fg} />}
          <Text size={15} weight="bold" color={fg}>
            {children}
          </Text>
        </>
      )}
    </Pressable>
  );
}
