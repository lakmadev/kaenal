import { useSafeBack } from "@/hooks/use-safe-back";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLayout } from "@/hooks/use-layout";
import { services } from "@/services";
import { useSync } from "@/stores/sync";
import { engine } from "@/sync";
import type { MutationRecord, PendingFile } from "@/sync/types";
import { useTheme } from "@/theme";
import { Body, Card, EmptyState, Icon, Mono, Screen, SectionLabel, Skeleton, StatusPill, Text, type IconName } from "@/ui";

const STORAGE_CAP = 500 * 1024 * 1024; // 500 MB budget shown by the gauge

const KIND_META: Record<string, { label: string; icon: IconName }> = {
  "inspection.complete": { label: "Inspection submitted", icon: "clipboard" },
  "ncr.create": { label: "NCR raised", icon: "alert" },
  "ncr.transition": { label: "NCR updated", icon: "alert" },
  "ncr.verify": { label: "NCR verified", icon: "shieldCheck" },
  "eightd.step": { label: "8D step advanced", icon: "gitBranch" },
  "capa.action.status": { label: "CAPA action updated", icon: "tool" },
  "document.review": { label: "Document review", icon: "doc" },
};

function meta(kind: string): { label: string; icon: IconName } {
  return KIND_META[kind] ?? { label: kind, icon: "cloud" };
}

function fmtBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

// m-system.jsx SyncQueue — the real offline queue: pending / inflight / failed /
// needs-review mutations + staged files, with retry / discard and a storage gauge.
export default function SyncQueue() {
  const goBack = useSafeBack("/(app)/home");
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const { contentMaxWidth } = useLayout();
  const sync = useSync((s) => s);

  const [mutations, setMutations] = useState<MutationRecord[] | null>(null);
  const [files, setFiles] = useState<PendingFile[]>([]);

  const refresh = useCallback(async () => {
    const [m, f] = await Promise.all([services.syncStore.listMutations(), services.syncStore.listFiles()]);
    setMutations(m);
    setFiles(f);
  }, []);

  // Re-read whenever the engine changes the pill summary (a push settled, etc.).
  useEffect(() => {
    void refresh();
  }, [refresh, sync.pending, sync.failed, sync.state]);

  const online = sync.state !== "offline";
  const needsReview = (mutations ?? []).filter((m) => m.status === "failed" && (m.error ?? "").startsWith("REVIEW:"));
  const failed = (mutations ?? []).filter((m) => m.status === "failed" && !(m.error ?? "").startsWith("REVIEW:"));
  const active = (mutations ?? []).filter((m) => m.status === "pending" || m.status === "inflight");
  const storageBytes = files.reduce((n, f) => n + f.bytes, 0);

  async function retry(id: string): Promise<void> {
    await engine.retryMutation(id);
    await refresh();
  }
  async function discard(id: string): Promise<void> {
    await engine.discardMutation(id);
    await refresh();
  }

  return (
    <Screen>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 8,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: online ? palette.successBg : palette.warnBg,
        }}
      >
        <Icon name={online ? "cloud" : "cloudOff"} size={15} color={online ? palette.successFg : palette.warnFg} />
        <Text size={12.5} weight="semibold" color={online ? palette.successFg : palette.warnFg} style={{ flex: 1 }}>
          {online ? "Online — syncing automatically" : "Offline — your work is saved on this device"}
        </Text>
        <Pressable onPress={goBack} hitSlop={8}>
          <Icon name="x" size={18} color={online ? palette.successFg : palette.warnFg} />
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <SectionLabel style={{ marginBottom: 4 }}>Sync queue</SectionLabel>
        <Text size={22} weight="bold" style={{ letterSpacing: -0.4 }}>
          {mutations === null ? "…" : `${active.length} pending · ${needsReview.length} needs review`}
        </Text>
        <Text size={12.5} tone="muted" style={{ marginTop: 3 }}>
          {sync.lastSyncedAt ? `Last sync ${new Date(sync.lastSyncedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })}` : "Uploads automatically when you reconnect"}
        </Text>
      </View>

      <Body contentStyle={{ alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth }}>
          {mutations === null ? (
            <View style={{ padding: 16, gap: 10 }}>
              <Skeleton width="100%" height={80} />
              <Skeleton width="100%" height={120} />
            </View>
          ) : (
            <>
              {needsReview.map((m) => (
                <ConflictCard key={m.id} mutation={m} onKeepServer={() => void discard(m.id)} onRetry={() => void retry(m.id)} />
              ))}

              {active.length + failed.length === 0 && needsReview.length === 0 ? (
                <EmptyState icon="cloud" title="Nothing waiting to upload" body="Completed work syncs automatically. When you go offline, items queue here." />
              ) : (
                <>
                  <SectionLabel style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>Queue</SectionLabel>
                  <Card style={{ marginHorizontal: 16 }}>
                    {[...active, ...failed].map((m, i, a) => (
                      <QueueRow key={m.id} mutation={m} last={i === a.length - 1} onRetry={() => void retry(m.id)} />
                    ))}
                  </Card>
                </>
              )}

              <Card style={{ margin: 16, padding: 14 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text size={12} weight="semibold" tone="muted">
                    Local storage
                  </Text>
                  <Text size={12} tone="muted">
                    <Text size={12} weight="bold">
                      {fmtBytes(storageBytes)}
                    </Text>{" "}
                    / 500 MB
                  </Text>
                </View>
                <View style={{ height: 6, borderRadius: 999, backgroundColor: palette.bgSubtle, overflow: "hidden" }}>
                  <View style={{ width: `${Math.min(100, (storageBytes / STORAGE_CAP) * 100)}%`, height: "100%", backgroundColor: palette.accent }} />
                </View>
              </Card>
            </>
          )}
        </View>
      </Body>
    </Screen>
  );
}

function ConflictCard({ mutation, onKeepServer, onRetry }: { mutation: MutationRecord; onKeepServer: () => void; onRetry: () => void }) {
  const { palette, radius } = useTheme();
  const reason = (mutation.error ?? "").replace(/^REVIEW:/, "");
  return (
    <Card style={{ margin: 16, marginBottom: 0, padding: 14, borderColor: palette.warn, borderWidth: 1.5 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Icon name="alert" size={16} color={palette.warnFg} />
        <Text size={13} weight="bold">
          Conflict — needs review
        </Text>
        <View style={{ flex: 1 }} />
        <Mono size={10.5} color={palette.muted}>
          {meta(mutation.kind).label}
        </Mono>
      </View>
      <Text size={12.5} tone="muted" style={{ lineHeight: 18, marginBottom: 12 }}>
        {reason || "This record changed on the server while you were offline."}
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable onPress={onKeepServer} style={{ flex: 1 }}>
          <View style={{ height: 38, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, alignItems: "center", justifyContent: "center" }}>
            <Text size={12.5} weight="semibold">
              Keep server
            </Text>
          </View>
        </Pressable>
        <Pressable onPress={onRetry} style={{ flex: 1 }}>
          <View style={{ height: 38, borderRadius: radius.lg, backgroundColor: palette.accent, alignItems: "center", justifyContent: "center" }}>
            <Text size={12.5} weight="bold" color={palette.accentFg}>
              Retry mine
            </Text>
          </View>
        </Pressable>
      </View>
    </Card>
  );
}

function QueueRow({ mutation, last, onRetry }: { mutation: MutationRecord; last: boolean; onRetry: () => void }) {
  const { palette } = useTheme();
  const m = meta(mutation.kind);
  const isFailed = mutation.status === "failed";
  const isInflight = mutation.status === "inflight";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: palette.border }}>
      <View style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: palette.bgSubtle, alignItems: "center", justifyContent: "center" }}>
        <Icon name={m.icon} size={18} color={palette.muted} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={13} weight="semibold" numberOfLines={1}>
          {m.label}
        </Text>
        <Text size={11} tone="muted" numberOfLines={1}>
          {isFailed ? (mutation.error ?? "Failed") : mutation.dependsOnFileIds.length > 0 ? `${mutation.dependsOnFileIds.length} file(s) attached` : "Queued"}
        </Text>
      </View>
      {isInflight ? (
        <Icon name="refresh" size={16} color={palette.info} />
      ) : isFailed ? (
        <Pressable onPress={onRetry} hitSlop={6}>
          <StatusPill tone="danger" size="sm">
            Retry
          </StatusPill>
        </Pressable>
      ) : (
        <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: palette.border }} />
      )}
    </View>
  );
}
