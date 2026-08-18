import { Platform } from "react-native";

import type { CameraPort, CapturedPhoto } from "./ports";

/** A picked/captured image with the fields the presign flow needs. */
export interface PickedImage {
  uri: string;
  width: number;
  height: number;
  mime: string;
  /** Byte size when the picker reports it (0 = unknown → resolved before upload). */
  size: number;
}

type Picker = typeof import("expo-image-picker");

/**
 * Photo capture (05 §M7) behind the CameraPort. Uses expo-image-picker: the
 * device camera on native, and a file dialog on web (so the evidence flow is
 * verifiable in the browser preview). `pickImage("camera" | "library")` returns
 * the richer descriptor the presign/upload pipeline needs.
 */
export const cameraAdapter: CameraPort & {
  pickImage: (source: "camera" | "library") => Promise<PickedImage | null>;
} = {
  async requestPermission() {
    if (Platform.OS === "web") return true;
    const IP = require("expo-image-picker") as Picker;
    const cam = await IP.requestCameraPermissionsAsync();
    return cam.granted;
  },

  async capturePhoto(): Promise<CapturedPhoto | null> {
    const img = await this.pickImage(Platform.OS === "web" ? "library" : "camera");
    return img === null ? null : { uri: img.uri, width: img.width, height: img.height };
  },

  async pickImage(source): Promise<PickedImage | null> {
    const IP = require("expo-image-picker") as Picker;
    const opts = { quality: 0.85, mediaTypes: ["images"] as ["images"] };
    // Camera isn't available in the web preview → fall back to the file dialog.
    const useCamera = source === "camera" && Platform.OS !== "web";
    const res = useCamera ? await IP.launchCameraAsync(opts) : await IP.launchImageLibraryAsync(opts);
    if (res.canceled || res.assets.length === 0) return null;
    const a = res.assets[0]!;
    return {
      uri: a.uri,
      width: a.width ?? 0,
      height: a.height ?? 0,
      mime: a.mimeType ?? "image/jpeg",
      size: a.fileSize ?? 0,
    };
  },
};
