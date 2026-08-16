import { View } from "react-native";

import { DashboardBody } from "@/features/home/dashboards";
import { useDashboard } from "@/features/home/use-dashboard";
import { useLayout } from "@/hooks/use-layout";
import { useRole, useSession } from "@/stores/session";
import { useSync } from "@/stores/sync";
import { BellButton, Body, Card, Header, Screen, Skeleton, Text } from "@/ui";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  auditor: "Auditor",
  inspector: "Inspector",
  viewer: "Viewer",
};

/** Time-of-day greeting for the inspector's big title (design: "Good morning, Sara"). */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** The role-aware home title (m-home.jsx). */
function titleFor(role: string, firstName: string): string {
  switch (role) {
    case "inspector":
      return `${greeting()}, ${firstName}`;
    case "manager":
      return "Plant snapshot";
    case "admin":
      return "Workspace pulse";
    default:
      return "Overview";
  }
}

// M5 home: role-aware dashboards (Inspector / Viewer / Manager / Admin) from
// m-home.jsx, curated by the caller's role + capabilities. Every metric is real,
// computed by GET /v1/me/dashboard inside the tenant-scoped tx (RLS-scoped);
// presentation-only curation, since the server re-enforces every capability.
export default function Home() {
  const me = useSession((s) => s.me);
  const role = useRole();
  const sync = useSync((s) => s.state);
  const { contentMaxWidth } = useLayout();
  const { data, isLoading, isError, refetch, isRefetching } = useDashboard();

  const firstName = me?.name?.split(" ")[0] ?? "there";
  const plantName = me?.plants[0]?.name;
  const overline = me ? `${plantName ?? me.tenantName} · ${ROLE_LABEL[role]}` : undefined;

  return (
    <Screen>
      <Header overline={overline} title={titleFor(role, firstName)} sync={sync} right={<BellButton />} />
      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth }}>
          {data ? (
            <DashboardBody data={data} />
          ) : isLoading ? (
            <LoadingState />
          ) : isError ? (
            <ErrorState onRetry={() => void refetch()} busy={isRefetching} />
          ) : null}
        </View>
      </Body>
    </Screen>
  );
}

/** KPI + card skeleton while the first dashboard pull is in flight. */
function LoadingState() {
  return (
    <>
      <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 14 }}>
        {[0, 1, 2].map((i) => (
          <Card key={i} style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 14, gap: 8 }}>
            <Skeleton width="70%" height={10} />
            <Skeleton width="45%" height={22} />
          </Card>
        ))}
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
        <Card style={{ padding: 14, gap: 14 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width="100%" height={40} />
          ))}
        </Card>
      </View>
    </>
  );
}

function ErrorState({ onRetry, busy }: { onRetry: () => void; busy: boolean }) {
  return (
    <View style={{ padding: 16, paddingTop: 40, alignItems: "center", gap: 10 }}>
      <Text size={15} weight="bold">
        Couldn't load your dashboard
      </Text>
      <Text size={13} tone="muted" style={{ textAlign: "center", maxWidth: 260, lineHeight: 19 }}>
        You may be offline. Your last synced view returns automatically once you reconnect.
      </Text>
      <Text size={13} weight="semibold" tone="accent" onPress={busy ? undefined : onRetry}>
        {busy ? "Retrying…" : "Try again"}
      </Text>
    </View>
  );
}
