import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { SettingRow, SettingsGroup, SubHeader } from "@/features/settings/parts";
import { useLayout } from "@/hooks/use-layout";
import { services } from "@/services";
import { useTheme } from "@/theme";
import { Body, Card, Icon, Screen, SectionLabel, Text, type IconName } from "@/ui";

const CATEGORIES: { key: string; icon: IconName; title: string; def: boolean }[] = [
  { key: "assigned", icon: "clipboard", title: "Work assigned to me", def: true },
  { key: "dueSoon", icon: "clock", title: "Due-soon reminders", def: true },
  { key: "ncrAction", icon: "alert", title: "NCR needs my action", def: true },
  { key: "syncFailed", icon: "cloudOff", title: "Sync failed", def: true },
  { key: "approvals", icon: "check", title: "Approvals & mentions", def: false },
];

function prefKey(k: string): string {
  return `kaenal.notif.${k}`;
}

// m-settings-detail.jsx SettingsNotifPrefs — device push categories (persisted
// locally). The full server channel matrix (email digest, per-channel) is managed
// in the web app; flagged in PROGRESS.
export default function NotificationPrefs() {
  const router = useRouter();
  const { palette } = useTheme();
  const { contentMaxWidth } = useLayout();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const entries = await Promise.all(CATEGORIES.map(async (c) => [c.key, (await services.kv.getItem(prefKey(c.key))) ?? (c.def ? "1" : "0")] as const));
    setPrefs(Object.fromEntries(entries.map(([k, v]) => [k, v === "1"])));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(key: string): void {
    setPrefs((p) => {
      const next = !p[key];
      void services.kv.setItem(prefKey(key), next ? "1" : "0");
      return { ...p, [key]: next };
    });
  }

  return (
    <Screen>
      <SubHeader title="Notifications" onBack={() => router.back()} />
      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth, paddingTop: 16 }}>
          <SectionLabel style={{ paddingHorizontal: 20, paddingBottom: 8 }}>Push</SectionLabel>
          <SettingsGroup>
            {CATEGORIES.map((c, i, a) => (
              <SettingRow key={c.key} icon={c.icon} title={c.title} toggle={prefs[c.key] ?? c.def} onToggle={() => toggle(c.key)} last={i === a.length - 1} />
            ))}
          </SettingsGroup>

          <Card style={{ marginHorizontal: 16, padding: 14, backgroundColor: palette.bgSubtle, borderWidth: 0, flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Icon name="mail" size={16} color={palette.muted} />
            <Text size={12.5} tone="muted" style={{ flex: 1, lineHeight: 18 }}>
              These control push on this device. Email digests and per-channel routing are set in the web
              app's notification matrix.
            </Text>
          </Card>
        </View>
      </Body>
    </Screen>
  );
}
