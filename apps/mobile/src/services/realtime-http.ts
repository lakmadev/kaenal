import { API_BASE_URL } from "@/lib/api";
import { useSession } from "@/stores/session";

/**
 * Bearer headers for the mobile realtime REST calls (presence R6, collab R6.2).
 * These endpoints aren't in the ts-rest contract, so — like the auth routes —
 * they're called with plain fetch in bearer mode. Returns null when there's no
 * session, so callers no-op cleanly.
 */
export function authHeaders(): Record<string, string> | null {
  const { token, tenant } = useSession.getState();
  if (token === null || tenant === null) return null;
  return {
    "content-type": "application/json",
    "x-auth-mode": "bearer",
    "x-tenant-id": tenant,
    authorization: `Bearer ${token}`,
  };
}

export { API_BASE_URL };
