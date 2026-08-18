import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { FormResponses } from "@kaenal/types";

import { loadDraft, saveDraft } from "@/features/inspections/drafts";
import { ProgressBar, QuestionCard } from "@/features/inspections/parts";
import { useInspection, useTemplate } from "@/features/inspections/queries";
import { answerableItems, isVisible, progress } from "@/features/inspections/scoring";
import { useLayout } from "@/hooks/use-layout";
import { useSync } from "@/stores/sync";
import { useTheme } from "@/theme";
import { ActionBar, Body, Button, Icon, Mono, Screen, SectionLabel, Skeleton, SyncPill, Text } from "@/ui";

// m-inspections.jsx InspRunner — section-by-section, autosaved locally, resumable.
export default function InspectionRunner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const { contentMaxWidth } = useLayout();
  const syncState = useSync((s) => s.state);

  const insp = useInspection(id ?? "");
  const tmpl = useTemplate(insp.data?.templateId);

  const [responses, setResponses] = useState<FormResponses>({});
  const [sectionIndex, setSectionIndex] = useState(0);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const loadedFor = useRef<string | null>(null);

  // Seed responses once: server truth (a resumed in_progress inspection) overlaid
  // with the local draft (the inspector's newer, possibly-offline edits win).
  useEffect(() => {
    if (!insp.data || loadedFor.current === insp.data.id) return;
    loadedFor.current = insp.data.id;
    const base = insp.data.responses ?? {};
    void loadDraft(insp.data.id).then((draft) => {
      setResponses({ ...base, ...(draft?.responses ?? {}) });
    });
  }, [insp.data]);

  const answer = useCallback(
    (itemId: string, value: unknown) => {
      setResponses((prev) => {
        const next = { ...prev, [itemId]: value };
        if (id) void saveDraft(id, next).then(() => setSavedAt(Date.now()));
        return next;
      });
    },
    [id],
  );

  if (insp.isLoading || tmpl.isLoading || !tmpl.data) {
    return (
      <Screen>
        <View style={{ paddingTop: insets.top + 40, paddingHorizontal: 16, gap: 12 }}>
          <Skeleton width="60%" height={20} />
          <Skeleton width="100%" height={60} />
          <Skeleton width="100%" height={120} />
          <Skeleton width="100%" height={120} />
        </View>
      </Screen>
    );
  }

  const sections = tmpl.data.schema.sections;
  const section = sections[sectionIndex];
  const { answered, total } = progress(tmpl.data.schema, responses);
  const isLast = sectionIndex >= sections.length - 1;
  const recentlySaved = savedAt !== null && Date.now() - savedAt < 4000;

  function next(): void {
    if (isLast) {
      router.push(`/inspection/${id}/review`);
      return;
    }
    setSectionIndex((i) => Math.min(i + 1, sections.length - 1));
  }

  const visibleItems = section ? section.items.filter((it) => isVisible(it, responses)) : [];
  // 1-based number within the answerable items of this section, for the badge.
  const answerable = section ? answerableItems({ sections: [section] }, responses) : [];

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 6, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 }}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
            <Icon name="chevronLeft" size={24} stroke={2} color={palette.text} />
          </Pressable>
          <Mono size={11} weight="bold" color={palette.muted}>
            {insp.data?.code} · {(section?.title ?? "").toUpperCase()}
          </Mono>
          <View style={{ flex: 1 }} />
          <SyncPill state={syncState} />
        </View>
        <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 }}>
          <Text size={17} weight="bold" style={{ marginBottom: 10 }}>
            {insp.data?.title}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <ProgressBar ratio={total === 0 ? 0 : answered / total} />
            <Mono size={12} weight="semibold" color={palette.muted}>
              {answered}/{total}
            </Mono>
          </View>
        </View>
      </View>

      <Body>
        <View style={{ alignItems: "center" }}>
          <View style={{ width: "100%", maxWidth: contentMaxWidth }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                paddingTop: 14,
                paddingBottom: 6,
              }}
            >
              <SectionLabel>
                Section {sectionIndex + 1} of {sections.length} · {section?.title}
              </SectionLabel>
              {recentlySaved && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Icon name="check" size={12} stroke={3} color={palette.successFg} />
                  <Text size={11} weight="semibold" color={palette.successFg}>
                    Autosaved
                  </Text>
                </View>
              )}
            </View>

            {visibleItems.map((item) => {
              const badgeIndex = answerable.findIndex((a) => a.id === item.id) + 1;
              return (
                <QuestionCard
                  key={item.id}
                  item={item}
                  index={badgeIndex}
                  value={responses[item.id]}
                  onChange={(v) => answer(item.id, v)}
                />
              );
            })}
            <View style={{ height: 8 }} />
          </View>
        </View>
      </Body>

      <ActionBar>
        <Button
          variant="danger"
          icon="flag"
          style={{ flex: 1 }}
          onPress={() =>
            Platform.OS === "web"
              ? window.alert("Raising an NCR from a failed check arrives in M8 (NCR).")
              : Alert.alert("Flag NCR", "Raising an NCR from a failed check arrives in M8 (NCR).")
          }
        >
          Flag NCR
        </Button>
        <Button icon="arrowRight" style={{ flex: 2 }} onPress={next}>
          {isLast ? "Review" : "Save & next"}
        </Button>
      </ActionBar>
    </Screen>
  );
}
