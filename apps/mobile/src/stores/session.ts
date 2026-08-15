import { create } from "zustand";

import type { MeDto } from "@kaenal/types";

import { toMobileRole, type MobileRole } from "@/config/rbac";
import { services } from "@/services";

const TOKEN_KEY = "kaenal.session.token";
const TENANT_KEY = "kaenal.session.tenant";

export type SessionStatus = "loading" | "unauthenticated" | "authenticated";

interface SessionState {
  status: SessionStatus;
  /** Bearer token (also mirrored in the secure store). */
  token: string | null;
  /** Active workspace slug → X-Tenant-Id. */
  tenant: string | null;
  /** Resolved identity + capabilities from GET /v1/me. */
  me: MeDto | null;

  /** Rehydrate token/tenant from the secure store at app start. */
  bootstrap: () => Promise<void>;
  /** Persist a fresh authenticated session. */
  signIn: (args: { token: string; tenant: string; me: MeDto }) => Promise<void>;
  /** Update the resolved identity (e.g. after a /v1/me refetch). */
  setMe: (me: MeDto) => void;
  /** Clear the session and wipe secrets. */
  signOut: () => Promise<void>;
}

export const useSession = create<SessionState>((set, get) => ({
  status: "loading",
  token: null,
  tenant: null,
  me: null,

  bootstrap: async () => {
    const [token, tenant] = await Promise.all([
      services.secureStore.getItem(TOKEN_KEY),
      services.secureStore.getItem(TENANT_KEY),
    ]);
    // A token alone doesn't make us authenticated until /v1/me is refetched (M4).
    // Until then, treat a stored token as "needs re-auth" so the shell can decide.
    if (token && tenant) {
      set({ token, tenant, status: "unauthenticated" });
    } else {
      set({ status: "unauthenticated" });
    }
  },

  signIn: async ({ token, tenant, me }) => {
    await Promise.all([
      services.secureStore.setItem(TOKEN_KEY, token),
      services.secureStore.setItem(TENANT_KEY, tenant),
    ]);
    set({ token, tenant, me, status: "authenticated" });
  },

  setMe: (me) => set({ me }),

  signOut: async () => {
    await Promise.all([
      services.secureStore.removeItem(TOKEN_KEY),
      services.secureStore.removeItem(TENANT_KEY),
    ]);
    set({ token: null, tenant: null, me: null, status: "unauthenticated" });
  },
}));

/** Selector: the caller's resolved capabilities (empty when signed out). */
export function useCapabilities(): readonly string[] {
  return useSession((s) => s.me?.capabilities ?? []);
}

/** Selector: the caller's mobile role (defaults to viewer when unknown/signed out). */
export function useRole(): MobileRole {
  const role = useSession((s) => s.me?.role);
  return toMobileRole(role ?? "viewer");
}

export { toMobileRole };
