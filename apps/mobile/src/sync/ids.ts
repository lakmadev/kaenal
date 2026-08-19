// uuid v7 — time-ordered ids so offline-created rows sort by creation and the
// server can validate them (05 §2.2: "client-supplied ids on create, validated:
// unused, v7"). Kept dependency-free and pure (crypto.getRandomValues is present
// on Hermes, RN, and the web/test runtime).

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  const g = globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } };
  if (g.crypto?.getRandomValues) {
    g.crypto.getRandomValues(out);
    return out;
  }
  // Deterministic-enough fallback for non-crypto environments; never reached on device.
  for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

const HEX: string[] = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));

/**
 * Generate a uuid v7: 48-bit big-endian Unix-millis timestamp, version/variant
 * bits set, remaining bits random. `now` is injectable for deterministic tests.
 */
export function uuidv7(now: number = Date.now()): string {
  const b = randomBytes(16);
  const ts = Math.floor(now);
  b[0] = (ts / 2 ** 40) & 0xff;
  b[1] = (ts / 2 ** 32) & 0xff;
  b[2] = (ts / 2 ** 24) & 0xff;
  b[3] = (ts / 2 ** 16) & 0xff;
  b[4] = (ts / 2 ** 8) & 0xff;
  b[5] = ts & 0xff;
  b[6] = (b[6]! & 0x0f) | 0x70; // version 7
  b[8] = (b[8]! & 0x3f) | 0x80; // variant 10
  return (
    HEX[b[0]!]! + HEX[b[1]!]! + HEX[b[2]!]! + HEX[b[3]!]! + "-" +
    HEX[b[4]!]! + HEX[b[5]!]! + "-" +
    HEX[b[6]!]! + HEX[b[7]!]! + "-" +
    HEX[b[8]!]! + HEX[b[9]!]! + "-" +
    HEX[b[10]!]! + HEX[b[11]!]! + HEX[b[12]!]! + HEX[b[13]!]! + HEX[b[14]!]! + HEX[b[15]!]!
  );
}

const V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Whether `s` is a well-formed uuid v7 — mirrors the server-side create validation. */
export function isUuidV7(s: string): boolean {
  return V7_RE.test(s);
}
