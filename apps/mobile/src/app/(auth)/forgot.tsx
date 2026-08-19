import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthField, BackButton } from "@/features/auth/parts";
import { useLayout } from "@/hooks/use-layout";
import { forgotPasswordRequest } from "@/lib/auth-api";
import { Button, Screen, Text } from "@/ui";

// Design: m-auth-extra.jsx → AuthForgot (rule #9). POST /v1/auth/forgot-password.
export default function Forgot() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { contentMaxWidth } = useLayout();
  const params = useLocalSearchParams<{ tenant?: string; email?: string }>();
  const slug = (params.tenant ?? "").toString();
  const [email, setEmail] = useState((params.email ?? "").toString());
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || busy) return;
    setBusy(true);
    // Always resolves ok (never an enumeration oracle); ignore the result.
    try {
      await forgotPasswordRequest(slug, email.trim());
    } catch {
      /* even a network hiccup shouldn't reveal whether the address exists */
    }
    router.replace({ pathname: "/(auth)/reset-sent", params: { email: email.trim() } });
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: "center" }}>
          <View style={{ flex: 1, width: "100%", maxWidth: contentMaxWidth }}>
            <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 24 }}>
              <BackButton onPress={() => router.back()} />
            </View>
            <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24 }}>
              <Text size={24} weight="bold" style={{ letterSpacing: -0.5 }}>
                Reset password
              </Text>
              <Text size={14} tone="muted" style={{ marginTop: 6, lineHeight: 21 }}>
                We'll email a secure reset link to your work address.
              </Text>
              <View style={{ marginTop: 26 }}>
                <AuthField
                  label="Email"
                  highlight
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@company.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  onSubmitEditing={submit}
                />
              </View>
            </View>
            <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}>
              <Button icon="send" loading={busy} disabled={!email.trim()} onPress={submit}>
                Send reset link
              </Button>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
