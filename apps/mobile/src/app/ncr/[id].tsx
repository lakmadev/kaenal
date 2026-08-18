import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { NcrDto } from "@kaenal/types";

import { enqueueTransition } from "@/features/ncr/offline";
import { ncrDue, ncrStatusLabel, ncrStatusTone, severityOf } from "@/features/ncr/parts";
import { useNcr } from "@/features/ncr/queries";
import { engine } from "@/sync";
import { useLayout } from "@/hooks/use-layout";
import { useCapabilities, useSession } from "@/stores/session";
import { useSync } from "@/stores/sync";
import { useTheme } from "@/theme";
import { ActionBar, Body, Button, Card, Icon, Mono, Screen, SectionLabel, Sev, Skeleton, StatusPill, SyncPill, Text } from "@/ui";

type NcrMove = "assigned" | "in_progress" | "resolved" | "escalated";

/** The next lifecycle move offered on the detail screen for a given status.
 *  `open` must be assigned (to an owner) before work starts, so from `open` we
 *  assign to the current user; `assigned`/`reopened` then start; work resolves. */
function nextAction(status: NcrDto["status"], userId: string | undefined): { label: string; to: NcrMove; ownerId?: string } | null {
  if (status === "open") return { label: "Assign to me", to: "assigned", ownerId: userId };
  if (status === "assigned" || status === "reopened") return { label: "Start work", to: "in_progress" };
  if (status === "in_progress") return { label: "Mark resolved", to: "resolved" };
  return null;
}

// m-ncr.jsx NcrDetail — read-mostly, with the escalate-to-8D banner and a single
// status-appropriate action. Transitions are durable (offline-safe).
export default function NcrDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette, radius } = useTheme();
  const { contentMaxWidth } = useLayout();
  const caps = useCapabilities();
  const me = useSession((s) => s.me);
  const syncState = useSync((s) => s.state);
  const { data: ncr, isLoading, refetch } = useNcr(id ?? "");
  const [busy, setBusy] = useState(false);

  const canManage = caps.includes("ncr:manage");
  const canVerify = caps.includes("ncr:verify");
  const due = ncr ? ncrDue(ncr.dueAt) : null;
  const action = ncr ? nextAction(ncr.status, me?.userId) : null;
  const canEscalate = ncr !== undefined && ncr.eightDId === null && ncr.status !== "closed" && ncr.status !== "verified";

  async function transition(to: NcrMove, ownerId?: string): Promise<void> {
    if (!ncr) return;
    setBusy(true);
    try {
      await enqueueTransition(ncr, to, ownerId ? { ownerId } : undefined);
      // Let the queued mutation push (offline: this is a no-op and the pill shows
      // "pending"), then refetch the server truth so the UI reflects the new state.
      await engine.sync();
      await refetch();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 6, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 }}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
            <Icon name="chevronLeft" size={24} stroke={2} color={palette.text} />
          </Pressable>
          <Mono size={11.5} weight="bold" color={palette.muted}>
            {ncr?.code ?? "…"}
          </Mono>
          <View style={{ flex: 1 }} />
          <SyncPill state={syncState} />
        </View>
        <View style={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 14 }}>
          {ncr ? (
            <>
              <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
                <Sev level={severityOf(ncr.priority)} />
                <StatusPill tone={ncrStatusTone(ncr.status)}>{ncrStatusLabel(ncr.status)}</StatusPill>
              </View>
              <Text size={18} weight="bold" style={{ lineHeight: 23 }}>
                {ncr.title}
              </Text>
            </>
          ) : (
            <Skeleton width="80%" height={22} />
          )}
        </View>
      </View>

      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth }}>
          {isLoading || !ncr ? (
            <View style={{ padding: 16, gap: 12 }}>
              <Skeleton width="100%" height={60} />
              <Skeleton width="100%" height={120} />
            </View>
          ) : (
            <>
              {ncr.description && (
                <>
                  <SectionLabel style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>Description</SectionLabel>
                  <Text size={13.5} style={{ paddingHorizontal: 16, lineHeight: 21 }}>
                    {ncr.description}
                  </Text>
                </>
              )}

              <SectionLabel style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>Details</SectionLabel>
              <Card style={{ marginHorizontal: 16 }}>
                <DetailRow label="Severity" value={ncr.priority} />
                <DetailRow label="Status" value={ncrStatusLabel(ncr.status)} />
                <DetailRow label="Owner" value={ncr.ownerId ? "Assigned" : "Unassigned"} />
                <DetailRow label="SLA" value={ncr.slaState.replace(/_/g, " ")} />
                <DetailRow label="Due" value={due ? due.text : "No due date"} last />
              </Card>

              {ncr.eightDId ? (
                <Card style={{ margin: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: palette.infoBg, borderColor: palette.border }}>
                  <View style={{ width: 38, height: 38, borderRadius: radius.md, backgroundColor: palette.surface, alignItems: "center", justifyContent: "center" }}>
                    <Icon name="brain" size={19} color={palette.info} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text size={13.5} weight="bold">
                      8D investigation open
                    </Text>
                    <Text size={11.5} tone="muted">
                      This NCR was escalated — track it in the web app
                    </Text>
                  </View>
                </Card>
              ) : (
                canEscalate &&
                canManage && (
                  <Pressable onPress={() => void transition("escalated")} disabled={busy}>
                    <Card style={{ margin: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: palette.infoBg, borderColor: palette.border }}>
                      <View style={{ width: 38, height: 38, borderRadius: radius.md, backgroundColor: palette.surface, alignItems: "center", justifyContent: "center" }}>
                        <Icon name="brain" size={19} color={palette.info} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text size={13.5} weight="bold">
                          Escalate to 8D investigation
                        </Text>
                        <Text size={11.5} tone="muted">
                          For recurring or critical non-conformities
                        </Text>
                      </View>
                      <Icon name="chevronRight" size={16} color={palette.info} />
                    </Card>
                  </Pressable>
                )
              )}
              <View style={{ height: 16 }} />
            </>
          )}
        </View>
      </Body>

      {ncr && (canManage || canVerify) && (
        <ActionBar>
          {ncr.status === "resolved" && canVerify ? (
            <Button icon="shieldCheck" style={{ flex: 1 }} onPress={() => router.push(`/ncr/${id}/verify`)}>
              Verify
            </Button>
          ) : action && canManage ? (
            <Button icon="arrowRight" style={{ flex: 1 }} loading={busy} onPress={() => void transition(action.to, action.ownerId)}>
              {action.label}
            </Button>
          ) : (
            <Button
              variant="ghost"
              icon="chat"
              style={{ flex: 1 }}
              onPress={() =>
                Platform.OS === "web"
                  ? window.alert("Comments arrive with the activity feed in a later phase.")
                  : undefined
              }
            >
              Comment
            </Button>
          )}
        </ActionBar>
      )}
    </Screen>
  );
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { palette } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: palette.border }}>
      <Text size={13} tone="muted">
        {label}
      </Text>
      <Text size={13} weight="semibold" style={{ textTransform: "capitalize" }}>
        {value}
      </Text>
    </View>
  );
}
