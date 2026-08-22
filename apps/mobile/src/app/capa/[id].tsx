import { useLocalSearchParams } from "expo-router";
import { useSafeBack } from "@/hooks/use-safe-back";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { CapaActionDto } from "@kaenal/types";

import { AssigneeSheet } from "@/features/assign/AssigneeSheet";
import { PhotoField } from "@/features/capture/PhotoField";
import { enqueueAssignCapa, enqueueCapaActionStatus } from "@/features/work/offline";
import { useCapa, useCapaActions } from "@/features/work/queries";
import { useLayout } from "@/hooks/use-layout";
import { useCapabilities } from "@/stores/session";
import { useTheme } from "@/theme";
import { Body, Card, Icon, Mono, Screen, SectionLabel, Skeleton, StatusPill, SyncPill, Text } from "@/ui";
import { engine } from "@/sync";

const PHASE_TONE: Record<string, "neutral" | "progress" | "done"> = {
  closed: "done",
  effectiveness: "done",
  verification: "progress",
  implementation: "progress",
  action_plan: "progress",
  root_cause: "progress",
  initiation: "neutral",
};

// m-work.jsx CapaCheckoff — check off the CAPA's actions (real status writes) and
// attach evidence. Each toggle is a durable, offline-safe mutation.
export default function CapaCheckoff() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const goBack = useSafeBack("/(app)/tasks");
  const insets = useSafeAreaInsets();
  const { palette, radius } = useTheme();
  const { contentMaxWidth } = useLayout();
  const { data: capa, isLoading, refetch } = useCapa(id ?? "");
  const actions = useCapaActions(id ?? "");
  const caps = useCapabilities();
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const canManage = caps.includes("capa:manage");

  async function assignOwner(ownerId: string | null): Promise<void> {
    if (!capa) return;
    await enqueueAssignCapa(capa, ownerId);
    await engine.sync();
    await refetch();
  }

  async function toggle(action: CapaActionDto): Promise<void> {
    setPending(action.id);
    try {
      await enqueueCapaActionStatus(action, action.status === "done" || action.status === "verified" ? "in_progress" : "done");
      await engine.sync();
      await actions.refetch();
    } finally {
      setPending(null);
    }
  }

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 6, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 }}>
          <Pressable onPress={goBack} hitSlop={8} style={{ padding: 4 }}>
            <Icon name="chevronLeft" size={24} stroke={2} color={palette.text} />
          </Pressable>
          <Mono size={11.5} weight="bold" color={palette.muted}>
            {capa?.code ?? "…"}
          </Mono>
          <View style={{ flex: 1 }} />
          {capa && canManage && (
            <Pressable onPress={() => setAssignOpen(true)} hitSlop={8} style={{ padding: 4, marginRight: 4 }} accessibilityLabel="Reassign owner">
              <Icon name="users" size={19} color={palette.muted} />
            </Pressable>
          )}
          {capa ? <StatusPill tone={PHASE_TONE[capa.status] ?? "progress"}>{capa.status.replace(/_/g, " ")}</StatusPill> : <SyncPill state="synced" />}
        </View>
        <View style={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 14 }}>
          {capa ? (
            <Text size={17} weight="bold" style={{ lineHeight: 22 }}>
              {capa.title}
            </Text>
          ) : (
            <Skeleton width="80%" height={22} />
          )}
        </View>
      </View>

      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth, padding: 16, gap: 14 }}>
          {isLoading || !capa ? (
            <Skeleton width="100%" height={120} />
          ) : (
            <>
              {capa.description && (
                <Card style={{ padding: 14 }}>
                  <SectionLabel style={{ marginBottom: 8 }}>Action</SectionLabel>
                  <Text size={13.5} style={{ lineHeight: 20 }}>
                    {capa.description}
                  </Text>
                </Card>
              )}

              <View>
                <SectionLabel style={{ marginBottom: 8 }}>Checklist</SectionLabel>
                <Card>
                  {actions.isLoading ? (
                    <View style={{ padding: 14, gap: 12 }}>
                      {[0, 1].map((i) => (
                        <Skeleton key={i} width="100%" height={18} />
                      ))}
                    </View>
                  ) : (actions.data ?? []).length === 0 ? (
                    <View style={{ padding: 14 }}>
                      <Text size={13} tone="muted">
                        No actions on this CAPA yet.
                      </Text>
                    </View>
                  ) : (
                    (actions.data ?? []).map((a, i, arr) => {
                      const done = a.status === "done" || a.status === "verified";
                      return (
                        <Pressable key={a.id} onPress={() => void toggle(a)} disabled={pending !== null}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: palette.border, opacity: pending === a.id ? 0.5 : 1 }}>
                            <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: done ? palette.accent : palette.border, backgroundColor: done ? palette.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
                              {done && <Icon name="check" size={12} stroke={3} color={palette.accentFg} />}
                            </View>
                            <Text size={13} style={{ flex: 1 }}>
                              {a.description}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                </Card>
              </View>

              <View>
                <SectionLabel style={{ marginBottom: 8 }}>Evidence</SectionLabel>
                <PhotoField value={photoIds} onChange={setPhotoIds} />
                <Text size={11} tone="subtle" style={{ marginTop: 6 }}>
                  Photos upload to your workspace; linking evidence directly to the CAPA lands with the web
                  activity feed.
                </Text>
              </View>
            </>
          )}
          <View style={{ height: radius.md }} />
        </View>
      </Body>

      {capa && (
        <AssigneeSheet
          visible={assignOpen}
          onClose={() => setAssignOpen(false)}
          title="Assign CAPA owner"
          code={capa.code}
          currentOwnerId={capa.ownerId}
          onPick={(ownerId) => assignOwner(ownerId)}
        />
      )}
    </Screen>
  );
}
