"use client";

import type { UserPreferencesSettings } from "@kaenal/types";
import { useOnline } from "@/hooks/use-online";
import { hasCapability, useMe } from "@/hooks/use-me";
import { usePreferences, useUpdatePreferences } from "@/hooks/use-preferences";
import { usePreferencesSaveStore } from "@/lib/stores/preferences-save";

/**
 * Everything the Tweaks panel and the Preferences cards need: the values, a
 * `save` that applies instantly and persists, whether the controls are locked
 * (offline), whether the AI row applies, and the shared save status.
 */
export function useAppearance() {
  const prefs = usePreferences();
  const update = useUpdatePreferences();
  const online = useOnline();
  const { data: me } = useMe();
  const status = usePreferencesSaveStore((s) => s.status);
  const failed = usePreferencesSaveStore((s) => s.failed);
  const updatedElsewhere = usePreferencesSaveStore((s) => s.updatedElsewhere);

  const save = (patch: Partial<UserPreferencesSettings>): void => {
    if (!online) return;
    update.mutate(patch);
  };

  return {
    values: prefs.values,
    isLoading: prefs.isLoading,
    isError: prefs.isError,
    reload: () => void prefs.refetch(),
    offline: !online,
    canUseAi: hasCapability(me, "ai:use"),
    status,
    failed,
    updatedElsewhere,
    save,
    /** "Try again" after a failed save: re-send the change that failed. */
    retry: () => {
      if (failed !== null) update.mutate(failed);
    },
  };
}
