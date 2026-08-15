import { useRef, useState } from "react";
import { Pressable, TextInput, View, type TextInputProps } from "react-native";

import { Icon, Mono, SectionLabel, Text } from "@/ui";
import { useTheme } from "@/theme";

// Reusable auth building blocks, reproduced from project_brain/mobile/src/m-auth*.jsx
// (rule #9). They compose the shared ui kit + real inputs so the flows actually work.

/** Accent hexagon + letter-spaced wordmark (design `Wordmark`). */
export function Wordmark({ size = 22 }: { size?: number }) {
  const { palette } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
      <Icon name="logo" size={size} color={palette.accent} />
      <Text size={size * 0.72} weight="bold" style={{ letterSpacing: size * 0.14 }}>
        KAENAL
      </Text>
    </View>
  );
}

/** Circular back chevron (design header on workspace/sign-in/mfa/recovery/forgot). */
export function BackButton({ onPress }: { onPress: () => void }) {
  const { palette } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={10} style={{ padding: 4, marginLeft: -6, alignSelf: "flex-start" }}>
      <Icon name="chevronLeft" size={24} stroke={2} color={palette.text} />
    </Pressable>
  );
}

interface FieldProps extends Omit<TextInputProps, "style"> {
  label: string;
  /** Render a password eye toggle and mask input. */
  secure?: boolean;
  /** Force the focused/accent ring even when not focused (design idle-accent state). */
  highlight?: boolean;
}

/** Labeled text field with focus ring + optional password reveal (design `field`). */
export function AuthField({ label, secure = false, highlight = false, ...input }: FieldProps) {
  const { palette, radius } = useTheme();
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);
  const active = focused || highlight;
  return (
    <View style={{ marginBottom: 16 }}>
      <SectionLabel style={{ marginBottom: 8 }}>{label}</SectionLabel>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          height: 52,
          borderWidth: active ? 1.5 : 1,
          borderColor: active ? palette.accent : palette.border,
          borderRadius: radius.md,
          backgroundColor: palette.surface,
          paddingHorizontal: 14,
          ...(active ? { shadowColor: palette.accent, shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } } : {}),
        }}
      >
        <TextInput
          {...input}
          secureTextEntry={secure && !reveal}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          placeholderTextColor={palette.subtle}
          style={{ flex: 1, fontSize: 15.5, color: palette.text }}
        />
        {secure && (
          <Pressable onPress={() => setReveal((v) => !v)} hitSlop={10}>
            <Icon name={reveal ? "eye" : "eyeOff"} size={18} color={palette.muted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export type OtpState = "idle" | "error" | "success";

/** Six-box code entry bound to one hidden input (design `AuthMFA` boxes). */
export function OtpInput({
  value,
  onChange,
  state = "idle",
  length = 6,
  autoFocus = true,
}: {
  value: string;
  onChange: (v: string) => void;
  state?: OtpState;
  length?: number;
  autoFocus?: boolean;
}) {
  const { palette, radius } = useTheme();
  const ref = useRef<TextInput>(null);
  const chars = value.padEnd(length, " ").slice(0, length).split("");
  const stateColor = state === "error" ? palette.danger : state === "success" ? palette.success : palette.accent;

  return (
    <Pressable onPress={() => ref.current?.focus()} style={{ flexDirection: "row", gap: 9 }}>
      {chars.map((c, i) => {
        const isCursor = state === "idle" && i === value.length && value.length < length;
        const stated = state === "error" || state === "success";
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: 58,
              borderRadius: radius.md,
              backgroundColor: palette.surface,
              borderWidth: 1.5,
              borderColor: isCursor ? palette.accent : stated ? stateColor : palette.border,
              alignItems: "center",
              justifyContent: "center",
              ...(isCursor ? { shadowColor: palette.accent, shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } } : {}),
            }}
          >
            <Mono
              size={26}
              weight="semibold"
              color={state === "error" ? palette.dangerFg : state === "success" ? palette.successFg : palette.text}
            >
              {c.trim()}
            </Mono>
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, length))}
        keyboardType="number-pad"
        autoFocus={autoFocus}
        maxLength={length}
        // Off-screen but focusable — the visible boxes mirror its value.
        style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
      />
    </Pressable>
  );
}

/** Password strength meter + requirement checklist (design `AuthSetPassword`). */
export function PasswordStrength({ password }: { password: string }) {
  const { palette } = useTheme();
  const reqs = [
    { l: "At least 12 characters", ok: password.length >= 12 },
    { l: "Upper & lowercase letters", ok: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { l: "A number or symbol", ok: /[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password) },
    { l: "Not a common password", ok: password.length > 0 && !/^(password|12345|qwerty)/i.test(password) },
  ];
  const met = reqs.filter((r) => r.ok).length;
  const label = met <= 1 ? "Weak" : met <= 2 ? "Fair" : met === 3 ? "Good" : "Strong";
  const labelColor = met <= 1 ? palette.dangerFg : met <= 2 ? palette.warnFg : palette.successFg;
  const bars = [0, 1, 2, 3].map((i) => (i < met ? (met <= 1 ? palette.danger : met <= 2 ? palette.warn : palette.success) : palette.border));

  return (
    <View>
      <View style={{ flexDirection: "row", gap: 5, marginTop: 10 }}>
        {bars.map((c, i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: c }} />
        ))}
      </View>
      {password.length > 0 && (
        <Text size={12} weight="semibold" style={{ marginTop: 6, color: labelColor }}>
          {label}
        </Text>
      )}
      <View style={{ marginTop: 14, gap: 8 }}>
        {reqs.map((r) => (
          <View key={r.l} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: r.ok ? palette.success : "transparent",
                borderWidth: r.ok ? 0 : 1.5,
                borderColor: palette.borderStrong,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {r.ok && <Icon name="check" size={11} stroke={3} color={palette.accentFg} />}
            </View>
            <Text size={12.5} tone={r.ok ? "text" : "muted"}>
              {r.l}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Whether a password clears the strength bar enough to submit. */
export function passwordIsStrong(password: string): boolean {
  return (
    password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password))
  );
}
