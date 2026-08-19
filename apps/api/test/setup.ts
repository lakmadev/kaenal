import { config } from "dotenv";

// Tests read the same .env the dev server does; CI supplies the vars directly.
config({ path: new URL("../../../.env", import.meta.url).pathname });

// The AI suite asserts the deterministic stub provider's output. A developer who
// flips their local .env to AI_PROVIDER=ollama (to try the vision model) must not
// have `pnpm test` start hitting a real model — pin the stub for tests. CI never
// sets AI_PROVIDER, so this is a no-op there.
process.env["AI_PROVIDER"] = "stub";
