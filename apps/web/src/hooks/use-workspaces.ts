"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { apiQueries, unwrap } from "@kaenal/api-client";
import type { WorkspaceDto } from "@kaenal/types";
import { getApiClient } from "@/lib/api";
import { setActiveTenant } from "@/lib/tenant";

/** Every workspace the signed-in person can enter (the profile switcher). */
export function useWorkspaces() {
  return useQuery({
    ...apiQueries.workspaces(getApiClient()),
    staleTime: 5 * 60_000,
  });
}

/**
 * Switch the active workspace. The server mints a session for the target tenant
 * and sets the session cookie; we update the readable workspace cookie and do a
 * full reload so every query refetches against the new tenant.
 */
export function useSwitchWorkspace() {
  const client = getApiClient();
  return useMutation({
    mutationFn: (slug: string) =>
      client.switchWorkspace({ body: { slug } }).then((r) => unwrap<WorkspaceDto>(r)),
    onSuccess: (ws) => {
      setActiveTenant(ws.tenantSlug);
      window.location.assign("/dashboard");
    },
  });
}
