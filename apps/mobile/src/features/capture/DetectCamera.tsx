import { forwardRef, useImperativeHandle } from "react";

// Base fallback — Metro resolves DetectCamera.native.tsx / .web.tsx per platform.
// This exists only so `import { DetectCamera } from "./DetectCamera"` typechecks.

export interface DetectCameraHandle {
  capture(): Promise<string | null>;
}

export const DetectCamera = forwardRef<DetectCameraHandle>(function DetectCamera(_props, ref) {
  useImperativeHandle(ref, () => ({ capture: () => Promise.resolve(null) }));
  return null;
});
