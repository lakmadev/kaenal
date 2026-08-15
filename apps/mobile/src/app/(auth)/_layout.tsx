import { Redirect, Stack } from "expo-router";

import { useSession } from "@/stores/session";

export default function AuthLayout() {
  const status = useSession((s) => s.status);
  // Fully authenticated users never see the auth stack. A "locked" session stays
  // here (the unlock screen lives in this group).
  if (status === "authenticated") return <Redirect href="/(app)/home" />;
  return <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />;
}
