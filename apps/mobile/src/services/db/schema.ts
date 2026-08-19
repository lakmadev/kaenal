// Local SQLite schema (05 §2), expressed with Drizzle so the native adapter has a
// typed, migration-friendly definition. The local DB mirrors a SUBSET of server
// tables plus two local-only tables (mutation_queue, pending_files).
//
// Design notes:
//  - The mirror is generic: one `mirror` table keyed by (entity_type, id) holding
//    the DTO as JSON, rather than one table per entity. Field-level querying isn't
//    needed offline (the app reads whole entities); this keeps the schema tiny and
//    means a new mirrored entity needs zero migrations. `updated_at`/`version` are
//    promoted to columns so delta cursors and optimistic concurrency are indexable.
//  - JSON payloads are stored as TEXT (SQLite has no native JSON type worth using here).

import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Mirrored server rows (inspections/ncrs/plants/… — the offline read set, 05 §2). */
export const mirror = sqliteTable(
  "mirror",
  {
    entityType: text("entity_type").notNull(),
    id: text("id").notNull(),
    updatedAt: text("updated_at").notNull(),
    version: integer("version").notNull().default(0),
    deleted: integer("deleted", { mode: "boolean" }).notNull().default(false),
    data: text("data").notNull(), // JSON DTO
  },
  (t) => ({
    pk: index("mirror_pk").on(t.entityType, t.id),
    // Delta-cursor scan order (05 §2.1): newest-first within an entity type.
    delta: index("mirror_delta").on(t.entityType, t.updatedAt, t.id),
  }),
);

/** Per-table delta cursor high-water mark (05 §2.1). */
export const syncCursor = sqliteTable("sync_cursor", {
  entityType: text("entity_type").primaryKey(),
  cursor: text("cursor").notNull(),
});

/** Local write queue (05 §2.2). `id` = uuidv7 = Idempotency-Key. */
export const mutationQueue = sqliteTable(
  "mutation_queue",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    payload: text("payload").notNull(), // JSON
    baseUpdatedAt: text("base_updated_at"),
    baseVersion: integer("base_version"),
    dependsOnFileIds: text("depends_on_file_ids").notNull().default("[]"), // JSON string[]
    attempts: integer("attempts").notNull().default(0),
    status: text("status").notNull().default("pending"),
    error: text("error"),
    createdAt: text("created_at").notNull(),
    nextAttemptAt: text("next_attempt_at"),
  },
  (t) => ({
    // FIFO-per-entity scan (05 §2.2).
    entity: index("mq_entity").on(t.entityType, t.entityId, t.createdAt),
    status: index("mq_status").on(t.status),
  }),
);

/** Captured evidence awaiting presign+upload (05 §2.2). */
export const pendingFiles = sqliteTable("pending_files", {
  id: text("id").primaryKey(),
  localUri: text("local_uri").notNull(),
  mime: text("mime").notNull(),
  bytes: integer("bytes").notNull().default(0),
  sha256: text("sha256"),
  status: text("status").notNull().default("pending"),
  remoteId: text("remote_id"),
  error: text("error"),
  createdAt: text("created_at").notNull(),
});

/** DDL applied on first open (idempotent). Kept alongside the Drizzle defs so the
 *  expo-sqlite adapter can bootstrap without a migration runner on device. */
export const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS mirror (
  entity_type TEXT NOT NULL, id TEXT NOT NULL, updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL,
  PRIMARY KEY (entity_type, id)
);
CREATE INDEX IF NOT EXISTS mirror_delta ON mirror (entity_type, updated_at, id);
CREATE TABLE IF NOT EXISTS sync_cursor (entity_type TEXT PRIMARY KEY, cursor TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS mutation_queue (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  payload TEXT NOT NULL, base_updated_at TEXT, base_version INTEGER,
  depends_on_file_ids TEXT NOT NULL DEFAULT '[]', attempts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', error TEXT, created_at TEXT NOT NULL, next_attempt_at TEXT
);
CREATE INDEX IF NOT EXISTS mq_entity ON mutation_queue (entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS mq_status ON mutation_queue (status);
CREATE TABLE IF NOT EXISTS pending_files (
  id TEXT PRIMARY KEY, local_uri TEXT NOT NULL, mime TEXT NOT NULL, bytes INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT, status TEXT NOT NULL DEFAULT 'pending', remote_id TEXT, error TEXT, created_at TEXT NOT NULL
);
`;
