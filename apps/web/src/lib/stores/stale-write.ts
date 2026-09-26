import { create } from "zustand";
import type { StaleWriteInfo } from "@kaenal/core";

/** What a reload of the affected record produced. */
export type FreshState =
  | { kind: "loading" }
  | { kind: "ok"; row: Record<string, unknown> }
  | { kind: "deleted" }
  | { kind: "failed" }
  /** No cached record matched the mutation, so there is nothing to diff against. */
  | { kind: "none" };

/** A write that was rejected with 409 STALE_WRITE, held while the user reconciles. */
export interface StaleWriteCase {
  info: StaleWriteInfo;
  /** The failed mutation's variables (`{ id, body }`). */
  variables: Record<string, unknown>;
  /** Re-runs the same mutation function with new variables. */
  run: (variables: Record<string, unknown>) => Promise<unknown>;
  entityId: string | null;
  /** The row as the user loaded it (cache snapshot taken before the reload). */
  original: Record<string, unknown> | null;
  fresh: FreshState;
}

interface StaleWriteState {
  current: StaleWriteCase | null;
  open: (c: StaleWriteCase) => void;
  setFresh: (fresh: FreshState) => void;
  close: () => void;
}

/** Global stale-write state: one dialog, mounted once in the app shell (S1-5). */
export const useStaleWriteStore = create<StaleWriteState>()((set) => ({
  current: null,
  open: (current) => set((s) => (s.current === null ? { current } : s)),
  setFresh: (fresh) => set((s) => (s.current === null ? s : { current: { ...s.current, fresh } })),
  close: () => set({ current: null }),
}));
