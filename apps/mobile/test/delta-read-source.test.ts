import { describe, expect, it, vi } from "vitest";

import { createDeltaReadSource, type DeltaFetcher, type SyncReadSource } from "../src/sync/read-source.js";

/**
 * The real delta read source (05 §2.1): pull an entity through its `/v1/sync/*`
 * endpoint, page until the server clears `hasMore`, surface tombstones as deleted
 * mirror rows, and fall back to the list source for entities without a delta
 * endpoint.
 */
describe("createDeltaReadSource", () => {
  it("pages until hasMore is false and persists the last cursor", async () => {
    const fetch: DeltaFetcher = vi
      .fn()
      .mockResolvedValueOnce({
        changed: [{ id: "a", updatedAt: "2026-01-01T00:00:01.000Z", version: 1 }],
        deleted: [],
        nextCursor: "c1",
        hasMore: true,
      })
      .mockResolvedValueOnce({
        changed: [{ id: "b", updatedAt: "2026-01-01T00:00:02.000Z", version: 3 }],
        deleted: ["z"],
        nextCursor: "c2",
        hasMore: false,
      });
    const src = createDeltaReadSource({ ncr: fetch }, listStub());

    const batch = await src.pull("ncr", null);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(batch.cursor).toBe("c2");
    // Two changed rows (not tombstoned) + one tombstone for the deleted id.
    const live = batch.rows.filter((r) => !r.deleted).map((r) => r.id);
    expect(live).toEqual(["a", "b"]);
    const tomb = batch.rows.find((r) => r.id === "z");
    expect(tomb?.deleted).toBe(true);
    expect(tomb?.data).toBeNull();
  });

  it("maps a changed DTO onto a live mirror row carrying its version", async () => {
    const fetch: DeltaFetcher = vi.fn().mockResolvedValue({
      changed: [{ id: "a", updatedAt: "2026-01-01T00:00:01.000Z", version: 7 }],
      deleted: [],
      nextCursor: "c1",
      hasMore: false,
    });
    const src = createDeltaReadSource({ ncr: fetch }, listStub());
    const batch = await src.pull("ncr", null);
    expect(batch.rows[0]).toMatchObject({ id: "a", entityType: "ncr", version: 7, deleted: false });
  });

  it("stops paging at maxPages even if the server never clears hasMore", async () => {
    const fetch: DeltaFetcher = vi.fn().mockResolvedValue({
      changed: [{ id: "a", updatedAt: "2026-01-01T00:00:01.000Z", version: 1 }],
      deleted: [],
      nextCursor: "c",
      hasMore: true,
    });
    const src = createDeltaReadSource({ ncr: fetch }, listStub(), { maxPages: 3 });
    await src.pull("ncr", null);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("falls back to the list source for an entity without a delta fetcher", async () => {
    const fallback = listStub();
    const src = createDeltaReadSource({ ncr: vi.fn() }, fallback);
    await src.pull("audit", "since-cursor");
    expect(fallback.pull).toHaveBeenCalledWith("audit", "since-cursor");
  });
});

function listStub(): SyncReadSource {
  return { pull: vi.fn().mockResolvedValue({ rows: [], cursor: null }) };
}
