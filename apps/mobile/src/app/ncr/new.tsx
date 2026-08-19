import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { NcrPriority } from "@kaenal/types";

import { PhotoField } from "@/features/capture/PhotoField";
import { enqueueCreateNcr } from "@/features/ncr/offline";
import { useLayout } from "@/hooks/use-layout";
import { apiClient } from "@/lib/api";
import { services } from "@/services";
import { ensurePermission } from "@/services/permissions";
import { useTheme } from "@/theme";
import { ActionBar, Body, Button, Card, Icon, Screen, SectionLabel, StatusPill, Text } from "@/ui";

const CONTAINMENTS = ["Cell stopped & quarantined", "Customer Quality notified", "WIP re-inspection started"];

// m-ncr.jsx guided create (NcrCreateStep1/2/3) — a 3-step stepper. Durable create
// through the offline engine, so raising an NCR works offline ("saved on device").
export default function NcrNew() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette, radius, fonts } = useTheme();
  const { contentMaxWidth } = useLayout();
  const params = useLocalSearchParams<{ title?: string; inspectionId?: string }>();

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(params.title ?? "");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<NcrPriority>("major");
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [containment, setContainment] = useState<Set<string>>(new Set());
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [structured, setStructured] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      // Auto-stamp: request quietly, never block the form on location (05 §3).
      if ((await ensurePermission("location", "Location stamping", { promptSettings: false })) !== "granted") return;
      const c = await services.location?.current();
      if (c) setCoords({ latitude: c.latitude, longitude: c.longitude });
    })();
  }, []);

  async function structure(): Promise<void> {
    if (description.trim().length === 0) return;
    setAiBusy(true);
    try {
      const res = await apiClient.requestAiDraft({ body: { feature: "quicklog_structuring", input: description.trim() } });
      if (res.status === 200) setStructured(res.body.value);
    } catch {
      /* gateway unavailable — the raw description still submits */
    } finally {
      setAiBusy(false);
    }
  }

  async function submit(): Promise<void> {
    setBusy(true);
    try {
      const parts = [
        description.trim(),
        structured ? `\n\nAI structured:\n${structured}` : "",
        containment.size > 0 ? `\n\nContainment:\n- ${[...containment].join("\n- ")}` : "",
        coords ? `\n\nGPS: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : "",
        params.inspectionId ? `\n\nRaised from inspection ${params.inspectionId}` : "",
      ];
      await enqueueCreateNcr({
        title: title.trim().slice(0, 120),
        description: parts.join("") || null,
        priority: severity,
        source: params.inspectionId ? "inspection" : "manual",
        ...(params.inspectionId ? { sourceId: params.inspectionId } : {}),
      });
      router.replace("/(app)/ncr");
    } finally {
      setBusy(false);
    }
  }

  const stepTitle = step === 0 ? "What & where" : step === 1 ? "Details" : "Review & submit";
  const canNext = step === 0 ? title.trim().length > 0 : true;

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 8, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingBottom: 8 }}>
          <Pressable onPress={() => (step === 0 ? router.back() : setStep((s) => s - 1))} hitSlop={8} style={{ padding: 4 }}>
            <Icon name={step === 0 ? "x" : "chevronLeft"} size={22} color={palette.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text size={15} weight="bold">
              Flag non-conformity
            </Text>
            <Text size={11} tone="muted">
              Step {step + 1} of 3 · {stepTitle}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 4, paddingHorizontal: 16, paddingBottom: 10 }}>
          {[0, 1, 2].map((n) => (
            <View key={n} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: n <= step ? palette.accent : palette.border }} />
          ))}
        </View>
      </View>

      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth, padding: 16, gap: 14 }}>
          {step === 0 && (
            <>
              <View>
                <SectionLabel style={{ marginBottom: 7 }}>Title</SectionLabel>
                <Card style={{ padding: 12 }}>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g. Weld porosity — Cell 3 Station 3B"
                    placeholderTextColor={palette.subtle}
                    style={{ fontSize: 14, color: palette.text, fontFamily: fonts.sans }}
                  />
                </Card>
              </View>
              <Card style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon name="mapPin" size={15} color={palette.accent} />
                <Text size={13} weight="semibold" style={{ flex: 1 }}>
                  {coords ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}` : "Location"}
                </Text>
                <StatusPill tone={coords ? "done" : "neutral"} size="sm">
                  {coords ? "GPS" : "Off"}
                </StatusPill>
              </Card>
              <Text size={11.5} tone="muted">
                Location is auto-detected from GPS. Add the part/asset in the description on the next step.
              </Text>
            </>
          )}

          {step === 1 && (
            <>
              <View>
                <SectionLabel style={{ marginBottom: 7 }}>What happened?</SectionLabel>
                <Card style={{ padding: 12 }}>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Describe the non-conformity: what, where, how many affected."
                    placeholderTextColor={palette.subtle}
                    multiline
                    style={{ minHeight: 80, fontSize: 14, lineHeight: 20, color: palette.text, fontFamily: fonts.sans, textAlignVertical: "top" }}
                  />
                  <Pressable onPress={() => void structure()} disabled={aiBusy || description.trim().length === 0} style={{ marginTop: 8, alignSelf: "flex-start" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 5, paddingHorizontal: 9, borderRadius: radius.full, backgroundColor: palette.accentSoft, opacity: description.trim().length === 0 ? 0.5 : 1 }}>
                      <Icon name="sparkles" size={12} color={palette.accent} />
                      <Text size={11} weight="bold" color={palette.accent}>
                        {aiBusy ? "Structuring…" : "Structure with AI"}
                      </Text>
                    </View>
                  </Pressable>
                  {structured && (
                    <Text size={12.5} tone="muted" style={{ marginTop: 8, lineHeight: 18 }}>
                      {structured}
                    </Text>
                  )}
                </Card>
              </View>

              <View>
                <SectionLabel style={{ marginBottom: 7 }}>Severity</SectionLabel>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {(["minor", "major", "critical"] as NcrPriority[]).map((s) => {
                    const on = severity === s;
                    const crit = s === "critical";
                    return (
                      <Pressable key={s} onPress={() => setSeverity(s)} style={{ flex: 1 }}>
                        <View style={{ height: 40, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", backgroundColor: on ? (crit ? palette.danger : palette.accent) : palette.surface, borderWidth: 1.5, borderColor: on ? (crit ? palette.danger : palette.accent) : palette.border }}>
                          <Text size={13} weight="semibold" color={on ? (crit ? "#ffffff" : palette.accentFg) : palette.muted} style={{ textTransform: "capitalize" }}>
                            {s}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View>
                <SectionLabel style={{ marginBottom: 7 }}>Evidence</SectionLabel>
                <PhotoField value={photoIds} onChange={setPhotoIds} />
              </View>

              <View>
                <SectionLabel style={{ marginBottom: 7 }}>Immediate containment</SectionLabel>
                <View style={{ gap: 6 }}>
                  {CONTAINMENTS.map((c) => {
                    const on = containment.has(c);
                    return (
                      <Pressable
                        key={c}
                        onPress={() =>
                          setContainment((prev) => {
                            const next = new Set(prev);
                            if (next.has(c)) next.delete(c);
                            else next.add(c);
                            return next;
                          })
                        }
                      >
                        <Card style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12 }}>
                          <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: on ? palette.accent : palette.border, backgroundColor: on ? palette.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
                            {on && <Icon name="check" size={12} stroke={3} color={palette.accentFg} />}
                          </View>
                          <Text size={12.5} style={{ flex: 1 }}>
                            {c}
                          </Text>
                        </Card>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <Card style={{ padding: 14 }}>
                <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
                  <StatusPill tone={severity === "critical" ? "danger" : "warn"} size="sm">
                    {severity}
                  </StatusPill>
                  <StatusPill tone="neutral" size="sm">
                    {params.inspectionId ? "From inspection" : "Manual"}
                  </StatusPill>
                </View>
                <Text size={15} weight="bold" style={{ lineHeight: 20 }}>
                  {title || "Untitled non-conformity"}
                </Text>
                {description.trim().length > 0 && (
                  <Text size={12.5} tone="muted" style={{ marginTop: 6, lineHeight: 18 }}>
                    {description.trim()}
                  </Text>
                )}
              </Card>
              <ReviewRow label="Evidence" value={`${photoIds.length} photo${photoIds.length === 1 ? "" : "s"}`} />
              <ReviewRow label="Containment" value={containment.size > 0 ? `${containment.size} action${containment.size === 1 ? "" : "s"} logged` : "None"} />
              <ReviewRow label="Location" value={coords ? "GPS stamped" : "Not available"} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 2 }}>
                <Icon name="cloudOff" size={14} color={palette.warnFg} />
                <Text size={12} tone="muted">
                  Saved on device and synced when you're online.
                </Text>
              </View>
            </>
          )}
        </View>
      </Body>

      <ActionBar>
        {step < 2 ? (
          <Button icon="arrowRight" style={{ flex: 1 }} disabled={!canNext} onPress={() => setStep((s) => s + 1)}>
            {step === 0 ? "Continue to details" : "Review & submit"}
          </Button>
        ) : (
          <Button icon="flag" style={{ flex: 1 }} loading={busy} onPress={() => void submit()}>
            Submit NCR
          </Button>
        )}
      </ActionBar>
    </Screen>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  const { palette } = useTheme();
  return (
    <Card style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: palette.successBg, alignItems: "center", justifyContent: "center" }}>
        <Icon name="check" size={14} stroke={3} color={palette.success} />
      </View>
      <View style={{ flex: 1 }}>
        <Text size={11} weight="semibold" tone="muted">
          {label}
        </Text>
        <Text size={13.5} weight="semibold">
          {value}
        </Text>
      </View>
    </Card>
  );
}
