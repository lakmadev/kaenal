import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeBack } from "@/hooks/use-safe-back";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { FormResponses } from "@kaenal/types";

import { clearDraft, loadDraft } from "@/features/inspections/drafts";
import { enqueueComplete } from "@/features/inspections/offline";
import { useInspection, useTemplate } from "@/features/inspections/queries";
import { requiredComplete, tally } from "@/features/inspections/scoring";
import { useLayout } from "@/hooks/use-layout";
import { useSession } from "@/stores/session";
import { useSync } from "@/stores/sync";
import { useTheme } from "@/theme";
import { ActionBar, Avatar, Body, Button, Card, Icon, Screen, SectionLabel, Skeleton, SyncPill, Text } from "@/ui";

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : "")).toUpperCase() || "?";
}

// m-inspections.jsx InspReview — tally + sign-off, then complete (durable/offline).
export default function InspectionReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goBack = useSafeBack("/(app)/tasks");
  const insets = useSafeAreaInsets();
  const { palette, radius } = useTheme();
  const { contentMaxWidth } = useLayout();
  const me = useSession((s) => s.me);
  const syncState = useSync((s) => s.state);

  const insp = useInspection(id ?? "");
  const tmpl = useTemplate(insp.data?.templateId);
  const [responses, setResponses] = useState<FormResponses>({});
  const [busy, setBusy] = useState(false);
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!insp.data || loadedFor.current === insp.data.id) return;
    loadedFor.current = insp.data.id;
    const base = insp.data.responses ?? {};
    void loadDraft(insp.data.id).then((d) => setResponses({ ...base, ...(d?.responses ?? {}) }));
  }, [insp.data]);

  const ready = insp.data && tmpl.data;
  const counts = ready ? tally(tmpl.data!.schema, responses) : { pass: 0, fail: 0, na: 0 };
  const canComplete = ready ? requiredComplete(tmpl.data!.schema, responses) : false;

  async function complete(): Promise<void> {
    if (!insp.data) return;
    setBusy(true);
    try {
      await enqueueComplete(insp.data, responses);
      await clearDraft(insp.data.id);
      router.replace(`/inspection/${id}/done`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 6, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingBottom: 6 }}>
          <Pressable onPress={goBack} hitSlop={8} style={{ padding: 4 }}>
            <Icon name="chevronLeft" size={24} stroke={2} color={palette.text} />
          </Pressable>
          <Text size={15} weight="bold" style={{ flex: 1 }}>
            Review & submit
          </Text>
          <SyncPill state={syncState} />
        </View>
      </View>

      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth, padding: 16, gap: 14 }}>
          {!ready ? (
            <Skeleton width="100%" height={80} />
          ) : (
            <>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TallyCard value={counts.pass} label="Pass" color={palette.successFg} />
                <TallyCard value={counts.fail} label="Fail" color={palette.dangerFg} />
                <TallyCard value={counts.na} label="N/A" color={palette.muted} />
              </View>

              {counts.fail > 0 && (
                <Card style={{ padding: 14, borderColor: palette.warn, borderWidth: 1.5 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Icon name="flag" size={15} color={palette.warnFg} />
                    <Text size={13} weight="bold">
                      {counts.fail} failed check{counts.fail === 1 ? "" : "s"}
                    </Text>
                  </View>
                  <Text size={12.5} tone="muted" style={{ lineHeight: 18 }}>
                    On submit, the server scores this inspection. Raising a linked NCR from a failed check arrives in M8.
                  </Text>
                </Card>
              )}

              <View>
                <SectionLabel style={{ marginBottom: 8 }}>Sign-off</SectionLabel>
                <Card style={{ padding: 14 }}>
                  <View
                    style={{
                      height: 72,
                      borderRadius: radius.md,
                      backgroundColor: palette.bgSubtle,
                      borderWidth: 1,
                      borderStyle: "dashed",
                      borderColor: palette.border,
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "row",
                      gap: 6,
                    }}
                  >
                    <Icon name="pen" size={16} color={palette.subtle} />
                    <Text size={12.5} weight="semibold" tone="subtle">
                      On-device signature pad — capture on your phone
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
                    <Avatar initials={me ? initials(me.name) : "?"} size={28} />
                    <Text size={12.5}>
                      <Text size={12.5} weight="bold">
                        {me?.name}
                      </Text>{" "}
                      · Inspector
                    </Text>
                  </View>
                </Card>
              </View>

              {!canComplete && (
                <Text size={12.5} tone="muted" style={{ textAlign: "center" }}>
                  Answer all required checks before completing.
                </Text>
              )}
            </>
          )}
        </View>
      </Body>

      <ActionBar>
        <Button icon="check" loading={busy} disabled={!ready || !canComplete} style={{ flex: 1 }} onPress={() => void complete()}>
          Complete inspection
        </Button>
      </ActionBar>
    </Screen>
  );
}

function TallyCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <Card style={{ flex: 1, padding: 14, alignItems: "center" }}>
      <Text size={26} weight="bold" color={color}>
        {value}
      </Text>
      <Text size={11} weight="semibold" tone="muted">
        {label}
      </Text>
    </Card>
  );
}
