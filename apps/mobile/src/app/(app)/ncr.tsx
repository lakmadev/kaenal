import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import type { NcrDto } from "@kaenal/types";

import { FilterChip } from "@/features/inspections/parts";
import { NcrCard } from "@/features/ncr/parts";
import { NcrDetailView } from "@/features/ncr/NcrDetailView";
import { useNcrs } from "@/features/ncr/queries";
import { useLayout } from "@/hooks/use-layout";
import { useCapabilities, useSession } from "@/stores/session";
import { useSync } from "@/stores/sync";
import { useTheme } from "@/theme";
import { Body, Card, EmptyState, Header, Icon, Screen, Skeleton } from "@/ui";

const OPEN = new Set<NcrDto["status"]>(["draft", "open", "assigned", "in_progress", "reopened", "escalated"]);
type Filter = "open" | "verify" | "closed";

// M8 NCR list — the NCRs tab. Real /v1/ncrs, status filter chips. On a phone a
// row → the detail route; on a tablet (≥768pt) it's a master-detail two-pane
// (m-tablet.jsx): the list on the left, the selected NCR's detail on the right.
export default function Ncr() {
  const router = useRouter();
  const me = useSession((s) => s.me);
  const caps = useCapabilities();
  const sync = useSync((s) => s.state);
  const { palette } = useTheme();
  const { contentMaxWidth, isTablet } = useLayout();
  const [filter, setFilter] = useState<Filter>("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading, isError } = useNcrs();

  const items = useMemo(() => data?.items ?? [], [data]);
  const counts = useMemo(() => {
    let open = 0;
    let verify = 0;
    let closed = 0;
    for (const n of items) {
      if (n.status === "resolved") verify += 1;
      else if (n.status === "closed" || n.status === "verified") closed += 1;
      else if (OPEN.has(n.status)) open += 1;
    }
    return { open, verify, closed };
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === "verify") return items.filter((n) => n.status === "resolved");
    if (filter === "closed") return items.filter((n) => n.status === "closed" || n.status === "verified");
    return items.filter((n) => OPEN.has(n.status));
  }, [items, filter]);

  // Tablet: keep a valid selection — default to the first row, and correct it if
  // the current pick falls out of the active filter.
  useEffect(() => {
    if (!isTablet) return;
    if (filtered.length === 0) {
      setSelectedId(null);
    } else if (selectedId === null || !filtered.some((n) => n.id === selectedId)) {
      setSelectedId(filtered[0]!.id);
    }
  }, [isTablet, filtered, selectedId]);

  const overline = me ? `${me.plants[0]?.name ?? me.tenantName}` : undefined;
  const canCreate = caps.includes("ncr:create");

  function onRow(ncr: NcrDto): void {
    if (isTablet) setSelectedId(ncr.id);
    else router.push(`/ncr/${ncr.id}`);
  }

  const master = (
    <Screen>
      <Header
        overline={overline}
        title="Non-conformance"
        sync={sync}
        right={
          canCreate ? (
            <Pressable onPress={() => router.push("/ncr/new")} hitSlop={6} accessibilityLabel="Raise NCR">
              <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" }}>
                <Icon name="plus" size={20} />
              </View>
            </Pressable>
          ) : undefined
        }
      />
      <View style={{ alignItems: "center" }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ width: "100%", maxWidth: contentMaxWidth }}
          contentContainerStyle={{ gap: 7, paddingHorizontal: 16, paddingVertical: 10 }}
        >
          <FilterChip label={`Open · ${counts.open}`} active={filter === "open"} onPress={() => setFilter("open")} />
          <FilterChip label={`To verify · ${counts.verify}`} active={filter === "verify"} onPress={() => setFilter("verify")} />
          <FilterChip label={`Closed · ${counts.closed}`} active={filter === "closed"} onPress={() => setFilter("closed")} />
        </ScrollView>
      </View>
      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: isTablet ? undefined : contentMaxWidth }}>
          {isLoading ? (
            <LoadingRows />
          ) : isError ? (
            <EmptyState icon="cloudOff" title="Couldn't load NCRs" body="You may be offline. Your last synced list returns when you reconnect." />
          ) : filtered.length === 0 ? (
            <EmptyState icon="check" title="Nothing here" body="No non-conformances in this view. Raise one from a failed check or the Quick-Log." />
          ) : (
            filtered.map((ncr) => <NcrCard key={ncr.id} ncr={ncr} selected={isTablet && ncr.id === selectedId} onPress={() => onRow(ncr)} />)
          )}
          <View style={{ height: 16 }} />
        </View>
      </Body>
    </Screen>
  );

  if (!isTablet) return master;

  // Tablet master-detail (m-tablet.jsx): list column + detail column.
  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      <View style={{ width: 360, flexShrink: 0, borderRightWidth: 1, borderRightColor: palette.border }}>{master}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {selectedId ? (
          <NcrDetailView id={selectedId} embedded />
        ) : (
          <Screen>
            <Body contentStyle={{ alignItems: "center", justifyContent: "center" }}>
              <EmptyState icon="flag" title="Select a non-conformance" body="Pick one from the list to see its detail, activity and actions here." />
            </Body>
          </Screen>
        )}
      </View>
    </View>
  );
}

function LoadingRows() {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 10, gap: 10 }}>
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} style={{ padding: 14, gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Skeleton width={70} height={12} />
            <View style={{ flex: 1 }} />
            <Skeleton width={54} height={12} />
          </View>
          <Skeleton width="82%" height={16} />
          <Skeleton width="50%" height={12} />
        </Card>
      ))}
    </View>
  );
}
