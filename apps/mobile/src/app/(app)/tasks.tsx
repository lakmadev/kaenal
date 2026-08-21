import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";

import { FilterChip } from "@/features/inspections/parts";
import { useMyTasks, type TaskKind, type UnifiedTask } from "@/features/work/queries";
import { useLayout } from "@/hooks/use-layout";
import { useSession } from "@/stores/session";
import { useSync } from "@/stores/sync";
import { useTheme } from "@/theme";
import { Body, Card, EmptyState, Header, Icon, Mono, Screen, SectionLabel, Skeleton, Text, Touchable, type IconName } from "@/ui";

type Filter = "all" | TaskKind;

const KIND_META: Record<TaskKind, { icon: IconName; tone: (p: ReturnType<typeof useTheme>["palette"]) => string }> = {
  ncr: { icon: "alert", tone: () => "#ea580c" },
  capa: { icon: "tool", tone: (p) => p.success },
  inspection: { icon: "clipboard", tone: (p) => p.info },
  eightd: { icon: "gitBranch", tone: () => "#7c3aed" },
};

const BUCKETS = ["Overdue", "Today", "This week", "Later"] as const;
type Bucket = (typeof BUCKETS)[number];

function bucketOf(dueAt: string | null): Bucket {
  if (dueAt === null) return "Later";
  const diff = new Date(dueAt).getTime() - Date.now();
  if (diff < 0) return "Overdue";
  if (diff < 86_400_000 && new Date(dueAt).toDateString() === new Date().toDateString()) return "Today";
  if (diff < 7 * 86_400_000) return "This week";
  return "Later";
}

function dueLabel(dueAt: string | null): string {
  if (dueAt === null) return "";
  const diff = new Date(dueAt).getTime() - Date.now();
  const abs = Math.abs(diff);
  const mag = abs < 86_400_000 ? `${Math.round(abs / 3_600_000)}h` : `${Math.round(abs / 86_400_000)}d`;
  return diff < 0 ? `Overdue ${mag}` : `Due ${mag}`;
}

// M9 My Tasks — the unified assigned inbox (m-work.jsx MyTasks). Aggregates NCRs /
// CAPAs / inspections / 8D steps owned by the caller, grouped by due date.
export default function Tasks() {
  const router = useRouter();
  const me = useSession((s) => s.me);
  const sync = useSync((s) => s.state);
  const { contentMaxWidth } = useLayout();
  const [filter, setFilter] = useState<Filter>("all");
  const { data, isLoading, isError } = useMyTasks();

  const tasks = useMemo(() => data ?? [], [data]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: tasks.length, ncr: 0, capa: 0, inspection: 0, eightd: 0 };
    for (const t of tasks) c[t.kind] += 1;
    return c;
  }, [tasks]);

  const grouped = useMemo(() => {
    const shown = filter === "all" ? tasks : tasks.filter((t) => t.kind === filter);
    const byBucket = new Map<Bucket, UnifiedTask[]>();
    for (const t of shown) {
      const b = bucketOf(t.dueAt);
      (byBucket.get(b) ?? byBucket.set(b, []).get(b)!).push(t);
    }
    return BUCKETS.map((b) => ({ bucket: b, items: byBucket.get(b) ?? [] })).filter((g) => g.items.length > 0);
  }, [tasks, filter]);

  const overline = me ? `${me.plants[0]?.name ?? me.tenantName}` : "Assigned to me";

  return (
    <Screen>
      <Header overline={overline} title="My Tasks" sync={sync} />
      <View style={{ alignItems: "center" }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ width: "100%", maxWidth: contentMaxWidth }}
          contentContainerStyle={{ gap: 7, paddingHorizontal: 16, paddingVertical: 10 }}
        >
          <FilterChip label={`All · ${counts.all}`} active={filter === "all"} onPress={() => setFilter("all")} />
          <FilterChip label={`NCR · ${counts.ncr}`} active={filter === "ncr"} onPress={() => setFilter("ncr")} />
          <FilterChip label={`CAPA · ${counts.capa}`} active={filter === "capa"} onPress={() => setFilter("capa")} />
          <FilterChip label={`8D · ${counts.eightd}`} active={filter === "eightd"} onPress={() => setFilter("eightd")} />
          <FilterChip label={`Inspection · ${counts.inspection}`} active={filter === "inspection"} onPress={() => setFilter("inspection")} />
        </ScrollView>
      </View>
      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth }}>
          {isLoading ? (
            <LoadingRows />
          ) : isError ? (
            <EmptyState icon="cloudOff" title="Couldn't load your tasks" body="You may be offline. Your last synced list returns when you reconnect." />
          ) : grouped.length === 0 ? (
            <EmptyState icon="check" title="Nothing on your plate" body="You've cleared everything assigned to you. New NCRs, CAPAs and 8D steps appear here." />
          ) : (
            grouped.map((g) => (
              <View key={g.bucket}>
                <SectionLabel style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>{g.bucket}</SectionLabel>
                <Card style={{ marginHorizontal: 16 }}>
                  {g.items.map((t, i, a) => (
                    <TaskRow key={`${t.kind}-${t.id}`} task={t} last={i === a.length - 1} onPress={() => router.push(t.route as never)} />
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

function TaskRow({ task, last, onPress }: { task: UnifiedTask; last: boolean; onPress: () => void }) {
  const { palette } = useTheme();
  const meta = KIND_META[task.kind];
  const tint = meta.tone(palette);
  const due = dueLabel(task.dueAt);
  const overdue = task.dueAt !== null && new Date(task.dueAt).getTime() < Date.now();
  return (
    <Touchable onPress={onPress}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: palette.border }}>
        <View style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: tint + (palette.dark ? "26" : "16"), alignItems: "center", justifyContent: "center" }}>
          <Icon name={meta.icon} size={18} color={tint} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Mono size={10} weight="bold" color={palette.muted}>
              {task.code}
            </Mono>
            <Text size={9.5} weight="bold" tone="subtle" style={{ letterSpacing: 0.5, textTransform: "uppercase" }}>
              {task.tag}
            </Text>
          </View>
          <Text size={13.5} weight="semibold" numberOfLines={1} style={{ marginTop: 1 }}>
            {task.title}
          </Text>
        </View>
        {due !== "" && (
          <Text size={11} weight="semibold" color={overdue ? palette.dangerFg : palette.muted}>
            {due}
          </Text>
        )}
      </View>
    </Touchable>
  );
}

function LoadingRows() {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 10 }}>
      <Card style={{ padding: 14, gap: 14 }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width="100%" height={36} />
        ))}
      </Card>
    </View>
  );
}
