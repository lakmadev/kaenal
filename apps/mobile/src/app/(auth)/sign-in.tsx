import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthField, BackButton } from "@/features/auth/parts";
import { initials } from "@/features/auth/recent";
import { useLayout } from "@/hooks/use-layout";
import type { AuthError } from "@/lib/auth-api";
import { useSession } from "@/stores/session";
import { useTheme } from "@/theme";
import { Avatar, Button, Icon, Mono, Screen, Text } from "@/ui";

// Design: m-auth.jsx → AuthSignIn (rule #9). Wired to POST /v1/auth/sign-in.
export default function SignIn() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const { contentMaxWidth } = useLayout();
  const { tenant, email: emailParam } = useLocalSearchParams<{ tenant: string; email?: string }>();
  const slug = (tenant ?? "").toString();

  const signInStart = useSession((s) => s.signInStart);
  const [email, setEmail] = useState((emailParam ?? "").toString());
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await signInStart({ tenant: slug, email: email.trim(), password });
      if (result === "mfa") router.push("/(auth)/mfa");
      // On "ok" the root layout re-routes into the app once status flips.
    } catch (e) {
      setError((e as AuthError).message ?? "Sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: "center" }}>
          <View style={{ flex: 1, width: "100%", maxWidth: contentMaxWidth }}>
            <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 24 }}>
              <BackButton onPress={() => router.back()} />
            </View>
            <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 18 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 22 }}>
                <Avatar initials={initials(slug || "WS")} tone="accent" />
                <View>
                  <Text size={20} weight="bold" style={{ letterSpacing: -0.4 }}>
                    Sign in
                  </Text>
                  <Mono size={12} tone="muted">
                    {slug}.kaenal.app
                  </Mono>
                </View>
              </View>

              <AuthField
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@company.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
              />
              <AuthField
                label="Password"
                secure
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                textContentType="password"
                onSubmitEditing={submit}
              />

              {error && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 2 }}>
                  <Icon name="alert" size={14} color={palette.dangerFg} />
                  <Text size={13} style={{ color: palette.dangerFg, flex: 1 }}>
                    {error}
                  </Text>
                </View>
              )}

              <Pressable
                onPress={() => router.push({ pathname: "/(auth)/forgot", params: { tenant: slug, email: email.trim() } })}
                style={{ alignSelf: "flex-end", marginTop: 6 }}
                hitSlop={8}
              >
                <Text size={13} weight="semibold" tone="accent">
                  Forgot password?
                </Text>
              </Pressable>
            </View>

            <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}>
              <Button loading={busy} disabled={!email.trim() || !password} onPress={submit}>
                Sign in
              </Button>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
