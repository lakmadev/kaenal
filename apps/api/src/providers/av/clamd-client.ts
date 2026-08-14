import net from "node:net";
import { once } from "node:events";
import type { Readable } from "node:stream";

/**
 * Minimal clamd `INSTREAM` client (dependency-free, over a TCP socket). We
 * implement the wire protocol directly rather than pull a heavy client library:
 * the protocol is tiny and this keeps the dependency surface — and the attack
 * surface of the security path — small and auditable.
 *
 * Protocol (clamd docs): send `zINSTREAM\0`, then a sequence of chunks each
 * framed as `<uint32 big-endian length><bytes>`, terminated by a zero-length
 * chunk (`\0\0\0\0`). clamd replies once, e.g. `stream: OK\0` or
 * `stream: <signature> FOUND\0`, or an error such as
 * `INSTREAM size limit exceeded\0`.
 */

const MAX_FRAME_BYTES = 64 * 1024; // frame the source stream into ≤64KB writes

export interface ClamdOptions {
  readonly host: string;
  readonly port: number;
  /** Overall deadline for connect + scan. */
  readonly timeoutMs: number;
}

/** Streams `source` to clamd and returns the raw reply line (trimmed). */
export async function clamdInstream(source: Readable, opts: ClamdOptions): Promise<string> {
  const socket = net.connect({ host: opts.host, port: opts.port });
  socket.setTimeout(opts.timeoutMs);

  const chunks: Buffer[] = [];
  const done = new Promise<string>((resolve, reject) => {
    socket.on("data", (d: Buffer) => chunks.push(d));
    socket.on("end", () => resolve(Buffer.concat(chunks).toString("utf8").replace(/\0+$/, "").trim()));
    socket.on("error", reject);
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error(`clamd timed out after ${opts.timeoutMs}ms`));
    });
  });

  try {
    await once(socket, "connect");
    await write(socket, Buffer.from("zINSTREAM\0", "ascii"));

    for await (const raw of source) {
      const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
      for (let off = 0; off < buf.length; off += MAX_FRAME_BYTES) {
        const slice = buf.subarray(off, off + MAX_FRAME_BYTES);
        const header = Buffer.allocUnsafe(4);
        header.writeUInt32BE(slice.length, 0);
        await write(socket, header);
        await write(socket, slice);
      }
    }

    // Zero-length terminating chunk tells clamd the stream is complete.
    await write(socket, Buffer.from([0, 0, 0, 0]));
    return await done;
  } finally {
    source.destroy?.();
  }
}

/** Write with backpressure: resolve on drain when the socket buffer is full. */
async function write(socket: net.Socket, data: Buffer): Promise<void> {
  if (!socket.write(data)) await once(socket, "drain");
}
