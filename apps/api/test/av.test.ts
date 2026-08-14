import net from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnv } from "../src/env.js";
import { FakeStorage } from "../src/files/storage.js";
import { createScanner } from "../src/providers/av/factory.js";
import { StubScanner } from "../src/providers/av/stub.adapter.js";
import { ClamAvScanner } from "../src/providers/av/clamav.adapter.js";

/**
 * Antivirus provider layer (providers/av). The ClamAV adapter is exercised
 * against a mock clamd TCP server that speaks the INSTREAM protocol, so both
 * verdicts and the error path are covered hermetically — no real clamd needed.
 */

const BASE_ENV: NodeJS.ProcessEnv = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  DATABASE_APP_URL: "postgres://u:p@localhost:5432/db",
  DATABASE_PUBLIC_URL: "postgres://u:p@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  AUTH_SECRET: "0123456789abcdef0123456789abcdef",
  APP_BASE_URL: "http://localhost:3000",
};

const TERMINATOR = Buffer.from([0, 0, 0, 0]);

/**
 * A stand-in clamd: accepts an INSTREAM upload and, once the zero-length
 * terminator arrives, replies with a fixed line. This tests the adapter's
 * protocol framing and verdict mapping, not clamd's own detection.
 */
function mockClamd(reply: string): Promise<{ port: number; close: () => Promise<void> }> {
  const server = net.createServer((sock) => {
    let buf = Buffer.alloc(0);
    sock.on("data", (d: Buffer) => {
      buf = Buffer.concat([buf, d]);
      if (buf.length >= 4 && buf.subarray(-4).equals(TERMINATOR)) sock.end(`${reply}\0`);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as net.AddressInfo).port;
      resolve({
        port,
        close: () => new Promise<void>((res) => server.close(() => res())),
      });
    });
  });
}

const servers: { close: () => Promise<void> }[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.close()));
});

async function clamdReplying(reply: string): Promise<number> {
  const s = await mockClamd(reply);
  servers.push(s);
  return s.port;
}

async function seeded(): Promise<FakeStorage> {
  const storage = new FakeStorage();
  await storage.put("t/evidence.bin", Buffer.from("some file bytes"), "application/octet-stream");
  return storage;
}

describe("createScanner — config selects the engine", () => {
  it("returns the stub by default", () => {
    expect(createScanner(loadEnv(BASE_ENV), new FakeStorage())).toBeInstanceOf(StubScanner);
  });

  it("returns the ClamAV adapter when AV_PROVIDER=clamav", () => {
    expect(createScanner(loadEnv({ ...BASE_ENV, AV_PROVIDER: "clamav" }), new FakeStorage())).toBeInstanceOf(
      ClamAvScanner,
    );
  });
});

describe("StubScanner", () => {
  it("verdicts by filename marker", async () => {
    const s = new StubScanner();
    expect(await s.scan({ filename: "photo.jpg", key: "k" })).toBe("clean");
    expect(await s.scan({ filename: "eicar.com", key: "k" })).toBe("infected");
  });
});

describe("ClamAvScanner — streams to clamd and maps the verdict", () => {
  it("returns clean on an OK reply", async () => {
    const port = await clamdReplying("stream: OK");
    const scanner = new ClamAvScanner({ host: "127.0.0.1", port, timeoutMs: 5000 }, await seeded());
    expect(await scanner.scan({ filename: "evidence.bin", key: "t/evidence.bin" })).toBe("clean");
  });

  it("returns infected on a FOUND reply", async () => {
    const port = await clamdReplying("stream: Eicar-Test-Signature FOUND");
    const scanner = new ClamAvScanner({ host: "127.0.0.1", port, timeoutMs: 5000 }, await seeded());
    expect(await scanner.scan({ filename: "evidence.bin", key: "t/evidence.bin" })).toBe("infected");
  });

  it("throws (never returns clean) when clamd reports an error like a size limit", async () => {
    const port = await clamdReplying("INSTREAM size limit exceeded");
    const scanner = new ClamAvScanner({ host: "127.0.0.1", port, timeoutMs: 5000 }, await seeded());
    await expect(scanner.scan({ filename: "evidence.bin", key: "t/evidence.bin" })).rejects.toThrow(/could not scan/i);
  });

  it("throws when the object is missing rather than declaring it clean", async () => {
    const port = await clamdReplying("stream: OK");
    const scanner = new ClamAvScanner({ host: "127.0.0.1", port, timeoutMs: 5000 }, new FakeStorage());
    await expect(scanner.scan({ filename: "gone.bin", key: "t/gone.bin" })).rejects.toThrow(/not found/i);
  });
});
