import type { RefObject } from "react";
import type { View } from "react-native";

import type { Mark } from "./marks";

// Base fallback — Metro resolves flatten.native.ts / flatten.web.ts per platform;
// this exists only so `import { flatten } from "./flatten"` typechecks. If ever
// reached (no platform match), it returns the original image unchanged.
export async function flatten(
  _ref: RefObject<View | null>,
  imageUri: string,
  _marks: Mark[],
  _w: number,
  _h: number,
): Promise<string> {
  return Promise.resolve(imageUri);
}
