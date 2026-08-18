import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";

import type { InspectionDto } from "@kaenal/types";

import { FilterChip, InspectionListCard } from "@/features/inspections/parts";
import { useInspections } from "@/features/inspections/queries";
import { useLayout } from "@/hooks/use-layout";
import { useSession } from "@/stores/session";
import { useSync } from "@/stores/sync";
import { Body, Card, EmptyState, Header, Screen, Skeleton } from "@/ui";

const ACTIVE = new Set<InspectionDto["status"]>(["scheduled", "in_progress"]);

type Filter = "assigned" | "overdue" | "done";

function statusMeta(status: InspectionDto["status"]): string {
  switch (status) {
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Scheduled";
  }
}

// M6 Inspections — the inspector's work queue (m-inspections.jsx InspList), on the
// Tasks tab. M9 augments this with NCRs/CAPAs/8D into the unified inbox.
export default function Tasks() {
  const router = useRouter();
  const me = useSession((s) => s.me);
  const sync = useSync((s) => s.state);
  const { contentMaxWidth } = useLayout();
  const [filter, setFilter] = useState<Filter>("assigned");
  const { data, isLoading, isError } = useInspections();

  const items = useMemo(() => data?.items ?? [], [data]);
  const counts = useMemo(() => {
    const now = Date.now();
    let assigned = 0;
    let overdue = 0;
    let done = 0;
    for (const i of items) {
      if (i.status === "completed") done += 1;
      else if (ACTIVE.has(i.status)) {
        assigned += 1;
        if (i.scheduledAt !== null && new Date(i.scheduledAt).getTime() < now) overdue += 1;
      }
    }
    return { assigned, overdue, done };
  }, [items]);

  const filtered = useMemo(() => {
    const now = Date.now();
    if (filter === "done") return items.filter((i) => i.status === "completed");
    if (filter === "overdue")
      return items.filter((i) => ACTIVE.has(i.status) && i.scheduledAt !== null && new Date(i.scheduledAt).getTime() < now);
    return items.filter((i) => ACTIVE.has(i.status));
  }, [items, filter]);

  const plantName = me?.plants[0]?.name;
  const overline = me ? `${plantName ?? me.tenantName}` : undefined;

  return (
    <Screen>
      <Header overline={overline} title="Today's work" sync={sync} />
      <View style={{ alignItems: "center", backgroundColor: undefined }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ width: "100%", maxWidth: contentMaxWidth }}
          contentContainerStyle={{ gap: 7, paddingHorizontal: 16, paddingVertical: 10 }}
        >
          <FilterChip label={`Assigned · ${counts.assigned}`} active={filter === "assigned"} onPress={() => setFilter("assigned")} />
          <FilterChip
            label={`Overdue · ${counts.overdue}`}
            active={filter === "overdue"}
            tone="danger"
            onPress={() => setFilter("overdue")}
          />
          <FilterChip label={`Done · ${counts.done}`} active={filter === "done"} onPress={() => setFilter("done")} />
        </ScrollView>
      </View>
      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth }}>
          {isLoading ? (
            <LoadingRows />
          ) : isError ? (
            <EmptyState icon="cloudOff" title="Couldn't load your work" body="You may be offline. Your last synced list returns when you reconnect." />
          ) : filtered.length === 0 ? (
            <EmptyState icon="check" title="You're all caught up" body="No inspections here right now. New work appears here and notifies you." />
          ) : (
            filtered.map((insp) => (
              <InspectionListCard
                key={insp.id}
                insp={insp}
                meta={statusMeta(insp.status)}
                onPress={() => router.push(`/inspection/${insp.id}`)}
              />
            ))
          )}
          <View style={{ height: 16 }} />
        </View>
      </Body>
    </Screen>
  );
}

function LoadingRows() {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 10, gap: 10 }}>
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} style={{ padding: 14, gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Skeleton width={64} height={12} />
            <View style={{ flex: 1 }} />
            <Skeleton width={44} height={12} />
          </View>
          <Skeleton width="80%" height={16} />
          <Skeleton width="55%" height={12} />
        </Card>
      ))}
    </View>
  );
}
