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
 * A short-TTL presigned GET for a clean file (03 §7). The server audits the
 * download and refuses files that are not `clean` (except to the uploader while
 * a scan is pending). The caller opens `result.url` on a user click.
 */
export function useDownloadFile() {
  const client = getApiClient();
  return useMutation({
    mutationFn: (id: string) => client.downloadFile({ params: { id } }).then((r) => unwrap<DownloadFileResult>(r)),
  });
}
