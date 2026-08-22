import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackButton } from "@/features/auth/parts";
import { getRecentWorkspaces, initials, type RecentWorkspace } from "@/features/auth/recent";
import { useLayout } from "@/hooks/use-layout";
import { useTheme } from "@/theme";
import { Avatar, Button, Card, Icon, Mono, Screen, SectionLabel, Text } from "@/ui";

// Design: m-auth.jsx → AuthWorkspace (rule #9). Enter a workspace slug or pick a recent.
export default function Workspace() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette, radius, fonts } = useTheme();
  const { contentMaxWidth } = useLayout();
  const [slug, setSlug] = useState("");
  const [recent, setRecent] = useState<RecentWorkspace[]>([]);

  useEffect(() => {
    void getRecentWorkspaces().then(setRecent);
  }, []);

  function go(target: string) {
    const s = target.trim().toLowerCase();
    if (!s) return;
    router.push({ pathname: "/(auth)/sign-in", params: { tenant: s } });
  }

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: "center" }}>
        <View style={{ flex: 1, width: "100%", maxWidth: contentMaxWidth }}>
          <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 24 }}>
            <BackButton />
          </View>
          <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 20 }}>
            <Text size={26} weight="bold" style={{ letterSpacing: -0.5 }}>
              Find your workspace
            </Text>
            <Text size={14} tone="muted" style={{ marginTop: 6 }}>
              Enter your team's Kaenal address.
            </Text>

            <SectionLabel style={{ marginTop: 26, marginBottom: 8 }}>Workspace URL</SectionLabel>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                height: 52,
                borderWidth: 1.5,
                borderColor: palette.accent,
                borderRadius: radius.md,
                backgroundColor: palette.surface,
                paddingHorizontal: 14,
                shadowColor: palette.accent,
                shadowOpacity: 0.18,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 0 },
              }}
            >
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                value={slug}
                onChangeText={(t) => setSlug(t.replace(/[^a-z0-9-]/gi, "").toLowerCase())}
                placeholder="your-team"
                placeholderTextColor={palette.subtle}
                onSubmitEditing={() => go(slug)}
                style={{ flex: 1, color: palette.text, fontFamily: fonts.mono, fontSize: 16 }}
              />
              <Mono size={16} color={palette.subtle}>
                .kaenal.app
              </Mono>
            </View>

            {recent.length > 0 && (
              <>
                <SectionLabel style={{ marginTop: 26, marginBottom: 10 }}>Recent workspaces</SectionLabel>
                <Card>
                  {recent.map((w, i) => (
                    <Pressable
                      key={w.slug}
                      onPress={() => go(w.slug)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        paddingVertical: 13,
                        paddingHorizontal: 14,
                        borderBottomWidth: i < recent.length - 1 ? 1 : 0,
                        borderBottomColor: palette.border,
                      }}
                    >
                      <Avatar initials={initials(w.name)} tone={i === 0 ? "accent" : "neutral"} />
                      <View style={{ flex: 1 }}>
                        <Text size={14.5} weight="semibold">
                          {w.name}
                        </Text>
                        <Mono size={11.5} tone="muted">
                          {w.slug}.kaenal.app
                        </Mono>
                      </View>
                      <Icon name="chevronRight" size={16} color={palette.subtle} />
                    </Pressable>
                  ))}
                </Card>
              </>
            )}
          </View>

          <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}>
            <Button icon="arrowRight" disabled={!slug.trim()} onPress={() => go(slug)}>
              Continue
            </Button>
          </View>
        </View>
      </View>
    </Screen>
  );
}
