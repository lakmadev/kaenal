import { defineConfig } from "vitest/config";

// Only the PURE offline-engine modules are unit-tested here (sync/* + the in-memory
// store). They import nothing platform-specific, so the suite runs under plain Node
// without a React Native / Expo runtime. Screen/component tests use Maestro (M13).
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
