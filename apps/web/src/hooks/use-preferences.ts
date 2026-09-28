"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { ApiRequestError, unwrap } from "@kaenal/api-client";
import { parseStaleWrite } from "@kaenal/core";
import { USER_PREFERENCES_DEFAULTS, type UserPreferencesDto, type UserPreferencesSettings } from "@kaenal/types";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui";
import { getApiClient } from "@/lib/api";
import { usePreferencesSaveStore } from "@/lib/stores/preferences-save";

const PREFERENCES_KEY = ["me", "preferences"] as const;

type PreferencesPatch = Partial<UserPreferencesSettings>;

/** The caller's preferences (`GET /v1/me/preferences`); defaults until first load. */
export function usePreferences() {
  const query = useQuery({
    queryKey: PREFERENCES_KEY,
    queryFn: () =>
      getApiClient()
        .getUserPreferences()
        .then((r) => unwrap<UserPreferencesDto>(r)),
    staleTime: 60_000,
  });
  const values: UserPreferencesSettings = query.data ?? USER_PREFERENCES_DEFAULTS;
  return { ...query, values };
}

async function sendPatch(qc: QueryClient, patch: PreferencesPatch): Promise<UserPreferencesDto> {
  const client = getApiClient();
  const version = qc.getQueryData<UserPreferencesDto>(PREFERENCES_KEY)?.lockVersion ?? 0;
  try {
    return await client.updateUserPreferences({ body: { ...patch, version } }).then((r) => unwrap<UserPreferencesDto>(r));
  } catch (error) {
    if (!(error instanceof ApiRequestError) || parseStaleWrite(error.status, error.body) === null) throw error;
    // Board W10-G: preferences are single-field self-scoped values, so a 409 is
    // reconciled silently. Re-read, re-apply only the field(s) just changed, retry once.
    const fresh = await client.getUserPreferences().then((r) => unwrap<UserPreferencesDto>(r));
    qc.setQueryData<UserPreferencesDto>(PREFERENCES_KEY, { ...fresh, ...patch });
    usePreferencesSaveStore.getState().setUpdatedElsewhere();
    return client
      .updateUserPreferences({ body: { ...patch, version: fresh.lockVersion } })
      .then((r) => unwrap<UserPreferencesDto>(r));
  }
}

/**
 * Optimistic preference save. The change shows instantly; a failure snaps the
 * changed fields back and puts the patch in the save store so the UI can offer
 * "Try again". Runs serially (`scope`) so each PATCH carries the latest version.
 * The global 409 dialog is skipped (`meta`) because W10-G reconciles silently.
 */
export function useUpdatePreferences() {
  const qc = useQueryClient();
  const save = usePreferencesSaveStore;
  const t = useTranslations("tweaks");
  const toast = useToast();

  return useMutation({
    scope: { id: "user-preferences" },
    meta: { skipStaleDialog: true },
    mutationFn: (patch: PreferencesPatch) => sendPatch(qc, patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: PREFERENCES_KEY });
      const before = qc.getQueryData<UserPreferencesDto>(PREFERENCES_KEY) ?? { ...USER_PREFERENCES_DEFAULTS, lockVersion: 0 };
      const previous: PreferencesPatch = {};
      for (const key of Object.keys(patch) as (keyof UserPreferencesSettings)[]) {
        Object.assign(previous, { [key]: before[key] });
      }
      qc.setQueryData<UserPreferencesDto>(PREFERENCES_KEY, { ...before, ...patch });
      save.getState().setSaving();
      return { previous };
    },
    onSuccess: (dto) => {
      // Keep any newer optimistic values; only the version must advance.
      qc.setQueryData<UserPreferencesDto>(PREFERENCES_KEY, (old) => (old ? { ...old, lockVersion: dto.lockVersion } : dto));
      save.getState().setSaved();
    },
    onError: (_error, patch, context) => {
      if (context !== undefined) {
        qc.setQueryData<UserPreferencesDto>(PREFERENCES_KEY, (old) => (old ? { ...old, ...context.previous } : old));
      }
      save.getState().setFailed(patch);
      toast.error(t("failedToast"));
    },
  });
}
