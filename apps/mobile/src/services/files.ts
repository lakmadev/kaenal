import { Platform } from "react-native";

import type { FilesPort, LocalFile } from "./ports";

/**
 * Local evidence storage + image compression (05 §M7 / §2.2) behind FilesPort.
 * Native compresses with expo-image-manipulator (≤2000px, ~80% JPEG) to keep the
 * offline queue small and uploads cheap; on web the picked file is used as-is
 * (the browser already hands us a bounded blob). Byte size is resolved at upload
 * time, so this port stays free of the shifting expo-file-system surface.
 */
export const filesAdapter: FilesPort = {
  async save(sourceUri, name): Promise<LocalFile> {
    // The picker already returns a stable app-scoped URI on native and an object
    // URL on web; both survive until the upload completes, so no copy is needed.
    return { uri: sourceUri, name, mimeType: guessMime(name), size: 0 };
  },

  async compressImage(uri): Promise<LocalFile> {
    const name = (uri.split("/").pop() ?? "photo").replace(/\.[a-z0-9]+$/i, "") + ".jpg";
    if (Platform.OS === "web") return { uri, name, mimeType: "image/jpeg", size: 0 };
    const IM = require("expo-image-manipulator") as typeof import("expo-image-manipulator");
    const out = await IM.manipulateAsync(uri, [{ resize: { width: 2000 } }], {
      compress: 0.8,
      format: IM.SaveFormat.JPEG,
    });
    return { uri: out.uri, name, mimeType: "image/jpeg", size: 0 };
  },

  async remove(): Promise<void> {
    // Cleanup is a no-op for now; the OS reclaims picker temp files. The storage
    // gauge + explicit eviction land with the offline-storage screen (M11).
  },

  async usage(): Promise<number> {
    return 0;
  },
};

function guessMime(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "heic") return "image/heic";
  if (ext === "webp") return "image/webp";
  if (ext === "m4a" || ext === "mp4") return "audio/mp4";
  return "image/jpeg";
}
