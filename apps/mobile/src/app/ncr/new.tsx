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
import { useScan } from "@/stores/scan";
import { useTheme } from "@/theme";
import { ActionBar, Body, Button, Card, Icon, Screen, SectionLabel, StatusPill, Text, type IconName } from "@/ui";

const CONTAINMENTS = ["Cell stopped & quarantined", "Customer Quality notified", "WIP re-inspection started"];
const CATEGORIES = ["Process", "Product", "Material", "Documentation", "Other"];

type Method = "photo" | "voice" | "manual" | "scan";
const METHODS: { key: Method; icon: IconName; label: string; ready: boolean }[] = [
  { key: "photo", icon: "camera", label: "Photo", ready: true },
  { key: "voice", icon: "mic", label: "Voice", ready: false },
  { key: "manual", icon: "edit", label: "Manual", ready: true },
  { key: "scan", icon: "qr", label: "Scan asset", ready: true },
];

// m-ncr.jsx guided create (NcrCreateStep1/2/3) — a 3-step stepper, pixel-for-pixel:
// (1) how-to-start method chooser + location + asset, (2) evidence + title +
// severity + category + containment + open-8D, (3) review & submit. Durable create
// through the offline engine (containment + evidence persisted for real).
export default function NcrNew() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette, radius, fonts } = useTheme();
  const { contentMaxWidth } = useLayout();
  const params = useLocalSearchParams<{ title?: string; inspectionId?: string }>();
  const scanResult = useScan((s) => s.result);
  const clearScan = useScan((s) => s.clear);

  const [step, setStep] = useState(0);
  const [method, setMethod] = useState<Method>("photo");
  const [asset, setAsset] = useState<string | null>(null);
  const [title, setTitle] = useState(params.title ?? "");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<NcrPriority>("major");
  const [category, setCategory] = useState<string | null>(null);
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [containment, setContainment] = useState<Set<string>>(new Set());
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [open8d, setOpen8d] = useState(false);
  const [busy, setBusy] = useState(false);

  // Auto-stamp location quietly; never block the form on it (05 §3).
  useEffect(() => {
    void (async () => {
      if ((await ensurePermission("location", "Location stamping", { promptSettings: false })) !== "granted") return;
      const c = await services.location?.current();
      if (c) setCoords({ latitude: c.latitude, longitude: c.longitude });
    })();
  }, []);

  // Consume an asset/part code handed back from the /scan route.
  useEffect(() => {
    if (scanResult) {
      setAsset(scanResult);
      clearScan();
    }
  }, [scanResult, clearScan]);

  async function submit(): Promise<void> {
    setBusy(true);
    try {
      const parts = [
        description.trim(),
        asset ? `\n\nAsset: ${asset}` : "",
        coords ? `\n\nGPS: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : "",
        params.inspectionId ? `\n\nRaised from inspection ${params.inspectionId}` : "",
      ];
      const body = {
        title: title.trim().slice(0, 120),
        description: parts.join("") || null,
        priority: severity,
        category,
        containment: [...containment],
        evidenceFileIds: photoIds,
        source: (params.inspectionId ? "inspection" : "manual") as "inspection" | "manual",
        ...(params.inspectionId ? { sourceId: params.inspectionId } : {}),
      };

      if (open8d) {
        // "Yes, open 8D" — online path: create then escalate immediately so the
        // 8D really opens on submit. Offline, fall through to the durable queue
        // (the NCR's own detail then offers "Escalate to 8D").
        try {
          const created = await apiClient.createNcr({ body });
          if (created.status === 201) {
            await apiClient.transitionNcr({ params: { id: created.body.id }, body: { to: "escalated", version: created.body.lockVersion } });
            router.replace(`/ncr/${created.body.id}`);
            return;
          }
        } catch {
          /* offline — fall back to the durable queue below */
        }
      }

      await enqueueCreateNcr(body);
      router.replace("/(app)/ncr");
    } finally {
      setBusy(false);
    }
  }

  const stepTitle = step === 0 ? "What & where" : step === 1 ? "Details" : "Review & submit";
  const canNext = step === 0 ? true : step === 1 ? title.trim().length > 0 : true;

  function openScan(): void {
    clearScan();
    router.push("/scan");
  }

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
        <View style={{ width: "100%", maxWidth: contentMaxWidth, padding: 16, gap: 16 }}>
          {step === 0 && (
            <>
              <View>
                <SectionLabel style={{ marginBottom: 8 }}>How do you want to start?</SectionLabel>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {METHODS.map((m) => {
                    const on = method === m.key;
                    return (
                      <Pressable
                        key={m.key}
                        onPress={() => {
                          setMethod(m.key);
                          if (m.key === "scan") openScan();
                        }}
                        style={{ width: "48%" }}
                      >
                        <Card style={{ padding: 14, gap: 8, borderWidth: 1.5, borderColor: on ? palette.accent : palette.border, backgroundColor: on ? palette.accentSoft : palette.surface }}>
                          <View style={{ width: 34, height: 34, borderRadius: radius.md, backgroundColor: on ? palette.accent : palette.bgSubtle, alignItems: "center", justifyContent: "center" }}>
                            <Icon name={m.icon} size={17} color={on ? palette.accentFg : palette.text} />
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text size={13.5} weight="semibold">
                              {m.label}
                            </Text>
                            {!m.ready && (
                              <StatusPill tone="neutral" size="sm">
                                Soon
                              </StatusPill>
                            )}
                          </View>
                        </Card>
                      </Pressable>
                    );
                  })}
                </View>
                {method === "voice" && (
                  <Text size={11.5} tone="muted" style={{ marginTop: 8 }}>
                    Voice capture (hold-to-talk + audio evidence) arrives next — for now, use Photo or Manual.
                  </Text>
                )}
              </View>

              <View>
                <SectionLabel style={{ marginBottom: 8 }}>Location</SectionLabel>
                <Card style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Icon name="mapPin" size={15} color={palette.accent} />
                  <Text size={13} weight="semibold" style={{ flex: 1 }}>
                    {coords ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}` : "Location"}
                  </Text>
                  <StatusPill tone={coords ? "done" : "neutral"} size="sm">
                    {coords ? "GPS" : "Off"}
                  </StatusPill>
                </Card>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                  <Icon name="info" size={13} color={palette.muted} />
                  <Text size={11.5} tone="muted">
                    Detected from GPS. Add the asset below or on the next step.
                  </Text>
                </View>
              </View>

              <View>
                <SectionLabel style={{ marginBottom: 8 }}>Asset / part</SectionLabel>
                <Pressable onPress={openScan}>
                  <Card style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text size={13} tone={asset ? "text" : "subtle"} weight={asset ? "semibold" : "regular"} style={{ flex: 1 }}>
                      {asset ?? "Scan QR or tap to add…"}
                    </Text>
                    <Icon name="qr" size={17} color={palette.accent} />
                  </Card>
                </Pressable>
              </View>
            </>
          )}

          {step === 1 && (
            <>
              <View>
                <SectionLabel style={{ marginBottom: 7 }}>Evidence</SectionLabel>
                <PhotoField value={photoIds} onChange={setPhotoIds} />
              </View>

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

              <View>
                <SectionLabel style={{ marginBottom: 7 }}>What happened?</SectionLabel>
                <Card style={{ padding: 12 }}>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Describe the non-conformity: what, where, how many affected."
                    placeholderTextColor={palette.subtle}
                    multiline
                    style={{ minHeight: 72, fontSize: 14, lineHeight: 20, color: palette.text, fontFamily: fonts.sans, textAlignVertical: "top" }}
                  />
                </Card>
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <SectionLabel style={{ marginBottom: 7 }}>Severity</SectionLabel>
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    {(["minor", "major", "critical"] as NcrPriority[]).map((s) => {
                      const on = severity === s;
                      const crit = s === "critical";
                      return (
                        <Pressable key={s} onPress={() => setSeverity(s)} style={{ flex: 1 }}>
                          <View style={{ height: 38, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: on ? (crit ? palette.danger : palette.accent) : palette.surface, borderWidth: 1, borderColor: on ? (crit ? palette.danger : palette.accent) : palette.border }}>
                            <Text size={12} weight="bold" color={on ? (crit ? "#ffffff" : palette.accentFg) : palette.muted}>
                              {s === "minor" ? "Min" : s === "major" ? "Maj" : "Crit"}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <SectionLabel style={{ marginBottom: 7 }}>Category</SectionLabel>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                    {CATEGORIES.map((c) => {
                      const on = category === c;
                      return (
                        <Pressable key={c} onPress={() => setCategory(on ? null : c)}>
                          <View style={{ paddingHorizontal: 10, height: 30, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: on ? palette.accentSoft : palette.surface, borderWidth: 1, borderColor: on ? palette.accent : palette.border }}>
                            <Text size={11.5} weight="semibold" color={on ? palette.accent : palette.muted}>
                              {c}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
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

              {/* "Open an 8D?" — a real choice; on submit it escalates the NCR. */}
              {(severity === "critical" || containment.size > 0) && (
                <Card style={{ padding: 12, backgroundColor: palette.infoBg, borderColor: palette.border }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Icon name="brain" size={15} color={palette.info} />
                    <Text size={12} weight="bold" color={palette.info}>
                      Open an 8D for this NCR?
                    </Text>
                  </View>
                  <Text size={11} color={palette.info} style={{ lineHeight: 16, marginBottom: 8, opacity: 0.9 }}>
                    Critical severity or logged containment usually triggers an 8D investigation.
                  </Text>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <Pressable onPress={() => setOpen8d(true)} style={{ flex: 1 }}>
                      <View style={{ height: 32, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: open8d ? palette.accent : palette.surface, borderWidth: 1, borderColor: open8d ? palette.accent : palette.border }}>
                        <Text size={12} weight="semibold" color={open8d ? palette.accentFg : palette.info}>
                          Yes, open 8D
                        </Text>
                      </View>
                    </Pressable>
                    <Pressable onPress={() => setOpen8d(false)}>
                      <View style={{ height: 32, paddingHorizontal: 14, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: !open8d ? palette.bgSubtle : palette.surface, borderWidth: 1, borderColor: palette.border }}>
                        <Text size={12} weight="semibold" color={palette.info}>
                          Later
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                </Card>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <Card style={{ padding: 14 }}>
                <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
                  <StatusPill tone={severity === "critical" ? "danger" : "warn"} size="sm">
                    {severity}
                  </StatusPill>
                  {category && (
                    <StatusPill tone="neutral" size="sm">
                      {category}
                    </StatusPill>
                  )}
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
              <ReviewRow label="Evidence" value={`${photoIds.length} photo${photoIds.length === 1 ? "" : "s"}`} onEdit={() => setStep(1)} />
              <ReviewRow label="Containment" value={containment.size > 0 ? `${containment.size} action${containment.size === 1 ? "" : "s"} logged` : "None"} onEdit={() => setStep(1)} />
              <ReviewRow label="8D investigation" value={open8d ? "Will open on submit" : "Not now"} onEdit={() => setStep(1)} />
              <ReviewRow label="Location" value={coords ? "GPS stamped" : "Not available"} onEdit={() => setStep(0)} />
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

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
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
      <Pressable onPress={onEdit} hitSlop={8}>
        <Text size={12.5} weight="semibold" color={palette.accent}>
          Edit
        </Text>
      </Pressable>
    </Card>
  );
}
