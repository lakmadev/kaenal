import type { ScanStatus } from "@kaenal/types";

/**
 * Antivirus port (Ports & Adapters). A completed upload is scanned through this
 * interface; the engine behind it (ClamAV in prod, a filename stub in dev/test)
 * is chosen by `createScanner` from `AV_PROVIDER`. The verdict is one of the
 * terminal `files.scan_status` states — an infected file is then never
 * downloadable, by anyone (07 §3).
 */
export interface ScanInput {
  /** Original filename — used by the stub's marker heuristic and for diagnostics. */
  readonly filename: string;
  /** Object-storage key; the real adapter streams these bytes to the engine. */
  readonly key: string;
}

export interface Scanner {
  scan(input: ScanInput): Promise<Exclude<ScanStatus, "pending">>;
}
