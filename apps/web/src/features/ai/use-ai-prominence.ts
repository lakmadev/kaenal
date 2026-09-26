"use client";

import { useQuery } from "@tanstack/react-query";
import { unwrap } from "@kaenal/api-client";
import { USER_PREFERENCES_DEFAULTS, type AiProminence, type UserPreferencesDto } from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/**
 * The persisted `aiProminence` (front | normal | quiet) from
 * `GET /v1/me/preferences` (Q8). Defaults to "normal" while loading or on error
 * so the button never flickers away. Read-only here; the Tweaks panel owns writes.
 */
export function useAiProminence(): AiProminence {
  const { data } = useQuery({
    queryKey: ["me", "preferences"],
    queryFn: () => getApiClient().getUserPreferences().then((r) => unwrap<UserPreferencesDto>(r)),
  });
  return data?.aiProminence ?? USER_PREFERENCES_DEFAULTS.aiProminence;
}
