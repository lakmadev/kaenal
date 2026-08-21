import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackButton, OtpInput, type OtpState } from "@/features/auth/parts";
import { useLayout } from "@/hooks/use-layout";
import type { AuthError } from "@/lib/auth-api";
import { useSession } from "@/stores/session";
import { useTheme } from "@/theme";
import { Button, Icon, Screen, Text } from "@/ui";

// Design: m-auth.jsx → AuthMFA (rule #9). Second factor for POST /v1/auth/sign-in.
export default function Mfa() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette, radius } = useTheme();
  const { contentMaxWidth } = useLayout();

  const mfaPending = useSession((s) => s.mfaPending);
  const signInVerify = useSession((s) => s.signInVerify);
  const cancelMfa = useSession((s) => s.cancelMfa);

  const [code, setCode] = useState("");
  const [state, setState] = useState<OtpState>("idle");
  const [busy, setBusy] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(3);

  async function verify(value: string) {
    if (busy || value.length < 6) return;
    setBusy(true);
    setState("idle");
    try {
      await signInVerify(value);
      setState("success"); // session flips to authenticated; root re-routes shortly
    } catch (e) {
      const left = Math.max(0, attemptsLeft - 1);
      setAttemptsLeft(left);
      setState("error");
      setCode("");
      setBusy(false);
      void (e as AuthError);
    }
  }

  // Auto-verify once six digits are entered (design has no explicit tap needed).
  useEffect(() => {
    if (code.length === 6 && !busy && state !== "success") void verify(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // No challenge in flight (deep-linked or refreshed) → back to the start. This
  // guard runs AFTER every hook so hook order stays stable across renders.
  if (!mfaPending) return <Redirect href="/(auth)/welcome" />;

  const boxBg = state === "success" ? palette.successBg : state === "error" ? palette.dangerBg : palette.accentSoft;
  const boxFg = state === "success" ? palette.success : state === "error" ? palette.dangerFg : palette.accent;
  const subtitle =
    state === "success"
      ? "Signing you in…"
      : state === "error"
        ? `That code did not match. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} left.`
        : "Enter the 6-digit code from your authenticator app.";

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: "center" }}>
        <View style={{ flex: 1, width: "100%", maxWidth: contentMaxWidth }}>
          <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 24 }}>
            <BackButton
              onPress={() => {
                cancelMfa();
                router.back();
              }}
            />
          </View>
          <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: radius.lg,
                backgroundColor: boxBg,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
              }}
            >
              <Icon
                name={state === "success" ? "check" : state === "error" ? "alert" : "shieldCheck"}
                size={26}
                stroke={state === "success" ? 2.6 : 2}
                color={boxFg}
              />
            </View>
            <Text size={24} weight="bold" style={{ letterSpacing: -0.5 }}>
              {state === "success" ? "Verified" : "Two-factor"}
            </Text>
            <Text size={14} tone="muted" style={{ marginTop: 6, lineHeight: 21 }}>
              {subtitle}
            </Text>

            <View style={{ marginTop: 30 }}>
              <OtpInput value={code} onChange={setCode} state={state} />
            </View>

            {state !== "success" && (
              <Pressable onPress={() => router.push("/(auth)/recovery")} style={{ alignSelf: "center", marginTop: 24 }} hitSlop={8}>
                <Text size={13.5} weight="semibold" tone="accent">
                  Use a recovery code instead
                </Text>
              </Pressable>
            )}
          </View>

          <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}>
            <Button
              loading={busy}
              disabled={code.length < 6 || state === "success"}
              icon={state === "success" ? "check" : undefined}
              onPress={() => verify(code)}
            >
              {state === "success" ? "Verified" : busy ? "Verifying…" : "Verify"}
            </Button>
          </View>
        </View>
      </View>
    </Screen>
  );
}
