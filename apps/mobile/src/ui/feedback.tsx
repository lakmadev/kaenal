import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, View, type DimensionValue } from "react-native";

import { useTheme } from "../theme";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

/** Shimmering skeleton block for loading states. Respects a low-motion fallback via opacity pulse. */
export function Skeleton({
  width = "100%",
  height = 14,
  radius: r,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: object;
}) {
  const { palette, radius } = useTheme();
  const pulse = useRef(new Animated.Value(0.4)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  // Honour the OS "reduce motion" setting: a static block instead of a pulse.
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduceMotion(v));
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(0.6);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: r ?? radius.md, backgroundColor: palette.bgSubtle, opacity: pulse },
        style,
      ]}
    />
  );
}

/** Centered empty state — icon tile, title, supporting copy. */
export function EmptyState({
  icon = "check",
  title,
  body,
}: {
  icon?: IconName;
  title: string;
  body: string;
}) {
  const { palette, radius } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: radius["2xl"],
          backgroundColor: palette.bgSubtle,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={28} stroke={1.6} color={palette.subtle} />
      </View>
      <Text size={16} weight="bold">
        {title}
      </Text>
      <Text size={13} tone="muted" style={{ textAlign: "center", maxWidth: 240, lineHeight: 19 }}>
        {body}
      </Text>
    </View>
  );
}
