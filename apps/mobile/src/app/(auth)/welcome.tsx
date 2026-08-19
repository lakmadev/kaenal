import { useRouter } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Wordmark } from "@/features/auth/parts";
import { useLayout } from "@/hooks/use-layout";
import { Button, Screen, Text } from "@/ui";

// Design: project_brain/mobile/src/m-auth.jsx → AuthWelcome (rule #9).
export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { contentMaxWidth } = useLayout();

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: "center", paddingTop: insets.top }}>
        <View style={{ flex: 1, width: "100%", maxWidth: contentMaxWidth, paddingHorizontal: 28, justifyContent: "center" }}>
          <Wordmark size={26} />
          <Text size={30} weight="bold" style={{ letterSpacing: -0.9, lineHeight: 34, marginTop: 28 }}>
            Quality that{"\n"}moves with you.
          </Text>
          <Text size={15} tone="muted" style={{ marginTop: 14, lineHeight: 23, maxWidth: 300 }}>
            Run inspections, flag non-conformities, and stay in sync — on the floor, online or off.
          </Text>
        </View>
        <View style={{ width: "100%", maxWidth: contentMaxWidth, paddingHorizontal: 24, paddingBottom: insets.bottom + 24, gap: 10 }}>
          <Button onPress={() => router.push("/(auth)/workspace")}>Get started</Button>
          <Button variant="ghost" onPress={() => router.push("/(auth)/invite")}>
            I have an invite link
          </Button>
          <Text size={12} tone="subtle" style={{ textAlign: "center", marginTop: 6 }}>
            v2.4.0 · Kaenal QMS
          </Text>
        </View>
      </View>
    </Screen>
  );
}
