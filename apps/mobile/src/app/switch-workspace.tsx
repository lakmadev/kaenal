import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { WorkspaceDto } from "@kaenal/types";

import { confirmIfUnsynced } from "@/features/auth/guard";
import { initials } from "@/features/auth/recent";
import { apiClient } from "@/lib/api";
import { useSession } from "@/stores/session";
import { useSync } from "@/stores/sync";
import { useTheme } from "@/theme";
import { Avatar, Button, Icon, Text } from "@/ui";

// Design: m-auth-extra.jsx → WorkspaceSwitcher (rule #9). A bottom sheet listing the
// caller's memberships (GET /v1/me/workspaces); tapping one calls switch-workspace.
export default function SwitchWorkspace() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();

  const switchWorkspace = useSession((s) => s.switchWorkspace);
  const signOut = useSession((s) => s.signOut);
  const pending = useSync((s) => s.pending);
  const failed = useSync((s) => s.failed);
  const unsynced = pending + failed;

  const [items, setItems] = useState<WorkspaceDto[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await apiClient.myWorkspaces();
      if (res.status === 200) setItems(res.body.items);
      else setError("Couldn't load your workspaces.");
    })();
  }, []);

  async function pick(ws: WorkspaceDto) {
    if (ws.active || busy) return;
    if (!(await confirmIfUnsynced("switch workspace"))) return;
    setBusy(ws.tenantSlug);
    setError(null);
    try {
      await switchWorkspace(ws.tenantSlug);
      router.back();
    } catch {
      setError(`Couldn't switch to ${ws.tenantName}.`);
      setBusy(null);
    }
  }

  async function addAnother() {
    // Single-session model: joining another workspace is a fresh sign-in, so this
    // signs out (guarded) and returns to the picker. Multi-account (staying signed
    // into several at once) is a future enhancement — see progress_mobile.md.
    if (!(await confirmIfUnsynced("switch workspace"))) return;
    await signOut();
    router.replace("/(auth)/workspace");
  }

  return (
    <View style={{ flex: 1, justifyContent: "flex-end" }}>
      {/* Dim backdrop — tap to dismiss. */}
      <Pressable style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.35)" }} onPress={() => router.back()} />
      <View
        style={{
          backgroundColor: palette.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: insets.bottom + 16,
        }}
      >
        <View style={{ width: 40, height: 5, borderRadius: 999, backgroundColor: palette.borderStrong, alignSelf: "center", marginBottom: 14 }} />
        <Text size={17} weight="bold">
          Switch workspace
        </Text>
        <Text size={12.5} tone="muted" style={{ marginTop: 2, marginBottom: 8 }}>
          {items ? `You belong to ${items.length} Kaenal workspace${items.length === 1 ? "" : "s"}` : "Loading…"}
        </Text>

        {items === null && !error ? (
          <ActivityIndicator color={palette.accent} style={{ paddingVertical: 24 }} />
        ) : (
          items?.map((w, i, a) => (
            <Pressable
              key={w.tenantSlug}
              onPress={() => pick(w)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
                paddingHorizontal: 8,
                borderBottomWidth: i < a.length - 1 ? 1 : 0,
                borderBottomColor: palette.border,
                opacity: busy && busy !== w.tenantSlug ? 0.5 : 1,
              }}
            >
              <Avatar initials={initials(w.tenantName)} size={40} tone={w.active ? "accent" : "neutral"} />
              <View style={{ flex: 1 }}>
                <Text size={14.5} weight="semibold">
                  {w.tenantName}
                </Text>
                <Text size={11.5} tone="muted" style={{ textTransform: "capitalize" }}>
                  {w.role}
                </Text>
              </View>
              {busy === w.tenantSlug ? (
                <ActivityIndicator color={palette.accent} />
              ) : w.active ? (
                <Icon name="check" size={18} stroke={2.4} color={palette.accent} />
              ) : (
                <Icon name="chevronRight" size={16} color={palette.subtle} />
              )}
            </Pressable>
          ))
        )}

        {unsynced > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 14 }}>
            <Icon name="alert" size={13} color={palette.warnFg} />
            <Text size={11.5} style={{ color: palette.warnFg }}>
              {unsynced} item{unsynced === 1 ? "" : "s"} must sync before switching
            </Text>
          </View>
        )}
        {error && (
          <Text size={12.5} style={{ color: palette.dangerFg, marginTop: 12 }}>
            {error}
          </Text>
        )}

        <Button variant="ghost" icon="plus" onPress={addAnother} style={{ marginTop: 14 }}>
          Add another workspace
        </Button>
      </View>
    </View>
  );
}
