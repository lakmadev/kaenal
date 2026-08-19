import type { ReactNode } from "react";
import { ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme";
import { Text } from "./Text";

/** Full-screen background surface. Fills the theme bg; children lay out in a column. */
export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { palette } = useTheme();
  return <View style={[{ flex: 1, backgroundColor: palette.bg }, style]}>{children}</View>;
}

/** Scrollable body region. Adds bottom safe-area padding so content clears the home indicator. */
export function Body({
  children,
  contentStyle,
  bottomInset = true,
}: {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  bottomInset?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[{ paddingBottom: bottomInset ? insets.bottom + 16 : 16 }, contentStyle]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

/** Elevated content card — surface bg, hairline border, tight radius. */
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette, radius } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderWidth: 1,
          borderRadius: radius.xl,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Uppercase section eyebrow used above card groups. */
export function SectionLabel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <Text size={11} weight="bold" tone="muted" style={{ letterSpacing: 0.9, textTransform: "uppercase" }}>
        {children}
      </Text>
    </View>
  );
}

/** Sticky bottom action bar (one primary action per screen, thumb zone). */
export function ActionBar({ children }: { children: ReactNode }) {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 10,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: insets.bottom + 12,
        backgroundColor: palette.surface,
        borderTopWidth: 1,
        borderTopColor: palette.border,
      }}
    >
      {children}
    </View>
  );
}
