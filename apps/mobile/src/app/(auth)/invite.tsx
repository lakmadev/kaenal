import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthField, BackButton, PasswordStrength, Wordmark, passwordIsStrong } from "@/features/auth/parts";
import { useLayout } from "@/hooks/use-layout";
import { acceptInviteRequest, type AuthError } from "@/lib/auth-api";
import { useTheme } from "@/theme";
import { Button, Icon, Screen, StatusPill, Text } from "@/ui";

/** Pull `token` + `workspace` out of a pasted invite URL (…/invite/<token>?workspace=slug). */
function parseInviteUrl(raw: string): { token?: string; workspace?: string } {
  try {
    const url = new URL(raw.trim());
    const token = url.pathname.split("/").filter(Boolean).pop();
    const workspace = url.searchParams.get("workspace") ?? undefined;
    return { token, workspace };
  } catch {
    return {};
  }
}

// Design: m-auth.jsx → AuthSetPassword (rule #9). POST /v1/auth/accept-invite.
export default function Invite() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const { contentMaxWidth } = useLayout();
  const params = useLocalSearchParams<{ token?: string; workspace?: string }>();

  const [link, setLink] = useState("");
  const parsed = params.token ? { token: params.token.toString(), workspace: params.workspace?.toString() } : parseInviteUrl(link);
  const hasToken = Boolean(parsed.token && parsed.workspace);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!hasToken || !name.trim() || !passwordIsStrong(password) || busy) return;
    setBusy(true);
    setError(null);
    try {
      await acceptInviteRequest(parsed.workspace!, parsed.token!, name.trim(), password);
      // Account created — send them to sign in to their new workspace.
      router.replace({ pathname: "/(auth)/sign-in", params: { tenant: parsed.workspace! } });
    } catch (e) {
      setError((e as AuthError).message ?? "That invitation is invalid or has expired.");
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: "center" }}>
          <View style={{ flex: 1, width: "100%", maxWidth: contentMaxWidth }}>
            <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <BackButton onPress={() => router.back()} />
              <Wordmark size={20} />
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
              {!params.token && (
                <View style={{ marginBottom: 18 }}>
                  <AuthField
                    label="Invite link"
                    value={link}
                    onChangeText={setLink}
                    placeholder="Paste the link from your email"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {link.length > 0 && !hasToken && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                      <Icon name="alert" size={13} color={palette.warnFg} />
                      <Text size={12.5} style={{ color: palette.warnFg }}>
                        That doesn't look like a Kaenal invite link.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <StatusPill tone="accent">Workspace invitation</StatusPill>
              <Text size={24} weight="bold" style={{ letterSpacing: -0.5, marginTop: 12 }}>
                Set up your account
              </Text>
              <Text size={14} tone="muted" style={{ marginTop: 6 }}>
                {hasToken ? (
                  <>
                    You're joining <Text size={14} weight="semibold">{parsed.workspace}</Text>. Choose a name and password.
                  </>
                ) : (
                  "Paste your invite link above to continue."
                )}
              </Text>

              <View style={{ marginTop: 24, opacity: hasToken ? 1 : 0.5 }} pointerEvents={hasToken ? "auto" : "none"}>
                <AuthField label="Full name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />
                <AuthField label="Create password" secure value={password} onChangeText={setPassword} placeholder="Create a strong password" />
                <PasswordStrength password={password} />
              </View>

              {error && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 14 }}>
                  <Icon name="alert" size={14} color={palette.dangerFg} />
                  <Text size={13} style={{ color: palette.dangerFg, flex: 1 }}>
                    {error}
                  </Text>
                </View>
              )}
            </ScrollView>
            <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}>
              <Button loading={busy} disabled={!hasToken || !name.trim() || !passwordIsStrong(password)} onPress={submit}>
                Create account
              </Button>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
