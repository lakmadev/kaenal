import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { NotificationDto } from "@kaenal/types";

import { useLayout } from "@/hooks/use-layout";
import { apiClient } from "@/lib/api";
import { useSession } from "@/stores/session";
import { useTheme } from "@/theme";
import { Body, Card, EmptyState, Icon, Mono, Screen, SectionLabel, Skeleton, Text, type IconName } from "@/ui";

function iconFor(kind: string): { icon: IconName; tone: (p: ReturnType<typeof useTheme>["palette"]) => string } {
  if (kind.includes("inspection")) return { icon: "clipboard", tone: (p) => p.info };
  if (kind.includes("ncr")) return { icon: "alert", tone: () => "#ea580c" };
  if (kind.includes("capa")) return { icon: "tool", tone: (p) => p.success };
  if (kind.includes("8d") || kind.includes("eight")) return { icon: "gitBranch", tone: () => "#7c3aed" };
  if (kind.includes("sync")) return { icon: "cloudOff", tone: (p) => p.danger };
  if (kind.includes("approval") || kind.includes("document")) return { icon: "check", tone: (p) => p.success };
  if (kind.includes("due")) return { icon: "clock", tone: (p) => p.warn };
  return { icon: "bell", tone: (p) => p.muted };
}

function ago(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

// m-system.jsx Notifications — the real /v1/notifications feed, grouped New / Earlier.
export default function Notifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const { contentMaxWidth } = useLayout();
  const tenant = useSession((s) => s.tenant);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["notifications", tenant],
    queryFn: async (): Promise<NotificationDto[]> => {
      const res = await apiClient.listNotifications({ query: { limit: 50 } });
      return res.status === 200 ? res.body.items : [];
    },
    enabled: tenant !== null,
    staleTime: 15_000,
  });

  const groups = useMemo(() => {
    const items = data ?? [];
    return [
      { grp: "New", items: items.filter((n) => n.readAt === null) },
      { grp: "Earlier", items: items.filter((n) => n.readAt !== null) },
    ].filter((g) => g.items.length > 0);
  }, [data]);

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 6, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingBottom: 10 }}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
            <Icon name="chevronLeft" size={24} stroke={2} color={palette.text} />
          </Pressable>
          <Text size={20} weight="bold" style={{ flex: 1, letterSpacing: -0.4 }}>
            Notifications
          </Text>
        </View>
      </View>
      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth }}>
          {isLoading ? (
            <View style={{ padding: 16 }}>
              <Card style={{ padding: 14, gap: 14 }}>
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} width="100%" height={36} />
                ))}
              </Card>
            </View>
          ) : isError ? (
            <EmptyState icon="cloudOff" title="Couldn't load notifications" body="You may be offline. They return when you reconnect." />
          ) : groups.length === 0 ? (
            <EmptyState icon="bell" title="No new notifications" body="Assignments, due-soon reminders and sync alerts show up here." />
          ) : (
            groups.map((g) => (
              <View key={g.grp}>
                <SectionLabel style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>{g.grp}</SectionLabel>
                <Card style={{ marginHorizontal: 16 }}>
                  {g.items.map((n, i, a) => (
                    <NotifRow key={n.id} n={n} last={i === a.length - 1} />
                  ))}
                </Card>
              </View>
            ))
          )}
          <View style={{ height: 16 }} />
        </View>
      </Body>
    </Screen>
  );
}

function NotifRow({ n, last }: { n: NotificationDto; last: boolean }) {
  const { palette } = useTheme();
  const m = iconFor(n.kind);
  const tint = m.tone(palette);
  const unread = n.readAt === null;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: palette.border, backgroundColor: unread ? palette.accentSoft : "transparent" }}>
      <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: tint + (palette.dark ? "26" : "16"), alignItems: "center", justifyContent: "center" }}>
        <Icon name={m.icon} size={17} color={tint} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={13.5} weight="semibold">
          {n.title}
        </Text>
        {n.body && (
          <Text size={12} tone="muted" style={{ marginTop: 1 }}>
            {n.body}
          </Text>
        )}
      </View>
      <Mono size={11} color={palette.subtle}>
        {ago(n.createdAt)}
      </Mono>
    </View>
  );
}
