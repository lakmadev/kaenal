import { Redirect } from "expo-router";

import { useSession } from "@/stores/session";

// Entry redirect: send authenticated users into the app tabs, everyone else to the
// auth flow. (Auth screens are placeholders until M4.)
export default function Index() {
  const status = useSession((s) => s.status);
  return <Redirect href={status === "authenticated" ? "/(app)/home" : "/(auth)/welcome"} />;
}
