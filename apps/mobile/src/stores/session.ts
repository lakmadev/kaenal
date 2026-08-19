import { create } from "zustand";

import type { MeDto } from "@kaenal/types";

import { toMobileRole, type MobileRole } from "@/config/rbac";
import { apiClient } from "@/lib/api";
import { type AuthError, signInRequest, signOutRequest } from "@/lib/auth-api";
import { unregisterForPushAsync } from "@/features/notifications/push";
import { services } from "@/services";

const TOKEN_KEY = "kaenal.session.token";
const TENANT_KEY = "kaenal.session.tenant";
const ME_KEY = "kaenal.session.me";
const BIOMETRIC_KEY = "kaenal.biometric.enabled";
const PRIMED_KEY = "kaenal.permissions.primed";

// "locked" = a valid session exists on device but biometric unlock is required
// before the app is usable (05 §3). Distinct from "authenticated" so the router
// can gate the shell behind the unlock screen.
export type SessionStatus = "loading" | "unauthenticated" | "locked" | "authenticated";

/** Credentials held between the password step and the second-factor step. */
interface MfaPending {
  tenant: string;
  email: string;
  password: string;
}

interface SessionState {
  status: SessionStatus;
  token: string | null;
  tenant: string | null;
  me: MeDto | null;
  /** Present while an MFA challenge is in flight (drives the MFA screen). */
  mfaPending: MfaPending | null;
  /** Whether biometric unlock is enabled for the stored session. */
  biometricEnabled: boolean;
  /** Whether the one-time permission-priming screen has been shown. */
  primed: boolean;

  bootstrap: () => Promise<void>;
  markPrimed: () => Promise<void>;
  /** Step 1: email + password. Returns "mfa" if a code is still needed. */
  signInStart: (args: { tenant: string; email: string; password: string }) => Promise<"ok" | "mfa">;
  /** Step 2: TOTP or recovery code, using the held credentials. */
  signInVerify: (code: string) => Promise<void>;
  /** Cancel an in-flight MFA challenge (back button). */
  cancelMfa: () => void;
  setMe: (me: MeDto) => void;
  setBiometricEnabled: (on: boolean) => Promise<void>;
  /** Unlock a "locked" session after a successful biometric prompt. */
  unlock: () => void;
  /** Switch to another workspace the user belongs to (issues a new session). */
  switchWorkspace: (slug: string) => Promise<void>;
  signOut: () => Promise<void>;
}

/** Store the token+tenant, resolve /v1/me, and land on authenticated (or locked). */
async function establish(
  set: (patch: Partial<SessionState>) => void,
  get: () => SessionState,
  token: string,
  tenant: string,
): Promise<void> {
  await Promise.all([
    services.secureStore.setItem(TOKEN_KEY, token),
    services.secureStore.setItem(TENANT_KEY, tenant),
  ]);
  // Set token/tenant first so the shared apiClient's getters pick them up.
  set({ token, tenant });
  const res = await apiClient.getMe();
  if (res.status !== 200) {
    throw { status: res.status, code: "ME_FAILED", message: "Could not load your profile." } as AuthError;
  }
  await services.kv.setItem(ME_KEY, JSON.stringify(res.body));
  set({ me: res.body, status: "authenticated", mfaPending: null });
}

export const useSession = create<SessionState>((set, get) => ({
  status: "loading",
  token: null,
  tenant: null,
  me: null,
  mfaPending: null,
  biometricEnabled: false,
  primed: false,

  bootstrap: async () => {
    const [token, tenant, meRaw, bio, primed] = await Promise.all([
      services.secureStore.getItem(TOKEN_KEY),
      services.secureStore.getItem(TENANT_KEY),
      services.kv.getItem(ME_KEY),
      services.kv.getItem(BIOMETRIC_KEY),
      services.kv.getItem(PRIMED_KEY),
    ]);
    const biometricEnabled = bio === "1";
    set({ biometricEnabled, primed: primed === "1" });

    const cachedMe = parseMe(meRaw);
    if (!token || !tenant) {
      set({ status: "unauthenticated" });
      return;
    }

    // Only LOCK when biometrics can actually unlock on this device. On the web /
    // installed PWA (and any device without enrolled biometrics) there's no way to
    // pass the prompt, so locking would strand the user on "Couldn't unlock" — go
    // straight to authenticated instead.
    const canLock = biometricEnabled && ((await services.biometric?.isAvailable?.()) ?? false);

    // Validate the stored token by resolving /v1/me. A network failure keeps the
    // session ONLY when we have a cached identity to render offline (§4); without
    // one we can't show a coherent shell, so fall back to sign-in.
    set({ token, tenant, me: cachedMe });
    const settle = (): void =>
      set({ status: canLock ? "locked" : cachedMe ? "authenticated" : "unauthenticated" });
    try {
      const res = await apiClient.getMe();
      if (res.status === 200) {
        await services.kv.setItem(ME_KEY, JSON.stringify(res.body));
        set({ me: res.body, status: canLock ? "locked" : "authenticated" });
      } else if (res.status === 401) {
        await clearSession();
        set({ token: null, tenant: null, me: null, status: "unauthenticated" });
      } else {
        settle(); // transient/server error — trust the cached identity if present
      }
    } catch {
      settle(); // offline — same
    }
  },

  signInStart: async ({ tenant, email, password }) => {
    const res = await signInRequest(tenant, email, password);
    if ("mfaRequired" in res) {
      set({ mfaPending: { tenant, email, password } });
      return "mfa";
    }
    await establish(set, get, res.sessionToken, tenant);
    return "ok";
  },

  signInVerify: async (code) => {
    const pending = get().mfaPending;
    if (!pending) throw { status: 0, code: "NO_CHALLENGE", message: "Start sign-in again." } as AuthError;
    const res = await signInRequest(pending.tenant, pending.email, pending.password, code);
    if ("mfaRequired" in res) {
      // Server still wants a code → the one supplied was wrong.
      throw { status: 401, code: "MFA_INVALID", message: "That code did not match." } as AuthError;
    }
    await establish(set, get, res.sessionToken, pending.tenant);
  },

  cancelMfa: () => set({ mfaPending: null }),

  setMe: (me) => {
    void services.kv.setItem(ME_KEY, JSON.stringify(me));
    set({ me });
  },

  markPrimed: async () => {
    await services.kv.setItem(PRIMED_KEY, "1");
    set({ primed: true });
  },

  setBiometricEnabled: async (on) => {
    await services.kv.setItem(BIOMETRIC_KEY, on ? "1" : "0");
    set({ biometricEnabled: on });
  },

  unlock: () => set({ status: "authenticated" }),

  switchWorkspace: async (slug) => {
    // Opt into bearer mode so the API returns the target-tenant token in the body.
    const res = await apiClient.switchWorkspace({
      body: { slug },
      extraHeaders: { "x-auth-mode": "bearer" },
    });
    if (res.status !== 200 || !res.body.sessionToken) {
      throw { status: res.status, code: "SWITCH_FAILED", message: "Could not switch workspace." } as AuthError;
    }
    // The local mirror/queue belong to the OLD tenant — wipe before adopting the new
    // session (the caller's guard already ensured nothing is unsynced), then re-pull.
    await services.syncStore.wipe();
    await establish(set, get, res.body.sessionToken, slug);
    const { startSync } = await import("@/sync");
    void startSync();
  },

  signOut: async () => {
    const { token, tenant } = get();
    // Best-effort server revoke; the local wipe happens regardless (05 §2/§4).
    if (token && tenant) {
      // Deregister this device's push token first (while the session is still
      // valid) so it stops receiving push after sign-out (registry 0036).
      await unregisterForPushAsync().catch(() => {});
      try {
        await signOutRequest(tenant, token);
      } catch {
        /* offline — local wipe still proceeds */
      }
    }
    await clearSession();
    set({ token: null, tenant: null, me: null, mfaPending: null, status: "unauthenticated" });
  },
}));

/** Wipe secrets, the cached identity, and the offline mirror/queues (05 §2/§4). */
async function clearSession(): Promise<void> {
  await Promise.all([
    services.secureStore.removeItem(TOKEN_KEY),
    services.secureStore.removeItem(TENANT_KEY),
    services.kv.removeItem(ME_KEY),
    services.syncStore.wipe(),
  ]);
}

/** Parse a cached MeDto blob, tolerating corruption. */
function parseMe(raw: string | null): MeDto | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MeDto;
  } catch {
    return null;
  }
}

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
