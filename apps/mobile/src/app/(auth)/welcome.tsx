import { useRouter } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { MobileRole } from "@/config/rbac";
import { makeMockMe } from "@/dev/mock-session";
import { useLayout } from "@/hooks/use-layout";
import { useSession } from "@/stores/session";
import { useTheme } from "@/theme";
import { Button, Icon, Screen, SectionLabel, Text } from "@/ui";

// M2 welcome placeholder. The real onboarding (Welcome → Workspace → Sign in → MFA)
// is M4. For now it offers a DEV role picker so the role-aware shell is testable.
const ROLES: MobileRole[] = ["inspector", "auditor", "viewer", "manager", "admin"];

export default function Welcome() {
  const { palette, radius } = useTheme();
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  const insets = useSafeAreaInsets();
  const { contentMaxWidth } = useLayout();

  async function enterAs(role: MobileRole) {
    await signIn({ token: "dev-token", tenant: "acme", me: makeMockMe(role) });
    router.replace("/(app)/home");
  }

  return (
    <Screen>
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 24,
          alignItems: "center",
        }}
      >
        <View style={{ flex: 1, width: "100%", maxWidth: contentMaxWidth, justifyContent: "center", gap: 10 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: radius.xl,
              backgroundColor: palette.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="shieldCheck" size={30} color={palette.accentFg} />
          </View>
          <Text size={30} weight="bold" style={{ letterSpacing: -0.6, marginTop: 8 }}>
            Kaenal
          </Text>
          <Text size={15} tone="muted">
            Quality & safety, on the floor. Sign in to your workspace to start inspecting.
          </Text>
        </View>

        <View style={{ width: "100%", maxWidth: contentMaxWidth, gap: 10 }}>
          <SectionLabel style={{ marginBottom: 2 }}>Dev · enter as role</SectionLabel>
          {ROLES.map((r) => (
            <Button key={r} variant="ghost" onPress={() => void enterAs(r)}>
              {r[0]!.toUpperCase() + r.slice(1)}
            </Button>
          ))}
          <Text size={11} weight="semibold" tone="subtle" style={{ textAlign: "center", marginTop: 4 }}>
            Real sign-in + MFA arrives in M4
          </Text>
        </View>
      </View>
    </Screen>
  );
}
