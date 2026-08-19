import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { NotificationDto } from "@kaenal/types";

import { useLayout } from "@/hooks/use-layout";
import { apiClient } from "@/lib/api";
import { entityRoute } from "@/lib/deep-links";
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
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["notifications", tenant],
    queryFn: async (): Promise<NotificationDto[]> => {
      const res = await apiClient.listNotifications({ query: { limit: 50 } });
      return res.status === 200 ? res.body.items : [];
    },
    enabled: tenant !== null,
    staleTime: 15_000,
  });

  // Optimistically flip a row to read locally, then persist. The unread badge
  // (unread-count query) is invalidated so the bell recolours immediately.
  function markRead(id: string, alreadyRead: boolean): void {
    if (alreadyRead) return;
    const now = new Date().toISOString();
    qc.setQueryData<NotificationDto[]>(["notifications", tenant], (prev) =>
      (prev ?? []).map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? now } : n)),
    );
    void apiClient.markNotificationRead({ params: { id }, body: {} }).finally(() => {
      void qc.invalidateQueries({ queryKey: ["notifications-unread", tenant] });
    });
  }

  const markAll = useMutation({
    mutationFn: async () => {
      await apiClient.markAllNotificationsRead({ body: {} });
    },
    onMutate: () => {
      const now = new Date().toISOString();
      qc.setQueryData<NotificationDto[]>(["notifications", tenant], (prev) =>
        (prev ?? []).map((n) => ({ ...n, readAt: n.readAt ?? now })),
      );
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["notifications", tenant] });
      void qc.invalidateQueries({ queryKey: ["notifications-unread", tenant] });
    },
  });

  // Tap a row: mark it read, then deep-link into its entity if one exists.
  function open(n: NotificationDto): void {
    markRead(n.id, n.readAt !== null);
    const href = entityRoute(n.entityKind, n.entityId);
    if (href) router.push(href);
  }

  const items = data ?? [];
  const anyUnread = items.some((n) => n.readAt === null);
  const groups = useMemo(() => {
    return [
      { grp: "New", items: items.filter((n) => n.readAt === null) },
      { grp: "Earlier", items: items.filter((n) => n.readAt !== null) },
    ].filter((g) => g.items.length > 0);
  }, [items]);

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
          {anyUnread && (
            <Pressable
              onPress={() => markAll.mutate()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Mark all notifications read"
              style={{ paddingHorizontal: 6, paddingVertical: 4 }}
            >
              <Text size={13} weight="semibold" tone="accent">
                Mark all read
              </Text>
            </Pressable>
          )}
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
                    <NotifRow key={n.id} n={n} last={i === a.length - 1} onPress={() => open(n)} />
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

function NotifRow({ n, last, onPress }: { n: NotificationDto; last: boolean; onPress: () => void }) {
  const { palette } = useTheme();
  const m = iconFor(n.kind);
  const tint = m.tone(palette);
  const unread = n.readAt === null;
  const linkable = entityRoute(n.entityKind, n.entityId) !== null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${n.title}${n.body ? `, ${n.body}` : ""}${unread ? ", unread" : ""}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.border,
        backgroundColor: pressed ? palette.bgSubtle : unread ? palette.accentSoft : "transparent",
      })}
    >
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
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <Mono size={11} color={palette.subtle}>
          {ago(n.createdAt)}
        </Mono>
        {linkable && <Icon name="chevronRight" size={14} color={palette.subtle} />}
      </View>
    </Pressable>
  );
}
