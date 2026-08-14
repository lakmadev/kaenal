import type { ScanStatus } from "@kaenal/types";
import type { Storage } from "../../files/storage.js";
import type { Scanner, ScanInput } from "./scanner.port.js";
import { clamdInstream } from "./clamd-client.js";

export interface ClamAvConfig {
  readonly host: string;
  readonly port: number;
  readonly timeoutMs: number;
}

/**
 * ClamAV adapter: streams the object's bytes to a `clamd` daemon over TCP
 * (INSTREAM) and maps the verdict onto `files.scan_status`. Customer bytes never
 * leave our infrastructure — clamd runs inside it — which is why a self-hosted
 * engine is the right choice for a regulated document store over any
 * send-the-file-to-a-vendor scanning API.
 *
 * The only two safe terminal verdicts are `clean` and `infected`. Anything else
 * clamd can say — a size-limit refusal, a scan error, an unreachable daemon — is
 * "we did NOT establish this file is clean", so we throw: the file stays
 * `pending` (never downloadable, per the 07 §3 gate) and the job retries, rather
 * than a false `clean` that would let an unscanned file through.
 */
export class ClamAvScanner implements Scanner {
  constructor(
    private readonly config: ClamAvConfig,
    private readonly storage: Storage,
  ) {}

  async scan(input: ScanInput): Promise<Exclude<ScanStatus, "pending">> {
    const stream = await this.storage.getStream(input.key);
    if (stream === null) {
      // The row exists but its object doesn't — a real inconsistency, not a
      // verdict. Throw so it's retried/inspected rather than declared clean.
      throw new Error(`clamav: object not found for key ${input.key}`);
    }

    const reply = await clamdInstream(stream, this.config);

    if (/\bFOUND\b/.test(reply)) return "infected";
    if (/\bOK\b/.test(reply)) return "clean";
    // e.g. "INSTREAM size limit exceeded", "ERROR", or anything unexpected.
    throw new Error(`clamav: could not scan ${input.key} — clamd said: ${reply || "<empty reply>"}`);
  }
}
