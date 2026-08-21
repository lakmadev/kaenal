import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScanCamera } from "@/features/capture/ScanCamera";
import { ensurePermission } from "@/services/permissions";
import { useScan } from "@/stores/scan";
import { useTheme } from "@/theme";
import { Button, Icon, Screen, Text } from "@/ui";

// Full-screen QR / barcode scanner (05 §3). Native: a live expo-camera view that
// scans an asset/area code and hands it back via the scan store. Web (and any
// device without camera): a manual-entry fallback so the flow still completes —
// honest, not a fake camera. Camera permission runs through the shared flow
// (request → re-ask → Settings when blocked).
export default function Scan() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { radius } = useTheme();
  const setResult = useScan((s) => s.setResult);

  const isNative = Platform.OS !== "web";
  const [granted, setGranted] = useState(false);
  const [manual, setManual] = useState("");
  const handled = useRef(false);

  useEffect(() => {
    if (!isNative) return;
    void (async () => {
      setGranted((await ensurePermission("camera", "Scanning")) === "granted");
    })();
  }, [isNative]);

  function finish(value: string): void {
    if (handled.current) return; // debounce continuous scans
    const v = value.trim();
    if (!v) return;
    handled.current = true;
    setResult(v);
    router.back();
  }

  return (
    <Screen style={{ backgroundColor: "#000000" }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 12, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="x" size={24} color="#ffffff" />
        </Pressable>
        <Text size={17} weight="bold" color="#ffffff">
          Scan asset code
        </Text>
      </View>

      {isNative && granted ? (
        <View style={{ flex: 1 }}>
          <ScanCamera onScan={finish} />
          {/* Reticle overlay */}
          <View pointerEvents="none" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: 230, height: 230, borderRadius: 24, borderWidth: 3, borderColor: "#ffffff" }} />
            <Text size={13} color="#ffffff" style={{ marginTop: 16, opacity: 0.9 }}>
              Point the camera at an asset or area QR code
            </Text>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 14 }}>
          <View style={{ width: 60, height: 60, borderRadius: radius["2xl"], backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}>
            <Icon name="hash" size={28} color="#ffffff" />
          </View>
          <Text size={17} weight="bold" color="#ffffff">
            Enter the asset code
          </Text>
          <Text size={13} color="#ffffff" style={{ opacity: 0.7, lineHeight: 19 }}>
            {isNative
              ? "Camera access is off, so type the code printed under the QR instead."
              : "Live scanning uses the camera on the mobile app. Type the code printed under the QR to continue here."}
          </Text>
          <TextInput
            value={manual}
            onChangeText={setManual}
            placeholder="e.g. AST-10432"
            placeholderTextColor="rgba(255,255,255,0.4)"
            autoCapitalize="characters"
            autoCorrect={false}
            style={{ height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", color: "#ffffff", paddingHorizontal: 14, fontSize: 15 }}
          />
          <Button disabled={manual.trim().length === 0} onPress={() => finish(manual)}>
            Use this code
          </Button>
        </View>
      )}
    </Screen>
  );
}
