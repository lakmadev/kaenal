import { randomUUID } from "node:crypto";
import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

/**
 * Assigns every request an id and echoes it (03 §4).
 *
 * An inbound X-Request-Id is honoured only when it looks like a uuid: the
 * value is logged and returned in the error envelope, so an unvalidated one is
 * a log-injection and response-splitting vector.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const inbound = req.header("x-request-id");
    const requestId = inbound !== undefined && UUID.test(inbound) ? inbound : randomUUID();

    req.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);
    next();
  }
}
