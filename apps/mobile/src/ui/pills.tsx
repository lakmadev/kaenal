import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "../theme";
import type { Palette } from "../theme";
import { Icon } from "./Icon";
import { Text } from "./Text";

// ── Sync pill — the signature offline affordance, shown in every header ──
export type SyncState = "synced" | "pending" | "failed" | "offline";

export function SyncPill({
  state = "synced",
  label,
  onPress: _onPress,
}: {
  state?: SyncState;
  label?: string;
  onPress?: () => void;
}) {
  const { palette, radius } = useTheme();
  const map: Record<SyncState, { bg: string; fg: string; dot: string; text: string; spin?: boolean }> = {
    synced: { bg: palette.successBg, fg: palette.successFg, dot: palette.success, text: label ?? "Synced" },
    pending: { bg: palette.warnBg, fg: palette.warnFg, dot: palette.warn, text: label ?? "Pending", spin: true },
    failed: { bg: palette.dangerBg, fg: palette.dangerFg, dot: palette.danger, text: label ?? "Failed" },
    offline: { bg: palette.bgSubtle, fg: palette.muted, dot: palette.subtle, text: label ?? "Offline" },
  };
  const s = map[state];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: 26,
        paddingLeft: 8,
        paddingRight: 9,
        borderRadius: radius.full,
        backgroundColor: s.bg,
        borderWidth: 1,
        borderColor: palette.border,
      }}
    >
      {s.spin ? (
        <Icon name="refresh" size={12} stroke={2.2} color={s.fg} />
      ) : (
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: s.dot }} />
      )}
      <Text size={11.5} weight="semibold" color={s.fg}>
        {s.text}
      </Text>
    </View>
  );
}

// ── Status vocabulary — same tones as web ──
export type StatusTone =
  | "open"
  | "verify"
  | "progress"
  | "closed"
  | "done"
  | "danger"
  | "warn"
  | "neutral"
  | "accent";

export function StatusPill({
  tone = "neutral",
  size = "md",
  children,
}: {
  tone?: StatusTone;
  size?: "sm" | "md";
  children: ReactNode;
}) {
  const { palette, radius } = useTheme();
  const tones: Record<StatusTone, { bg: string; fg: string }> = {
    open: { bg: palette.infoBg, fg: palette.info },
    verify: { bg: palette.infoBg, fg: palette.info },
    progress: { bg: palette.warnBg, fg: palette.warnFg },
    closed: { bg: palette.successBg, fg: palette.successFg },
    done: { bg: palette.successBg, fg: palette.successFg },
    danger: { bg: palette.dangerBg, fg: palette.dangerFg },
    warn: { bg: palette.warnBg, fg: palette.warnFg },
    neutral: { bg: palette.bgSubtle, fg: palette.muted },
    accent: { bg: palette.accentSoft, fg: palette.accent },
  };
  const c = tones[tone];
  return (
    <View
      style={{
        alignSelf: "flex-start",
        height: size === "sm" ? 18 : 21,
        paddingHorizontal: size === "sm" ? 7 : 8,
        justifyContent: "center",
        borderRadius: radius.full,
        backgroundColor: c.bg,
      }}
    >
      <Text
        size={size === "sm" ? 10 : 11}
        weight="bold"
        color={c.fg}
        style={{ letterSpacing: 0.5, textTransform: "uppercase" }}
      >
        {children}
      </Text>
    </View>
  );
}

// ── Severity chip ──
export type SevLevel = "critical" | "high" | "major" | "medium" | "minor" | "low";

export function Sev({ level }: { level: SevLevel }) {
  const { palette, radius } = useTheme();
  const map: Record<SevLevel, string> = {
    critical: palette.danger,
    high: "#ea580c",
    major: "#ea580c",
    medium: palette.warn,
    minor: palette.warn,
    low: palette.success,
  };
  const col = map[level];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        height: 21,
        paddingHorizontal: 8,
        borderRadius: radius.full,
        backgroundColor: col + (palette.dark ? "28" : "18"),
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 2, backgroundColor: col }} />
      <Text size={10.5} weight="bold" color={col} style={{ letterSpacing: 0.5, textTransform: "uppercase" }}>
        {level}
      </Text>
    </View>
  );
}

// ── Avatar (initials) ──
export function Avatar({
  initials,
  size = 34,
  tone = "neutral",
  style,
}: {
  initials: string;
  size?: number;
  tone?: "neutral" | "accent";
  style?: StyleProp<ViewStyle>;
}) {
  const { palette } = useTheme();
  const bg = tone === "accent" ? palette.accent : palette.bgSubtle;
  const fg = tone === "accent" ? palette.accentFg : palette.text;
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: palette.border,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Text weight="bold" size={size * 0.36} color={fg}>
        {initials}
      </Text>
    </View>
  );
}

// re-export for consumers that only need the palette type alongside pills
export type { Palette };
