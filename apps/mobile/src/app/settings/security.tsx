import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";

import { confirmDestructive } from "@/features/auth/guard";
import { SettingRow, SettingsGroup, SubHeader } from "@/features/settings/parts";
import { useLayout } from "@/hooks/use-layout";
import {
  getMfaStatus,
  listSessions,
  revokeOtherSessions,
  revokeSession,
  type SessionSummary,
} from "@/lib/account-api";
import { useSession } from "@/stores/session";
import { useTheme } from "@/theme";
import { Body, Button, Card, Icon, Screen, SectionLabel, Skeleton, StatusPill, Text } from "@/ui";

function deviceLabel(ua: string | null): string {
  if (!ua) return "Unknown device";
  if (/expo|okhttp|kaenal|dalvik|cfnetwork/i.test(ua)) return "Kaenal mobile app";
  if (/iphone/i.test(ua)) return "iPhone · Safari";
  if (/ipad/i.test(ua)) return "iPad · Safari";
  if (/android/i.test(ua)) return "Android · Chrome";
  if (/edg/i.test(ua)) return "Edge";
  if (/chrome/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  if (/firefox/i.test(ua)) return "Firefox";
  return "Web browser";
}

function ago(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// Security (m-settings-detail.jsx SettingsSecurity) — all real: MFA status via
// /v1/auth/mfa, active sessions + revoke via /v1/auth/sessions, biometric toggle,
// and links to the real Two-factor / Change-password screens. No desktop punts.
export default function Security() {
  const router = useRouter();
  const { palette } = useTheme();
  const { contentMaxWidth } = useLayout();
  const qc = useQueryClient();
  const tenant = useSession((s) => s.tenant);
  const biometricEnabled = useSession((s) => s.biometricEnabled);
  const setBiometricEnabled = useSession((s) => s.setBiometricEnabled);

  const mfa = useQuery({ queryKey: ["mfa-status", tenant], queryFn: getMfaStatus, enabled: tenant !== null, staleTime: 10_000 });
  const sessions = useQuery({
    queryKey: ["sessions", tenant],
    queryFn: async (): Promise<SessionSummary[]> => (await listSessions()).sessions,
    enabled: tenant !== null,
    staleTime: 10_000,
  });

  const revokeOne = useMutation({
    mutationFn: (id: string) => revokeSession(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["sessions", tenant] }),
  });
  const revokeAll = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["sessions", tenant] }),
  });

  const twoFactorValue = mfa.isLoading ? "…" : mfa.data?.enrolled ? "On" : "Off";
  const recoverySub = mfa.data?.enrolled ? `${mfa.data.recoveryCodesRemaining} of your codes remain` : "Set up two-factor first";
  const others = (sessions.data ?? []).filter((s) => !s.current);

  async function onRevokeOne(s: SessionSummary): Promise<void> {
    if (await confirmDestructive("Sign out this device?", `${deviceLabel(s.userAgent)} will be signed out.`)) {
      revokeOne.mutate(s.id);
    }
  }
  async function onRevokeAll(): Promise<void> {
    if (await confirmDestructive("Sign out all other devices?", "Every device except this one will be signed out.")) {
      revokeAll.mutate();
    }
  }

  return (
    <Screen>
      <SubHeader title="Security" />
      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth, paddingTop: 16 }}>
          <SectionLabel style={{ paddingHorizontal: 20, paddingBottom: 8 }}>Two-factor</SectionLabel>
          <SettingsGroup>
            <SettingRow
              icon="shieldCheck"
              title="Authenticator app"
              sub={mfa.data?.enrolled ? "Active" : "Not set up"}
              value={twoFactorValue}
              onPress={() => router.push("/settings/two-factor")}
            />
            <SettingRow icon="key" title="Recovery codes" sub={recoverySub} onPress={() => router.push("/settings/two-factor")} last />
          </SettingsGroup>

          <SectionLabel style={{ paddingHorizontal: 20, paddingBottom: 8 }}>Sign-in</SectionLabel>
          <SettingsGroup>
            <SettingRow
              icon="user"
              title="Biometric unlock"
              sub="Face ID / fingerprint on this device"
              toggle={biometricEnabled}
              onToggle={() => void setBiometricEnabled(!biometricEnabled)}
            />
            <SettingRow icon="lock" title="Change password" onPress={() => router.push("/settings/change-password")} last />
          </SettingsGroup>

          <SectionLabel style={{ paddingHorizontal: 20, paddingBottom: 8 }}>Active sessions</SectionLabel>
          {sessions.isLoading ? (
            <Card style={{ marginHorizontal: 16, padding: 14, gap: 12 }}>
              {[0, 1].map((i) => (
                <Skeleton key={i} width="100%" height={34} />
              ))}
            </Card>
          ) : sessions.isError ? (
            <Card style={{ marginHorizontal: 16, padding: 14, flexDirection: "row", gap: 10, alignItems: "center" }}>
              <Icon name="cloudOff" size={16} color={palette.muted} />
              <Text size={12.5} tone="muted" style={{ flex: 1 }}>
                Couldn't load your sessions. Pull back and retry when you're online.
              </Text>
            </Card>
          ) : (
            <Card style={{ marginHorizontal: 16 }}>
              {(sessions.data ?? []).map((s, i, a) => (
                <View
                  key={s.id}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: i < a.length - 1 ? 1 : 0, borderBottomColor: palette.border }}
                >
                  <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: palette.bgSubtle, alignItems: "center", justifyContent: "center" }}>
                    <Icon name={/app/i.test(deviceLabel(s.userAgent)) ? "smartphone" : "globe"} size={16} color={palette.text} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text size={13.5} weight="semibold">
                      {deviceLabel(s.userAgent)}
                      {s.current ? " · this device" : ""}
                    </Text>
                    <Text size={11.5} tone="muted">
                      {(s.ip ?? "unknown IP") + " · " + ago(s.signedInAt)}
                    </Text>
                  </View>
                  {s.current ? (
                    <StatusPill tone="done" size="sm">
                      Current
                    </StatusPill>
                  ) : (
                    <Pressable onPress={() => void onRevokeOne(s)} hitSlop={8} disabled={revokeOne.isPending}>
                      <Text size={12.5} weight="semibold" style={{ color: palette.dangerFg }}>
                        Revoke
                      </Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </Card>
          )}

          {others.length > 0 && (
            <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
              <Button variant="ghost" tone="danger" icon="logOut" loading={revokeAll.isPending} onPress={() => void onRevokeAll()}>
                Sign out all other devices
              </Button>
            </View>
          )}
          <View style={{ height: 16 }} />
        </View>
      </Body>
    </Screen>
  );
}
