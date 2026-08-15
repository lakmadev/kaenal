import { Pressable, View } from "react-native";

import { useTheme, useThemeContext, type ThemeMode } from "../theme";
import { Icon, type IconName } from "./Icon";

const OPTIONS: { id: ThemeMode; icon: IconName }[] = [
  { id: "light", icon: "sun" },
  { id: "dark", icon: "moon" },
  { id: "system", icon: "smartphone" },
];

/** Segmented light / dark / system control, wired to the theme provider. */
export function ThemeToggle() {
  const { palette, radius } = useTheme();
  const { mode, setMode } = useThemeContext();
  return (
    <View style={{ flexDirection: "row", backgroundColor: palette.bgSubtle, borderRadius: radius.full, padding: 3 }}>
      {OPTIONS.map((o) => {
        const on = mode === o.id;
        return (
          <Pressable
            key={o.id}
            onPress={() => setMode(o.id)}
            hitSlop={4}
            style={{
              width: 32,
              height: 26,
              borderRadius: radius.full,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: on ? palette.surface : "transparent",
            }}
          >
            <Icon name={o.icon} size={15} color={on ? palette.text : palette.subtle} />
          </Pressable>
        );
      })}
    </View>
  );
}
