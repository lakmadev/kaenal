import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
} from "@expo-google-fonts/archivo";
import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono";
import { useFonts } from "expo-font";

// The font map the app root loads before rendering (keeps the splash up until the
// Archivo/JetBrains Mono faces are ready, so text never flashes in a system font).
export const fontMap = {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  JetBrainsMono_500Medium,
} as const;

export function useAppFonts(): boolean {
  const [loaded] = useFonts(fontMap);
  return loaded;
}
