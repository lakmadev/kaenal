"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { apiQueries, unwrap } from "@kaenal/api-client";
import type { DownloadFileResult, FileDto, PresignFileResult } from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/**
 * Files (03 §7). The three-step upload — presign → PUT straight to storage →
 * complete — lives here so the create/new-version dialogs just `await
 * uploadFile(file)` and attach the returned `fileId`. The PUT goes through
 * `XMLHttpRequest` (not the API client) because it targets the presigned
 * storage URL directly and we want real upload progress for the drop zone.
 */

function putWithProgress(url: string, file: File, mime: string, onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
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
}

/** Presign → upload → complete. Returns the completed (scan-pending) file row. */
export async function uploadFile(file: File, onProgress?: (pct: number) => void): Promise<FileDto> {
  const client = getApiClient();
  const mime = file.type !== "" ? file.type : "application/octet-stream";
  const presign = await client
    .presignFile({ body: { filename: file.name, mime, sizeBytes: file.size } })
    .then((r) => unwrap<PresignFileResult>(r));
  await putWithProgress(presign.uploadUrl, file, mime, onProgress);
  return client.completeFile({ params: { id: presign.fileId }, body: {} }).then((r) => unwrap<FileDto>(r));
}

/** File metadata (mime, size, scan status) for icons/sizes and the preview gate. */
export function useFile(id: string | null | undefined) {
  const q = apiQueries.files.detail(getApiClient(), id ?? "");
  return useQuery({ ...q, enabled: id !== null && id !== undefined && id !== "" });
}

/**
 * A presigned INLINE url for rendering a file in place (the document Preview).
 * A declarative query — StrictMode-safe and cached for the URL's lifetime —
 * rather than an imperative mutation, so the iframe/img always gets its src.
 * Fires the audited download once per fileId (03 §7, 07 §1).
 */
export function usePreviewUrl(fileId: string | null | undefined) {
  const client = getApiClient();
  return useQuery({
    queryKey: ["file", fileId ?? "", "preview"],
    queryFn: () =>
      client
        .downloadFile({ params: { id: fileId as string }, query: { disposition: "inline" } })
        .then((r) => unwrap<DownloadFileResult>(r)),
    enabled: fileId !== null && fileId !== undefined && fileId !== "",
    staleTime: 10 * 60 * 1000, // presigned TTL is 15m; stay well within it
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * A short-TTL presigned GET for a clean file (03 §7). The server audits the
 * download and refuses files that are not `clean` (except to the uploader while
 * a scan is pending). The caller opens `result.url` on a user click.
 */
export function useDownloadFile() {
  const client = getApiClient();
  return useMutation({
    // disposition "inline" renders in the Preview iframe; default "attachment"
    // forces a download for the Download button.
    mutationFn: ({ id, disposition }: { id: string; disposition?: "inline" | "attachment" }) =>
      client
        .downloadFile({ params: { id }, query: disposition !== undefined ? { disposition } : {} })
        .then((r) => unwrap<DownloadFileResult>(r)),
  });
}
