import { useLocalSearchParams, useRouter } from "expo-router";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useInspection } from "@/features/inspections/queries";
import { useLayout } from "@/hooks/use-layout";
import { useSync } from "@/stores/sync";
import { useTheme } from "@/theme";
import { Button, Card, Icon, Mono, Screen, Text } from "@/ui";

// m-inspections.jsx InspSaved — completion confirmation. When the completion
// mutation hasn't synced yet (offline / pending), show the "saved on device"
// state; the durable queue syncs it on reconnect.
export default function InspectionDone() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette, radius } = useTheme();
  const { contentMaxWidth } = useLayout();
  const sync = useSync((s) => s.state);
  const insp = useInspection(id ?? "");

  const synced = sync === "synced";

  return (
    <Screen>
      <View style={{ height: insets.top }} />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 30 }}>
        <View style={{ width: "100%", maxWidth: contentMaxWidth, alignItems: "center", gap: 18 }}>
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: palette.successBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="check" size={44} stroke={2.4} color={palette.success} />
          </View>
          <View style={{ alignItems: "center", gap: 8 }}>
            <Text size={22} weight="bold" style={{ letterSpacing: -0.4 }}>
              Inspection complete
            </Text>
            <Text size={14} tone="muted" style={{ textAlign: "center", maxWidth: 280, lineHeight: 21 }}>
              Your answers were recorded. The server validates and scores them on submit.
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: radius.xl,
              backgroundColor: synced ? palette.successBg : palette.warnBg,
            }}
          >
            <Icon name={synced ? "cloud" : "cloudOff"} size={16} color={synced ? palette.successFg : palette.warnFg} />
            <Text size={13.5} weight="semibold" color={synced ? palette.successFg : palette.warnFg}>
              {synced ? "Synced" : "Saved on device — will sync when online"}
            </Text>
          </View>

          <Card style={{ padding: 14, width: "100%", maxWidth: 320, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: radius.lg,
                backgroundColor: palette.bgSubtle,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="clipboard" size={17} color={palette.muted} />
            </View>
            <View style={{ flex: 1 }}>
              <Mono size={11} weight="bold" color={palette.muted}>
                {insp.data?.code ?? "…"}
              </Mono>
              <Text size={12.5} tone="muted">
                {insp.data?.title ?? "Inspection"}
              </Text>
            </View>
          </Card>
        </View>
      </View>

      <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24, gap: 10 }}>
        <Button onPress={() => router.replace("/(app)/tasks")}>Back to work queue</Button>
        <Button
          variant="ghost"
          icon="eye"
          onPress={() =>
            Platform.OS === "web"
              ? window.alert("The sync queue screen arrives in M11 (System & Settings).")
              : router.replace("/(app)/tasks")
          }
        >
          View sync queue
        </Button>
      </View>
    </Screen>
  );
}
