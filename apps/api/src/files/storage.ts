import { Readable } from "node:stream";

/**
 * The object-storage port (03 §7). The Files service depends on this interface,
 * not on the AWS SDK, so the presign/complete/download logic — the part that
 * carries the security rules — is testable without a live bucket (tests bind a
 * `FakeStorage`). The real adapter is `S3Storage`.
 */
export interface StatResult {
  readonly sizeBytes: number;
  /** The object's content hash surrogate — S3 ETag (03 §7 records it as sha256). */
  readonly etag: string;
}

/** How a presigned GET presents the object: forced download vs inline render. */
export type Disposition = "attachment" | "inline";

export interface Storage {
  /** A short-TTL presigned PUT the client uploads to directly. */
  presignPut(key: string, mime: string): Promise<string>;
  /**
   * A short-TTL presigned GET with the original filename. `disposition`
   * `attachment` (default) forces a download; `inline` lets the browser render
   * the object in place — what the document Preview needs.
   */
  presignGet(key: string, filename: string, disposition?: Disposition): Promise<string>;
  /** Object metadata, or null if it does not exist (upload never happened). */
  stat(key: string): Promise<StatResult | null>;
  /**
   * Open a read stream over the object's bytes, or null if it does not exist.
   * Server-side readers only (the AV scanner streams bytes to clamd) — clients
   * always download through a presigned GET, never through the API process.
   */
  getStream(key: string): Promise<Readable | null>;
  /**
   * Upload bytes server-side (the export renderer, 03 §8 — not a client
   * upload). Returns the stored object's byte size.
   */
  put(key: string, body: Buffer, contentType: string): Promise<{ sizeBytes: number }>;
  /**
   * Permanently delete an object. Used when its owning `files` row is purged
   * (06 §1 `housekeeping`). Idempotent — deleting a missing key is a no-op, so a
   * retried purge never fails on an object already gone.
   */
  delete(key: string): Promise<void>;
}

/**
 * In-memory test double. `presignPut` registers the object as if the upload
 * succeeded, so the happy path needs no real network; `remove` simulates the
 * "client never uploaded" case for the complete-verification test.
 */
export class FakeStorage implements Storage {
  private readonly objects = new Map<string, number>();
  /** Bytes stored by server-side `put`, so tests can read the rendered output. */
  private readonly bodies = new Map<string, Buffer>();
  /** Default object size reported by `stat` after a presigned put. */
  private readonly defaultSize: number;

  constructor(defaultSize = 2048) {
    this.defaultSize = defaultSize;
  }

  presignPut(key: string, _mime: string): Promise<string> {
    this.objects.set(key, this.defaultSize);
    return Promise.resolve(`https://fake-storage.local/put/${encodeURIComponent(key)}`);
  }

  presignGet(key: string, filename: string, disposition: Disposition = "attachment"): Promise<string> {
    return Promise.resolve(
      `https://fake-storage.local/get/${encodeURIComponent(key)}?filename=${encodeURIComponent(filename)}&disposition=${disposition}`,
    );
  }

  stat(key: string): Promise<StatResult | null> {
    const size = this.objects.get(key);
    return Promise.resolve(size === undefined ? null : { sizeBytes: size, etag: `fake-etag-${key.length}` });
  }

  getStream(key: string): Promise<Readable | null> {
    if (!this.objects.has(key)) return Promise.resolve(null);
    // Prefer the exact bytes stored by `put`; fall back to zero-filled bytes of
    // the recorded size for objects that only went through a (faked) presign.
    const body = this.bodies.get(key) ?? Buffer.alloc(this.objects.get(key) ?? 0);
    return Promise.resolve(Readable.from(body));
  }

  put(key: string, body: Buffer, _contentType: string): Promise<{ sizeBytes: number }> {
    this.objects.set(key, body.byteLength);
    this.bodies.set(key, body);
    return Promise.resolve({ sizeBytes: body.byteLength });
  }

  delete(key: string): Promise<void> {
    this.objects.delete(key);
    this.bodies.delete(key);
    return Promise.resolve();
  }

  /** Test hook: read back what `put` stored, to assert on rendered bytes. */
  read(key: string): Buffer | null {
    return this.bodies.get(key) ?? null;
  }

  /** Test hook: does the object still exist? */
  has(key: string): boolean {
    return this.objects.has(key);
  }

  /** Test hook: pretend the object was never uploaded. */
  remove(key: string): void {
    this.objects.delete(key);
    this.bodies.delete(key);
  }

  /** Test hook: simulate the uploaded object having a specific size. */
  setSize(key: string, sizeBytes: number): void {
    this.objects.set(key, sizeBytes);
  }
}
