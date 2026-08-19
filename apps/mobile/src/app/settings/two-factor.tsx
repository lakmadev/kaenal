import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";

import { OtpInput } from "@/features/auth/parts";
import { SubHeader } from "@/features/settings/parts";
import { useLayout } from "@/hooks/use-layout";
import {
  activateMfa,
  disableMfa,
  enrollMfa,
  getMfaStatus,
  regenerateRecoveryCodes,
  type AccountApiError,
  type MfaStatus,
} from "@/lib/account-api";
import { useSession } from "@/stores/session";
import { useTheme } from "@/theme";
import { Body, Button, Card, EmptyState, Icon, Mono, Screen, SectionLabel, Skeleton, Text } from "@/ui";

type Mode =
  | { k: "loading" }
  | { k: "error" }
  | { k: "status" }
  | { k: "enroll"; qr: string; secret: string; code: string; err: string | null; busy: boolean }
  | { k: "codes"; codes: string[]; heading: string }
  | { k: "prompt"; action: "disable" | "regenerate"; code: string; err: string | null; busy: boolean };

function secretFromOtpauth(uri: string): string {
  const m = /[?&]secret=([^&]+)/i.exec(uri);
  return m?.[1] ?? "";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

// Two-factor (07 §4) — real /v1/auth/mfa/*: status, enrol (scan QR → verify code →
// recovery codes), disable, regenerate recovery codes. No stubs.
export default function TwoFactor() {
  const router = useRouter();
  const { palette, radius } = useTheme();
  const { contentMaxWidth } = useLayout();
  const tenant = useSession((s) => s.tenant);
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [mode, setMode] = useState<Mode>({ k: "loading" });

  const refresh = useCallback(async () => {
    setMode({ k: "loading" });
    try {
      const s = await getMfaStatus();
      setStatus(s);
      setMode({ k: "status" });
    } catch {
      // A failed status fetch must not leave a blank screen (05 §4 offline).
      setMode({ k: "error" });
    }
  }, []);

  // Wait for the session to hydrate before the first fetch (avoids a 401 race).
  useEffect(() => {
    if (tenant !== null) void refresh();
  }, [tenant, refresh]);

  async function beginEnroll(): Promise<void> {
    setMode({ k: "loading" });
    try {
      const { qrDataUri, otpauthUri } = await enrollMfa();
      setMode({ k: "enroll", qr: qrDataUri, secret: secretFromOtpauth(otpauthUri), code: "", err: null, busy: false });
    } catch (e) {
      setMode({ k: "status" });
      // Surface via a fresh status fetch; enrol errors are rare (already enrolled).
      void refresh();
      void e;
    }
  }

  async function confirmActivate(m: Extract<Mode, { k: "enroll" }>): Promise<void> {
    if (m.code.length < 6) return;
    setMode({ ...m, busy: true, err: null });
    try {
      const { recoveryCodes } = await activateMfa(m.code);
      setMode({ k: "codes", codes: recoveryCodes, heading: "Two-factor is on" });
      void getMfaStatus().then(setStatus);
    } catch (e) {
      setMode({ ...m, busy: false, err: (e as AccountApiError).message || "That code didn't match." });
    }
  }

  async function confirmPrompt(m: Extract<Mode, { k: "prompt" }>): Promise<void> {
    if (m.code.length < 6) return;
    setMode({ ...m, busy: true, err: null });
    try {
      if (m.action === "disable") {
        await disableMfa(m.code);
        await refresh();
      } else {
        const { recoveryCodes } = await regenerateRecoveryCodes(m.code);
        setMode({ k: "codes", codes: recoveryCodes, heading: "New recovery codes" });
        void getMfaStatus().then(setStatus);
      }
    } catch (e) {
      setMode({ ...m, busy: false, err: (e as AccountApiError).message || "That code didn't match." });
    }
  }

  return (
    <Screen>
      <SubHeader title="Two-factor" onBack={() => router.back()} />
      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth, padding: 16, gap: 14 }}>
          {mode.k === "loading" && (
            <Card style={{ padding: 16, gap: 12 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} width="100%" height={30} />
              ))}
            </Card>
          )}

          {mode.k === "error" && (
            <View style={{ gap: 12 }}>
              <EmptyState icon="cloudOff" title="Couldn't load two-factor" body="You may be offline. It returns when you reconnect." />
              <Button variant="ghost" icon="refresh" onPress={() => void refresh()}>
                Try again
              </Button>
            </View>
          )}

          {mode.k === "status" && status && !status.enrolled && (
            <>
              <View style={{ alignItems: "center", gap: 10, paddingVertical: 8 }}>
                <View style={{ width: 60, height: 60, borderRadius: radius["2xl"], backgroundColor: palette.accentSoft, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="shieldCheck" size={28} color={palette.accent} />
                </View>
                <Text size={16} weight="bold">
                  Add an extra layer
                </Text>
                <Text size={13} tone="muted" style={{ textAlign: "center", maxWidth: 280, lineHeight: 19 }}>
                  Protect your account with a code from an authenticator app (Google Authenticator, 1Password, Authy).
                </Text>
              </View>
              <Button icon="shieldCheck" onPress={() => void beginEnroll()}>
                Set up authenticator
              </Button>
            </>
          )}

          {mode.k === "status" && status?.enrolled && (
            <>
              <Card style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: radius.lg, backgroundColor: palette.successBg, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="shieldCheck" size={20} color={palette.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text size={14.5} weight="bold">
                    Authenticator app
                  </Text>
                  <Text size={12} tone="muted">
                    Active{status.enrolledAt ? ` · added ${fmtDate(status.enrolledAt)}` : ""}
                  </Text>
                </View>
              </Card>

              <SectionLabel style={{ paddingHorizontal: 4 }}>Recovery codes</SectionLabel>
              <Card style={{ padding: 14, gap: 6 }}>
                <Text size={13.5}>
                  <Text size={13.5} weight="bold">
                    {status.recoveryCodesRemaining}
                  </Text>{" "}
                  of your one-time recovery codes remain.
                </Text>
                <Text size={12} tone="muted" style={{ lineHeight: 17 }}>
                  Use these if you lose your authenticator. Regenerating invalidates the old set.
                </Text>
                <View style={{ height: 4 }} />
                <Button variant="ghost" icon="refresh" onPress={() => setMode({ k: "prompt", action: "regenerate", code: "", err: null, busy: false })}>
                  Regenerate recovery codes
                </Button>
              </Card>

              <Button variant="ghost" tone="danger" icon="lock" onPress={() => setMode({ k: "prompt", action: "disable", code: "", err: null, busy: false })}>
                Turn off two-factor
              </Button>
            </>
          )}

          {mode.k === "enroll" && (
            <>
              <Text size={13.5} tone="muted" style={{ lineHeight: 20 }}>
                1. Scan this with your authenticator app, then enter the 6-digit code it shows.
              </Text>
              <Card style={{ padding: 18, alignItems: "center", gap: 14 }}>
                <View style={{ backgroundColor: "#ffffff", padding: 10, borderRadius: radius.md }}>
                  <Image source={{ uri: mode.qr }} style={{ width: 180, height: 180 }} />
                </View>
                <Pressable
                  onPress={() => void Clipboard.setStringAsync(mode.secret)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Mono size={12.5} color={palette.muted}>
                    {mode.secret}
                  </Mono>
                  <Icon name="copy" size={13} color={palette.subtle} />
                </Pressable>
              </Card>
              <View style={{ alignItems: "center", gap: 10, paddingTop: 4 }}>
                <OtpInput value={mode.code} onChange={(c) => setMode({ ...mode, code: c })} state={mode.err ? "error" : "idle"} />
                {mode.err && (
                  <Text size={12.5} style={{ color: palette.dangerFg }}>
                    {mode.err}
                  </Text>
                )}
              </View>
              <Button loading={mode.busy} disabled={mode.code.length < 6} onPress={() => void confirmActivate(mode)}>
                Verify &amp; turn on
              </Button>
            </>
          )}

          {mode.k === "prompt" && (
            <>
              <Text size={15} weight="bold">
                {mode.action === "disable" ? "Turn off two-factor" : "Regenerate recovery codes"}
              </Text>
              <Text size={13} tone="muted" style={{ lineHeight: 19 }}>
                Enter a current 6-digit code from your authenticator to confirm.
              </Text>
              <View style={{ alignItems: "center", gap: 10, paddingVertical: 6 }}>
                <OtpInput value={mode.code} onChange={(c) => setMode({ ...mode, code: c })} state={mode.err ? "error" : "idle"} />
                {mode.err && (
                  <Text size={12.5} style={{ color: palette.dangerFg }}>
                    {mode.err}
                  </Text>
                )}
              </View>
              <Button
                variant={mode.action === "disable" ? "danger" : "primary"}
                loading={mode.busy}
                disabled={mode.code.length < 6}
                onPress={() => void confirmPrompt(mode)}
              >
                {mode.action === "disable" ? "Turn off" : "Regenerate"}
              </Button>
              <Button variant="ghost" onPress={() => setMode({ k: "status" })}>
                Cancel
              </Button>
            </>
          )}

          {mode.k === "codes" && (
            <>
              <View style={{ alignItems: "center", gap: 8, paddingVertical: 4 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: palette.successBg, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="check" size={28} stroke={2.2} color={palette.success} />
                </View>
                <Text size={17} weight="bold">
                  {mode.heading}
                </Text>
                <Text size={13} tone="muted" style={{ textAlign: "center", maxWidth: 280, lineHeight: 19 }}>
                  Save these one-time recovery codes somewhere safe. Each works once if you lose your authenticator.
                </Text>
              </View>
              <Card style={{ padding: 16 }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {mode.codes.map((c) => (
                    <View key={c} style={{ width: "50%", paddingVertical: 5 }}>
                      <Mono size={13}>{c}</Mono>
                    </View>
                  ))}
                </View>
              </Card>
              <Button icon="copy" variant="ghost" onPress={() => void Clipboard.setStringAsync(mode.codes.join("\n"))}>
                Copy all codes
              </Button>
              <Button onPress={() => void refresh()}>Done</Button>
            </>
          )}
        </View>
      </Body>
    </Screen>
  );
}
