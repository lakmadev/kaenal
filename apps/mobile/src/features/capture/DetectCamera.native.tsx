import { CameraView } from "expo-camera";
import { forwardRef, useImperativeHandle, useRef } from "react";

// Native live camera for CapCamera's on-frame AI detect (m-capture.jsx CapCamera).
// Isolated behind a Metro platform extension so expo-camera never enters the web
// bundle (same reason ScanCamera is split). Exposes an imperative `capture()` that
// grabs the current frame as base64 for the vision model — a throwaway preview
// grab, not staged evidence.

export interface DetectCameraHandle {
  capture(): Promise<string | null>;
}

export const DetectCamera = forwardRef<DetectCameraHandle>(function DetectCamera(_props, ref) {
  const camera = useRef<CameraView>(null);
  useImperativeHandle(ref, () => ({
    async capture() {
      const shot = await camera.current?.takePictureAsync({ base64: true, quality: 0.5, skipProcessing: true });
      return shot?.base64 ?? null;
    },
  }));
  return <CameraView ref={camera} style={{ flex: 1 }} facing="back" />;
});
