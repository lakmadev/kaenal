import { Redirect, Stack } from "expo-router";

import { useSession } from "@/stores/session";

export default function AuthLayout() {
  const status = useSession((s) => s.status);
  if (status === "authenticated") return <Redirect href="/(app)/home" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
