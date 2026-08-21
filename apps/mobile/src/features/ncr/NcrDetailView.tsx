import { useRouter } from "expo-router";
import { useSafeBack } from "@/hooks/use-safe-back";
import { useState } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { AuditEventDto, NcrDto } from "@kaenal/types";

import { AssigneeSheet } from "@/features/assign/AssigneeSheet";
import { useNcrEvidence } from "@/features/ncr/evidence";
import { enqueueAssignNcr, enqueueTransition } from "@/features/ncr/offline";
import { ncrDue, ncrStatusLabel, ncrStatusTone, severityOf } from "@/features/ncr/parts";
import { useNcr, useNcrActivity } from "@/features/ncr/queries";
import { useLayout } from "@/hooks/use-layout";
import { useCapabilities, useSession } from "@/stores/session";
import { useSync } from "@/stores/sync";
import { engine } from "@/sync";
import { useTheme } from "@/theme";
import { ActionBar, Body, Button, Card, Icon, Mono, Screen, SectionLabel, Sev, Skeleton, StatusPill, SyncPill, Text, type IconName } from "@/ui";

type NcrMove = "assigned" | "in_progress" | "resolved" | "escalated";

/** The next lifecycle move offered on the detail screen for a given status. */
function nextAction(status: NcrDto["status"], userId: string | undefined): { label: string; to: NcrMove; ownerId?: string } | null {
  if (status === "open") return { label: "Assign to me", to: "assigned", ownerId: userId };
  if (status === "assigned" || status === "reopened") return { label: "Start work", to: "in_progress" };
  if (status === "in_progress") return { label: "Mark resolved", to: "resolved" };
  return null;
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).toLowerCase();
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay ? `Today, ${time}` : `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}

function activityRow(e: AuditEventDto, palette: ReturnType<typeof useTheme>["palette"]): { icon: IconName; tint: string; label: string } {
  const who = e.actorName ? ` by ${e.actorName}` : "";
  switch (e.action) {
    case "created":
      return { icon: "flag", tint: palette.dangerFg, label: `Raised${who}` };
    case "assigned":
      return { icon: "user", tint: palette.info, label: `Assigned${who}` };
    case "status_changed":
      return { icon: "shield", tint: palette.info, label: e.reason?.trim() ? e.reason : `Status changed${who}` };
    case "commented":
      return { icon: "chat", tint: palette.muted, label: `Comment${who}` };
    case "file_attached":
      return { icon: "camera", tint: palette.muted, label: `Evidence added${who}` };
    case "signed":
      return { icon: "shieldCheck", tint: palette.success, label: `Signed off${who}` };
    case "linked":
      return { icon: "brain", tint: palette.info, label: `Escalated to 8D${who}` };
    default:
      return { icon: "activity", tint: palette.muted, label: `${e.action.replace(/_/g, " ")}${who}` };
  }
}

// m-ncr.jsx NcrDetail — the shared detail body, used both by the `/ncr/[id]`
// route (phone) and the tablet two-pane detail column (`embedded`, no back). All
// the read data, lifecycle transitions, assign, comments/verify links live here.
export function NcrDetailView({ id, embedded = false }: { id: string; embedded?: boolean }) {
  const router = useRouter();
  const goBack = useSafeBack("/(app)/ncr");
  const insets = useSafeAreaInsets();
  const { palette, radius } = useTheme();
  const { contentMaxWidth } = useLayout();
  const caps = useCapabilities();
  const me = useSession((s) => s.me);
  const syncState = useSync((s) => s.state);
  const { data: ncr, isLoading, refetch } = useNcr(id);
  const { data: evidence } = useNcrEvidence(id);
  const { data: activity } = useNcrActivity(id);
  const [busy, setBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  async function assign(ownerId: string | null): Promise<void> {
    if (!ncr) return;
    await enqueueAssignNcr(ncr, ownerId);
    await engine.sync();
    await refetch();
  }

  const canManage = caps.includes("ncr:manage");
  const canVerify = caps.includes("ncr:verify");
  const due = ncr ? ncrDue(ncr.dueAt) : null;
  const action = ncr ? nextAction(ncr.status, me?.userId) : null;
  const canEscalate = ncr !== undefined && ncr.eightDId === null && ncr.status !== "closed" && ncr.status !== "verified";

  const locationParts = ncr ? [ncr.plantName, ncr.areaName].filter((x): x is string => !!x) : [];
  const severityValue = ncr
    ? ncr.priority.charAt(0).toUpperCase() + ncr.priority.slice(1) + (ncr.unitsAffected != null ? ` · ${ncr.unitsAffected} units` : "")
    : "";

  async function transition(to: NcrMove, ownerId?: string): Promise<void> {
    if (!ncr) return;
    setBusy(true);
    try {
      await enqueueTransition(ncr, to, ownerId ? { ownerId } : undefined);
      await engine.sync();
      await refetch();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ paddingTop: (embedded ? 8 : insets.top + 6), backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 }}>
          {!embedded && (
            <Pressable onPress={goBack} hitSlop={8} style={{ padding: 4 }}>
              <Icon name="chevronLeft" size={24} stroke={2} color={palette.text} />
            </Pressable>
          )}
          <Mono size={11.5} weight="bold" color={palette.muted} style={embedded ? { paddingLeft: 4 } : undefined}>
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
              <Text size={18} weight="bold" style={{ lineHeight: 23, marginBottom: 6 }}>
                {ncr.title}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {locationParts.length > 0 && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Icon name="mapPin" size={12} color={palette.muted} />
                    <Text size={12} tone="muted">
                      {locationParts.join(" · ")}
                    </Text>
                  </View>
                )}
                {locationParts.length > 0 && (
                  <Text size={12} tone="muted">
                    ·
                  </Text>
                )}
                <Text size={12} tone="muted">
                  {fmtWhen(ncr.createdAt)}
                </Text>
              </View>
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
              {evidence && evidence.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, gap: 8 }}>
                  {evidence.map((f) => (
                    <View key={f.id} style={{ width: 108, height: 108, borderRadius: 11, overflow: "hidden", backgroundColor: palette.bgSubtle, alignItems: "center", justifyContent: "center" }}>
                      {f.url ? (
                        <Image source={{ uri: f.url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                      ) : (
                        <Icon name={f.isImage ? "camera" : "doc"} size={22} color={palette.subtle} />
                      )}
                    </View>
                  ))}
                </ScrollView>
              )}

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
                <DetailRow label="Reporter" value={ncr.reporterName ?? "—"} />
                <DetailRow label="Owner" value={ncr.ownerName ?? (ncr.ownerId ? "Assigned" : "Unassigned")} onPress={canManage ? () => setAssignOpen(true) : undefined} />
                {ncr.category && <DetailRow label="Category" value={ncr.category} />}
                <DetailRow label="Severity" value={severityValue} />
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

              {activity && activity.length > 0 && (
                <>
                  <SectionLabel style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 }}>Activity</SectionLabel>
                  <Card style={{ marginHorizontal: 16 }}>
                    {activity.slice(0, 12).map((e, i, a) => {
                      const row = activityRow(e, palette);
                      return (
                        <View key={e.id} style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: i < a.length - 1 ? 1 : 0, borderBottomColor: palette.border }}>
                          <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: palette.bgSubtle, alignItems: "center", justifyContent: "center" }}>
                            <Icon name={row.icon} size={14} color={row.tint} />
                          </View>
                          <Text size={12.5} weight="medium" style={{ flex: 1 }}>
                            {row.label}
                          </Text>
                          <Mono size={11} color={palette.subtle}>
                            {new Date(e.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                          </Mono>
                        </View>
                      );
                    })}
                  </Card>
                </>
              )}
              <View style={{ height: 16 }} />
            </>
          )}
        </View>
      </Body>

      {ncr && (
        <ActionBar>
          <Button variant="ghost" icon="chat" style={{ flex: 1 }} onPress={() => router.push(`/ncr/${id}/comments`)}>
            Comment
          </Button>
          {ncr.status === "resolved" && canVerify ? (
            <Button icon="shieldCheck" style={{ flex: 1 }} onPress={() => router.push(`/ncr/${id}/verify`)}>
              Verify
            </Button>
          ) : action && canManage ? (
            <Button icon="arrowRight" style={{ flex: 1 }} loading={busy} onPress={() => void transition(action.to, action.ownerId)}>
              {action.label}
            </Button>
          ) : null}
        </ActionBar>
      )}

      {ncr && (
        <AssigneeSheet visible={assignOpen} onClose={() => setAssignOpen(false)} title="Assign NCR" code={ncr.code} currentOwnerId={ncr.ownerId} onPick={(userId) => assign(userId)} />
      )}
    </Screen>
  );
}

function DetailRow({ label, value, last, onPress }: { label: string; value: string; last?: boolean; onPress?: () => void }) {
  const { palette } = useTheme();
  const body = (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: palette.border }}>
      <Text size={13} tone="muted">
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1, marginLeft: 12 }}>
        <Text size={13} weight="semibold" style={{ flexShrink: 1, textAlign: "right" }}>
          {value}
        </Text>
        {onPress && <Icon name="chevronRight" size={14} color={palette.subtle} />}
      </View>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}
