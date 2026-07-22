import { describe, expect, it } from "vitest";
import { ALLOWED_MIME_TYPES, MAX_FILE_BYTES, isAllowedMime, validateUpload } from "../src/file-policy.js";

describe("file upload policy (03 §7, 07 §3)", () => {
  it("accepts an allowed type within the size limit", () => {
    expect(validateUpload({ mime: "application/pdf", sizeBytes: 1024 }).ok).toBe(true);
    expect(validateUpload({ mime: "image/png", sizeBytes: MAX_FILE_BYTES }).ok).toBe(true);
  });

  it("rejects a type not on the allowlist", () => {
    const d = validateUpload({ mime: "application/x-msdownload", sizeBytes: 10 });
    expect(d.ok).toBe(false);
    if (!d.ok) {
      expect(d.code).toBe("VALIDATION_FAILED");
      expect(d.details?.["field"]).toBe("mime");
    }
  });

  it("rejects SVG — it is an XSS vector, not a safe image", () => {
    expect(isAllowedMime("image/svg+xml")).toBe(false);
    expect(validateUpload({ mime: "image/svg+xml", sizeBytes: 10 }).ok).toBe(false);
  });

  it("rejects a file over the size limit", () => {
    const d = validateUpload({ mime: "image/png", sizeBytes: MAX_FILE_BYTES + 1 });
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.details?.["maxBytes"]).toBe(MAX_FILE_BYTES);
  });

  it("rejects a zero or negative size", () => {
    expect(validateUpload({ mime: "image/png", sizeBytes: 0 }).ok).toBe(false);
    expect(validateUpload({ mime: "image/png", sizeBytes: -5 }).ok).toBe(false);
  });

  it("names each allowed type as allowed and nothing else", () => {
    for (const mime of ALLOWED_MIME_TYPES) expect(isAllowedMime(mime)).toBe(true);
    expect(isAllowedMime("application/zip")).toBe(false);
  });
});
