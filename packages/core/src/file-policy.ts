import { allow, deny, type Decision } from "./result.js";

/**
 * Upload policy (03 §7, 07 §3). A pure gate on `{mime, sizeBytes}` — no HTTP,
 * no S3 — so the same rule runs in the API before a presign is issued and could
 * run in the client to fail fast. The mime list is an allowlist, not a
 * denylist: anything not named is refused, because a denylist is a race against
 * every new dangerous type. SVG is deliberately absent — it is an XSS vector
 * (07 §3) and must be sanitised or rejected, so it is rejected here.
 */

/** 25 MB (03 §7 default; tenant-configurable is a later setting). */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const ALLOWED_MIME_TYPES: readonly string[] = [
  // Images (evidence photos, diagrams). NOT image/svg+xml — see above.
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  // Documents.
  "application/pdf",
  "text/plain",
  "text/csv",
  // Office.
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

const ALLOWED = new Set(ALLOWED_MIME_TYPES);

export function isAllowedMime(mime: string): boolean {
  return ALLOWED.has(mime);
}

export function validateUpload(input: { mime: string; sizeBytes: number }): Decision {
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    return deny("VALIDATION_FAILED", "File size must be a positive number of bytes", {
      field: "sizeBytes",
    });
  }
  if (input.sizeBytes > MAX_FILE_BYTES) {
    return deny("VALIDATION_FAILED", "File exceeds the maximum upload size", {
      field: "sizeBytes",
      maxBytes: MAX_FILE_BYTES,
    });
  }
  if (!ALLOWED.has(input.mime)) {
    return deny("VALIDATION_FAILED", "Unsupported file type", {
      field: "mime",
      allowed: ALLOWED_MIME_TYPES,
    });
  }
  return allow();
}
