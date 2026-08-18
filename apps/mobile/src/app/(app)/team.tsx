import { useMemo } from "react";
import { View } from "react-native";

import { Kpi } from "@/features/home/parts";
import { useMembers } from "@/features/oversight/queries";
import { useLayout } from "@/hooks/use-layout";
import { useSession } from "@/stores/session";
import { useSync } from "@/stores/sync";
import { useTheme } from "@/theme";
import { Avatar, Body, Card, EmptyState, Header, Screen, SectionLabel, Skeleton, Text } from "@/ui";

const ROLE_LABEL: Record<string, string> = { admin: "Admin", manager: "Manager", auditor: "Auditor", inspector: "Inspector", viewer: "Viewer", partner: "Partner" };

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : "")).toUpperCase() || "?";
}

// m-oversight.jsx TeamSnapshot — the manager's people + plant view (real members).
export default function Team() {
  const me = useSession((s) => s.me);
  const sync = useSync((s) => s.state);
  const { contentMaxWidth } = useLayout();
  const { data, isLoading, isError } = useMembers();
  const members = useMemo(() => data ?? [], [data]);

  const counts = useMemo(() => {
    let inspectors = 0;
    let auditors = 0;
    for (const m of members) {
      if (m.role === "inspector") inspectors += 1;
      if (m.role === "auditor") auditors += 1;
    }
    return { people: members.length, inspectors, auditors };
  }, [members]);

  return (
    <Screen>
      <Header overline={me ? (me.plants[0]?.name ?? me.tenantName) : undefined} title="Team & plant" sync={sync} />
      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth }}>
          {isLoading ? (
            <View style={{ padding: 16, gap: 12 }}>
              <Skeleton width="100%" height={64} />
              <Skeleton width="100%" height={160} />
            </View>
          ) : isError ? (
            <EmptyState icon="cloudOff" title="Couldn't load the team" body="You may be offline. Your last synced view returns when you reconnect." />
          ) : (
            <>
              <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 14 }}>
                <Kpi kpi={{ label: "People", value: String(counts.people), tone: "default" }} />
                <Kpi kpi={{ label: "Inspectors", value: String(counts.inspectors), tone: "default" }} />
                <Kpi kpi={{ label: "Auditors", value: String(counts.auditors), tone: "default" }} />
              </View>

              <SectionLabel style={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 }}>People</SectionLabel>
              <Card style={{ marginHorizontal: 16 }}>
                {members.map((m, i, a) => (
                  <PersonRow key={m.userId} name={m.name} role={m.role} last={i === a.length - 1} />
                ))}
              </Card>
              <View style={{ height: 16 }} />
            </>
          )}
        </View>
      </Body>
    </Screen>
  );
}

function PersonRow({ name, role, last }: { name: string; role: string; last: boolean }) {
  const { palette } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: palette.border }}>
      <Avatar initials={initials(name)} size={34} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={13.5} weight="semibold" numberOfLines={1}>
          {name}
        </Text>
        <Text size={11.5} tone="muted">
          {ROLE_LABEL[role] ?? role}
        </Text>
      </View>
    </View>
  );
}
