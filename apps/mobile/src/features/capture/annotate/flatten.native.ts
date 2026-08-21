import type { RefObject } from "react";
import type { View } from "react-native";
import { captureRef } from "react-native-view-shot";

import type { Mark } from "./marks";

// Native flatten: snapshot the composed view (photo Image + Svg overlay) to a
// real JPEG file. The marks/size are implicit in the rendered view, so they are
// unused here — the web path (canvas) uses them instead.
export async function flatten(
  ref: RefObject<View | null>,
  _imageUri: string,
  _marks: Mark[],
  _w: number,
  _h: number,
  _mmPerPx: number | null = null,
): Promise<string> {
  if (ref.current === null) throw new Error("Nothing to capture");
  return captureRef(ref, { format: "jpg", quality: 0.9 });
}
