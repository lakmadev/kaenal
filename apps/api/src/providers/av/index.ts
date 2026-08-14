export type { Scanner, ScanInput } from "./scanner.port.js";
export { createScanner } from "./factory.js";
export { StubScanner } from "./stub.adapter.js";
export { ClamAvScanner, type ClamAvConfig } from "./clamav.adapter.js";
