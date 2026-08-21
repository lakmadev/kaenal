import { Controller, Get, Inject } from "@nestjs/common";
import { Res } from "@nestjs/common";
import type { Response } from "express";
import type { RealtimeEvent } from "@kaenal/types";
import { currentContext } from "../context.js";
import { REALTIME } from "../tokens.js";
import type { RealtimeService, StreamIdentity } from "./realtime.service.js";

/** How often to write an SSE comment so idle proxies don't close the stream. */
const HEARTBEAT_MS = 25_000;

/**
 * Server-Sent Events stream (Phase R1).
 *
 * The handshake is authenticated by the ordinary request lifecycle — tenant
 * resolution, session, RLS-scoped transaction, the lot — exactly like any other
 * route. But an SSE connection is long-lived, and the tenant-scoped Postgres
 * transaction must NOT stay open for its lifetime (that would pin one pooled
 * connection per connected client). So this handler captures the resolved
 * identity, registers the stream, and RETURNS: the interceptor's `withTenant`
 * then commits and releases the connection while the raw HTTP socket — taken
 * over via `@Res()` — stays open. From that point the stream touches no
 * database; it relays only pointer events from Redis pub/sub, and the client
 * refetches through the normal RLS-scoped API.
 */
@Controller()
export class RealtimeController {
  constructor(@Inject(REALTIME) private readonly realtime: RealtimeService) {}

  @Get("v1/events")
  stream(@Res() res: Response): void {
    const ctx = currentContext();
    // Authenticated route (default-deny in the interceptor), so both are set;
    // guard without a non-null assertion to stay honest under strict lint.
    if (ctx.userId === null || ctx.membership === null) {
      res.status(401).end();
      return;
    }
    const identity: StreamIdentity = {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      membership: ctx.membership,
    };

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Defeat nginx/proxy response buffering so events flush immediately.
      "X-Accel-Buffering": "no",
    });
    res.write("retry: 3000\n\n"); // EventSource reconnect backoff
    res.write(": connected\n\n");

    let open = true;
    const safeWrite = (chunk: string): void => {
      if (!open) return;
      try {
        res.write(chunk);
      } catch {
        cleanup();
      }
    };

    const send = (event: RealtimeEvent): void => {
      safeWrite(`data: ${JSON.stringify(event)}\n\n`);
    };
    const unsubscribe = this.realtime.addClient(identity, send);

    const heartbeat = setInterval(() => safeWrite(": ping\n\n"), HEARTBEAT_MS);

    function cleanup(): void {
      if (!open) return;
      open = false;
      clearInterval(heartbeat);
      unsubscribe();
    }

    res.on("close", cleanup);
    res.on("error", cleanup);
  }
}
