import type Redis from "ioredis";
import type { Capability } from "@kaenal/core";
import type { PresenceEntity, PresenceSnapshot, PresenceViewer } from "@kaenal/types";
import type { RealtimeService } from "./realtime.service.js";

/**
 * Live presence + edit-intent (Phase R4).
 *
 * Who is looking at (and who is editing) an entity right now, so colleagues on
 * the same NCR see each other and don't collide into an optimistic-concurrency
 * 409. Presence is ephemeral and Redis-only — never a DB row, never audited —
 * and carries no names on the wire (the client resolves them from the members
 * directory). It rides the existing R1 SSE bus: a snapshot is pushed only to the
 * entity's CURRENT viewers (the Redis presence set is precisely that audience),
 * so nobody learns who is viewing something they aren't.
 *
 * Storage (no KEYS/SCAN, self-healing): a SET indexes the viewer ids for an
 * entity; each viewer also has a short-TTL detail key. A missed heartbeat lets
 * the detail key expire; the next snapshot read prunes it from the index. So a
 * client that vanishes (crash, closed laptop) drops out on its own.
 */

const VIEWER_TTL_SECONDS = 45; // survives ~2 missed 20s heartbeats
const INDEX_TTL_SECONDS = 90;

const VIEW_CAPABILITY: Readonly<Record<PresenceEntity, Capability>> = {
  ncr: "ncr:view",
  inspection: "inspection:view",
  capa: "capa:view",
  eightd: "ncr:view", // 8D rides NCR view rights, as elsewhere
  supplier: "supplier:view",
  ppap: "ppap:view",
  scar: "scar:view",
  document: "document:view",
  fmea: "fmea:view",
};

interface StoredViewer {
  readonly editing: boolean;
}

export class PresenceService {
  private onEmpty?: (tenantId: string, type: PresenceEntity, id: string) => void;

  constructor(
    private readonly redis: Redis,
    private readonly realtime: RealtimeService,
  ) {}

  /** Notified when an entity's last viewer leaves (Phase R8) — the collab service
   *  uses it to evict that entity's now-idle CRDT docs. */
  setOnEmpty(fn: (tenantId: string, type: PresenceEntity, id: string) => void): void {
    this.onEmpty = fn;
  }

  /** The view capability a member must hold to join an entity's presence. */
  requiredCapability(type: PresenceEntity): Capability {
    return VIEW_CAPABILITY[type];
  }

  private indexKey(tenantId: string, type: PresenceEntity, id: string): string {
    return `pz:idx:${tenantId}:${type}:${id}`;
  }

  private viewerKey(tenantId: string, type: PresenceEntity, id: string, userId: string): string {
    return `pz:v:${tenantId}:${type}:${id}:${userId}`;
  }

  /**
   * Enter or heartbeat: refresh this viewer's TTL, recompute the snapshot, and
   * push it to every current viewer. The same call serves the periodic heartbeat
   * and an `editing` toggle.
   */
  async heartbeat(
    tenantId: string,
    type: PresenceEntity,
    id: string,
    userId: string,
    editing: boolean,
  ): Promise<PresenceSnapshot> {
    const stored: StoredViewer = { editing };
    await this.redis
      .multi()
      .set(this.viewerKey(tenantId, type, id, userId), JSON.stringify(stored), "EX", VIEWER_TTL_SECONDS)
      .sadd(this.indexKey(tenantId, type, id), userId)
      .expire(this.indexKey(tenantId, type, id), INDEX_TTL_SECONDS)
      .exec();
    const snapshot = await this.snapshot(tenantId, type, id);
    this.broadcast(tenantId, snapshot);
    return snapshot;
  }

  /** Leave now (form closed / navigated away / tab hidden). */
  async leave(
    tenantId: string,
    type: PresenceEntity,
    id: string,
    userId: string,
  ): Promise<PresenceSnapshot> {
    await this.redis
      .multi()
      .del(this.viewerKey(tenantId, type, id, userId))
      .srem(this.indexKey(tenantId, type, id), userId)
      .exec();
    const snapshot = await this.snapshot(tenantId, type, id);
    this.broadcast(tenantId, snapshot);
    // Last viewer gone → let the collab service reclaim this entity's idle docs.
    if (snapshot.viewers.length === 0) this.onEmpty?.(tenantId, type, id);
    return snapshot;
  }

  /** Current viewers, lazily pruning any whose detail key has already expired. */
  async snapshot(tenantId: string, type: PresenceEntity, id: string): Promise<PresenceSnapshot> {
    const indexKey = this.indexKey(tenantId, type, id);
    const ids = await this.redis.smembers(indexKey);
    if (ids.length === 0) return { entityType: type, entityId: id, viewers: [] };

    const raws = await this.redis.mget(ids.map((u) => this.viewerKey(tenantId, type, id, u)));
    const viewers: PresenceViewer[] = [];
    const expired: string[] = [];
    ids.forEach((userId, i) => {
      const raw = raws[i];
      if (raw === null || raw === undefined) {
        expired.push(userId);
        return;
      }
      let editing = false;
      try {
        editing = (JSON.parse(raw) as StoredViewer).editing === true;
      } catch {
        /* corrupt value — treat as not-editing */
      }
      viewers.push({ userId, editing });
    });
    if (expired.length > 0) await this.redis.srem(indexKey, ...expired);
    viewers.sort((a, b) => a.userId.localeCompare(b.userId));
    return { entityType: type, entityId: id, viewers };
  }

  /**
   * Push the snapshot to each current viewer (and only them — the presence set
   * is the audience). User-targeted, so it fans out across API instances through
   * the same Redis pub/sub the rest of the bus uses.
   */
  private broadcast(tenantId: string, snapshot: PresenceSnapshot): void {
    const at = new Date().toISOString();
    for (const viewer of snapshot.viewers) {
      this.realtime.emit({
        tenantId,
        userId: viewer.userId,
        event: {
          topic: "presence",
          action: "updated",
          entityType: snapshot.entityType,
          entityId: snapshot.entityId,
          viewers: snapshot.viewers,
          at,
        },
      });
    }
  }
}
