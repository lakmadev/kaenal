import { forwardRef, useImperativeHandle } from "react";

// Web stub: live on-frame detection needs the native camera. The screen renders
// its honest fallback instead of this; `capture` never yields a frame here.

export interface DetectCameraHandle {
  capture(): Promise<string | null>;
}

export const DetectCamera = forwardRef<DetectCameraHandle>(function DetectCamera(_props, ref) {
  useImperativeHandle(ref, () => ({ capture: () => Promise.resolve(null) }));
  return null;
});
