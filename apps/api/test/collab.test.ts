import "reflect-metadata";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { CollabService, collabEntityPrefix, collabRoomKey } from "../src/realtime/collab.service.js";

/**
 * Server-authoritative collab docs (Phase R7). The property that matters: a late
 * joiner — one that opens a field AFTER edits were made — converges to the live
 * document by applying `state()`, instead of only seeing the persisted base. The
 * doc holds just the delta from the shared deterministic seed, so it never needs
 * the entity's text.
 */

/** Mirror of the web `seedUpdate` — a deterministic base every client shares. */
function seed(base: string): Uint8Array {
  const doc = new Y.Doc();
  doc.clientID = 0x5eed;
  if (base.length > 0) doc.getText("t").insert(0, base);
  return Y.encodeStateAsUpdate(doc);
}
const toB64 = (u: Uint8Array): string => Buffer.from(u).toString("base64");
const fromB64 = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "base64"));
const text = (doc: Y.Doc): string => {
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return doc.getText("t").toString();
};

describe("CollabService", () => {
  const room = collabRoomKey("t1", "eightd", "e1", "D5");

  it("accumulates updates and serves them as state; a late joiner converges", () => {
    const svc = new CollabService();

    // Editor A: seed the shared base locally, make an edit, relay the delta.
    const a = new Y.Doc();
    Y.applyUpdate(a, seed("cause: "), "seed");
    let aUpdate: Uint8Array = new Uint8Array();
    a.on("update", (u: Uint8Array, origin: unknown) => {
      if (origin !== "remote") aUpdate = u;
    });
    a.getText("t").insert(a.getText("t").length, "worn bearing");
    svc.apply(room, toB64(aUpdate));

    expect(svc.state(room)).not.toBeNull();

    // Late joiner B: seeds the same base, then applies the server state.
    const b = new Y.Doc();
    Y.applyUpdate(b, seed("cause: "), "seed");
    Y.applyUpdate(b, fromB64(svc.state(room) as string), "remote");

    expect(text(b)).toBe("cause: worn bearing");
    expect(text(b)).toBe(text(a));
  });

  it("returns null state for a room with no edits", () => {
    const svc = new CollabService();
    expect(svc.state(collabRoomKey("t1", "ncr", "never", "x"))).toBeNull();
  });

  it("keeps rooms (and tenants) isolated", () => {
    const svc = new CollabService();
    const roomA = collabRoomKey("t1", "eightd", "e1", "D5");
    const roomB = collabRoomKey("t2", "eightd", "e1", "D5"); // different tenant

    const doc = new Y.Doc();
    Y.applyUpdate(doc, seed(""), "seed");
    let upd: Uint8Array = new Uint8Array();
    doc.on("update", (u: Uint8Array, o: unknown) => {
      if (o !== "remote") upd = u;
    });
    doc.getText("t").insert(0, "tenant-1 only");
    svc.apply(roomA, toB64(upd));

    expect(svc.state(roomA)).not.toBeNull();
    expect(svc.state(roomB)).toBeNull(); // other tenant's room is untouched
  });

  it("evict drops a room's doc", () => {
    const svc = new CollabService();
    const doc = new Y.Doc();
    Y.applyUpdate(doc, seed("x"), "seed");
    let upd: Uint8Array = new Uint8Array();
    doc.on("update", (u: Uint8Array, o: unknown) => {
      if (o !== "remote") upd = u;
    });
    doc.getText("t").insert(1, "y");
    svc.apply(room, toB64(upd));
    expect(svc.roomCount).toBe(1);
    svc.evict(room);
    expect(svc.roomCount).toBe(0);
    expect(svc.state(room)).toBeNull();
  });

  it("ignores a malformed update without throwing", () => {
    const svc = new CollabService();
    expect(() => svc.apply(room, "not-base64-yjs!!!")).not.toThrow();
  });

  it("evictEntity drops all of one entity's field docs, sparing others (R8)", () => {
    const svc = new CollabService();
    const seedRoom = (r: string): void => {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, seed("x"), "seed");
      let upd: Uint8Array = new Uint8Array();
      doc.on("update", (u: Uint8Array, o: unknown) => {
        if (o !== "remote") upd = u;
      });
      doc.getText("t").insert(1, "y");
      svc.apply(r, toB64(upd));
    };
    seedRoom(collabRoomKey("t1", "eightd", "e9", "D5"));
    seedRoom(collabRoomKey("t1", "eightd", "e9", "D6"));
    seedRoom(collabRoomKey("t1", "eightd", "other", "D5"));
    expect(svc.roomCount).toBe(3);

    const evicted = svc.evictEntity(collabEntityPrefix("t1", "eightd", "e9"));

    expect(evicted).toBe(2); // both of e9's fields
    expect(svc.roomCount).toBe(1); // the other entity's doc survives
    expect(svc.state(collabRoomKey("t1", "eightd", "other", "D5"))).not.toBeNull();
  });
});
