import { Redirect, useRouter } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLayout } from "@/hooks/use-layout";
import { useSession } from "@/stores/session";
import { useTheme } from "@/theme";
import { Button, Card, Icon, Screen, Text, type IconName } from "@/ui";

const PERMS: { icon: IconName; title: string; desc: string }[] = [
  { icon: "camera", title: "Camera", desc: "Photograph defects and scan asset QR codes while you inspect." },
  { icon: "mapPin", title: "Location", desc: "Auto-stamp the plant, line and station on every capture." },
  { icon: "bell", title: "Notifications", desc: "Get pinged when work is assigned or a sync fails." },
];

// Design: m-auth.jsx → AuthPriming (rule #9). Education BEFORE the OS prompts; the
// real permission requests fire when Capture/Location/Notifications features run.
export default function Priming() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette, radius } = useTheme();
  const { contentMaxWidth } = useLayout();
  const status = useSession((s) => s.status);
  const primed = useSession((s) => s.primed);
  const markPrimed = useSession((s) => s.markPrimed);

  // Only meaningful for an authenticated, not-yet-primed session; otherwise send
  // the user where they belong (guards this top-level, group-less route).
  if (status !== "authenticated") return <Redirect href="/(auth)/welcome" />;
  if (primed) return <Redirect href="/(app)/home" />;

  async function done() {
    await markPrimed();
    router.replace("/(app)/home");
  }

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: "center" }}>
        <View style={{ flex: 1, width: "100%", maxWidth: contentMaxWidth }}>
          <View style={{ height: insets.top + 24 }} />
          <View style={{ flex: 1, paddingHorizontal: 24 }}>
            <Text size={25} weight="bold" style={{ letterSpacing: -0.5, lineHeight: 29 }}>
              A few permissions to work hands-free
            </Text>
            <Text size={14} tone="muted" style={{ marginTop: 8 }}>
              Here's why Kaenal asks. You'll confirm each on the next screen.
            </Text>
            <View style={{ gap: 12, marginTop: 26 }}>
              {PERMS.map((p) => (
                <Card key={p.title} style={{ padding: 16, flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: radius.md,
                      backgroundColor: palette.accentSoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name={p.icon} size={20} color={palette.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text size={15} weight="bold">
                      {p.title}
                    </Text>
                    <Text size={12.5} tone="muted" style={{ marginTop: 3, lineHeight: 19 }}>
                      {p.desc}
                    </Text>
                  </View>
                </Card>
              ))}
            </View>
          </View>
          <View style={{ paddingHorizontal: 24, paddingTop: 18, paddingBottom: insets.bottom + 24, gap: 10 }}>
            <Button onPress={done}>Continue</Button>
            <Text size={13} tone="muted" style={{ textAlign: "center" }}>
              You can change these anytime in Settings.
            </Text>
          </View>
        </View>
      </View>
    </Screen>
  );
}
