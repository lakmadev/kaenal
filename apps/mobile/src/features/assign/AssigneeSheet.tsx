import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import type { MemberWorkloadDto } from "@kaenal/types";

import { apiClient } from "@/lib/api";
import { useSession } from "@/stores/session";
import { useTheme } from "@/theme";
import { Avatar, Button, Icon, Mono, Skeleton, Text } from "@/ui";

async function fetchWorkload(): Promise<MemberWorkloadDto[]> {
  const res = await apiClient.listMemberWorkload();
  if (res.status !== 200) throw new Error("Could not load teammates.");
  return res.body.items;
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

const BAND_LABEL: Record<MemberWorkloadDto["band"], string> = { light: "Light", steady: "Steady", busy: "Busy" };

// m-oversight.jsx AssignSheet — the assign/reassign bottom sheet. Teammate search
// over /v1/members/workload (live open-NCR load), select a row, "Assign to X".
// Reusable across NCR / inspection / 8D / CAPA / SCAR — the caller supplies the
// title + current owner + an onPick that runs the module's assign mutation.
export function AssigneeSheet({
  visible,
  onClose,
  title,
  code,
  currentOwnerId,
  onPick,
  allowUnassign = true,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  code?: string;
  currentOwnerId: string | null;
  onPick: (userId: string | null) => Promise<void> | void;
  allowUnassign?: boolean;
}) {
  const { palette, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const tenant = useSession((s) => s.tenant);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(currentOwnerId);
  const [busy, setBusy] = useState(false);

  const { data: members, isLoading } = useQuery({
    queryKey: ["member-workload", tenant],
    queryFn: fetchWorkload,
    enabled: visible && tenant !== null,
    staleTime: 30_000,
  });

  const bandColor: Record<MemberWorkloadDto["band"], string> = {
    light: palette.success,
    steady: palette.warnFg,
    busy: palette.dangerFg,
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = members ?? [];
    if (q === "") return all;
    return all.filter((m) => m.name.toLowerCase().includes(q) || m.role.toLowerCase().includes(q));
  }, [members, query]);

  const pickedMember = (members ?? []).find((m) => m.userId === picked) ?? null;

  async function confirm(): Promise<void> {
    setBusy(true);
    try {
      await onPick(picked);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }} onPress={onClose} />
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: "82%",
          backgroundColor: palette.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: Math.max(insets.bottom, 16) + 8,
        }}
      >
        <View style={{ width: 40, height: 5, borderRadius: 999, backgroundColor: palette.borderStrong, alignSelf: "center", marginBottom: 14 }} />
        <Text size={17} weight="bold">
          {title}
        </Text>
        {code ? (
          <Mono size={11.5} color={palette.muted}>
            {code}
          </Mono>
        ) : null}

        {/* Search */}
        <View style={{ marginTop: 14, marginBottom: 4, height: 42, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.bg, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 }}>
          <Icon name="search" size={16} color={palette.subtle} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search teammates…"
            placeholderTextColor={palette.subtle}
            style={{ flex: 1, fontSize: 13.5, color: palette.text }}
          />
        </View>

        <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled">
          {isLoading ? (
            <View style={{ paddingVertical: 12, gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} width="100%" height={44} />
              ))}
            </View>
          ) : filtered.length === 0 ? (
            <Text size={13} tone="muted" style={{ paddingVertical: 20, textAlign: "center" }}>
              No teammates match.
            </Text>
          ) : (
            filtered.map((m, i, a) => {
              const on = picked === m.userId;
              return (
                <Pressable
                  key={m.userId}
                  onPress={() => setPicked(m.userId)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 8, borderBottomWidth: i < a.length - 1 ? 1 : 0, borderBottomColor: palette.border }}
                >
                  <Avatar initials={initials(m.name)} size={36} tone={on ? "accent" : "neutral"} />
                  <View style={{ flex: 1 }}>
                    <Text size={14} weight="semibold">
                      {m.name}
                    </Text>
                    <Text size={11.5} tone="muted" style={{ textTransform: "capitalize" }}>
                      {m.role} · {m.openNcrs} open
                    </Text>
                  </View>
                  <Text size={11} weight="semibold" color={bandColor[m.band]}>
                    {BAND_LABEL[m.band]}
                  </Text>
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: on ? palette.accent : palette.borderStrong, backgroundColor: on ? palette.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
                    {on && <Icon name="check" size={13} stroke={3} color={palette.accentFg} />}
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>

        <Button style={{ marginTop: 14 }} loading={busy} disabled={picked === currentOwnerId} onPress={() => void confirm()}>
          {picked ? `Assign to ${pickedMember?.name ?? "teammate"}` : "Assign"}
        </Button>
        {allowUnassign && currentOwnerId !== null && (
          <Button
            variant="ghost"
            tone="danger"
            style={{ marginTop: 6 }}
            disabled={busy}
            onPress={() => void Promise.resolve(onPick(null)).then(onClose)}
          >
            Unassign
          </Button>
        )}
      </View>
    </Modal>
  );
}
