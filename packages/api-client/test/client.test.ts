import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "../src/client.js";

/**
 * The client's job is to speak the API's conventions correctly: the tenant
 * header, cookie-vs-bearer auth, and double-submit CSRF on unsafe cookie
 * requests. These tests stub global `fetch` and assert the request that goes
 * out, plus that a response comes back as the ts-rest discriminated union.
 */

interface Captured {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  credentials?: RequestCredentials;
}

let last: Captured | null = null;

function stubFetch(status: number, body: unknown): void {
  const mock = (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    last = {
      url: typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      method: init.method ?? "GET",
      headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
      body: typeof init.body === "string" ? init.body : null,
      ...(init.credentials !== undefined ? { credentials: init.credentials } : {}),
    };
    return Promise.resolve(
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
    );
  };
  vi.stubGlobal("fetch", mock);
}

afterEach(() => {
  vi.unstubAllGlobals();
  last = null;
});

describe("request wiring", () => {
  it("sends the tenant header and cookies, no CSRF on a GET", async () => {
    stubFetch(200, { items: [], nextCursor: null });
    const client = createApiClient({ baseUrl: "http://api.test", tenant: "acme", credentials: "include" });

    const res = await client.listNcrs({ query: { limit: 20 } });

    expect(res.status).toBe(200);
    expect(last?.url).toContain("/v1/ncrs");
    expect(last?.method).toBe("GET");
    expect(last?.headers["x-tenant-id"]).toBe("acme");
    expect(last?.headers["x-csrf-token"]).toBeUndefined();
    expect(last?.credentials).toBe("include");
  });

  it("echoes the CSRF token on an unsafe cookie-authenticated request", async () => {
    stubFetch(201, { id: "00000000-0000-0000-0000-000000000001" });
    const client = createApiClient({ baseUrl: "http://api.test", tenant: "acme", csrfToken: "csrf-abc" });

    await client.createNcr({ body: { title: "Bad weld", priority: "major" } });

    expect(last?.method).toBe("POST");
    expect(last?.headers["x-csrf-token"]).toBe("csrf-abc");
    expect(last?.headers["authorization"]).toBeUndefined();
    expect(last?.body).toContain("Bad weld");
  });

  it("uses a bearer token and skips CSRF when one is set (mobile)", async () => {
    stubFetch(201, { id: "00000000-0000-0000-0000-000000000002" });
    const client = createApiClient({ baseUrl: "http://api.test", tenant: "acme", token: "session-xyz" });

    await client.createNcr({ body: { title: "Missing torque", priority: "minor" } });

    expect(last?.headers["authorization"]).toBe("Bearer session-xyz");
    expect(last?.headers["x-csrf-token"]).toBeUndefined();
  });

  it("resolves a dynamic tenant getter per request", async () => {
    stubFetch(200, { userId: "u", tenantSlug: "globex", role: "admin", capabilities: [] });
    let workspace = "acme";
    const client = createApiClient({ baseUrl: "http://api.test", tenant: () => workspace });

    workspace = "globex";
    await client.getMe();
    expect(last?.headers["x-tenant-id"]).toBe("globex");
  });

  it("returns non-2xx as data, not a throw (the error envelope)", async () => {
    stubFetch(404, { error: { code: "NOT_FOUND", message: "No such NCR" } });
    const client = createApiClient({ baseUrl: "http://api.test", tenant: "acme" });

    const res = await client.getNcr({ params: { id: "00000000-0000-0000-0000-0000000000ff" } });
    expect(res.status).toBe(404);
  });
});
