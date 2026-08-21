import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * Mobile-only ESLint (flat). The repo-root `eslint.config.js` ignores
 * `apps/mobile/**` (React Native has its own toolchain), so `expo lint` — which
 * resolves the nearest flat config from this cwd — needs a config here or it
 * finds everything ignored and errors. This one uses Expo's recommended flat
 * preset and lints the mobile source for real.
 */
const expo = require("eslint-config-expo/flat.js");

export default [
  ...expo,
  {
    ignores: ["dist/**", ".expo/**", "expo-env.d.ts", "node_modules/**"],
  },
  {
    rules: {
      // React Native <Text> renders raw strings — the HTML entity-escaping rule
      // (a browser DOM concern) does not apply and would only clutter copy.
      "react/no-unescaped-entities": "off",
      // RN loads static assets via require('./x.png'); that idiom is expected.
      "@typescript-eslint/no-require-imports": "off",
      // eslint-plugin-react-hooks v6 ships experimental rules that false-positive
      // on valid RN idioms (e.g. `useRef(new Animated.Value(0)).current`, which
      // stores a stable mutable object, not a render-derived value). Keep them as
      // signal (warn), not a hard gate.
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];
