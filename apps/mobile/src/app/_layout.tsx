import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { PERSIST_BUSTER, queryPersister } from "@/lib/persist-query";
import { queryClient } from "@/lib/query-client";
import { useAppearance } from "@/stores/appearance";
import { useSession } from "@/stores/session";
import { startSync } from "@/sync";
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

  // Boot the offline engine once the session is authenticated: init the local
  // store, run a first pull/push cycle, and keep the sync pill live (05 §2).
  useEffect(() => {
    if (sessionStatus === "authenticated") void startSync();
  }, [sessionStatus]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister: queryPersister, buster: PERSIST_BUSTER }}
        >
          <ThemeProvider initialMode={appearanceMode} onModeChange={setMode}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(app)" />
              <Stack.Screen name="(auth)" />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
