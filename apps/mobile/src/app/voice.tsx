import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { useRouter } from "expo-router";
import { useSafeBack } from "@/hooks/use-safe-back";
import { useRef, useState } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";

import { createTranscriber, type Transcriber } from "@/features/capture/transcribe";
import { addBytesEvidence } from "@/features/capture/files";
import { enqueueCreateNcr } from "@/features/ncr/offline";
import { SubHeader } from "@/features/settings/parts";
import { useLayout } from "@/hooks/use-layout";
import { apiClient } from "@/lib/api";
import { useTheme } from "@/theme";
import { ActionBar, Body, Button, Card, Icon, Screen, Text } from "@/ui";

/** Whether audio capture can work here — web mic needs a secure origin. */
function micSupported(): boolean {
  if (Platform.OS !== "web") return true;
  return typeof window !== "undefined" && window.isSecureContext === true;
}

function fmtClock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Best-guess mime from the recorder's output uri. */
function mimeOf(uri: string): string {
  if (uri.includes(".webm")) return "audio/webm";
  if (uri.includes(".m4a")) return "audio/m4a";
  if (uri.includes(".caf")) return "audio/x-caf";
  return "audio/mp4";
}

// m-capture.jsx CapVoice — record a spoken note as REAL audio evidence, attach it
// to a new NCR, transcribe it live where the platform can (Web Speech API on a
// secure origin; the words land in the editable note), and let the AI structure
// the result. Native has no built-in STT, so there transcription is unsupported
// and the flow stays record + type/dictate — but the audio is ALWAYS captured.
export default function Voice() {
  const router = useRouter();
  const goBack = useSafeBack("/(app)/home");
  const { palette, radius } = useTheme();
  const { contentMaxWidth } = useLayout();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);

  const [supported] = useState(micSupported());
  const [note, setNote] = useState("");
  const [structured, setStructured] = useState<string | null>(null);
  const [captured, setCaptured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  // Live speech-to-text where the platform can do it (Web Speech API on a secure
  // origin); the text lands straight in the note field, editable after.
  const transcriber = useRef<Transcriber>(createTranscriber());
  const canTranscribe = transcriber.current.supported;

  async function start(): Promise<void> {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setCaptured(false);
    // Transcribe live in parallel with recording — the audio is still kept as
    // evidence regardless of whether transcription is available or succeeds.
    if (canTranscribe) transcriber.current.start((text) => setNote(text));
  }

  async function stop(): Promise<void> {
    transcriber.current.stop();
    await recorder.stop();
    setCaptured(true);
  }

  async function structure(): Promise<void> {
    if (note.trim().length === 0) return;
    setAiBusy(true);
    try {
      const res = await apiClient.requestAiDraft({ body: { feature: "quicklog_structuring", input: note.trim() } });
      if (res.status === 200) setStructured(res.body.value);
    } catch {
      /* gateway off — the raw note still submits */
    } finally {
      setAiBusy(false);
    }
  }

  async function submit(): Promise<void> {
    setBusy(true);
    try {
      const evidence: string[] = [];
      if (recorder.uri) evidence.push(await addBytesEvidence(recorder.uri, mimeOf(recorder.uri)));
      const title = (note.trim().split("\n")[0] || "Voice-logged non-conformity").slice(0, 120);
      const desc = [note.trim(), structured ? `\n\nAI structured:\n${structured}` : "", "\n\n(Voice note attached as evidence)"].join("");
      await enqueueCreateNcr({
        title,
        description: desc,
        priority: "major",
        source: "manual",
        evidenceFileIds: evidence,
      });
      router.replace("/(app)/ncr");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return (
      <Screen>
        <SubHeader title="Voice mode" />
        <Body contentStyle={{ alignItems: "center" }}>
          <View style={{ width: "100%", maxWidth: contentMaxWidth, padding: 24, alignItems: "center", gap: 12 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: palette.bgSubtle, alignItems: "center", justifyContent: "center" }}>
              <Icon name="mic" size={30} color={palette.subtle} />
            </View>
            <Text size={15} weight="bold">
              Voice needs the app
            </Text>
            <Text size={13} tone="muted" style={{ textAlign: "center", lineHeight: 19, maxWidth: 280 }}>
              Microphone capture works in the installed app or over a secure (https) connection. Use Photo or Manual here, or open the app on your device.
            </Text>
          </View>
        </Body>
      </Screen>
    );
  }

  const recording = state.isRecording;

  return (
    <Screen>
      <SubHeader title="Voice mode" subtitle="Just describe what you see" />
      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth, padding: 24, alignItems: "center", gap: 16 }}>
          {/* Mic */}
          <Pressable onPress={() => void (recording ? stop() : start())} disabled={busy}>
            <View style={{ width: 112, height: 112, borderRadius: 56, backgroundColor: recording ? palette.danger : palette.accent, alignItems: "center", justifyContent: "center" }}>
              <Icon name={recording ? "check" : "mic"} size={40} color={palette.accentFg} />
            </View>
          </Pressable>
          <Text size={13} weight="semibold" tone="muted">
            {recording ? `Listening… ${fmtClock(state.durationMillis)}` : captured ? `Recorded ${fmtClock(state.durationMillis)}` : "Tap to start recording"}
          </Text>

          {/* Waveform (live level meter) */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3, height: 30 }}>
            {Array.from({ length: 17 }).map((_, i) => {
              const base = 6 + ((i * 7) % 22);
              const lvl = recording ? base + Math.round((1 + (state.metering ?? -60) / 60) * 18) : captured ? base : 4;
              return <View key={i} style={{ width: 3, height: Math.max(4, Math.min(30, lvl)), borderRadius: 999, backgroundColor: palette.accent, opacity: recording ? 0.85 : 0.3 }} />;
            })}
          </View>

          {/* Note (honest: typed/dictated summary — no STT backend) */}
          <Card style={{ width: "100%", padding: 14 }}>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={canTranscribe ? "Words appear here as you speak — edit anything, then structure with AI." : "Type or dictate what you saw — the AI will structure it."}
              placeholderTextColor={palette.subtle}
              multiline
              style={{ minHeight: 88, fontSize: 13.5, lineHeight: 20, color: palette.text, textAlignVertical: "top" }}
            />
            <Pressable onPress={() => void structure()} disabled={aiBusy || note.trim().length === 0} style={{ marginTop: 8, alignSelf: "flex-start" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 5, paddingHorizontal: 9, borderRadius: radius.full, backgroundColor: palette.accentSoft, opacity: note.trim().length === 0 ? 0.5 : 1 }}>
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

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" }}>
            <Icon name="info" size={13} color={palette.muted} />
            <Text size={11.5} tone="muted" style={{ flex: 1, lineHeight: 16 }}>
              {canTranscribe
                ? "Live transcription is on — the audio is also saved as evidence and syncs with the NCR."
                : "Live speech-to-text isn't available on this device — the audio is saved as evidence and syncs with the NCR."}
            </Text>
          </View>
        </View>
      </Body>
      <ActionBar>
        <Button variant="ghost" style={{ flex: 1 }} onPress={goBack}>
          Cancel
        </Button>
        <Button icon="flag" style={{ flex: 2 }} loading={busy} disabled={!captured && note.trim().length === 0} onPress={() => void submit()}>
          Save NCR
        </Button>
      </ActionBar>
    </Screen>
  );
}
