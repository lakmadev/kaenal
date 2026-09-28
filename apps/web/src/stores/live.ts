import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Live mode (S1-3). `enabledByUser` is a per-viewer convenience persisted in
 * localStorage (not business data). `connection` mirrors the realtime SSE
 * stream so the top-bar toggle can show "reconnecting". `toasts` is the
 * transient stack (max 3, newest first) shown by `LiveToasts`.
 */

export type LiveConnection = "connecting" | "open" | "reconnecting";

export interface LiveToastItem {
  id: string;
  title: string;
  body: string | null;
  entityKind: string;
  entityId: string;
  actorId: string | null;
}

const TOAST_MS = 7500;
const MAX_TOASTS = 3;

interface LiveState {
  enabledByUser: Record<string, boolean>;
  setEnabled: (userId: string, enabled: boolean) => void;

  connection: LiveConnection;
  setConnection: (connection: LiveConnection) => void;

  toasts: LiveToastItem[];
  /** Notification ids already toasted, so a reconnect replay never storms. */
  seen: Record<string, true>;
  /** Returns false (and does nothing) when this id was already toasted. */
  pushToast: (toast: LiveToastItem) => boolean;
  dismissToast: (id: string) => void;
}

export const useLiveStore = create<LiveState>()(
  persist(
    (set, get) => ({
      enabledByUser: {},
      setEnabled: (userId, enabled) =>
        set((s) => ({ enabledByUser: { ...s.enabledByUser, [userId]: enabled } })),

      connection: "connecting",
      setConnection: (connection) => set({ connection }),

      toasts: [],
      seen: {},
      pushToast: (toast) => {
        if (get().seen[toast.id] !== undefined) return false;
        set((s) => ({
          seen: { ...s.seen, [toast.id]: true },
          toasts: [toast, ...s.toasts].slice(0, MAX_TOASTS),
        }));
        setTimeout(() => get().dismissToast(toast.id), TOAST_MS);
        return true;
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: "kaenal-live",
      partialize: (s) => ({ enabledByUser: s.enabledByUser }),
    },
  ),
);
