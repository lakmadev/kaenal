import { Redirect, Tabs, useRouter } from "expo-router";

import { tabsForRole } from "@/config/rbac";
import { useRole, useSession } from "@/stores/session";
import { TabBar } from "@/ui";

// Minimal structural view of the navigator props we use (avoids depending on the
// @react-navigation/bottom-tabs types directly — it's only a transitive dep).
interface TabBarProps {
  state: { index: number; routeNames: string[]; routes: { name: string }[] };
  navigation: { navigate: (name: string) => void };
}

// Custom tab bar: renders the role's design tab set, but only the tabs whose screen
// actually exists yet (others arrive with their phase). The center FAB opens capture.
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
      onPress={(id) => {
        if (id === "capture") {
          router.push("/(app)/capture");
          return;
        }
        navigation.navigate(id);
      }}
    />
  );
}

export default function AppLayout() {
  const status = useSession((s) => s.status);
  const primed = useSession((s) => s.primed);
  if (status === "locked") return <Redirect href="/(auth)/unlock" />;
  if (status !== "authenticated") return <Redirect href="/(auth)/welcome" />;
  // One-time permission priming before the shell (05 §3 / design AuthPriming).
  // Top-level route (not in a group) so neither auth/app redirect can loop it.
  if (!primed) return <Redirect href="/priming" />;

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <AppTabBar {...props} />}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="tasks" />
      <Tabs.Screen name="ncr" />
      <Tabs.Screen name="me" />
      {/* Not a tab — opened by the FAB. Hidden from the bar. */}
      <Tabs.Screen name="capture" options={{ href: null }} />
    </Tabs>
  );
}
