import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { createApiClient, TENANT_HEADER } from "@kaenal/api-client";

// M0 placeholder. Importing the shared workspace client here is deliberate: if
// Metro can resolve @kaenal/api-client (and, transitively, @kaenal/types + zod)
// from inside apps/mobile, the monorepo wiring is correct. Replaced by the real
// theme + navigation shell in M1–M2.
const CLIENT_LINKED = typeof createApiClient === "function";

export default function Index() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 24 }}>
        <Text style={{ fontSize: 26, fontWeight: "700", letterSpacing: -0.5 }}>Kaenal</Text>
        <Text style={{ opacity: 0.6, fontSize: 14 }}>Mobile scaffold · M0</Text>
        <Text style={{ opacity: 0.6, fontSize: 13, marginTop: 8 }}>
          shared api-client linked: {CLIENT_LINKED ? "yes" : "no"}
        </Text>
        <Text style={{ opacity: 0.4, fontSize: 12 }}>tenant header: {TENANT_HEADER}</Text>
      </View>
    </SafeAreaView>
  );
}
