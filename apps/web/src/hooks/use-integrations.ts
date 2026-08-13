"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type {
  ConnectIntegrationBody,
  CreateIntegrationBody,
  IntegrationDto,
  UpdateIntegrationBody,
} from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/**
 * Connector registry (`/v1/integrations`). The whole surface is admin-only
 * server-side (`integration:manage`) — a manager/viewer 403s even on read, so the
 * section gates itself. The DTO carries `hasCredentials` (a boolean), never the
 * credential pointer; connect stores it, disconnect/delete purge it. Every
 * mutation invalidates the list so the card grid reflects the new status.
 */
export function useIntegrations() {
  return useQuery(apiQueries.integrations.list(getApiClient()));
}

export function useIntegrationEvents(id: string, enabled: boolean) {
  return useQuery({ ...apiQueries.integrations.events(getApiClient(), id), enabled });
}

export function useConnectorSchema(id: string, enabled: boolean) {
  return useQuery({ ...apiQueries.integrations.schema(getApiClient(), id), enabled });
}

/** Invalidate everything under the registry after a write. */
function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.integrations.all });
}

export function useCreateIntegration() {
  const client = getApiClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: CreateIntegrationBody) =>
      client.createIntegration({ body }).then((r) => unwrap<IntegrationDto>(r)),
    onSuccess: invalidate,
  });
}

export function useConnectIntegration() {
  const client = getApiClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ConnectIntegrationBody }) =>
      client.connectIntegration({ params: { id }, body }).then((r) => unwrap<IntegrationDto>(r)),
    onSuccess: invalidate,
  });
}

export function useDisconnectIntegration() {
  const client = getApiClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      client.disconnectIntegration({ params: { id }, body: {} }).then((r) => unwrap<IntegrationDto>(r)),
    onSuccess: invalidate,
  });
}

export function useDeleteIntegration() {
  const client = getApiClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      client.deleteIntegration({ params: { id }, body: {} }).then((r) => unwrap<IntegrationDto>(r)),
    onSuccess: invalidate,
  });
}

export function useUpdateIntegration() {
  const client = getApiClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateIntegrationBody }) =>
      client.updateIntegration({ params: { id }, body }).then((r) => unwrap<IntegrationDto>(r)),
    onSuccess: invalidate,
  });
}
