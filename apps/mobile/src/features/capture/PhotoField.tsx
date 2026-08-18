import { useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";

import { services } from "@/services";
import { useTheme } from "@/theme";
import { Icon, Text } from "@/ui";

import { addPhotoEvidence } from "./files";

/**
 * A photo evidence field (05 §M7) — used by the inspection runner's `photo`
 * items and the Quick-Log sheet. Captured images are staged as local
 * `pending_files` and uploaded by the sync engine (presign-at-push), so the
 * field works fully offline. `value` is the array of local file ids.
 */
export function PhotoField({ value, onChange }: { value: unknown; onChange: (v: string[]) => void }) {
  const { palette, radius } = useTheme();
  const ids = Array.isArray(value) ? (value.filter((x) => typeof x === "string") as string[]) : [];
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Resolve local URIs for any ids we don't yet have a thumbnail for (resume).
  useEffect(() => {
    const missing = ids.filter((id) => !(id in thumbs));
    if (missing.length === 0) return;
    void services.syncStore.listFiles().then((files) => {
      const map: Record<string, string> = {};
      for (const f of files) if (missing.includes(f.id)) map[f.id] = f.localUri;
      if (Object.keys(map).length > 0) setThumbs((t) => ({ ...t, ...map }));
    });
  }, [ids, thumbs]);

  async function add(source: "camera" | "library"): Promise<void> {
    setBusy(true);
    try {
      const added = await addPhotoEvidence(source);
      if (added) {
        setThumbs((t) => ({ ...t, [added.id]: added.uri }));
        onChange([...ids, added.id]);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {ids.map((id) => (
        <View key={id} style={{ width: 68, height: 68, borderRadius: radius.lg, overflow: "hidden", backgroundColor: palette.bgSubtle }}>
          {thumbs[id] ? (
            <Image source={{ uri: thumbs[id] }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Icon name="clock" size={16} color={palette.subtle} />
            </View>
          )}
          <Pressable
            onPress={() => onChange(ids.filter((x) => x !== id))}
            hitSlop={6}
            style={{
              position: "absolute",
              top: 3,
              right: 3,
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: "rgba(0,0,0,0.6)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="x" size={11} color="#ffffff" />
          </Pressable>
        </View>
      ))}
      <Pressable disabled={busy} onPress={() => void add("camera")} style={({ pressed }) => ({ opacity: pressed || busy ? 0.6 : 1 })}>
        <View
          style={{
            width: 68,
            height: 68,
            borderRadius: radius.lg,
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: palette.border,
            backgroundColor: palette.surface,
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
          }}
        >
          <Icon name="camera" size={18} color={palette.accent} />
          <Text size={9.5} weight="bold" color={palette.accent}>
            {busy ? "…" : "Add"}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
