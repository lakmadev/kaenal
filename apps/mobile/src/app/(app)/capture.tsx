import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { NcrPriority } from "@kaenal/types";

import { addPhotoEvidence } from "@/features/capture/files";
import { PhotoField } from "@/features/capture/PhotoField";
import { useLayout } from "@/hooks/use-layout";
import { apiClient } from "@/lib/api";
import { services } from "@/services";
import { ensurePermission, promptOpenSettings } from "@/services/permissions";
import { useTheme } from "@/theme";
import { Body, Button, Card, Icon, Screen, SectionLabel, StatusPill, Text } from "@/ui";

// m-capture.jsx CapQuickLog — real photo evidence (offline pipeline) + GPS stamp +
// AI structuring (quicklog_structuring) + "Log it" → a real NCR. Camera capture on
// device; on web the file dialog. Voice-to-text needs a transcription backend that
// doesn't exist yet, so that path is an honest note, not a fake transcript.
export default function Capture() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette, radius, fonts } = useTheme();
  const { contentMaxWidth } = useLayout();

  const [note, setNote] = useState("");
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locBlocked, setLocBlocked] = useState(false);
  const [structured, setStructured] = useState<{ value: string; confidence: string } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [logging, setLogging] = useState(false);
  const [severity, setSeverity] = useState<NcrPriority>("major");

  // Auto-stamp location: request quietly (no Settings modal on open — a capture must
  // never be blocked on location, 05 §3). If it's blocked, surface a tappable hint.
  useEffect(() => {
    void (async () => {
      const state = await ensurePermission("location", "Location stamping", { promptSettings: false });
      if (state === "blocked") {
        setLocBlocked(true);
        return;
      }
      if (state !== "granted") return;
      const c = await services.location?.current();
      if (c) setCoords({ latitude: c.latitude, longitude: c.longitude });
    })();
  }, []);

  async function structure(): Promise<void> {
    if (note.trim().length === 0) return;
    setAiBusy(true);
    try {
      const res = await apiClient.requestAiDraft({ body: { feature: "quicklog_structuring", input: note.trim() } });
      if (res.status === 200) setStructured({ value: res.body.value, confidence: res.body.confidence });
    } catch {
      /* AI gateway unavailable — leave the raw note, still loggable */
    } finally {
      setAiBusy(false);
    }
  }

  async function addFromCamera(): Promise<void> {
    const added = await addPhotoEvidence("camera");
    if (added) setPhotoIds((ids) => [...ids, added.id]);
  }

  async function logIt(): Promise<void> {
    if (note.trim().length === 0) return;
    setLogging(true);
    try {
      const title = note.trim().split("\n")[0]!.slice(0, 120);
      const description = [note.trim(), structured ? `\n\nAI structured:\n${structured.value}` : "", coords ? `\n\nGPS: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : ""].join("");
      const res = await apiClient.createNcr({ body: { title, description, priority: severity, source: "manual" } });
      if (res.status === 201) {
        router.replace("/(app)/home");
      }
    } finally {
      setLogging(false);
    }
  }

  const canLog = note.trim().length > 0 && !logging;

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <Pressable
            onPress={locBlocked ? () => promptOpenSettings("location", "Location stamping") : undefined}
            disabled={!locBlocked}
            style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
          >
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: coords ? palette.success : locBlocked ? palette.warn : palette.subtle }} />
            <Text size={12} weight="semibold" tone={locBlocked ? "accent" : "muted"}>
              {coords ? "Location stamped" : locBlocked ? "Location off · Enable" : "Locating…"}
            </Text>
          </Pressable>
          <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
            <Icon name="x" size={20} color={palette.muted} />
          </Pressable>
        </View>
        <Text size={24} weight="bold" style={{ letterSpacing: -0.4 }}>
          Quick-Log
        </Text>
        <Text size={12.5} tone="muted" style={{ marginTop: 1 }}>
          Describe it, snap it, done. No forms.
        </Text>
      </View>

      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth, padding: 16, gap: 12 }}>
          <Card style={{ padding: 14 }}>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="What did you see? e.g. Bracket weld bead on SN-A2104 looks inconsistent — porosity around the seam."
              placeholderTextColor={palette.subtle}
              multiline
              style={{ minHeight: 84, color: palette.text, fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, textAlignVertical: "top" }}
            />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
              <Pressable onPress={() => void structure()} disabled={aiBusy || note.trim().length === 0}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 5, paddingHorizontal: 9, borderRadius: radius.full, backgroundColor: palette.accentSoft, opacity: note.trim().length === 0 ? 0.5 : 1 }}>
                  <Icon name="sparkles" size={12} color={palette.accent} />
                  <Text size={11} weight="bold" color={palette.accent}>
                    {aiBusy ? "Structuring…" : "Structure with AI"}
                  </Text>
                </View>
              </Pressable>
            </View>
          </Card>

          {structured && (
            <Card style={{ padding: 14, backgroundColor: palette.accentSoft, borderColor: palette.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Icon name="sparkles" size={12} color={palette.accent} />
                  <Text size={11} weight="bold" color={palette.accent}>
                    Structured for you
                  </Text>
                </View>
                <View style={{ flex: 1 }} />
                <StatusPill tone="neutral" size="sm">
                  {structured.confidence}
                </StatusPill>
              </View>
              <Text size={13} style={{ lineHeight: 19 }}>
                {structured.value}
              </Text>
            </Card>
          )}

          <View>
            <SectionLabel style={{ marginBottom: 7 }}>Severity</SectionLabel>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["minor", "major", "critical"] as NcrPriority[]).map((s) => {
                const on = severity === s;
                return (
                  <Pressable key={s} onPress={() => setSeverity(s)} style={{ flex: 1 }}>
                    <View style={{ height: 40, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", backgroundColor: on ? palette.accent : palette.surface, borderWidth: 1.5, borderColor: on ? palette.accent : palette.border }}>
                      <Text size={13} weight="semibold" color={on ? palette.accentFg : palette.muted} style={{ textTransform: "capitalize" }}>
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

          <Card style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="mapPin" size={16} color={palette.accent} />
            <View style={{ flex: 1 }}>
              <Text size={12.5} weight="semibold">
                {coords ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}` : "Location"}
              </Text>
              <Text size={10.5} tone="muted">
                {coords ? "GPS auto-stamped on this capture" : "Add location permission to stamp GPS"}
              </Text>
            </View>
            <StatusPill tone={coords ? "done" : "neutral"} size="sm">
              {coords ? "Auto" : "Off"}
            </StatusPill>
          </Card>

          <Card style={{ padding: 12, backgroundColor: palette.bgSubtle, borderWidth: 0, flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Icon name="mic" size={16} color={palette.muted} />
            <Text size={12} tone="muted" style={{ flex: 1, lineHeight: 17 }}>
              Voice-to-text needs a transcription service (not yet available) — type your note and AI will
              structure it. On device you can still attach photos from the camera.
            </Text>
          </Card>
        </View>
      </Body>

      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.border, flexDirection: "row", gap: 10 }}>
        <Pressable onPress={() => void addFromCamera()}>
          <View style={{ width: 48, height: 48, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, alignItems: "center", justifyContent: "center" }}>
            <Icon name="camera" size={19} color={palette.text} />
          </View>
        </Pressable>
        <Button icon="arrowRight" style={{ flex: 1 }} loading={logging} disabled={!canLog} onPress={() => void logIt()}>
          Log it
        </Button>
      </View>
    </Screen>
  );
}
