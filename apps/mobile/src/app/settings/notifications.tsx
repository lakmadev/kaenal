import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import type { NotificationPrefsDto } from "@kaenal/types";

import { SettingRow, SettingsGroup, SubHeader } from "@/features/settings/parts";
import { useLayout } from "@/hooks/use-layout";
import { apiClient } from "@/lib/api";
import { services } from "@/services";
import { useSession } from "@/stores/session";
import { useTheme } from "@/theme";
import { Body, Card, Icon, Screen, SectionLabel, Skeleton, Text, type IconName } from "@/ui";

type Matrix = NotificationPrefsDto["matrix"];

// Each push category maps to the server notification kinds that drive it (the same
// `kind` strings notifications are created with and `deliver-notification` reads from
// the matrix). Toggling flips the `push` channel for every kind in the category and
// PUTs the whole matrix — so the preference is real, server-stored, and shared across
// devices (not the old local-KV stub that punted to "the web app").
const CATEGORIES: { key: string; icon: IconName; title: string; kinds: string[] }[] = [
  { key: "assigned", icon: "clipboard", title: "Work assigned to me", kinds: ["inspection_assigned", "ncr_assigned", "eight_d_assigned", "scar_assigned"] },
  { key: "ncrEscalated", icon: "alert", title: "NCR escalations", kinds: ["ncr_escalated"] },
  { key: "docExpiring", icon: "doc", title: "Documents expiring", kinds: ["document_expiring"] },
  { key: "exportReady", icon: "download", title: "Exports ready", kinds: ["export_ready"] },
];

const CHANNELS_ON = { inapp: true, email: false, push: true, sms: false };
const CHANNELS_OFF = { inapp: true, email: false, push: false, sms: false };

// "Sync failed" is a CLIENT-side local notification the offline engine raises on this
// device — it has no server kind, so it's an honest device-local toggle, not faked
// into the server matrix.
const SYNC_KEY = "kaenal.notif.syncFailed";

export default function NotificationPrefs() {
  const { palette } = useTheme();
  const { contentMaxWidth } = useLayout();
  const qc = useQueryClient();
  const tenant = useSession((s) => s.tenant);

  const prefs = useQuery({
    queryKey: ["notif-prefs", tenant],
    queryFn: async (): Promise<Matrix> => {
      const res = await apiClient.getNotificationPrefs();
      return res.status === 200 ? res.body.matrix : {};
    },
    enabled: tenant !== null,
    staleTime: 10_000,
  });

  const save = useMutation({
    mutationFn: async (matrix: Matrix) => {
      await apiClient.updateNotificationPrefs({ body: { matrix } });
    },
    onMutate: (matrix) => qc.setQueryData(["notif-prefs", tenant], matrix),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["notif-prefs", tenant] }),
  });

  // "on" when any of the category's kinds has push enabled.
  function isOn(matrix: Matrix, kinds: string[]): boolean {
    return kinds.some((k) => matrix[k]?.push === true);
  }
  function toggleCategory(kinds: string[]): void {
    const matrix = { ...(prefs.data ?? {}) };
    const next = !isOn(matrix, kinds);
    for (const k of kinds) matrix[k] = next ? CHANNELS_ON : CHANNELS_OFF;
    save.mutate(matrix);
  }

  const [syncLocal, setSyncLocal] = useState(true);
  const loadSync = useCallback(async () => {
    setSyncLocal(((await services.kv.getItem(SYNC_KEY)) ?? "1") === "1");
  }, []);
  useEffect(() => {
    void loadSync();
  }, [loadSync]);
  function toggleSync(): void {
    setSyncLocal((v) => {
      const next = !v;
      void services.kv.setItem(SYNC_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <Screen>
      <SubHeader title="Notifications" />
      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth, paddingTop: 16 }}>
          <SectionLabel style={{ paddingHorizontal: 20, paddingBottom: 8 }}>Push</SectionLabel>
          {prefs.isLoading ? (
            <Card style={{ marginHorizontal: 16, padding: 14, gap: 12 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} width="100%" height={30} />
              ))}
            </Card>
          ) : (
            <SettingsGroup>
              {CATEGORIES.map((c) => (
                <SettingRow
                  key={c.key}
                  icon={c.icon}
                  title={c.title}
                  toggle={isOn(prefs.data ?? {}, c.kinds)}
                  onToggle={() => toggleCategory(c.kinds)}
                />
              ))}
              <SettingRow icon="cloudOff" title="Sync failed (this device)" toggle={syncLocal} onToggle={toggleSync} last />
            </SettingsGroup>
          )}

          <Card style={{ marginHorizontal: 16, padding: 14, backgroundColor: palette.bgSubtle, borderWidth: 0, flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Icon name="info" size={16} color={palette.muted} />
            <Text size={12.5} tone="muted" style={{ flex: 1, lineHeight: 18 }}>
              These are saved to your account and apply on every device. In-app alerts always show in the
              bell; push also needs notifications enabled on this device.
            </Text>
          </Card>
        </View>
      </Body>
    </Screen>
  );
}
