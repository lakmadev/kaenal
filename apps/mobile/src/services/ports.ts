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
  db?: DbPort;
  files?: FilesPort;
  camera?: CameraPort;
  location?: LocationPort;
  notifications?: NotificationsPort;
  biometric?: BiometricPort;
}
