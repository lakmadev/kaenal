import type { OnModuleDestroy } from "@nestjs/common";
import type Redis from "ioredis";
import { authorize, type Capability, type Membership } from "@kaenal/core";
import type { RealtimeEvent } from "@kaenal/types";

/** The single Redis pub/sub channel every API instance fans out from. One
 *  channel + in-process tenant filtering scales fine here and shards later. */
export const RT_CHANNEL = "kaenal:rt";

/**
 * A signal published to Redis and fanned to matching local streams. Carries the
 * tenant and optional targeting used only to decide *which* connected streams
 * receive the (data-free) event.
 */
export interface RealtimeSignal {
  readonly tenantId: string;
  /** Deliver only to this user's streams; omit to reach every tenant member. */
  readonly userId?: string | null;
  /** Deliver only to members holding this capability; omit for no gate. */
  readonly capability?: Capability;
  readonly event: RealtimeEvent;
}

/** Identity captured from the authenticated handshake, kept for the life of the
 *  stream purely to filter fan-out. No transaction, no db handle — just facts. */
export interface StreamIdentity {
  readonly tenantId: string;
  readonly userId: string;
  readonly membership: Membership;
}

/** The narrow emit surface producers depend on (keeps them off the concrete
 *  service and out of any DI import cycle). */
export interface RealtimeEmitter {
  emit(signal: RealtimeSignal): void;
}

interface Client {
  readonly identity: StreamIdentity;
  readonly send: (event: RealtimeEvent) => void;
}

/**
 * The realtime signal bus (Phase R1).
 *
 * Publishing goes out on the shared command connection; receiving runs on a
 * DEDICATED connection in subscribe mode (ioredis forbids ordinary commands on
 * a subscribed connection, so it must be its own `.duplicate()`). Every API
 * instance subscribes, so a signal published anywhere reaches the streams held
 * on every instance — horizontal scale-out with no sticky sessions.
 */
export class RealtimeService implements RealtimeEmitter, OnModuleDestroy {
  private readonly clients = new Set<Client>();

  constructor(
    private readonly pub: Redis,
    private readonly sub: Redis,
  ) {
    void this.sub.subscribe(RT_CHANNEL);
    this.sub.on("message", (_channel, payload) => this.fanOut(payload));
  }

  /** Publish to every instance. Fire-and-forget by design: the bus is a
   *  best-effort *hint* to refetch, so a dropped signal costs at most one stale
   *  view until the next poll/navigation — never correctness. */
  emit(signal: RealtimeSignal): void {
    void this.pub.publish(RT_CHANNEL, JSON.stringify(signal)).catch(() => undefined);
  }

  /** Register a connected SSE stream; returns its unsubscribe. */
  addClient(identity: StreamIdentity, send: (event: RealtimeEvent) => void): () => void {
    const client: Client = { identity, send };
    this.clients.add(client);
    return () => {
      this.clients.delete(client);
    };
  }

  /** Connected streams on THIS instance (health/metrics). */
  get connectionCount(): number {
    return this.clients.size;
  }

  async onModuleDestroy(): Promise<void> {
    await this.sub.quit().catch(() => undefined);
  }

  /** Deliver one Redis message to every local stream it targets. */
  private fanOut(payload: string): void {
    let signal: RealtimeSignal;
    try {
      signal = JSON.parse(payload) as RealtimeSignal;
    } catch {
      return; // malformed — never throw on the subscriber connection
    }
    for (const client of this.clients) {
      if (!RealtimeService.matches(signal, client.identity)) continue;
      try {
        client.send(signal.event);
      } catch {
        /* a dead socket is torn down by its own close handler; ignore here */
      }
    }
  }

  /**
   * The isolation guarantee, in one pure place (unit-tested):
   *   1. never cross tenant,
   *   2. honour user targeting,
   *   3. honour the capability gate — a role that cannot view a module never
   *      even learns its data changed.
   */
  static matches(signal: RealtimeSignal, id: StreamIdentity): boolean {
    if (signal.tenantId !== id.tenantId) return false;
    if (signal.userId !== undefined && signal.userId !== null && signal.userId !== id.userId) {
      return false;
    }
    if (signal.capability !== undefined && !authorize(id.membership, signal.capability).ok) {
      return false;
    }
    return true;
  }
}
