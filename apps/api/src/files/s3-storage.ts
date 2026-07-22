import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Storage, StatResult } from "./storage.js";

/**
 * The real object-storage adapter (03 §7): MinIO locally, S3/R2 in the cloud.
 * Presigned URLs are minted per request with a short TTL and never stored
 * (07 §3) — the caller hands them straight to the client and they expire.
 */
export class S3Storage implements Storage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
    private readonly ttlSeconds: number,
  ) {}

  presignPut(key: string, mime: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: mime }),
      { expiresIn: this.ttlSeconds },
    );
  }

  presignGet(key: string, filename: string): Promise<string> {
    // Quote-strip the filename so it cannot break out of the header value.
    const safe = filename.replace(/["\\\r\n]/g, "_");
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${safe}"`,
      }),
      { expiresIn: this.ttlSeconds },
    );
  }

  async put(key: string, body: Buffer, contentType: string): Promise<{ sizeBytes: number }> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
    return { sizeBytes: body.byteLength };
  }

  async stat(key: string): Promise<StatResult | null> {
    try {
      const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return {
        sizeBytes: Number(head.ContentLength ?? 0),
        etag: (head.ETag ?? "").replaceAll('"', ""),
      };
    } catch (err: unknown) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }
}

function isNotFound(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e.name === "NotFound" || e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404;
}
