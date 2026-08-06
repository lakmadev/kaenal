"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type {
  FileDto,
  PortalPpapDto,
  PortalPpapResubmitBody,
  PortalScarDto,
  PortalScarRespondBody,
  PresignFileResult,
} from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/** The partner's own supplier identity — also the portal's session guard. */
export function usePortalIdentity() {
  return useQuery(apiQueries.portal.identity(getApiClient()));
}

export function usePortalScars() {
  return useQuery(apiQueries.portal.scars(getApiClient()));
}

export function usePortalScar(id: string) {
  return useQuery(apiQueries.portal.scar(getApiClient(), id));
}

export function usePortalPpapList() {
  return useQuery(apiQueries.portal.ppapList(getApiClient()));
}

export function usePortalPpap(id: string) {
  return useQuery(apiQueries.portal.ppap(getApiClient(), id));
}

/** Upload evidence through the PARTNER-scoped presign flow (P11) — never the
 *  internal `/v1/files/*` routes. Presign → PUT straight to storage → complete;
 *  returns the completed (scan-pending) file. The caller attaches the returned
 *  `id` to their SCAR/PPAP via the respond/re-submit `fileIds`. */
export async function uploadPortalEvidence(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<FileDto> {
  const client = getApiClient();
  const mime = file.type !== "" ? file.type : "application/octet-stream";
  const presign = await client
    .presignPortalEvidence({ body: { filename: file.name, mime, sizeBytes: file.size } })
    .then((r) => unwrap<PresignFileResult>(r));

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", presign.uploadUrl);
    xhr.setRequestHeader("Content-Type", mime);
    xhr.upload.onprogress = (e): void => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = (): void => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = (): void => reject(new Error("Upload failed"));
    xhr.send(file);
  });

  return client
    .completePortalEvidence({ params: { id: presign.fileId }, body: {} })
    .then((r) => unwrap<FileDto>(r));
}

/** Respond to a SCAR (note + optional acknowledge). Writes the returned record
 *  into the detail cache and refreshes the list. */
export function useRespondScar(id: string) {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PortalScarRespondBody) =>
      client.respondPortalScar({ params: { id }, body }).then((r) => unwrap<PortalScarDto>(r)),
    onSuccess: (scar) => {
      qc.setQueryData(queryKeys.portal.scar(id), scar);
      void qc.invalidateQueries({ queryKey: queryKeys.portal.scars() });
    },
  });
}

/** Re-submit a PPAP package after changes-requested feedback. */
export function useResubmitPpap(id: string) {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PortalPpapResubmitBody) =>
      client.resubmitPortalPpap({ params: { id }, body }).then((r) => unwrap<PortalPpapDto>(r)),
    onSuccess: (ppap) => {
      qc.setQueryData(queryKeys.portal.ppap(id), ppap);
      void qc.invalidateQueries({ queryKey: queryKeys.portal.ppapList() });
    },
  });
}
