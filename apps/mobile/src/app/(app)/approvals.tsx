import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { ApprovalDetailView } from "@/features/oversight/ApprovalDetailView";
import { usePendingApprovals } from "@/features/oversight/queries";
import { useLayout } from "@/hooks/use-layout";
import { useRole, useSession } from "@/stores/session";
import { useSync } from "@/stores/sync";
import { useTheme } from "@/theme";
import { Body, Card, EmptyState, Header, Icon, Mono, Screen, Skeleton, Text } from "@/ui";

const ROLE_LABEL: Record<string, string> = { admin: "Admin", manager: "Manager", auditor: "Auditor", inspector: "Inspector", viewer: "Viewer" };

function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// m-oversight.jsx ApprovalsInbox — documents awaiting the manager's approval. On
// a phone a row → the approval route; on a tablet (≥768pt) it's a master-detail
// two-pane (m-tablet.jsx): the inbox on the left, the item review on the right.
export default function Approvals() {
  const router = useRouter();
  const me = useSession((s) => s.me);
  const role = useRole();
  const sync = useSync((s) => s.state);
  const { palette } = useTheme();
  const { contentMaxWidth, isTablet } = useLayout();
  const { data, isLoading, isError, refetch } = usePendingApprovals();
  const items = data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isTablet) return;
    if (items.length === 0) setSelectedId(null);
    else if (selectedId === null || !items.some((d) => d.id === selectedId)) setSelectedId(items[0]!.id);
  }, [isTablet, items, selectedId]);

  function onRow(docId: string): void {
    if (isTablet) setSelectedId(docId);
    else router.push(`/approval/${docId}`);
  }

  const master = (
    <Screen>
      <Header overline={me ? `${ROLE_LABEL[role]} · ${me.plants[0]?.name ?? me.tenantName}` : undefined} title="Approvals" sync={sync} />
      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: isTablet ? undefined : contentMaxWidth }}>
          {isLoading ? (
            <LoadingRows />
          ) : isError ? (
            <EmptyState icon="cloudOff" title="Couldn't load approvals" body="You may be offline. Your last synced list returns when you reconnect." />
          ) : items.length === 0 ? (
            <EmptyState icon="check" title="Nothing to approve" body="No documents are waiting on your sign-off. Requests appear here and notify you." />
          ) : (
            items.map((doc) => (
              <ApprovalCard key={doc.id} doc={doc} selected={isTablet && doc.id === selectedId} onPress={() => onRow(doc.id)} time={ago(doc.updatedAt)} />
            ))
          )}
          <View style={{ height: 16 }} />
        </View>
      </Body>
    </Screen>
  );

  if (!isTablet) return master;

  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      <View style={{ width: 360, flexShrink: 0, borderRightWidth: 1, borderRightColor: palette.border }}>{master}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {selectedId ? (
          <ApprovalDetailView id={selectedId} embedded onDone={() => void refetch()} />
        ) : (
          <Screen>
            <Body contentStyle={{ alignItems: "center", justifyContent: "center" }}>
              <EmptyState icon="check" title="Nothing selected" body="Pick a request from the inbox to review and sign off here." />
            </Body>
          </Screen>
        )}
      </View>
    </View>
  );
}

function ApprovalCard({
  doc,
  onPress,
  time,
  selected = false,
}: {
  doc: { id: string; code: string; title: string; category: string };
  onPress: () => void;
  time: string;
  selected?: boolean;
}) {
  const { palette, radius } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <Card
        style={{
          marginHorizontal: 16,
          marginTop: 10,
          padding: 14,
          ...(selected ? { backgroundColor: palette.accentSoft, borderColor: palette.accent, borderLeftWidth: 3 } : {}),
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 38, height: 38, borderRadius: radius.md, backgroundColor: palette.info + (palette.dark ? "26" : "16"), alignItems: "center", justifyContent: "center" }}>
            <Icon name="doc" size={18} color={palette.info} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Mono size={10} weight="bold" color={palette.muted}>
                {doc.code}
              </Mono>
              <Text size={9.5} weight="bold" tone="subtle" style={{ letterSpacing: 0.5, textTransform: "uppercase" }}>
                {doc.category.replace(/_/g, " ")}
              </Text>
            </View>
            <Text size={14} weight="semibold" numberOfLines={1} style={{ marginTop: 1 }}>
              {doc.title}
            </Text>
            <Text size={11.5} tone="muted" style={{ marginTop: 2 }}>
              Awaiting review · {time}
            </Text>
          </View>
          <Icon name="chevronRight" size={16} color={palette.subtle} />
        </View>
      </Card>
    </Pressable>
  );
}

function LoadingRows() {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 10, gap: 10 }}>
      {[0, 1, 2].map((i) => (
        <Card key={i} style={{ padding: 14, flexDirection: "row", gap: 10, alignItems: "center" }}>
          <Skeleton width={38} height={38} radius={8} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="50%" height={12} />
            <Skeleton width="80%" height={14} />
          </View>
        </Card>
      ))}
    </View>
  );
}
