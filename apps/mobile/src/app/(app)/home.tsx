import { useRouter } from "expo-router";
import { View } from "react-native";

import { useLayout } from "@/hooks/use-layout";
import { useRole, useSession } from "@/stores/session";
import { useSync } from "@/stores/sync";
import {
  BellButton,
  Body,
  Button,
  Card,
  Header,
  Row,
  Screen,
  SectionLabel,
  StatusPill,
  Text,
  ThemeToggle,
} from "@/ui";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  auditor: "Auditor",
  inspector: "Inspector",
  viewer: "Viewer",
};

// M2 home: proves the shell end-to-end — session identity, resolved role +
// capabilities (server-provided), live sync pill, theme toggle, sign-out. The real
// role-aware dashboard (KPIs + Today's queue per m-home.jsx) lands in M5.
export default function Home() {
  const router = useRouter();
  const me = useSession((s) => s.me);
  const role = useRole();
  const signOut = useSession((s) => s.signOut);
  const sync = useSync((s) => s.state);
  const { contentMaxWidth } = useLayout();

  const firstName = me?.name?.split(" ")[0] ?? "there";

  return (
    <Screen>
      <Header
        overline={me ? `${me.tenantName} · ${ROLE_LABEL[role]}` : undefined}
        title={`Good morning, ${firstName}`}
        sync={sync}
        right={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ThemeToggle />
            <BellButton count={3} />
          </View>
        }
      />
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
              <StatusPill tone="neutral">
                {me?.openNcrs ?? 0} NCRs · {me?.openCapas ?? 0} CAPAs
              </StatusPill>
            </View>
          </Card>

          <SectionLabel style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
            Resolved capabilities ({me?.capabilities.length ?? 0})
          </SectionLabel>
          <Card style={{ marginHorizontal: 16 }}>
            {(me?.capabilities ?? []).slice(0, 6).map((c, i, a) => (
              <Row key={c} icon="check" iconTone="#16a34a" title={c} last={i === a.length - 1} />
            ))}
          </Card>

          <View style={{ padding: 16, marginTop: 8 }}>
            <Button variant="ghost" icon="logOut" onPress={() => void signOut().then(() => router.replace("/(auth)/welcome"))}>
              Sign out
            </Button>
          </View>

          <Text size={11} weight="semibold" tone="subtle" style={{ textAlign: "center" }}>
            Role-aware dashboard (KPIs + Today's queue) arrives in M5
          </Text>
        </View>
      </Body>
    </Screen>
  );
}
