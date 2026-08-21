import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "@/features/inspections/offline"; // registers the inspection puller + push handler
import "@/features/ncr/offline"; // registers the NCR puller + create/transition/verify handlers
import "@/features/work/offline"; // registers the 8D-step + CAPA-action-status handlers
import "@/features/oversight/offline"; // registers the document-review approval handler

import { registerForPushAsync, useNotificationRouting } from "@/features/notifications/push";
import { PERSIST_BUSTER, queryPersister } from "@/lib/persist-query";
import { queryClient } from "@/lib/query-client";
import { useAppearance } from "@/stores/appearance";
import { useHaptics } from "@/stores/haptics";
import { useSession } from "@/stores/session";
import { startSync } from "@/sync";
import { ThemeProvider, useAppFonts } from "@/theme";

void SplashScreen.preventAutoHideAsync();

// Web only: React Native Web renders every TextInput as a DOM <input>/<textarea>,
// which shows the browser's default focus outline (the orange inner box). Our fields
// draw their own focus treatment (accent border + ring, per m-auth.jsx), so suppress
// the UA outline app-wide — once, at module load. No-op on native.
if (Platform.OS === "web" && typeof document !== "undefined") {
  const STYLE_ID = "kaenal-input-focus-reset";
  if (!document.getElementById(STYLE_ID)) {
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent =
      "input,textarea,select,[contenteditable]{outline:none!important;-webkit-tap-highlight-color:transparent;}";
    document.head.appendChild(el);
  }
}

export default function RootLayout() {
  const fontsLoaded = useAppFonts();
  const appearanceHydrated = useAppearance((s) => s.hydrated);
  const appearanceMode = useAppearance((s) => s.mode);
  const setMode = useAppearance((s) => s.setMode);
  const sessionStatus = useSession((s) => s.status);

  // Route notification taps into the app (foreground + cold-start) via the shared
  // deep-link resolver (05 §3). No-op on web / when no notification opened us.
  useNotificationRouting();

  // One-time bootstrap: rehydrate the persisted appearance + haptics + session.
  useEffect(() => {
    void useAppearance.getState().hydrate();
    void useHaptics.getState().hydrate();
    void useSession.getState().bootstrap();
  }, []);

  const ready = fontsLoaded && appearanceHydrated && sessionStatus !== "loading";

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Boot the offline engine once the session is authenticated: init the local
  // store, run a first pull/push cycle, and keep the sync pill live (05 §2).
  // Also register for push (permission + Expo token) so alerts can deep-link.
  useEffect(() => {
    if (sessionStatus === "authenticated") {
      void startSync();
      void registerForPushAsync();
    }
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
            <Stack
              screenOptions={{
                headerShown: false,
                // A consistent, smooth slide for every push (iOS-native feel on
                // Android too), with the swipe-back gesture enabled.
                animation: "slide_from_right",
                animationDuration: 280,
                gestureEnabled: true,
              }}
            >
              <Stack.Screen name="(app)" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="priming" />
              <Stack.Screen name="switch-workspace" options={{ presentation: "transparentModal", animation: "fade" }} />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
