import { Platform } from "react-native";

import type { FormResponses } from "@kaenal/types";

import { apiClient } from "@/lib/api";
import { services } from "@/services";
import { ensurePermission } from "@/services/permissions";
import { uuidv7 } from "@/sync/ids";
import type { PendingFile } from "@/sync/types";

/**
 * Evidence pipeline (05 §M7) — capture → local `pending_files` → presign-at-push
 * → S3/MinIO PUT → complete. A photo is stored locally with a client id and only
 * uploaded during the sync cycle (the engine's `uploadFiles` hook), so capture
 * works fully offline. The referencing mutation depends on the file id and, at
 * push time, its payload's local ids are resolved to the server ids.
 */

/** Pick/compress a photo and stage it as a pending file. Returns the local id. */
export async function addPhotoEvidence(source: "camera" | "library"): Promise<{ id: string; uri: string } | null> {
  const camera = services.camera as
    | (typeof services.camera & { pickImage?: (s: "camera" | "library") => Promise<{ uri: string; mime: string; size: number } | null> })
    | undefined;
  if (!camera?.pickImage) return null;

  // Gate the device camera behind the runtime permission — request it, re-ask if
  // the OS still allows, and route to Settings when permanently denied (05 §3).
  // The library/file-dialog path (and web) needs no camera permission.
  if (source === "camera" && (await ensurePermission("camera", "Photo capture")) !== "granted") return null;

  const picked = await camera.pickImage(source);
  if (picked === null) return null;

  const compressed = (await services.files?.compressImage(picked.uri)) ?? { uri: picked.uri, mimeType: picked.mime };
  const uri = compressed.uri;
  const mime = compressed.mimeType || picked.mime || "image/jpeg";
  const bytes = picked.size > 0 ? picked.size : await byteSize(uri);

  const file: PendingFile = {
    id: uuidv7(),
    localUri: uri,
    mime,
    bytes,
    sha256: null,
    status: "pending",
    remoteId: null,
    error: null,
    createdAt: new Date().toISOString(),
  };
  await services.syncStore.putFile(file);
  return { id: file.id, uri };
}

/** Stage arbitrary already-produced bytes (e.g. a signature PNG data URL). */
export async function addBytesEvidence(uri: string, mime: string): Promise<string> {
  const file: PendingFile = {
    id: uuidv7(),
    localUri: uri,
    mime,
    bytes: await byteSize(uri),
    sha256: null,
    status: "pending",
    remoteId: null,
    error: null,
    createdAt: new Date().toISOString(),
  };
  await services.syncStore.putFile(file);
  return file.id;
}

/** The engine's `uploadFiles` hook: presign → PUT → complete each pending file. */
export async function uploadPendingFiles(): Promise<void> {
  const files = await services.syncStore.listFiles();
  for (const f of files) {
    if (f.status === "uploaded" && f.remoteId !== null) continue;
    try {
      await services.syncStore.putFile({ ...f, status: "uploading", error: null });
      const remoteId = await uploadOne(f);
      await services.syncStore.putFile({ ...f, status: "uploaded", remoteId, error: null });
    } catch {
      // Leave it retryable — the next cycle tries again (transient / offline).
      await services.syncStore.putFile({ ...f, status: "pending", error: "Upload failed; will retry." });
    }
  }
}

async function uploadOne(file: PendingFile): Promise<string> {
  const filename = file.localUri.split(/[/\\?#]/).pop() || `capture-${file.id}.jpg`;
  const bytes = file.bytes > 0 ? file.bytes : await byteSize(file.localUri);
  const presign = await apiClient.presignFile({ body: { filename, mime: file.mime, sizeBytes: bytes } });
  if (presign.status !== 201) throw new Error(`presign ${presign.status}`);
  await putBytes(presign.body.uploadUrl, file.localUri, file.mime);
  const done = await apiClient.completeFile({ params: { id: presign.body.fileId }, body: {} });
  if (done.status !== 200) throw new Error(`complete ${done.status}`);
  return presign.body.fileId;
}

/** Every referenced local file id in `responses` that is still a pending file. */
export async function pendingFileIdsIn(responses: FormResponses): Promise<string[]> {
  const files = await services.syncStore.listFiles();
  const known = new Set(files.map((f) => f.id));
  return [...collectIds(responses)].filter((id) => known.has(id));
}

/** Rewrite local file ids in `responses` to their uploaded server ids. */
export async function resolveResponseFileIds(responses: FormResponses): Promise<FormResponses> {
  const files = await services.syncStore.listFiles();
  const map = new Map(files.filter((f) => f.remoteId !== null).map((f) => [f.id, f.remoteId!]));
  const out: FormResponses = {};
  for (const [k, v] of Object.entries(responses)) {
    out[k] = Array.isArray(v) ? v.map((x) => (typeof x === "string" && map.has(x) ? map.get(x)! : x)) : v;
  }
  return out;
}

/** Map local pending-file ids → their uploaded server ids. Unresolved ids are
 *  dropped (a create gated on `dependsOnFileIds` only runs once all uploaded). */
export async function resolveFileIds(localIds: string[]): Promise<string[]> {
  const files = await services.syncStore.listFiles();
  const map = new Map(files.filter((f) => f.remoteId !== null).map((f) => [f.id, f.remoteId!]));
  return localIds.map((id) => map.get(id)).filter((id): id is string => id !== undefined);
}

/** Collect string ids from array-valued responses (photo/signature fields). */
function collectIds(responses: FormResponses): Set<string> {
  const ids = new Set<string>();
  for (const v of Object.values(responses)) {
    if (Array.isArray(v)) for (const x of v) if (typeof x === "string") ids.add(x);
  }
  return ids;
}

/** PUT the file's bytes to the presigned URL — blob on web, file uri on native. */
async function putBytes(uploadUrl: string, localUri: string, mime: string): Promise<void> {
  if (Platform.OS === "web") {
    const blob = await (await fetch(localUri)).blob();
    const res = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": mime }, body: blob });
    if (!res.ok) throw new Error(`PUT ${res.status}`);
    return;
  }
  // uploadAsync + FileSystemUploadType live in the legacy API surface (SDK 54+).
  const FS = require("expo-file-system/legacy") as typeof import("expo-file-system/legacy");
  const result = await FS.uploadAsync(uploadUrl, localUri, {
    httpMethod: "PUT",
    uploadType: FS.FileSystemUploadType.BINARY_CONTENT,
    headers: { "content-type": mime },
  });
  if (result.status < 200 || result.status >= 300) throw new Error(`PUT ${result.status}`);
}

async function byteSize(uri: string): Promise<number> {
  try {
    const blob = await (await fetch(uri)).blob();
    return blob.size;
  } catch {
    return 0;
  }
}
