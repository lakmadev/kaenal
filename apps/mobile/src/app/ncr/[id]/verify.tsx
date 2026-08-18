import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { enqueueTransition, enqueueVerify } from "@/features/ncr/offline";
import { useNcr } from "@/features/ncr/queries";
import { useLayout } from "@/hooks/use-layout";
import { useTheme } from "@/theme";
import { ActionBar, Body, Button, Card, Icon, Mono, Screen, SectionLabel, Skeleton, StatusPill, Text } from "@/ui";

// m-ncr.jsx NcrVerify — auditor four-eyes verification. "Effective" verifies +
// closes (the server enforces verifier ≠ resolver); "Not effective" reopens.
export default function NcrVerify() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette, radius, fonts } = useTheme();
  const { contentMaxWidth } = useLayout();
  const { data: ncr, isLoading } = useNcr(id ?? "");
  const [effective, setEffective] = useState<boolean | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    if (!ncr || effective === null) return;
    setBusy(true);
    try {
      if (effective) await enqueueVerify(ncr, note.trim() || undefined);
      else await enqueueTransition(ncr, "reopened", { reason: note.trim() || "Corrective action not effective" });
      router.replace(`/ncr/${id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 6, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 }}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
            <Icon name="chevronLeft" size={24} stroke={2} color={palette.text} />
          </Pressable>
          <Mono size={11.5} weight="bold" color={palette.muted}>
            {ncr?.code ?? "…"}
          </Mono>
          <View style={{ flex: 1 }} />
          <StatusPill tone="verify">Verify</StatusPill>
        </View>
        <View style={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 14 }}>
          <Text size={12} weight="semibold" tone="muted">
            Auditor verification
          </Text>
          <Text size={18} weight="bold" style={{ lineHeight: 23, marginTop: 2 }}>
            Confirm corrective action closed the gap
          </Text>
        </View>
      </View>

      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth, padding: 16, gap: 14 }}>
          {isLoading || !ncr ? (
            <Skeleton width="100%" height={80} />
          ) : (
            <>
              <Card style={{ padding: 14 }}>
                <SectionLabel style={{ marginBottom: 6 }}>Non-conformity</SectionLabel>
                <Text size={14.5} weight="semibold" style={{ lineHeight: 20 }}>
                  {ncr.title}
                </Text>
                {ncr.description && (
                  <Text size={12.5} tone="muted" style={{ marginTop: 6, lineHeight: 18 }}>
                    {ncr.description}
                  </Text>
                )}
              </Card>

              <View>
                <SectionLabel style={{ marginBottom: 8 }}>Verification decision</SectionLabel>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {[
                    { on: effective === true, label: "Effective", set: () => setEffective(true), tone: "success" as const },
                    { on: effective === false, label: "Not effective", set: () => setEffective(false), tone: "danger" as const },
                  ].map((o) => (
                    <Pressable key={o.label} onPress={o.set} style={{ flex: 1 }}>
                      <View
                        style={{
                          height: 44,
                          borderRadius: radius.lg,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          backgroundColor: o.on ? (o.tone === "success" ? palette.successBg : palette.dangerBg) : palette.surface,
                          borderWidth: 1.5,
                          borderColor: o.on ? (o.tone === "success" ? palette.success : palette.danger) : palette.border,
                        }}
                      >
                        {o.on && <Icon name="check" size={15} stroke={2.6} color={o.tone === "success" ? palette.successFg : palette.dangerFg} />}
                        <Text size={13.5} weight="semibold" color={o.on ? (o.tone === "success" ? palette.successFg : palette.dangerFg) : palette.muted}>
                          {o.label}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View>
                <SectionLabel style={{ marginBottom: 8 }}>Verifier note</SectionLabel>
                <Card style={{ padding: 12 }}>
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="Root cause addressed? Note what you confirmed."
                    placeholderTextColor={palette.subtle}
                    multiline
                    style={{ minHeight: 64, fontSize: 13.5, lineHeight: 19, color: palette.text, fontFamily: fonts.sans, textAlignVertical: "top" }}
                  />
                </Card>
              </View>
            </>
          )}
        </View>
      </Body>

      <ActionBar>
        <Button
          icon={effective === false ? "flag" : "shieldCheck"}
          style={{ flex: 1 }}
          loading={busy}
          disabled={!ncr || effective === null}
          onPress={() => void submit()}
        >
          {effective === false ? "Reopen NCR" : "Verify & close NCR"}
        </Button>
      </ActionBar>
    </Screen>
  );
}
