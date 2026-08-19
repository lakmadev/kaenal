import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Wordmark } from "@/features/auth/parts";
import { useLayout } from "@/hooks/use-layout";
import { services } from "@/services";
import { useSession } from "@/stores/session";
import { useTheme } from "@/theme";
import { Icon, Text } from "@/ui";
import { Screen } from "@/ui";

// Design: m-auth.jsx → AuthBiometric (+ AuthBiometricFail on repeated failure), rule #9.
export default function Unlock() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const { contentMaxWidth } = useLayout();

  const status = useSession((s) => s.status);
  const me = useSession((s) => s.me);
  const tenant = useSession((s) => s.tenant);
  const unlock = useSession((s) => s.unlock);
  const [failed, setFailed] = useState(false);

  const isIos = Platform.OS === "ios";
  const firstName = me?.name?.split(" ")[0] ?? "back";

  // "Use password" = re-authenticate with the same account, NOT a destructive
  // sign-out. Send the user to sign-in with their workspace + email prefilled; a
  // successful sign-in replaces the locked session. Never a dead-end.
  const usePassword = useCallback(() => {
    router.replace({ pathname: "/(auth)/sign-in", params: { tenant: tenant ?? "", email: me?.email ?? "" } });
  }, [router, tenant, me?.email]);

  const prompt = useCallback(async () => {
    const ok = await services.biometric?.authenticate?.(isIos ? "Unlock Kaenal with Face ID" : "Unlock Kaenal");
    if (ok) unlock();
    else setFailed(true);
  }, [isIos, unlock]);

  useEffect(() => {
    // Auto-prompt on mount when biometrics are actually available (device only).
    void (async () => {
      if (await services.biometric?.isAvailable?.()) void prompt();
      else setFailed(true); // e.g. web preview — fall back to the password path
    })();
  }, [prompt]);

  // If something already flipped us to authenticated, leave.
  if (status === "authenticated") return <Redirect href="/(app)/home" />;

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: "center", width: "100%" }}>
        <View style={{ flex: 1, width: "100%", maxWidth: contentMaxWidth, alignItems: "center", justifyContent: "center", padding: 32, gap: 24 }}>
          <Wordmark size={22} />
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: failed ? palette.dangerBg : palette.accentSoft,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 6,
            }}
          >
            <Icon
              name={failed ? "lock" : isIos ? "user" : "fingerprint"}
              size={44}
              stroke={1.5}
              color={failed ? palette.dangerFg : palette.accent}
            />
          </View>
          <View style={{ alignItems: "center" }}>
            <Text size={19} weight="bold">
              {failed ? "Couldn't unlock" : isIos ? "Unlock with Face ID" : "Unlock with fingerprint"}
            </Text>
            <Text size={13.5} tone="muted" style={{ marginTop: 6, textAlign: "center", maxWidth: 260, lineHeight: 20 }}>
              {failed ? "Use your password to continue." : `Welcome ${firstName === "back" ? "back" : `back, ${firstName}`}`}
            </Text>
          </View>
        </View>
        <View style={{ width: "100%", maxWidth: contentMaxWidth, paddingHorizontal: 24, paddingBottom: insets.bottom + 24, alignItems: "center", gap: 14 }}>
          {failed && (
            <Pressable onPress={prompt} hitSlop={8}>
              <Text size={14} weight="semibold" tone="accent">
                Try again
              </Text>
            </Pressable>
          )}
          <Pressable onPress={usePassword} hitSlop={8}>
            <Text size={14} weight="semibold" tone={failed ? "accent" : "muted"}>
              Use password instead
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
