import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { queryClient } from "@/lib/query-client";
import { useAppearance } from "@/stores/appearance";
import { useSession } from "@/stores/session";
import { ThemeProvider, useAppFonts } from "@/theme";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const fontsLoaded = useAppFonts();
  const appearanceHydrated = useAppearance((s) => s.hydrated);
  const appearanceMode = useAppearance((s) => s.mode);
  const setMode = useAppearance((s) => s.setMode);
  const sessionStatus = useSession((s) => s.status);

  // One-time bootstrap: rehydrate the persisted appearance + session.
  useEffect(() => {
    void useAppearance.getState().hydrate();
    void useSession.getState().bootstrap();
  }, []);

  const ready = fontsLoaded && appearanceHydrated && sessionStatus !== "loading";

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider initialMode={appearanceMode} onModeChange={setMode}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(app)" />
              <Stack.Screen name="(auth)" />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
