// Ports — the abstraction boundary between features and platform capabilities.
// Every device/service dependency is expressed as one of these interfaces; a
// concrete Expo adapter implements it, and the registry in `index.ts` is the single
// place they're wired. Features depend ONLY on these types, never on an SDK, so a
// service can be swapped by swapping one adapter (the portability requirement).

/** General-purpose key-value store (non-secret): appearance prefs, cursors, flags. */
export interface KvPort {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** Secret store for tokens/credentials — OS keychain/keystore backed. */
export interface SecureStorePort {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** Local SQLite database handle (offline mirror + queues). Wired in M3. */
export interface DbPort {
  execute(sql: string, params?: unknown[]): Promise<void>;
  select<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Run a set of statements atomically. */
  transaction(work: (tx: DbPort) => Promise<void>): Promise<void>;
}

/**
 * Domain-level offline store (05 §2) — the persistence port the sync engine and
 * feature repos depend on. Deliberately NOT raw SQL: keeping it domain-shaped means
 * the native (expo-sqlite + Drizzle) and in-memory (web/test) adapters are
 * interchangeable and the engine is unit-testable. Wired in M3.
 */
export interface SyncStorePort {
  init(): Promise<void>;

  // Read mirror (delta-pull target).
  upsertMirror(rows: import("../sync/types.js").MirrorRow[]): Promise<void>;
  getMirror(entityType: string, id: string): Promise<import("../sync/types.js").MirrorRow | null>;
  listMirror(entityType: string): Promise<import("../sync/types.js").MirrorRow[]>;

  // Per-table delta cursors (encoded via sync/cursor.ts).
  getCursor(entityType: string): Promise<string | null>;
  setCursor(entityType: string, cursor: string): Promise<void>;

  // Write queue (05 §2.2).
  listMutations(): Promise<import("../sync/types.js").MutationRecord[]>;
  putMutation(rec: import("../sync/types.js").MutationRecord): Promise<void>;
  deleteMutation(id: string): Promise<void>;

  // Pending files (05 §2.2).
  listFiles(): Promise<import("../sync/types.js").PendingFile[]>;
  putFile(f: import("../sync/types.js").PendingFile): Promise<void>;
  deleteFile(id: string): Promise<void>;

  /** Sign-out / tenant-switch wipe (05 §2, §4). */
  wipe(): Promise<void>;
}

export interface LocalFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

/** Local file storage for captured evidence before upload. Wired in M7. */
export interface FilesPort {
  /** Persist bytes/URI into app storage and return a stable local file descriptor. */
  save(sourceUri: string, name: string): Promise<LocalFile>;
  /** Downscale/compress an image (≤2000px, ~80% JPEG) per spec §2.2. */
  compressImage(uri: string): Promise<LocalFile>;
  remove(uri: string): Promise<void>;
  /** Total bytes used by the evidence cache (for the storage gauge). */
  usage(): Promise<number>;
}

export interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
}

/** Camera capture. Wired in M7. */
export interface CameraPort {
  requestPermission(): Promise<boolean>;
  capturePhoto(): Promise<CapturedPhoto | null>;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

/** Location. Permission-gated; must degrade gracefully. Wired in M6/M7. */
export interface LocationPort {
  requestPermission(): Promise<boolean>;
  current(): Promise<Coordinates | null>;
}

/** Push + local notifications. Wired in M13. */
export interface NotificationsPort {
  requestPermission(): Promise<boolean>;
  getPushToken(): Promise<string | null>;
}

/** Biometric unlock (Face ID / Touch ID / fingerprint). Wired in M4. */
export interface BiometricPort {
  isAvailable(): Promise<boolean>;
  authenticate(reason: string): Promise<boolean>;
}

/** The full set of platform services the app resolves through the registry. */
export interface Services {
  kv: KvPort;
  secureStore: SecureStorePort;
  /** Offline mirror + queues (05 §2), wired in M3. */
  syncStore: SyncStorePort;
  /** Optional low-level SQL handle for ad-hoc queries / the storage gauge. */
  db?: DbPort;
  files?: FilesPort;
  camera?: CameraPort;
  location?: LocationPort;
  notifications?: NotificationsPort;
  biometric?: BiometricPort;
}
