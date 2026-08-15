// Native SyncStorePort adapter — expo-sqlite (async API). Persists the offline
// mirror + queues (05 §2). Uses the DDL from schema.ts for bootstrap; row<->domain
// mapping is explicit so JSON columns round-trip safely. Selected on iOS/Android by
// db/index.ts; never loaded on web (expo-sqlite web needs wasm the preview lacks).

import * as SQLite from "expo-sqlite";

import type { SyncStorePort } from "../ports.js";
import type { MirrorRow, MutationRecord, PendingFile } from "../../sync/types.js";
import { CREATE_SQL } from "./schema.js";

interface MirrorDbRow {
  entity_type: string;
  id: string;
  updated_at: string;
  version: number;
  deleted: number;
  data: string;
}
interface MutationDbRow {
  id: string;
  kind: string;
  entity_type: string;
  entity_id: string;
  payload: string;
  base_updated_at: string | null;
  base_version: number | null;
  depends_on_file_ids: string;
  attempts: number;
  status: string;
  error: string | null;
  created_at: string;
  next_attempt_at: string | null;
}
interface FileDbRow {
  id: string;
  local_uri: string;
  mime: string;
  bytes: number;
  sha256: string | null;
  status: string;
  remote_id: string | null;
  error: string | null;
  created_at: string;
}

function toMirror(r: MirrorDbRow): MirrorRow {
  return {
    entityType: r.entity_type,
    id: r.id,
    updatedAt: r.updated_at,
    version: r.version,
    deleted: r.deleted === 1,
    data: JSON.parse(r.data) as unknown,
  };
}
function toMutation(r: MutationDbRow): MutationRecord {
  return {
    id: r.id,
    kind: r.kind,
    entityType: r.entity_type,
    entityId: r.entity_id,
    payload: JSON.parse(r.payload) as unknown,
    baseUpdatedAt: r.base_updated_at,
    baseVersion: r.base_version,
    dependsOnFileIds: JSON.parse(r.depends_on_file_ids) as string[],
    attempts: r.attempts,
    status: r.status as MutationRecord["status"],
    error: r.error,
    createdAt: r.created_at,
    nextAttemptAt: r.next_attempt_at,
  };
}
function toFile(r: FileDbRow): PendingFile {
  return {
    id: r.id,
    localUri: r.local_uri,
    mime: r.mime,
    bytes: r.bytes,
    sha256: r.sha256,
    status: r.status as PendingFile["status"],
    remoteId: r.remote_id,
    error: r.error,
    createdAt: r.created_at,
  };
}

export function createSqliteSyncStore(dbName = "kaenal.db"): SyncStorePort {
  let dbp: Promise<SQLite.SQLiteDatabase> | null = null;
  const db = () => (dbp ??= SQLite.openDatabaseAsync(dbName));

  return {
    async init() {
      const d = await db();
      await d.execAsync(CREATE_SQL);
    },

    async upsertMirror(rows) {
      const d = await db();
      await d.withTransactionAsync(async () => {
        for (const r of rows) {
          await d.runAsync(
            `INSERT INTO mirror (entity_type,id,updated_at,version,deleted,data)
             VALUES (?,?,?,?,?,?)
             ON CONFLICT(entity_type,id) DO UPDATE SET
               updated_at=excluded.updated_at, version=excluded.version,
               deleted=excluded.deleted, data=excluded.data`,
            [r.entityType, r.id, r.updatedAt, r.version, r.deleted ? 1 : 0, JSON.stringify(r.data)],
          );
        }
      });
    },
    async getMirror(entityType, id) {
      const d = await db();
      const row = await d.getFirstAsync<MirrorDbRow>(
        `SELECT * FROM mirror WHERE entity_type=? AND id=?`,
        [entityType, id],
      );
      return row ? toMirror(row) : null;
    },
    async listMirror(entityType) {
      const d = await db();
      const rows = await d.getAllAsync<MirrorDbRow>(
        `SELECT * FROM mirror WHERE entity_type=? AND deleted=0 ORDER BY updated_at DESC`,
        [entityType],
      );
      return rows.map(toMirror);
    },

    async getCursor(entityType) {
      const d = await db();
      const row = await d.getFirstAsync<{ cursor: string }>(
        `SELECT cursor FROM sync_cursor WHERE entity_type=?`,
        [entityType],
      );
      return row?.cursor ?? null;
    },
    async setCursor(entityType, cursor) {
      const d = await db();
      await d.runAsync(
        `INSERT INTO sync_cursor (entity_type,cursor) VALUES (?,?)
         ON CONFLICT(entity_type) DO UPDATE SET cursor=excluded.cursor`,
        [entityType, cursor],
      );
    },

    async listMutations() {
      const d = await db();
      const rows = await d.getAllAsync<MutationDbRow>(`SELECT * FROM mutation_queue ORDER BY created_at ASC`);
      return rows.map(toMutation);
    },
    async putMutation(m) {
      const d = await db();
      await d.runAsync(
        `INSERT INTO mutation_queue
          (id,kind,entity_type,entity_id,payload,base_updated_at,base_version,depends_on_file_ids,attempts,status,error,created_at,next_attempt_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET
           payload=excluded.payload, base_updated_at=excluded.base_updated_at, base_version=excluded.base_version,
           depends_on_file_ids=excluded.depends_on_file_ids, attempts=excluded.attempts, status=excluded.status,
           error=excluded.error, next_attempt_at=excluded.next_attempt_at`,
        [
          m.id, m.kind, m.entityType, m.entityId, JSON.stringify(m.payload),
          m.baseUpdatedAt, m.baseVersion, JSON.stringify(m.dependsOnFileIds), m.attempts,
          m.status, m.error, m.createdAt, m.nextAttemptAt,
        ],
      );
    },
    async deleteMutation(id) {
      const d = await db();
      await d.runAsync(`DELETE FROM mutation_queue WHERE id=?`, [id]);
    },

    async listFiles() {
      const d = await db();
      const rows = await d.getAllAsync<FileDbRow>(`SELECT * FROM pending_files ORDER BY created_at ASC`);
      return rows.map(toFile);
    },
    async putFile(f) {
      const d = await db();
      await d.runAsync(
        `INSERT INTO pending_files (id,local_uri,mime,bytes,sha256,status,remote_id,error,created_at)
         VALUES (?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET
           local_uri=excluded.local_uri, mime=excluded.mime, bytes=excluded.bytes, sha256=excluded.sha256,
           status=excluded.status, remote_id=excluded.remote_id, error=excluded.error`,
        [f.id, f.localUri, f.mime, f.bytes, f.sha256, f.status, f.remoteId, f.error, f.createdAt],
      );
    },
    async deleteFile(id) {
      const d = await db();
      await d.runAsync(`DELETE FROM pending_files WHERE id=?`, [id]);
    },

    async wipe() {
      const d = await db();
      await d.withTransactionAsync(async () => {
        await d.execAsync(
          `DELETE FROM mirror; DELETE FROM sync_cursor; DELETE FROM mutation_queue; DELETE FROM pending_files;`,
        );
      });
    },
  };
}
