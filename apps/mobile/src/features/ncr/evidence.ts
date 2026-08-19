// NCR evidence (m-ncr detail + verify photo strips). The files routes live
// OUTSIDE the ts-rest contract (plain REST on FilesController), so — like
// `account-api.ts` — we call them with an authenticated bearer fetch. The list
// is `GET /v1/files?entityKind=&entityId=`; each clean image's viewable URL is
// `GET /v1/files/:id/download?disposition=inline`.

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type { EntityKind, FileDto } from "@kaenal/types";

import { API_BASE_URL } from "@/lib/api";
import { useSession } from "@/stores/session";

export interface EvidenceItem {
  id: string;
  filename: string;
  mime: string;
  isImage: boolean;
  /** Inline presigned URL for a viewable image, else null (non-image, or not
   *  yet scan-clean / not downloadable to this user). */
  url: string | null;
}

function authedHeaders(): Record<string, string> {
  const { token, tenant } = useSession.getState();
  const h: Record<string, string> = { "x-auth-mode": "bearer" };
  if (tenant) h["x-tenant-id"] = tenant;
  if (token) h["authorization"] = `Bearer ${token}`;
  return h;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: authedHeaders() });
  const text = await res.text();
  const json: unknown = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error((json as { error?: { message?: string } }).error?.message ?? "Request failed");
  return json as T;
}

/** List evidence attached to an entity, resolving each image's inline URL. */
export async function fetchEvidence(entityKind: EntityKind, entityId: string): Promise<EvidenceItem[]> {
  const { items } = await getJson<{ items: FileDto[] }>(
    `/v1/files?entityKind=${encodeURIComponent(entityKind)}&entityId=${encodeURIComponent(entityId)}`,
  );
  return Promise.all(
    items.map(async (f): Promise<EvidenceItem> => {
      const isImage = f.mime.startsWith("image/");
      let url: string | null = null;
      if (isImage) {
        try {
          const dl = await getJson<{ url: string }>(`/v1/files/${f.id}/download?disposition=inline`);
          url = dl.url;
        } catch {
          // Still scanning / not downloadable to this user — show a placeholder tile.
          url = null;
        }
      }
      return { id: f.id, filename: f.filename, mime: f.mime, isImage, url };
    }),
  );
}

/** Evidence for an NCR (`entity_kind='ncr'`). */
export function useNcrEvidence(id: string): UseQueryResult<EvidenceItem[]> {
  const tenant = useSession((s) => s.tenant);
  return useQuery({
    queryKey: ["ncr-evidence", tenant, id],
    queryFn: () => fetchEvidence("ncr", id),
    enabled: tenant !== null && id !== "",
    staleTime: 60_000,
  });
}
