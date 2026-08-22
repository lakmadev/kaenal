import * as Y from "yjs";

/**
 * Pure CRDT helpers for mobile collaborative text (Phase R6.2) — the native
 * mirror of the web `collab-crdt`. Same deterministic seed (fixed clientID) and
 * same standard-base64 alphabet, so a web editor and a mobile editor on the SAME
 * field converge across platforms. React Native has no `btoa`/`atob`, so base64
 * is implemented here without a dependency.
 */

const SEED_CLIENT_ID = 0x5eed;
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Reduce an old→new value to one contiguous edit (common prefix/suffix). */
export function stringDiff(oldStr: string, newStr: string): {
  index: number;
  remove: number;
  insert: string;
} {
  let start = 0;
  const min = Math.min(oldStr.length, newStr.length);
  while (start < min && oldStr[start] === newStr[start]) start++;
  let endOld = oldStr.length;
  let endNew = newStr.length;
  while (endOld > start && endNew > start && oldStr[endOld - 1] === newStr[endNew - 1]) {
    endOld--;
    endNew--;
  }
  return { index: start, remove: endOld - start, insert: newStr.slice(start, endNew) };
}

/** Deterministic shared base — identical bytes on every client (incl. web). */
export function seedUpdate(base: string): Uint8Array {
  const doc = new Y.Doc();
  doc.clientID = SEED_CLIENT_ID;
  if (base.length > 0) doc.getText("t").insert(0, base);
  return Y.encodeStateAsUpdate(doc);
}

/** The text content of a Y.Text (yjs typings don't advertise a string return). */
export function ytextString(t: Y.Text): string {
  return t.toString();
}

/** Binary → standard base64 (no btoa on RN). */
export function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const has1 = i + 1 < bytes.length;
    const has2 = i + 2 < bytes.length;
    const b1 = has1 ? (bytes[i + 1] ?? 0) : 0;
    const b2 = has2 ? (bytes[i + 2] ?? 0) : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += has1 ? B64[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    out += has2 ? B64[b2 & 63] : "=";
  }
  return out;
}

/** Standard base64 → binary (no atob on RN). */
export function fromBase64(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, "");
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bi = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64.indexOf(clean[i] ?? "A");
    const c1 = B64.indexOf(clean[i + 1] ?? "A");
    const c2 = clean[i + 2] !== undefined ? B64.indexOf(clean[i + 2] as string) : -1;
    const c3 = clean[i + 3] !== undefined ? B64.indexOf(clean[i + 3] as string) : -1;
    bytes[bi++] = (c0 << 2) | (c1 >> 4);
    if (c2 >= 0) bytes[bi++] = ((c1 & 15) << 4) | (c2 >> 2);
    if (c3 >= 0) bytes[bi++] = ((c2 & 3) << 6) | c3;
  }
  return bytes.subarray(0, bi);
}
