"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { TENANT_HEADER, unwrap } from "@kaenal/api-client";
import type { AuditAction, AuditLogEntryDto, EntityKind, Page } from "@kaenal/types";
import { getApiClient } from "@/lib/api";
import { env } from "@/lib/env";
import { getActiveTenant } from "@/lib/tenant";

/**
 * Tenant-wide audit log (Settings › System › Audit log). Admin-only on the
 * server (`auditlog:read`); the UI additionally gates the section on the same
 * capability. Real keyset pagination via `useInfiniteQuery` — a "Load more"
 * appends the next cursor page, matching how the backend streams the trail
 * newest-first without offset drift.
 */

export interface AuditLogFilters {
  actorId?: string;
  action?: AuditAction;
  entityKind?: EntityKind;
  sensitiveOnly?: boolean;
  from?: string;
  to?: string;
}

const PAGE_SIZE = 50;

/** Only forward the filters that are actually set. Notably `sensitiveOnly` is
 *  sent ONLY when true — the server coerces the query string, so a literal
 *  "false" would read as true; omission is the correct "off". */
function toQuery(filters: AuditLogFilters): Record<string, string | number | boolean> {
  const q: Record<string, string | number | boolean> = { limit: PAGE_SIZE };
  if (filters.actorId !== undefined) q["actorId"] = filters.actorId;
  if (filters.action !== undefined) q["action"] = filters.action;
  if (filters.entityKind !== undefined) q["entityKind"] = filters.entityKind;
  if (filters.sensitiveOnly === true) q["sensitiveOnly"] = true;
  if (filters.from !== undefined) q["from"] = filters.from;
  if (filters.to !== undefined) q["to"] = filters.to;
  return q;
}

export function useAuditLog(filters: AuditLogFilters) {
  const client = getApiClient();
  return useInfiniteQuery({
    queryKey: ["audit-log", filters] as const,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      client
        .listTenantAuditLog({
          query: { ...toQuery(filters), ...(pageParam !== undefined ? { cursor: pageParam } : {}) },
        })
        .then((r) => unwrap<Page<AuditLogEntryDto>>(r)),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/**
 * Download the filtered log as CSV. A file body can't go through the JSON
 * ts-rest client, so this is a raw credentialed fetch that carries the same
 * tenant header, then triggers a browser download of the returned blob.
 */
export async function downloadAuditLogCsv(filters: AuditLogFilters): Promise<void> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(toQuery(filters))) {
    if (k === "limit") continue; // export is capped server-side, not paged
    params.set(k, String(v));
  }
  const tenant = getActiveTenant();
  const headers: Record<string, string> = {};
  if (tenant !== undefined && tenant !== "") headers[TENANT_HEADER] = tenant;

  const res = await fetch(`${env.apiBaseUrl}/v1/audit-log/export?${params.toString()}`, {
    method: "GET",
    credentials: "include",
    headers,
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
