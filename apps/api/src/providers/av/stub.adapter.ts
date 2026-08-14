import type { ScanStatus } from "@kaenal/types";
import type { Scanner, ScanInput } from "./scanner.port.js";

/**
 * The default scanner: no engine, verdicts by filename marker so the whole
 * pipeline (and both outcomes) is exercisable in dev/test/CI without ClamAV. A
 * name containing `eicar`/`infected`/`malware` is "infected"; everything else is
 * "clean". Never use in production — it inspects zero bytes.
 */
export class StubScanner implements Scanner {
  scan(input: ScanInput): Promise<Exclude<ScanStatus, "pending">> {
    const marked = /eicar|infected|malware/i.test(input.filename);
    return Promise.resolve(marked ? "infected" : "clean");
  }
}
