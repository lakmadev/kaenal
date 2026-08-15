import { kvAdapter } from "./kv";
import type { Services } from "./ports";
import { secureStoreAdapter } from "./secure-store";

// The service registry — the single place platform adapters are wired. Swap a
// service by swapping the adapter here; nothing else in the app changes.
// db/files/camera/location/notifications/biometric adapters are added in their
// phases (M3–M13); until then those slots are undefined and features guard on them.
export const services: Services = {
  kv: kvAdapter,
  secureStore: secureStoreAdapter,
};

export type { Services } from "./ports";
export * from "./ports";
