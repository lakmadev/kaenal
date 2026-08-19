import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { SettingRow, SettingsGroup, SubHeader } from "@/features/settings/parts";
import { useLayout } from "@/hooks/use-layout";
import { queryClient } from "@/lib/query-client";
import { services } from "@/services";
import { useTheme } from "@/theme";
import { Body, Button, Card, Icon, Screen, SectionLabel, Text } from "@/ui";

const STORAGE_CAP = 500 * 1024 * 1024;
const PREF_KEYS = { offlineDownload: "kaenal.pref.offlineDownload", hqPhotos: "kaenal.pref.hqPhotos", cellular: "kaenal.pref.cellularSync" };

function fmtMB(n: number): string {
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// m-settings-detail.jsx SettingsStorage — the real on-device evidence gauge (pending
// file bytes) + device offline preferences (persisted locally).
export default function Storage() {
  const router = useRouter();
  const { palette, radius } = useTheme();
  const { contentMaxWidth } = useLayout();

  const [bytes, setBytes] = useState(0);
  const [prefs, setPrefs] = useState({ offlineDownload: true, hqPhotos: false, cellular: true });
  const [cleared, setCleared] = useState(false);

  const load = useCallback(async () => {
    const [files, ...raw] = await Promise.all([
      services.syncStore.listFiles(),
      services.kv.getItem(PREF_KEYS.offlineDownload),
      services.kv.getItem(PREF_KEYS.hqPhotos),
      services.kv.getItem(PREF_KEYS.cellular),
    ]);
    setBytes(files.reduce((n, f) => n + f.bytes, 0));
    setPrefs({ offlineDownload: raw[0] !== "0", hqPhotos: raw[1] === "1", cellular: raw[2] !== "0" });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(key: keyof typeof prefs, kvKey: string): void {
    setPrefs((p) => {
      const next = !p[key];
      void services.kv.setItem(kvKey, next ? "1" : "0");
      return { ...p, [key]: next };
    });
  }

  async function clearCache(): Promise<void> {
    // Clears synced/cached records (the query cache) — pending mutations + staged
    // evidence files are NOT touched.
    queryClient.clear();
    setCleared(true);
    await load();
  }

  return (
    <Screen>
      <SubHeader title="Offline & storage" onBack={() => router.back()} />
      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth, paddingTop: 16 }}>
          <Card style={{ marginHorizontal: 16, marginBottom: 14, padding: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <Text size={13.5} weight="semibold">
                On-device evidence
              </Text>
              <Text size={12.5} tone="muted">
                <Text size={12.5} weight="bold">
                  {fmtMB(bytes)}
                </Text>{" "}
                / 500 MB
              </Text>
            </View>
            <View style={{ height: 10, borderRadius: 999, backgroundColor: palette.bgSubtle, overflow: "hidden" }}>
              <View style={{ width: `${Math.max(1, Math.min(100, (bytes / STORAGE_CAP) * 100))}%`, height: "100%", backgroundColor: palette.accent }} />
            </View>
            <Text size={11.5} tone="muted" style={{ marginTop: 8 }}>
              Photos and voice notes staged for upload. They're removed automatically once synced.
            </Text>
          </Card>

          <SectionLabel style={{ paddingHorizontal: 20, paddingBottom: 8 }}>Offline behaviour</SectionLabel>
          <SettingsGroup>
            <SettingRow icon="download" title="Download my work for offline" sub="Assigned inspections & templates" toggle={prefs.offlineDownload} onToggle={() => toggle("offlineDownload", PREF_KEYS.offlineDownload)} />
            <SettingRow icon="camera" title="High-quality photos" sub="Uses more storage & data" toggle={prefs.hqPhotos} onToggle={() => toggle("hqPhotos", PREF_KEYS.hqPhotos)} />
            <SettingRow icon="signal" title="Sync on cellular" sub="Otherwise Wi-Fi only" toggle={prefs.cellular} onToggle={() => toggle("cellular", PREF_KEYS.cellular)} last />
          </SettingsGroup>

          <View style={{ paddingHorizontal: 16 }}>
            <Button variant="ghost" icon="trash" style={{ flex: 1 }} onPress={() => void clearCache()}>
              {cleared ? "Synced cache cleared" : "Clear synced cache"}
            </Button>
            <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-start", marginTop: 10 }}>
              <Icon name="info" size={13} color={palette.muted} />
              <Text size={11.5} tone="muted" style={{ flex: 1, lineHeight: 16 }}>
                Only clears records already synced to the server. Pending work and staged photos are kept.
              </Text>
            </View>
          </View>
          <View style={{ height: radius.md }} />
        </View>
      </Body>
    </Screen>
  );
}
