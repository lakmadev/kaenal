"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type { BrandingDto, UpdateBrandingBody } from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/**
 * White-label branding (`/v1/settings/branding`). The GET is read by the shell
 * (TopBar tenant label) and the branding editor; the PUT (settings:manage) saves
 * the whole document with optimistic concurrency — the returned `lockVersion`
 * bumps, so we write it straight back into the cache for the next save.
 */
export function useBranding() {
  return useQuery(apiQueries.settings.branding(getApiClient()));
}

export function useUpdateBranding() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateBrandingBody) =>
      client.updateBranding({ body }).then((r) => unwrap<BrandingDto>(r)),
    onSuccess: (branding) => {
      qc.setQueryData(queryKeys.settings.branding(), branding);
    },
  });
}
