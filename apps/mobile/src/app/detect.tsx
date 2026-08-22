import { useRouter } from "expo-router";
import { useSafeBack } from "@/hooks/use-safe-back";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DetectCamera, type DetectCameraHandle } from "@/features/capture/DetectCamera";
import { analyzeFrame, type TriageDraft } from "@/features/ncr/ai";
import { ensurePermission } from "@/services/permissions";
import { useTheme } from "@/theme";
import { Button, Icon, Screen, Text } from "@/ui";

/**
 * CapCamera on-frame AI detect (m-capture.jsx CapCamera). A live camera view; the
 * shutter grabs the current frame and runs the governed vision model over it,
 * then overlays what the model actually saw — a defect label and the model's OWN
 * confidence estimate (labelled as such, never a fabricated detector score). Tap
 * "Draft NCR" to carry that detection into the guided NCR create.
 *
 * Honest scope: this is tap-to-analyse (one governed model call per frame), not a
 * continuous 30fps on-device detector — that needs an embedded model we don't ship.
 * Web / no-camera falls back to New NCR's Photo + AI, which runs the same model.
 */
export default function Detect() {
  const router = useRouter();
  const goBack = useSafeBack("/(app)/home");
  const insets = useSafeAreaInsets();
  const { radius } = useTheme();

  const isNative = Platform.OS !== "web";
  const [granted, setGranted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detection, setDetection] = useState<TriageDraft | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const camera = useRef<DetectCameraHandle>(null);

  useEffect(() => {
    if (!isNative) return;
    void (async () => {
      setGranted((await ensurePermission("camera", "Defect detection")) === "granted");
    })();
  }, [isNative]);

  async function analyze(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setErr(null);
    setDetection(null);
    try {
      const base64 = await camera.current?.capture();
      if (base64 === null || base64 === undefined) {
        setErr("Couldn't grab a frame — try again.");
        return;
      }
      const draft = await analyzeFrame(base64);
      if (!draft.title && !draft.category) {
        setErr("No clear defect in view — reframe and try again.");
        return;
      }
      setDetection(draft);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't analyse the frame.");
    } finally {
      setBusy(false);
    }
  }

  function draftNcr(): void {
    if (detection === null) return;
    router.push({
      pathname: "/ncr/new",
      params: {
        ...(detection.title ? { title: detection.title } : {}),
        ...(detection.severity ? { severity: detection.severity } : {}),
        ...(detection.category ? { category: detection.category } : {}),
        ...(detection.description ? { description: detection.description } : {}),
      },
    });
  }

  const label = detection?.title ?? detection?.category ?? "defect";

  return (
    <Screen style={{ backgroundColor: "#000000" }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 12, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable onPress={goBack} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="x" size={24} color="#ffffff" />
        </Pressable>
        <Text size={17} weight="bold" color="#ffffff">
          Detect defect
        </Text>
      </View>

      {isNative && granted ? (
        <View style={{ flex: 1 }}>
          <DetectCamera ref={camera} />

          {/* Framing guide */}
          <View pointerEvents="none" style={{ position: "absolute", top: 24, left: 24, right: 24, bottom: 150, borderRadius: 20, borderWidth: 2, borderColor: "rgba(255,255,255,0.35)" }} />

          {/* Detection overlay — what the model actually reported */}
          {detection !== null && (
            <View style={{ position: "absolute", left: 16, right: 16, bottom: 150, padding: 14, borderRadius: 14, backgroundColor: "rgba(20,20,22,0.92)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon name="sparkles" size={16} color="#fbbf24" />
                <Text size={13.5} weight="bold" color="#ffffff" style={{ flex: 1 }}>
                  Possible {label} detected
                </Text>
              </View>
              <Text size={11.5} color="rgba(255,255,255,0.65)">
                {detection.confidence !== undefined ? `${detection.confidence}% AI estimate · ` : ""}
                tap Draft NCR to log it
              </Text>
            </View>
          )}

          {err !== null && (
            <View style={{ position: "absolute", left: 16, right: 16, bottom: 150, padding: 12, borderRadius: 12, backgroundColor: "rgba(60,20,20,0.92)", borderWidth: 1, borderColor: "rgba(255,120,120,0.3)" }}>
              <Text size={12} color="#fecaca">
                {err}
              </Text>
            </View>
          )}

          {/* Controls */}
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom + 20, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14 }}>
            {detection === null ? (
              <Pressable onPress={() => void analyze()} disabled={busy} style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1 }}>
                {busy ? <ActivityIndicator color="#18181b" /> : <Icon name="sparkles" size={26} color="#18181b" />}
              </Pressable>
            ) : (
              <>
                <Pressable onPress={() => { setDetection(null); setErr(null); }} style={{ height: 48, paddingHorizontal: 20, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" }}>
                  <Text size={13.5} weight="semibold" color="#ffffff">
                    Retry
                  </Text>
                </Pressable>
                <Pressable onPress={draftNcr} style={{ height: 48, flex: 1, borderRadius: 12, backgroundColor: "#fafafa", alignItems: "center", justifyContent: "center" }}>
                  <Text size={13.5} weight="bold" color="#18181b">
                    Draft NCR
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 14 }}>
          <View style={{ width: 60, height: 60, borderRadius: radius["2xl"], backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}>
            <Icon name="camera" size={28} color="#ffffff" />
          </View>
          <Text size={17} weight="bold" color="#ffffff">
            Detection uses the camera
          </Text>
          <Text size={13} color="#ffffff" style={{ opacity: 0.7, lineHeight: 19 }}>
            {isNative
              ? "Camera access is off. Turn it on, or add a photo in New NCR to run the same AI."
              : "Live on-frame detection needs the camera on the mobile app. In New NCR, add a photo and tap Photo + AI to run the same vision model here."}
          </Text>
          <Button onPress={() => router.replace("/ncr/new")}>Go to New NCR</Button>
        </View>
      )}
    </Screen>
  );
}
