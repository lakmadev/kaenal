import { useLocalSearchParams, useRouter } from "expo-router";
import { Linking, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLayout } from "@/hooks/use-layout";
import { useTheme } from "@/theme";
import { Button, Icon, Screen, Text } from "@/ui";

// Design: m-auth-extra.jsx → AuthResetSent (rule #9).
export default function ResetSent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const { contentMaxWidth } = useLayout();
  const { email } = useLocalSearchParams<{ email?: string }>();

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: "center" }}>
        <View style={{ flex: 1, width: "100%", maxWidth: contentMaxWidth }}>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: palette.accentSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="mail" size={38} stroke={1.6} color={palette.accent} />
            </View>
            <Text size={21} weight="bold" style={{ letterSpacing: -0.4 }}>
              Check your email
            </Text>
            <Text size={14} tone="muted" style={{ textAlign: "center", lineHeight: 22, maxWidth: 280 }}>
              We sent a reset link to <Text size={14} weight="semibold">{email ?? "your address"}</Text>. It expires in 30 minutes.
            </Text>
          </View>
          <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24, gap: 10 }}>
            <Button onPress={() => void Linking.openURL("mailto:")}>Open mail app</Button>
            <Button variant="ghost" onPress={() => router.replace("/(auth)/welcome")}>
              Back to start
            </Button>
          </View>
        </View>
      </View>
    </Screen>
  );
}
