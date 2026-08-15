import { Alert, Platform } from "react-native";

import { useSync } from "@/stores/sync";

/**
 * Confirm a destructive session change (sign-out / workspace switch) when unsynced
 * mutations exist (05 §2.4, §4: "block with 'N items not synced' — sync or discard").
 * Resolves true if the caller should proceed. On web (no native Alert modal) we use
 * window.confirm; on device, Alert.
 */
export function confirmIfUnsynced(action: "sign out" | "switch workspace"): Promise<boolean> {
  const { pending, failed } = useSync.getState();
  const unsynced = pending + failed;
  if (unsynced === 0) return Promise.resolve(true);

  const title = `${unsynced} item${unsynced === 1 ? "" : "s"} not synced`;
  const message = `If you ${action} now, changes saved on this device that haven't reached the server will be lost. Sync first, or continue anyway?`;

  if (Platform.OS === "web") {
    const ok = typeof globalThis.confirm === "function" ? globalThis.confirm(`${title}\n\n${message}`) : true;
    return Promise.resolve(ok);
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Keep syncing", style: "cancel", onPress: () => resolve(false) },
      { text: `Continue anyway`, style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}
