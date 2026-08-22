import * as Y from "yjs";

/**
 * Pure CRDT helpers for collaborative text (Phase R5). Kept apart from the React
 * component so the tricky bits — the single-region text diff and the
 * *deterministic* seed — are unit-tested directly.
 */

/** A fixed client id for the SEED doc so every client's base state is
 *  byte-identical and therefore convergent. Real edits happen under each client's
 *  own random id; only the shared base uses this. Chosen large + constant so it
 *  never collides with a random 53-bit client id in practice. */
const SEED_CLIENT_ID = 0x5eed;

/**
 * Reduce an old→new textarea value to one contiguous edit (common-prefix /
 * common-suffix). Covers ordinary typing, paste, and deletion at a single caret;
 * multi-region edits collapse to their bounding change, which Yjs still merges
 * consistently.
 */
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

/**
 * A deterministic Yjs update representing `base` as the shared starting state.
 * Every client applies this identical update, so they converge — as opposed to
 * each independently inserting `base` (which Yjs would treat as distinct items
 * and duplicate).
 */
export function seedUpdate(base: string): Uint8Array {
  const doc = new Y.Doc();
  doc.clientID = SEED_CLIENT_ID;
  if (base.length > 0) doc.getText("t").insert(0, base);
  return Y.encodeStateAsUpdate(doc);
}

/** The text content of a Y.Text. yjs's typings don't advertise a `string` return
 *  from `toString`, so the assertion lives here, once. */
export function ytextString(t: Y.Text): string {
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return t.toString();
}

/** Binary → base64 (browser-safe, byte by byte to stay valid for binary). */
export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** base64 → binary. */
export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
