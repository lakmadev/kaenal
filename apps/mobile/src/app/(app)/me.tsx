import { useRouter } from "expo-router";
import { View } from "react-native";

import { confirmIfUnsynced } from "@/features/auth/guard";
import { SettingRow, SettingsGroup } from "@/features/settings/parts";
import { APP_VERSION } from "@/lib/app-info";
import { useLayout } from "@/hooks/use-layout";
import { useAppearance } from "@/stores/appearance";
import { useRole, useSession } from "@/stores/session";
import { useSync } from "@/stores/sync";
import { Avatar, Body, Button, Header, Screen, SectionLabel, StatusPill, Text } from "@/ui";

const ROLE_LABEL: Record<string, string> = { admin: "Admin", manager: "Manager", auditor: "Auditor", inspector: "Inspector", viewer: "Viewer" };
const THEME_LABEL: Record<string, string> = { light: "Light", dark: "Dark", system: "System" };

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : "")).toUpperCase() || "?";
}

// M11 Settings root (m-system.jsx SettingsRoot) — real identity + linked
// sub-pages + the unsynced sign-out guard.
export default function Me() {
  const router = useRouter();
  const me = useSession((s) => s.me);
  const role = useRole();
  const signOut = useSession((s) => s.signOut);
  const biometricEnabled = useSession((s) => s.biometricEnabled);
  const setBiometricEnabled = useSession((s) => s.setBiometricEnabled);
  const themeMode = useAppearance((s) => s.mode);
  const pending = useSync((s) => s.pending + s.failed);
  const { contentMaxWidth } = useLayout();

  async function handleSignOut(): Promise<void> {
    if (!(await confirmIfUnsynced("sign out"))) return;
    await signOut();
    router.replace("/(auth)/welcome");
  }

  return (
    <Screen>
      <Header overline={me ? `${me.name} · ${ROLE_LABEL[role]}` : undefined} title="Settings" />
      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 18 }}>
            <Avatar initials={me ? initials(me.name) : "?"} size={54} tone="accent" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text size={17} weight="bold" numberOfLines={1}>
                {me?.name}
              </Text>
              <Text size={12.5} tone="muted" numberOfLines={1}>
                {me?.email}
              </Text>
              <View style={{ marginTop: 5 }}>
                <StatusPill tone="accent" size="sm">
                  {ROLE_LABEL[role]}
                </StatusPill>
              </View>
            </View>
          </View>

          <SectionLabel style={{ paddingHorizontal: 16, paddingBottom: 8 }}>Account</SectionLabel>
          <SettingsGroup>
            <SettingRow icon="user" title="Profile" onPress={() => router.push("/settings/profile")} />
            <SettingRow icon="bell" title="Notification preferences" onPress={() => router.push("/settings/notifications")} last />
          </SettingsGroup>

          <SectionLabel style={{ paddingHorizontal: 16, paddingBottom: 8 }}>Security</SectionLabel>
          <SettingsGroup>
            <SettingRow icon="shieldCheck" title="Two-factor" value={me?.mfaEnabled ? "On" : "Off"} onPress={() => router.push("/settings/security")} />
            <SettingRow icon="key" title="Biometric unlock" toggle={biometricEnabled} onToggle={() => void setBiometricEnabled(!biometricEnabled)} />
            <SettingRow icon="lock" title="Security & sessions" onPress={() => router.push("/settings/security")} last />
          </SettingsGroup>

          <SectionLabel style={{ paddingHorizontal: 16, paddingBottom: 8 }}>Offline & storage</SectionLabel>
          <SettingsGroup>
            <SettingRow icon="cloud" title="Sync queue" sub={pending > 0 ? `${pending} item(s) waiting` : "All synced"} onPress={() => router.push("/sync-queue")} />
            <SettingRow icon="trash" title="Offline & storage" onPress={() => router.push("/settings/storage")} last />
          </SettingsGroup>

          <SectionLabel style={{ paddingHorizontal: 16, paddingBottom: 8 }}>Appearance</SectionLabel>
          <SettingsGroup>
            <SettingRow icon="sun" title="Theme" value={THEME_LABEL[themeMode]} onPress={() => router.push("/settings/appearance")} last />
          </SettingsGroup>

          <SectionLabel style={{ paddingHorizontal: 16, paddingBottom: 8 }}>Workspace</SectionLabel>
          <SettingsGroup>
            <SettingRow icon="building" title={me?.tenantName ?? "Workspace"} value="Switch" onPress={() => router.push("/switch-workspace")} />
            <SettingRow icon="info" title="About & version" value={`v${APP_VERSION}`} onPress={() => router.push("/settings/about")} last />
          </SettingsGroup>

          <View style={{ paddingHorizontal: 16, paddingTop: 4, gap: 10 }}>
            <Button variant="ghost" tone="danger" icon="logOut" onPress={() => void handleSignOut()}>
              Sign out
            </Button>
            {pending > 0 && (
              <Text size={11.5} weight="semibold" color="#b45309" style={{ textAlign: "center" }}>
                {pending} item(s) still need to sync before sign-out
              </Text>
            )}
          </View>
          <View style={{ height: 16 }} />
        </View>
      </Body>
    </Screen>
  );
}
