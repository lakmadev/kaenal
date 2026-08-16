import { useRouter } from "expo-router";
import { View } from "react-native";

import { confirmIfUnsynced } from "@/features/auth/guard";
import { useLayout } from "@/hooks/use-layout";
import { useRole, useSession } from "@/stores/session";
import { Body, Button, Card, Header, Screen, SectionLabel, StatusPill, Text, ThemeToggle } from "@/ui";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  auditor: "Auditor",
  inspector: "Inspector",
  viewer: "Viewer",
};

// Interim "Me" tab. The full Settings surface (profile, security/MFA/biometric/
// sessions, offline & storage, notifications, appearance) is M11; until then this
// keeps the essential account actions — identity, workspace switch, appearance,
// and the unsynced-guarded sign-out (05 §4) — reachable off the home dashboard.
export default function Me() {
  const router = useRouter();
  const me = useSession((s) => s.me);
  const role = useRole();
  const signOut = useSession((s) => s.signOut);
  const { contentMaxWidth } = useLayout();

  async function handleSignOut(): Promise<void> {
    if (!(await confirmIfUnsynced("sign out"))) return;
    await signOut();
    router.replace("/(auth)/welcome");
  }

  return (
    <Screen>
      <Header overline="Profile & preferences" title="Me" right={<ThemeToggle />} />
      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth }}>
          <Card style={{ margin: 16, padding: 16, gap: 4 }}>
            <Text size={16} weight="bold">
              {me?.name}
            </Text>
            <Text size={13} tone="muted">
              {me?.email}
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <StatusPill tone="accent">{ROLE_LABEL[role]}</StatusPill>
              {me && (
                <StatusPill tone="neutral">
                  {me.openNcrs} NCRs · {me.openCapas} CAPAs
                </StatusPill>
              )}
            </View>
          </Card>

          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            <Button variant="ghost" icon="building" onPress={() => router.push("/switch-workspace")}>
              Switch workspace
            </Button>
            <Button variant="ghost" icon="logOut" onPress={() => void handleSignOut()}>
              Sign out
            </Button>
          </View>

          <SectionLabel style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 }}>
            Coming in M11
          </SectionLabel>
          <Card style={{ marginHorizontal: 16, padding: 16 }}>
            <Text size={13} tone="muted" style={{ lineHeight: 19 }}>
              Full settings — security (MFA, biometric, active sessions, password), offline & storage,
              notification preferences and appearance — arrive with the Settings phase.
            </Text>
          </Card>
        </View>
      </Body>
    </Screen>
  );
}
