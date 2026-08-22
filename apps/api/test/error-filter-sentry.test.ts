import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArgumentsHost } from "@nestjs/common";
import type { Request, Response } from "express";

// Spy on the capture call the filter makes, without touching the real SDK.
const captureServerError = vi.fn();
vi.mock("../src/observability/sentry.js", () => ({
  captureServerError: (...args: unknown[]): void => {
    captureServerError(...args);
  },
  initSentry: vi.fn(),
  flushSentry: vi.fn(),
  isSentryEnabled: (): boolean => false,
}));

const { ErrorEnvelopeFilter, ApiError } = await import("../src/errors.js");

/**
 * The error envelope filter's Sentry hook (observability slice). Unexpected 5xx
 * errors are reported (correlated by requestId + tenant, never leaking the
 * message to the client); handled 4xx business errors are not.
 */

interface FakeRes {
  statusCode: number;
  headers: Record<string, string>;
  body: { error: { code: string; message: string } } | null;
  status(s: number): FakeRes;
  json(b: unknown): FakeRes;
  setHeader(k: string, v: string): void;
}

function fakeReqRes(): { req: Request; res: FakeRes } {
  const res: FakeRes = {
    statusCode: 0,
    headers: {},
    body: null,
    status(s) {
      this.statusCode = s;
      return this;
    },
    json(b) {
      this.body = b as FakeRes["body"];
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
    },
  };
  const req = {
    requestId: "req-1",
    path: "/v1/ncrs",
    method: "POST",
    tenant: { id: "t1", slug: "acme" },
  } as unknown as Request;
  return { req, res };
}

const host = (req: Request, res: FakeRes): ArgumentsHost =>
  ({
    switchToHttp: () => ({ getResponse: () => res as unknown as Response, getRequest: () => req }),
  }) as unknown as ArgumentsHost;

describe("ErrorEnvelopeFilter → Sentry", () => {
  const filter = new ErrorEnvelopeFilter();
  beforeEach(() => captureServerError.mockClear());

  it("captures an unexpected (5xx) error, correlated by request, without leaking the message", () => {
    const { req, res } = fakeReqRes();
    filter.catch(new Error("secret db failure"), host(req, res));

    expect(res.statusCode).toBe(500);
    expect(res.body?.error.code).toBe("INTERNAL");
    expect(res.body?.error.message).not.toContain("secret"); // 03 §4 — no internals leaked
    expect(captureServerError).toHaveBeenCalledTimes(1);
    expect(captureServerError.mock.calls[0]?.[1]).toMatchObject({
      requestId: "req-1",
      method: "POST",
      path: "/v1/ncrs",
      tenant: "acme",
    });
  });

  it("does NOT capture a handled 4xx business error", () => {
    const { req, res } = fakeReqRes();
    filter.catch(new ApiError("NOT_FOUND", "nope"), host(req, res));
    expect(res.statusCode).toBe(404);
    expect(captureServerError).not.toHaveBeenCalled();
  });

  it("captures an ApiError('INTERNAL') (also 5xx)", () => {
    const { req, res } = fakeReqRes();
    filter.catch(new ApiError("INTERNAL", "downstream down"), host(req, res));
    expect(res.statusCode).toBe(500);
    expect(captureServerError).toHaveBeenCalledTimes(1);
  });
});
