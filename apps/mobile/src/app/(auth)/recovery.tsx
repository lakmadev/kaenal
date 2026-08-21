import { Redirect } from "expo-router";
import { useSafeBack } from "@/hooks/use-safe-back";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackButton } from "@/features/auth/parts";
import { useLayout } from "@/hooks/use-layout";
import type { AuthError } from "@/lib/auth-api";
import { useSession } from "@/stores/session";
import { useTheme } from "@/theme";
import { Button, Icon, Screen, Text } from "@/ui";

// Design: m-auth-extra.jsx → AuthRecovery (rule #9). Recovery code goes in the same
// `code` field of POST /v1/auth/sign-in that TOTP uses.
export default function Recovery() {
  const goBack = useSafeBack("/(auth)/welcome");
  const insets = useSafeAreaInsets();
  const { palette, radius, fonts } = useTheme();
  const { contentMaxWidth } = useLayout();

  const mfaPending = useSession((s) => s.mfaPending);
  const signInVerify = useSession((s) => s.signInVerify);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!mfaPending) return <Redirect href="/(auth)/welcome" />;

  async function verify() {
    const value = code.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signInVerify(value);
    } catch (e) {
      setError((e as AuthError).message ?? "That recovery code did not work.");
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: "center" }}>
        <View style={{ flex: 1, width: "100%", maxWidth: contentMaxWidth }}>
          <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 24 }}>
            <BackButton />
          </View>
          <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: radius.lg,
                backgroundColor: palette.accentSoft,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
              }}
            >
              <Icon name="key" size={24} color={palette.accent} />
            </View>
            <Text size={24} weight="bold" style={{ letterSpacing: -0.5 }}>
              Recovery code
            </Text>
            <Text size={14} tone="muted" style={{ marginTop: 6, lineHeight: 21 }}>
              Enter one of the one-time codes you saved when you set up two-factor.
            </Text>

            <View
              style={{
                height: 54,
                borderWidth: 1.5,
                borderColor: palette.accent,
                borderRadius: radius.md,
                backgroundColor: palette.surface,
                paddingHorizontal: 16,
                justifyContent: "center",
                marginTop: 28,
                shadowColor: palette.accent,
                shadowOpacity: 0.18,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 0 },
              }}
            >
              <TextInput
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                placeholder="XXXX-XXXX"
                placeholderTextColor={palette.subtle}
                onSubmitEditing={verify}
                style={{ fontFamily: fonts.mono, fontSize: 19, letterSpacing: 2, color: palette.text }}
              />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
              <Icon name="info" size={13} color={palette.muted} />
              <Text size={12} tone="muted">
                Each code works once.
              </Text>
            </View>
            {error && (
              <Text size={13} style={{ color: palette.dangerFg, marginTop: 12 }}>
                {error}
              </Text>
            )}

            <Pressable onPress={goBack} style={{ alignSelf: "center", marginTop: 24 }} hitSlop={8}>
              <Text size={13.5} weight="semibold" tone="accent">
                Back to authenticator code
              </Text>
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}>
            <Button loading={busy} disabled={!code.trim()} onPress={verify}>
              Verify recovery code
            </Button>
          </View>
        </View>
      </View>
    </Screen>
  );
}
