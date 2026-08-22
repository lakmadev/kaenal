"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type { CountDto, NotificationDto, Page } from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/** Filters the notifications list endpoint accepts (matches the contract). */
export interface NotificationListQuery {
  unread?: boolean;
  starred?: boolean;
  entityKind?: string;
  cursor?: string;
  limit?: number;
}

export function useNotifications(query?: NotificationListQuery) {
  return useQuery(
    apiQueries.notifications.list(getApiClient(), query !== undefined ? { query } : undefined),
  );
}

/** The bell badge. The realtime stream (Phase R1, `useRealtime`) invalidates
 *  this the instant a notification is produced elsewhere, so the badge is live.
 *  The slow poll + window-focus refetch remain only as a fallback for when the
 *  SSE stream is dropped (flaky network, proxy timeout). */
export function useUnreadCount() {
  return useQuery({
    ...apiQueries.notifications.unreadCount(getApiClient()),
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
  });
}

function useNotificationInvalidator(): () => void {
  const qc = useQueryClient();
  // The prefix key covers both the lists and the unread-count.
  return () => void qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
}

export function useMarkNotificationRead() {
  const client = getApiClient();
  const invalidate = useNotificationInvalidator();
  return useMutation({
    mutationFn: (id: string) =>
      client.markNotificationRead({ params: { id }, body: {} }).then((r) => unwrap<NotificationDto>(r)),
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsRead() {
  const client = getApiClient();
  const invalidate = useNotificationInvalidator();
  return useMutation({
    mutationFn: () =>
      client.markAllNotificationsRead({ body: {} }).then((r) => unwrap<CountDto>(r)),
    onSuccess: invalidate,
  });
}

export function useStarNotification() {
  const client = getApiClient();
  const invalidate = useNotificationInvalidator();
  return useMutation({
    mutationFn: ({ id, starred }: { id: string; starred: boolean }) =>
      client.starNotification({ params: { id }, body: { starred } }).then((r) => unwrap<NotificationDto>(r)),
    onSuccess: invalidate,
  });
}

export function useDismissNotification() {
  const client = getApiClient();
  const invalidate = useNotificationInvalidator();
  return useMutation({
    mutationFn: (id: string) =>
      client.dismissNotification({ params: { id }, body: {} }).then((r) => unwrap<CountDto>(r)),
    onSuccess: invalidate,
  });
}

/** Convenience: the flat items array from a (possibly paginated) list result. */
export function notificationItems(page: Page<NotificationDto> | undefined): NotificationDto[] {
  return page?.items ?? [];
}
