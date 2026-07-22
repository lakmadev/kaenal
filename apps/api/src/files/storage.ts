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

export interface Storage {
  /** A short-TTL presigned PUT the client uploads to directly. */
  presignPut(key: string, mime: string): Promise<string>;
  /** A short-TTL presigned GET, forcing a download with the original filename. */
  presignGet(key: string, filename: string): Promise<string>;
  /** Object metadata, or null if it does not exist (upload never happened). */
  stat(key: string): Promise<StatResult | null>;
  /**
   * Upload bytes server-side (the export renderer, 03 §8 — not a client
   * upload). Returns the stored object's byte size.
   */
  put(key: string, body: Buffer, contentType: string): Promise<{ sizeBytes: number }>;
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

  presignGet(key: string, filename: string): Promise<string> {
    return Promise.resolve(
      `https://fake-storage.local/get/${encodeURIComponent(key)}?filename=${encodeURIComponent(filename)}`,
    );
  }

  stat(key: string): Promise<StatResult | null> {
    const size = this.objects.get(key);
    return Promise.resolve(size === undefined ? null : { sizeBytes: size, etag: `fake-etag-${key.length}` });
  }

  put(key: string, body: Buffer, _contentType: string): Promise<{ sizeBytes: number }> {
    this.objects.set(key, body.byteLength);
    this.bodies.set(key, body);
    return Promise.resolve({ sizeBytes: body.byteLength });
  }

  /** Test hook: read back what `put` stored, to assert on rendered bytes. */
  read(key: string): Buffer | null {
    return this.bodies.get(key) ?? null;
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
