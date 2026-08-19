import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { enqueueReview } from "@/features/oversight/offline";
import { useDocument } from "@/features/oversight/queries";
import { useLayout } from "@/hooks/use-layout";
import { engine } from "@/sync";
import { useTheme } from "@/theme";
import { ActionBar, Body, Button, Card, Icon, Mono, Screen, SectionLabel, Skeleton, StatusPill, Text } from "@/ui";

// m-oversight.jsx ApprovalItem — review a document with a mandatory reason note
// (recorded on the audit trail), then approve or reject. Durable / offline-safe.
// Shared by the `/approval/[id]` route (phone) and the tablet two-pane detail
// column (`embedded`, no back chevron); `onDone` fires after a decision so the
// tablet list can refetch instead of navigating away.
export function ApprovalDetailView({ id, embedded = false, onDone }: { id: string; embedded?: boolean; onDone?: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette, radius, fonts } = useTheme();
  const { contentMaxWidth } = useLayout();
  const { data: doc, isLoading } = useDocument(id);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  async function decide(decision: "approve" | "reject"): Promise<void> {
    if (!doc || reason.trim().length === 0) return;
    setBusy(decision);
    try {
      await enqueueReview(doc, decision, reason.trim());
      await engine.sync();
      setReason("");
      if (onDone) onDone();
      else router.replace("/(app)/approvals");
    } finally {
      setBusy(null);
    }
  }

  const canDecide = reason.trim().length > 0 && busy === null && doc !== undefined;

  return (
    <Screen>
      <View style={{ paddingTop: embedded ? 8 : insets.top + 6, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 }}>
          {!embedded && (
            <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
              <Icon name="chevronLeft" size={24} stroke={2} color={palette.text} />
            </Pressable>
          )}
          <Mono size={11.5} weight="bold" color={palette.muted} style={embedded ? { paddingLeft: 4 } : undefined}>
            {doc?.code ?? "…"}
          </Mono>
          <View style={{ flex: 1 }} />
          <StatusPill tone="warn">Awaiting you</StatusPill>
        </View>
        <View style={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 14 }}>
          <Text size={12} weight="semibold" tone="muted">
            Document approval
          </Text>
          {doc ? (
            <Text size={18} weight="bold" style={{ lineHeight: 23, marginTop: 2 }}>
              {doc.title}
            </Text>
          ) : (
            <Skeleton width="80%" height={22} style={{ marginTop: 4 }} />
          )}
        </View>
      </View>

      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth, padding: 16, gap: 14 }}>
          {isLoading || !doc ? (
            <Skeleton width="100%" height={120} />
          ) : (
            <>
              <Card style={{ padding: 14 }}>
                <SectionLabel style={{ marginBottom: 8 }}>Request summary</SectionLabel>
                <SummaryRow label="Category" value={doc.category.replace(/_/g, " ")} />
                <SummaryRow label="Version" value={doc.version} />
                <SummaryRow label="Owner" value={doc.ownerId ? "Assigned" : "—"} last />
              </Card>

              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 }}>
                  <SectionLabel>Reason / decision note</SectionLabel>
                  <Text size={11} weight="bold" color={palette.dangerFg}>
                    *
                  </Text>
                </View>
                <Card style={{ padding: 12 }}>
                  <TextInput
                    value={reason}
                    onChangeText={setReason}
                    placeholder="Why are you approving or rejecting? This is recorded on the audit trail."
                    placeholderTextColor={palette.subtle}
                    multiline
                    style={{ minHeight: 76, fontSize: 13, lineHeight: 19, color: palette.text, fontFamily: fonts.sans, textAlignVertical: "top" }}
                  />
                </Card>
                <Text size={11} tone="muted" style={{ marginTop: 6 }}>
                  A reason is recorded on the audit trail for every approve / reject.
                </Text>
              </View>
            </>
          )}
          <View style={{ height: radius.sm }} />
        </View>
      </Body>

      <ActionBar>
        <Button variant="ghost" style={{ flex: 1 }} loading={busy === "reject"} disabled={!canDecide} onPress={() => void decide("reject")}>
          Reject
        </Button>
        <Button icon="check" style={{ flex: 2 }} loading={busy === "approve"} disabled={!canDecide} onPress={() => void decide("approve")}>
          Approve
        </Button>
      </ActionBar>
    </Screen>
  );
}

function SummaryRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { palette } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 9, borderBottomWidth: last ? 0 : 1, borderBottomColor: palette.border }}>
      <Text size={13} tone="muted">
        {label}
      </Text>
      <Text size={13} weight="semibold" style={{ textTransform: "capitalize", flexShrink: 1, textAlign: "right" }}>
        {value}
      </Text>
    </View>
  );
}
