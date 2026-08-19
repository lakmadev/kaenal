import { useRouter } from "expo-router";
import { Platform, View } from "react-native";

import { SettingRow, SettingsGroup, SubHeader } from "@/features/settings/parts";
import { useLayout } from "@/hooks/use-layout";
import { useSession } from "@/stores/session";
import { useTheme } from "@/theme";
import { Body, Card, Icon, Screen, SectionLabel, Text } from "@/ui";

function webNote(what: string): void {
  if (Platform.OS === "web") window.alert(`${what} is managed in the desktop app for now.`);
}

// m-settings-detail.jsx SettingsSecurity — MFA status + biometric (real) with the
// rest routed to the web (session revocation + password aren't in the mobile
// contract yet; honest, not faked).
export default function Security() {
  const router = useRouter();
  const { palette } = useTheme();
  const { contentMaxWidth } = useLayout();
  const me = useSession((s) => s.me);
  const biometricEnabled = useSession((s) => s.biometricEnabled);
  const setBiometricEnabled = useSession((s) => s.setBiometricEnabled);

  return (
    <Screen>
      <SubHeader title="Security" onBack={() => router.back()} />
      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth, paddingTop: 16 }}>
          <SectionLabel style={{ paddingHorizontal: 20, paddingBottom: 8 }}>Two-factor</SectionLabel>
          <SettingsGroup>
            <SettingRow icon="shieldCheck" title="Authenticator app" sub={me?.mfaEnabled ? "Active" : "Not set up"} value={me?.mfaEnabled ? "On" : "Off"} />
            <SettingRow icon="key" title="Recovery codes" onPress={() => webNote("Recovery codes")} last />
          </SettingsGroup>

          <SectionLabel style={{ paddingHorizontal: 20, paddingBottom: 8 }}>Sign-in</SectionLabel>
          <SettingsGroup>
            <SettingRow icon="user" title="Biometric unlock" sub="Face ID / fingerprint on this device" toggle={biometricEnabled} onToggle={() => void setBiometricEnabled(!biometricEnabled)} />
            <SettingRow icon="lock" title="Change password" onPress={() => webNote("Changing your password")} last />
          </SettingsGroup>

          <Card style={{ marginHorizontal: 16, padding: 14, backgroundColor: palette.bgSubtle, borderWidth: 0, flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Icon name="smartphone" size={16} color={palette.muted} />
            <Text size={12.5} tone="muted" style={{ flex: 1, lineHeight: 18 }}>
              Active-session management (view + revoke other devices) is available in the desktop app. It
              arrives on mobile once the sessions endpoints are in the shared API contract.
            </Text>
          </Card>
        </View>
      </Body>
    </Screen>
  );
}
