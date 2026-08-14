import type { Env } from "../../env.js";
import type { Storage } from "../../files/storage.js";
import type { Scanner } from "./scanner.port.js";
import { StubScanner } from "./stub.adapter.js";
import { ClamAvScanner } from "./clamav.adapter.js";

/**
 * Select the AV engine from configuration. `AV_PROVIDER=stub` (default) verdicts
 * by filename and touches no bytes — right for dev/test/CI. `clamav` streams the
 * object to a clamd daemon. Switching is one env var; the scan pipeline is
 * identical either way.
 */
export function createScanner(env: Env, storage: Storage): Scanner {
  switch (env.AV_PROVIDER) {
    case "clamav":
      return new ClamAvScanner(
        { host: env.CLAMAV_HOST, port: env.CLAMAV_PORT, timeoutMs: env.CLAMAV_TIMEOUT_MS },
        storage,
      );
    case "stub":
      return new StubScanner();
  }
}
