import { useLocalSearchParams } from "expo-router";
import { useSafeBack } from "@/hooks/use-safe-back";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AssigneeSheet } from "@/features/assign/AssigneeSheet";
import { CollabText } from "@/features/collab/CollabText";
import { PresenceBar } from "@/features/realtime/PresenceBar";
import { enqueueAssignEightD, enqueueEightDStep } from "@/features/work/offline";
import { useEightD } from "@/features/work/queries";
import { useLayout } from "@/hooks/use-layout";
import { useCapabilities, useSession } from "@/stores/session";
import { useTheme } from "@/theme";
import { Body, Button, Card, Icon, Mono, Screen, SectionLabel, Skeleton, StatusPill, SyncPill, Text } from "@/ui";
import { engine } from "@/sync";

const D_TITLES = ["Team", "Problem", "Containment", "Root cause", "Corrective action", "Implement", "Prevent", "Close"];

// m-work.jsx EightDFollow — the mobile 8D subset: view D1–D8 and advance the
// current step if you own the investigation. Advance is a durable mutation.
export default function EightDFollow() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const goBack = useSafeBack("/(app)/tasks");
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const { contentMaxWidth } = useLayout();
  const userId = useSession((s) => s.me?.userId);
  const caps = useCapabilities();
  const { data: ed, isLoading, refetch } = useEightD(id ?? "");
  const [busy, setBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Persist the collaboratively-edited working note under the given step (R6.2).
  // The live co-editing is separate (CollabText over the realtime bus); this
  // writes the converged text through the normal offline-first step-save path.
  async function saveNote(step: number): Promise<void> {
    if (!ed) return;
    setSavingNote(true);
    try {
      const status = ed.steps[`d${step}`]?.status ?? "in_progress";
      await enqueueEightDStep(ed, step, status, { note: noteDraft });
      await engine.sync();
      await refetch();
    } finally {
      setSavingNote(false);
    }
  }

  const mine = ed !== undefined && (ed.teamLeadId === userId || ed.championId === userId || ed.memberIds.includes(userId ?? ""));
  const canManage = caps.includes("ncr:manage");

  async function assignLead(teamLeadId: string | null): Promise<void> {
    if (!ed) return;
    await enqueueAssignEightD(ed, teamLeadId);
    await engine.sync();
    await refetch();
  }

  async function completeStep(step: number): Promise<void> {
    if (!ed) return;
    setBusy(true);
    try {
      await enqueueEightDStep(ed, step, "complete");
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
          <Pressable onPress={goBack} hitSlop={8} style={{ padding: 4 }}>
            <Icon name="chevronLeft" size={24} stroke={2} color={palette.text} />
          </Pressable>
          <Mono size={11.5} weight="bold" color={palette.muted}>
            {ed?.code ?? "…"}
          </Mono>
          <View style={{ flex: 1 }} />
          {ed && <PresenceBar type="eightd" id={ed.id} editing={mine} />}
          {ed && canManage && (
            <Pressable onPress={() => setAssignOpen(true)} hitSlop={8} style={{ padding: 4, marginRight: 4 }} accessibilityLabel="Reassign team lead">
              <Icon name="users" size={19} color={palette.muted} />
            </Pressable>
          )}
          {ed ? <StatusPill tone="progress">D{ed.currentStep} of 8</StatusPill> : <SyncPill state="synced" />}
        </View>
        <View style={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 14 }}>
          {ed ? (
            <>
              <Text size={17} weight="bold" style={{ lineHeight: 22 }}>
                {ed.title}
              </Text>
              {ed.ncrId && (
                <Text size={12} tone="muted" style={{ marginTop: 3 }}>
                  Linked to an NCR · {mine ? "you're on the team" : "read-only"}
                </Text>
              )}
            </>
          ) : (
            <Skeleton width="80%" height={22} />
          )}
        </View>
      </View>

      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth, padding: 16 }}>
          {isLoading || !ed ? (
            <Skeleton width="100%" height={200} />
          ) : (
            <>
              <SectionLabel style={{ marginBottom: 10 }}>Discipline progress</SectionLabel>
              {(() => {
                // A step is done if its record says so (the server may not auto-bump
                // currentStep); "current" is the first step that isn't complete.
                const complete = (n: number): boolean =>
                  (ed.steps[`d${n}`]?.status ?? ed.steps[`D${n}`]?.status) === "complete" || n < ed.currentStep;
                const firstIncomplete = [1, 2, 3, 4, 5, 6, 7, 8].find((n) => !complete(n)) ?? 8;
                return D_TITLES.map((t, idx) => {
                  const n = idx + 1;
                  const state = complete(n) ? "done" : n === firstIncomplete ? "current" : "todo";
                  const isLast = n === 8;
                return (
                  <View key={n} style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ alignItems: "center" }}>
                      <View
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 13,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: state === "done" ? palette.success : state === "current" ? palette.accent : palette.bgSubtle,
                          borderWidth: state === "todo" ? 1.5 : 0,
                          borderColor: palette.border,
                        }}
                      >
                        {state === "done" ? (
                          <Icon name="check" size={13} stroke={3} color="#ffffff" />
                        ) : (
                          <Text size={10} weight="bold" color={state === "current" ? palette.accentFg : palette.muted}>
                            D{n}
                          </Text>
                        )}
                      </View>
                      {!isLast && <View style={{ width: 2, flex: 1, minHeight: 20, backgroundColor: state === "done" ? palette.success : palette.border }} />}
                    </View>
                    <View style={{ flex: 1, paddingBottom: 16 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text size={13.5} weight="semibold">
                          D{n} · {t}
                        </Text>
                        {state === "current" && mine && (
                          <StatusPill tone="accent" size="sm">
                            Yours
                          </StatusPill>
                        )}
                      </View>
                      {state === "current" && (
                        <Card style={{ marginTop: 8, padding: 12 }}>
                          <Text size={12.5} tone="muted" style={{ lineHeight: 18, marginBottom: 10 }}>
                            {mine
                              ? `Confirm ${t.toLowerCase()} is done before advancing to D${Math.min(n + 1, 8)}.`
                              : "This step is owned by the 8D team — you can follow its progress here."}
                          </Text>
                          {mine && (
                            <View style={{ gap: 10 }}>
                              <View style={{ gap: 6 }}>
                                <Text size={11.5} weight="semibold" tone="muted">
                                  Shared working note · edits sync live
                                </Text>
                                <CollabText
                                  type="eightd"
                                  id={ed.id}
                                  field="note"
                                  value={String(ed.steps[`d${n}`]?.data?.note ?? "")}
                                  onChange={setNoteDraft}
                                  placeholder="Co-author this step — everyone here sees your edits as you type."
                                />
                                <Button variant="ghost" icon="check" loading={savingNote} onPress={() => void saveNote(n)}>
                                  Save note
                                </Button>
                              </View>
                              <Button icon="check" style={{ flex: 1 }} loading={busy} onPress={() => void completeStep(n)}>
                                {`Complete D${n}`}
                              </Button>
                            </View>
                          )}
                        </Card>
                      )}
                      </View>
                    </View>
                  );
                });
              })()}
            </>
          )}
        </View>
      </Body>

      {ed && (
        <AssigneeSheet
          visible={assignOpen}
          onClose={() => setAssignOpen(false)}
          title="Assign 8D team lead"
          code={ed.code}
          currentOwnerId={ed.teamLeadId}
          onPick={(userId2) => assignLead(userId2)}
        />
      )}
    </Screen>
  );
}
