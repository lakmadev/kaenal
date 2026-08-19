import { useWindowDimensions } from "react-native";

// Breakpoint at 768pt: below is phone (single column + bottom tabs), at/above is
// tablet (wider content, and in later phases a side rail + master-detail). Reacts to
// iPad Split View / multitasking because it reads the live window size, not the
// device size.
const TABLET_MIN_WIDTH = 768;

export interface LayoutInfo {
  width: number;
  height: number;
  isTablet: boolean;
  isLandscape: boolean;
  /** Max content width so tablet screens never stretch a single column edge-to-edge. */
  contentMaxWidth: number;
}

export function useLayout(): LayoutInfo {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= TABLET_MIN_WIDTH;
  return {
    width,
    height,
    isTablet,
    isLandscape: width > height,
    contentMaxWidth: isTablet ? 720 : width,
  };
}
