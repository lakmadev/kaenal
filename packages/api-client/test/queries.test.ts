import { describe, expect, it } from "vitest";
import type { ApiClient } from "../src/client.js";
import { ApiRequestError, apiQueries, unwrap } from "../src/queries.js";
import { queryKeys } from "../src/query-keys.js";

/**
 * The query-option factories are what the FE feeds to `useQuery`. They must
 * produce a stable, structured key and a `queryFn` that unwraps a 2xx body or
 * throws on an error status (so TanStack renders an error state).
 */

/** A minimal client stub — only the methods the factories under test call. */
function fakeClient(response: { status: number; body: unknown }): ApiClient {
  const reply = (): Promise<typeof response> => Promise.resolve(response);
  return {
    getMe: reply,
    listNcrs: reply,
    getNcr: reply,
    listNotifications: reply,
    unreadCount: reply,
  } as unknown as ApiClient;
}

describe("unwrap", () => {
  it("returns the body on a 2xx", async () => {
    await expect(unwrap({ status: 200, body: { ok: true } })).resolves.toEqual({ ok: true });
  });

  it("throws an ApiRequestError carrying the status and envelope on a non-2xx", async () => {
    await expect(unwrap({ status: 409, body: { error: { code: "CONFLICT" } } })).rejects.toBeInstanceOf(ApiRequestError);
    await unwrap({ status: 409, body: { error: { code: "CONFLICT" } } }).catch((e: unknown) => {
      expect((e as ApiRequestError).status).toBe(409);
    });
  });
});

describe("apiQueries", () => {
  it("builds the expected key and unwraps the body for a list", async () => {
    const page = { items: [{ id: "n1" }], nextCursor: null };
    const opt = apiQueries.ncrs.list(fakeClient({ status: 200, body: page }), { query: { status: "open" } });

    expect(opt.queryKey).toEqual(queryKeys.ncrs.list({ status: "open" }));
    await expect(opt.queryFn()).resolves.toEqual(page);
  });

  it("keys a detail query by id", async () => {
    const opt = apiQueries.ncrs.detail(fakeClient({ status: 200, body: { id: "n1" } }), "n1");
    expect(opt.queryKey).toEqual(queryKeys.ncrs.detail("n1"));
    await expect(opt.queryFn()).resolves.toEqual({ id: "n1" });
  });

  it("propagates an error status as a rejected queryFn", async () => {
    const opt = apiQueries.ncrs.detail(fakeClient({ status: 404, body: { error: {} } }), "missing");
    await expect(opt.queryFn()).rejects.toBeInstanceOf(ApiRequestError);
  });

  it("exposes the notifications unread-count under a stable key", async () => {
    const opt = apiQueries.notifications.unreadCount(fakeClient({ status: 200, body: { count: 3 } }));
    expect(opt.queryKey).toEqual(queryKeys.notifications.unreadCount());
    await expect(opt.queryFn()).resolves.toEqual({ count: 3 });
  });
});
