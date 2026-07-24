"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signOut } from "@/lib/auth";
import { clearActiveTenant } from "@/lib/tenant";

/**
 * Sign out: revoke the session server-side, clear the workspace cookie, wipe the
 * query cache (so no other user's cached data lingers), and return to sign-in.
 * Best-effort — even if the network call fails, local state is cleared.
 */
export function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => signOut(),
    onSettled: () => {
      clearActiveTenant();
      queryClient.clear();
      router.replace("/sign-in");
    },
  });
}
