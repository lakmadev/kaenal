import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchNcrComments, postNcrComment } from "@/features/ncr/api";
import { SubHeader } from "@/features/settings/parts";
import { useLayout } from "@/hooks/use-layout";
import { useSession } from "@/stores/session";
import { useTheme } from "@/theme";
import { Body, Card, EmptyState, Icon, Screen, Skeleton, Text } from "@/ui";

/** Relative "just now / 5m / 3h / 2d" from an ISO timestamp. */
function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

// A record's discussion thread — the real Comment destination for the NCR
// detail's Comment button (was a dead alert). Backed by /v1/comments
// (list + create), author names resolved server-side.
export default function NcrComments() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { palette, radius, fonts } = useTheme();
  const { contentMaxWidth } = useLayout();
  const tenant = useSession((s) => s.tenant);
  const me = useSession((s) => s.me);
  const [draft, setDraft] = useState("");

  const key = ["ncr-comments", tenant, id];
  const { data: comments, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => fetchNcrComments(id ?? ""),
    enabled: tenant !== null && (id ?? "") !== "",
  });

  const post = useMutation({
    mutationFn: (body: string) => postNcrComment(id ?? "", body),
    onSuccess: () => {
      setDraft("");
      void qc.invalidateQueries({ queryKey: key });
    },
  });

  function send(): void {
    const body = draft.trim();
    if (body.length === 0 || post.isPending) return;
    post.mutate(body);
  }

  return (
    <Screen>
      <SubHeader title="Comments" onBack={() => (router.canGoBack() ? router.back() : router.replace(`/ncr/${id}`))} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Body contentStyle={{ alignItems: "center" }}>
          <View style={{ width: "100%", maxWidth: contentMaxWidth, padding: 16, gap: 10 }}>
            {isLoading ? (
              [0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={54} />)
            ) : comments && comments.length > 0 ? (
              comments.map((c) => {
                const mine = c.authorId === me?.userId;
                const name = mine ? "You" : (c.authorName ?? "Member");
                return (
                  <Card key={c.id} style={{ padding: 12, flexDirection: "row", gap: 10 }}>
                    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: palette.accentSoft, alignItems: "center", justifyContent: "center" }}>
                      <Text size={11} weight="bold" color={palette.accent}>
                        {initials(name === "You" ? (me?.name ?? "You") : name)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <Text size={12.5} weight="bold">
                          {name}
                        </Text>
                        <Text size={11} tone="subtle">
                          {ago(c.createdAt)}
                        </Text>
                      </View>
                      <Text size={13.5} style={{ lineHeight: 19 }}>
                        {c.body}
                      </Text>
                    </View>
                  </Card>
                );
              })
            ) : (
              <View style={{ paddingTop: 40 }}>
                <EmptyState icon="chat" title="No comments yet" body="Start the discussion on this non-conformity." />
              </View>
            )}
          </View>
        </Body>

        {/* Compose bar */}
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.surface }}>
          <View style={{ flex: 1, backgroundColor: palette.bgSubtle, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 6 }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Write a comment…"
              placeholderTextColor={palette.subtle}
              multiline
              style={{ fontSize: 14, color: palette.text, fontFamily: fonts.sans, maxHeight: 120, minHeight: 24 }}
            />
          </View>
          <Pressable
            onPress={send}
            disabled={draft.trim().length === 0 || post.isPending}
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: draft.trim().length === 0 ? palette.bgSubtle : palette.accent }}
          >
            <Icon name="send" size={18} color={draft.trim().length === 0 ? palette.subtle : palette.accentFg} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
