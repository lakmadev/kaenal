import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { startInspection } from "@/features/inspections/api";
import { enqueueAssignInspection } from "@/features/inspections/offline";
import { useInspection, useTemplate } from "@/features/inspections/queries";
import { AssigneeSheet } from "@/features/assign/AssigneeSheet";
import { useLayout } from "@/hooks/use-layout";
import { useCapabilities } from "@/stores/session";
import { engine } from "@/sync";
import { useTheme } from "@/theme";
import { ActionBar, Body, Button, Card, Icon, Mono, Screen, SectionLabel, Sev, Skeleton, StatusPill, SyncPill, Text, type SevLevel } from "@/ui";

const RISK_SEV: Record<string, SevLevel> = { critical: "critical", high: "high", medium: "medium", low: "low" };

// m-inspections.jsx InspStart — pre-run overview: sections summary + start/resume.
export default function InspectionStart() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const { contentMaxWidth } = useLayout();
  const [busy, setBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const caps = useCapabilities();
  const canAssign = caps.includes("inspection:perform");

  const insp = useInspection(id ?? "");
  const tmpl = useTemplate(insp.data?.templateId);

  async function assign(inspectorId: string | null): Promise<void> {
    if (!insp.data) return;
    await enqueueAssignInspection(insp.data, inspectorId);
    await engine.sync();
    await insp.refetch();
  }

  const inProgress = insp.data?.status === "in_progress";
  const totalChecks =
    tmpl.data?.schema.sections.reduce((n, s) => n + s.items.filter((i) => i.type !== "header" && i.type !== "info").length, 0) ?? 0;

  async function begin(): Promise<void> {
    if (!insp.data) return;
    setBusy(true);
    try {
      // Starting is an online transition (scheduled → in_progress); if it fails we
      // still open the runner — the draft is local and completion is queued.
      if (insp.data.status === "scheduled") {
        await startInspection(insp.data.id, insp.data.lockVersion).catch(() => undefined);
      }
      router.push(`/inspection/${id}/run`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 6, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingBottom: 4 }}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
            <Icon name="chevronLeft" size={24} stroke={2} color={palette.text} />
          </Pressable>
          <Mono size={11.5} weight="bold" color={palette.muted}>
            {insp.data?.code ?? "…"}
          </Mono>
          <View style={{ flex: 1 }} />
          {insp.data && canAssign && (
            <Pressable onPress={() => setAssignOpen(true)} hitSlop={8} style={{ padding: 4, marginRight: 4 }} accessibilityLabel="Assign inspector">
              <Icon name="users" size={19} color={palette.muted} />
            </Pressable>
          )}
          <SyncPill state="synced" />
        </View>
      </View>

      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth, padding: 16, gap: 14 }}>
          {insp.isLoading ? (
            <Skeleton width="90%" height={22} />
          ) : insp.data ? (
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {insp.data.risk && <Sev level={RISK_SEV[insp.data.risk] ?? "medium"} />}
                <StatusPill tone={inProgress ? "progress" : "neutral"}>{inProgress ? "In progress" : "Scheduled"}</StatusPill>
              </View>
              <Text size={19} weight="bold" style={{ lineHeight: 24 }}>
                {insp.data.title}
              </Text>
              <Text size={12.5} tone="muted">
                {insp.data.templateName ?? "Inspection"} · {totalChecks} check{totalChecks === 1 ? "" : "s"}
              </Text>
            </View>
          ) : null}

          <Card style={{ padding: 14 }}>
            <SectionLabel style={{ marginBottom: 4 }}>Sections · {totalChecks} checks</SectionLabel>
            {tmpl.isLoading ? (
              <View style={{ gap: 12, paddingTop: 8 }}>
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} width="100%" height={16} />
                ))}
              </View>
            ) : (
              (tmpl.data?.schema.sections ?? []).map((s, i, a) => {
                const checks = s.items.filter((it) => it.type !== "header" && it.type !== "info").length;
                return (
                  <View
                    key={s.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      paddingVertical: 9,
                      borderBottomWidth: i < a.length - 1 ? 1 : 0,
                      borderBottomColor: palette.border,
                    }}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: palette.bgSubtle,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text size={10.5} weight="bold" tone="muted">
                        {i + 1}
                      </Text>
                    </View>
                    <Text size={13.5} weight="semibold" style={{ flex: 1 }}>
                      {s.title}
                    </Text>
                    <Text size={11.5} tone="muted">
                      {checks} check{checks === 1 ? "" : "s"}
                    </Text>
                  </View>
                );
              })
            )}
          </Card>

          <Card style={{ padding: 14, backgroundColor: palette.bgSubtle, borderWidth: 0 }}>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <Icon name="info" size={17} color={palette.muted} />
              <Text size={12.5} tone="muted" style={{ flex: 1, lineHeight: 18 }}>
                Autosaves as you go. You can pause and resume — even offline.
              </Text>
            </View>
          </Card>
        </View>
      </Body>

      <ActionBar>
        <Button
          icon={inProgress ? "arrowRight" : "play"}
          loading={busy}
          disabled={!insp.data || tmpl.isLoading}
          style={{ flex: 1 }}
          onPress={() => void begin()}
        >
          {inProgress ? "Resume inspection" : "Start inspection"}
        </Button>
      </ActionBar>

      {insp.data && (
        <AssigneeSheet
          visible={assignOpen}
          onClose={() => setAssignOpen(false)}
          title="Assign inspection"
          code={insp.data.code}
          currentOwnerId={insp.data.inspectorId}
          onPick={(inspectorId) => assign(inspectorId)}
        />
      )}
    </Screen>
  );
}
