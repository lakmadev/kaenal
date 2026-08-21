import { useSafeBack } from "@/hooks/use-safe-back";
import { useState } from "react";
import { Platform, View } from "react-native";

import { AuthField, PasswordStrength, passwordIsStrong } from "@/features/auth/parts";
import { SubHeader } from "@/features/settings/parts";
import { useLayout } from "@/hooks/use-layout";
import { changePassword, type AccountApiError } from "@/lib/account-api";
import { useTheme } from "@/theme";
import { ActionBar, Body, Button, Icon, Screen, Text } from "@/ui";

// Change password (07 §2) — real POST /v1/auth/change-password. On success the
// server keeps THIS session and revokes every other device; we surface that.
export default function ChangePassword() {
  const goBack = useSafeBack("/(app)/me");
  const { palette } = useTheme();
  const { contentMaxWidth } = useLayout();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit = current.length > 0 && passwordIsStrong(next) && next === confirm && !busy;

  async function submit(): Promise<void> {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await changePassword(current, next);
      setDone(true);
      setTimeout(goBack, 1400);
    } catch (e) {
      const err = e as AccountApiError;
      setError(
        err.code === "VALIDATION_FAILED" || err.status === 401 || err.status === 403
          ? "Your current password isn't correct."
          : err.message,
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Screen>
        <SubHeader title="Change password" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 14 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: palette.successBg, alignItems: "center", justifyContent: "center" }}>
            <Icon name="check" size={32} stroke={2.2} color={palette.success} />
          </View>
          <Text size={18} weight="bold">
            Password changed
          </Text>
          <Text size={13.5} tone="muted" style={{ textAlign: "center", maxWidth: 260, lineHeight: 20 }}>
            Your other devices have been signed out. This device stays signed in.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <SubHeader title="Change password" />
      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth, padding: 16 }}>
          <AuthField
            label="Current password"
            secure
            value={current}
            onChangeText={setCurrent}
            placeholder="Current password"
            textContentType="password"
            autoCapitalize="none"
          />
          <AuthField
            label="New password"
            secure
            value={next}
            onChangeText={setNext}
            placeholder="Create a strong password"
            textContentType={Platform.OS === "ios" ? "newPassword" : "password"}
            autoCapitalize="none"
          />
          {next.length > 0 && <PasswordStrength password={next} />}
          <View style={{ height: 12 }} />
          <AuthField
            label="Confirm new password"
            secure
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Re-enter new password"
            highlight={mismatch}
            autoCapitalize="none"
          />
          {mismatch && (
            <Text size={12.5} style={{ color: palette.dangerFg, marginTop: -8 }}>
              Passwords don't match.
            </Text>
          )}
          {error && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 6 }}>
              <Icon name="alert" size={14} color={palette.dangerFg} />
              <Text size={13} style={{ color: palette.dangerFg, flex: 1 }}>
                {error}
              </Text>
            </View>
          )}
        </View>
      </Body>
      <ActionBar>
        <Button style={{ flex: 1 }} loading={busy} disabled={!canSubmit} onPress={() => void submit()}>
          Update password
        </Button>
      </ActionBar>
    </Screen>
  );
}
