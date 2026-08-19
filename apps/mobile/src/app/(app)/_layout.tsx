import { Redirect, Slot, Tabs, usePathname, useRouter } from "expo-router";
import { View } from "react-native";

import { tabsForRole } from "@/config/rbac";
import { useLayout } from "@/hooks/use-layout";
import { useRole, useSession } from "@/stores/session";
import { SideRail, TabBar } from "@/ui";

// Tab routes that actually have a screen (others in a role's set are future phases).
const REGISTERED = new Set(["home", "tasks", "ncr", "approvals", "team", "audit", "me"]);

interface TabBarProps {
  state: { index: number; routeNames: string[]; routes: { name: string }[] };
  navigation: { navigate: (name: string) => void };
}

/** Phone bottom tab bar — the role's design tab set, filtered to built screens. */
function AppTabBar({ state, navigation }: TabBarProps) {
  const role = useRole();
  const router = useRouter();
  const registered = new Set(state.routeNames);
  const items = tabsForRole(role).filter((t) => t.fab || registered.has(t.id));
  const active = state.routes[state.index]?.name ?? "home";
  return (
    <TabBar
      tabs={items}
      active={active}
      onPress={(id) => (id === "capture" ? router.push("/(app)/capture") : navigation.navigate(id))}
    />
  );
}

export default function AppLayout() {
  const status = useSession((s) => s.status);
  const primed = useSession((s) => s.primed);
  const role = useRole();
  const router = useRouter();
  const pathname = usePathname();
  const { isTablet } = useLayout();

  if (status === "locked") return <Redirect href="/(auth)/unlock" />;
  if (status !== "authenticated") return <Redirect href="/(auth)/welcome" />;
  if (!primed) return <Redirect href="/priming" />;

  // Tablet (≥768pt): promote the bottom tabs to a left side rail beside the
  // content (m-tablet.jsx). The breakpoint rarely flips, so switching navigator
  // shape here doesn't churn in practice; state lives in stores + the query cache.
  if (isTablet) {
    const active = pathname.replace(/^\/+/, "").split("/")[0] || "home";
    const items = tabsForRole(role).filter((t) => t.fab || REGISTERED.has(t.id));
    return (
      <View style={{ flex: 1, flexDirection: "row" }}>
        <SideRail
          tabs={items}
          active={active}
          onPress={(id) => (id === "capture" ? router.push("/(app)/capture") : router.navigate(`/(app)/${id}` as never))}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Slot />
        </View>
      </View>
    );
  }

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <AppTabBar {...props} />}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="tasks" />
      <Tabs.Screen name="ncr" />
      <Tabs.Screen name="approvals" />
      <Tabs.Screen name="team" />
      <Tabs.Screen name="audit" />
      <Tabs.Screen name="me" />
      <Tabs.Screen name="capture" options={{ href: null }} />
    </Tabs>
  );
}
