import { create } from "zustand";

import { services } from "@/services";
import type { ThemeMode } from "@/theme";

const KEY = "kaenal.appearance.mode";

interface AppearanceState {
  mode: ThemeMode;
  hydrated: boolean;
  /** Load the persisted preference (called once at app start). */
  hydrate: () => Promise<void>;
  setMode: (mode: ThemeMode) => void;
}

export const useAppearance = create<AppearanceState>((set) => ({
  mode: "system",
  hydrated: false,
  hydrate: async () => {
    const saved = await services.kv.getItem(KEY);
    set({
      mode: saved === "light" || saved === "dark" || saved === "system" ? saved : "system",
      hydrated: true,
    });
  },
  setMode: (mode) => {
    set({ mode });
    void services.kv.setItem(KEY, mode);
  },
}));
