import { FlashList } from "@shopify/flash-list";
import type { AuditLogEntryDto } from "@kaenal/types";
import { View } from "react-native";

import { useAuditLog } from "@/features/oversight/queries";
import { useLayout } from "@/hooks/use-layout";
import { useSync } from "@/stores/sync";
import { useTheme } from "@/theme";
import { Card, EmptyState, Header, Icon, Mono, Screen, Skeleton, Text, type IconName } from "@/ui";

function iconFor(action: string): IconName {
  if (action.includes("role")) return "key";
  if (action.includes("setting") || action.includes("entitlement")) return "settings";
  if (action === "exported") return "download";
  if (action === "deleted" || action === "purged") return "trash";
  if (action.includes("sign_in") || action.includes("signed_in")) return "logOut";
  return "activity";
}

function titleFor(action: string): string {
  return action.charAt(0).toUpperCase() + action.slice(1).replace(/_/g, " ");
}

function clock(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  if (then.toDateString() === now.toDateString()) return then.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// m-oversight.jsx audit highlights — the admin's read-only audit-log feed.
export default function Audit() {
  const sync = useSync((s) => s.state);
  const { palette, radius } = useTheme();
  const { contentMaxWidth } = useLayout();
  const { data, isLoading, isError } = useAuditLog();
  const items = data ?? [];

  // The audit feed is unbounded (every sensitive event), so it virtualises via
  // FlashList rather than mapping every row into a ScrollView. The single-card
  // framing + row dividers are preserved: FlashList is the scroller, wrapped in
  // the bordered rounded Card the design shows.
  const list =
    isLoading ? (
      <Card style={{ padding: 14, gap: 14, marginHorizontal: 16, marginTop: 16 }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width="100%" height={36} />
        ))}
      </Card>
    ) : isError ? (
      <View style={{ padding: 16 }}>
        <EmptyState icon="cloudOff" title="Couldn't load the audit log" body="You may be offline, or this needs the audit-log capability." />
      </View>
    ) : items.length === 0 ? (
      <View style={{ padding: 16 }}>
        <EmptyState icon="shield" title="No recent events" body="Sensitive actions across the workspace show up here." />
      </View>
    ) : (
      <View style={{ flex: 1, alignItems: "center" }}>
        <View style={{ flex: 1, width: "100%", maxWidth: contentMaxWidth, padding: 16 }}>
          <View style={{ flex: 1, borderWidth: 1, borderColor: palette.border, borderRadius: radius.lg, backgroundColor: palette.surface, overflow: "hidden" }}>
            <FlashList
              data={items}
              keyExtractor={(e) => e.id}
              renderItem={({ item, index }) => <AuditRow entry={item} last={index === items.length - 1} />}
            />
          </View>
        </View>
      </View>
    );

  return (
    <Screen>
      <Header overline="Read-only · sensitive events" title="Audit log" sync={sync} />
      {list}
    </Screen>
  );
}

function AuditRow({ entry, last }: { entry: AuditLogEntryDto; last: boolean }) {
  const { palette, radius } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: palette.border }}>
      <View style={{ width: 30, height: 30, borderRadius: radius.md, backgroundColor: palette.bgSubtle, alignItems: "center", justifyContent: "center" }}>
        <Icon name={iconFor(entry.action)} size={15} color={palette.muted} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={13} weight="semibold">
          {titleFor(entry.action)}
        </Text>
        <Text size={11.5} tone="muted" numberOfLines={1}>
          {entry.entityKind} · by {entry.actorName}
        </Text>
      </View>
      <Mono size={11} color={palette.subtle}>
        {clock(entry.createdAt)}
      </Mono>
    </View>
  );
}
