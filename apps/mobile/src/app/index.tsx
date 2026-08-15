import { Redirect } from "expo-router";

import { useSession } from "@/stores/session";

// Entry redirect (05 §3): authenticated → tabs; a valid-but-locked session →
// biometric unlock; everyone else → the onboarding flow.
export default function Index() {
  const status = useSession((s) => s.status);
  const href =
    status === "authenticated"
      ? "/(app)/home"
      : status === "locked"
        ? "/(auth)/unlock"
        : "/(auth)/welcome";
  return <Redirect href={href} />;
}
