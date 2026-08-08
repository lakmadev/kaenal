"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type { SessionPolicyDto, UpdateSessionPolicyBody } from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/**
 * Session policy (`/v1/settings/session-policy`). The GET is read by the admin
 * editor and the personal Security page (read-only summary); the PUT
 * (settings:manage) saves the whole policy with optimistic concurrency.
 */
export function useSessionPolicy() {
  return useQuery(apiQueries.settings.sessionPolicy(getApiClient()));
}

export function useUpdateSessionPolicy() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateSessionPolicyBody) =>
      client.updateSessionPolicy({ body }).then((r) => unwrap<SessionPolicyDto>(r)),
    onSuccess: (policy) => {
      qc.setQueryData(queryKeys.settings.sessionPolicy(), policy);
    },
  });
}
