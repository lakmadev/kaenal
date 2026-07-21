import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Request, Response } from "express";
import type { ErrorCode } from "@kaenal/types";
import type { Denied } from "@kaenal/core";

/**
 * The single error envelope (03 §4).
 *
 * Every failure leaves the API in this shape, so clients parse one thing and
 * the UI can map `code` to behaviour without string-matching messages.
 */

export interface ErrorBody {
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
    readonly details?: Record<string, unknown>;
    readonly requestId: string;
  };
}

const STATUS_BY_CODE: Readonly<Record<ErrorCode, number>> = {
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  TENANT_NOT_FOUND: 404,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_TRANSITION: 409,
  STALE_WRITE: 409,
  RATE_LIMITED: 429,
  IDEMPOTENCY_REPLAY: 200,
  INTERNAL: 500,
  USER_INACTIVE: 422,
};

export function statusFor(code: ErrorCode): number {
  return STATUS_BY_CODE[code];
}

/** An error that is safe to show the caller. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Lifts a `Denied` from packages/core onto the wire. */
  static from(denied: Denied): ApiError {
    return denied.details === undefined
      ? new ApiError(denied.code, denied.message)
      : new ApiError(denied.code, denied.message, { ...denied.details });
  }
}

/**
 * Rule 8 in one function.
 *
 * A foreign-tenant id must be indistinguishable from an id that was never
 * issued, so both produce this. Never call it with the id in the message.
 */
export function notFound(): ApiError {
  return new ApiError("NOT_FOUND", "Resource not found");
}

export function tenantNotFound(): ApiError {
  return new ApiError("TENANT_NOT_FOUND", "Tenant not found");
}

@Catch()
export class ErrorEnvelopeFilter implements ExceptionFilter {
  private readonly logger = new Logger("Error");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = typeof req.requestId === "string" ? req.requestId : "unknown";

    const { status, body } = this.render(exception, requestId);

    // A 429 without Retry-After tells the client to back off but not for how
    // long, so it retries immediately and the limiter never gets a break.
    if (body.error.code === "RATE_LIMITED") {
      const retryAfter = body.error.details?.["retryAfterSeconds"];
      if (typeof retryAfter === "number") res.setHeader("Retry-After", String(retryAfter));
    }

    if (status >= 500) {
      // The only place the real error is recorded. It must not reach the
      // client (03 §4: "no internals leaked"), so it is correlated by
      // requestId instead.
      this.logger.error(
        { requestId, path: req.path, method: req.method },
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json(body);
  }

  private render(exception: unknown, requestId: string): { status: number; body: ErrorBody } {
    if (exception instanceof ApiError) {
      return {
        status: statusFor(exception.code),
        body: {
          error: {
            code: exception.code,
            message: exception.message,
            ...(exception.details === undefined ? {} : { details: exception.details }),
            requestId,
          },
        },
      };
    }

    // Nest's own exceptions (404 from the router, 400 from a pipe, …).
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code: ErrorCode =
        status === 404
          ? "NOT_FOUND"
          : status === 401
            ? "UNAUTHENTICATED"
            : status === 403
              ? "FORBIDDEN"
              : status === 429
                ? "RATE_LIMITED"
                : status >= 500
                  ? "INTERNAL"
                  : "VALIDATION_FAILED";
      return {
        status,
        body: { error: { code, message: exception.message, requestId } },
      };
    }

    // Anything else is a bug. The caller gets a generic message on purpose:
    // stack traces and driver errors have leaked schema and credentials before.
    return {
      status: 500,
      body: { error: { code: "INTERNAL", message: "Internal server error", requestId } },
    };
  }
}
