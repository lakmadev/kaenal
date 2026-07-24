import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/** Vitest for the web app. Node environment for pure-logic tests; the `@/` alias
 *  mirrors tsconfig so tests import the same way components do. Component/DOM
 *  tests (jsdom + Testing Library) slot in per module as screens are built. */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
  },
});
