const DB_NAME = "cargoflow-offline";
const DB_VERSION = 1;
const QUEUE_STORE = "queue";
const META_STORE = "meta";

export type QueueStatus = "pending" | "failed";

export type QueuedMutation = {
  id?: number;
  kind: string; // "action" | "pod" | "tracking" | "other"
  url: string;
  method: string;
  body?: unknown;
  headers?: Record<string, string>;
  createdAt: number;
  status: QueueStatus;
  error?: string;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB is not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const store = db.createObjectStore(QUEUE_STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("kind", "kind", { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(storeName: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const req = run(t.objectStore(storeName));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

export function getAllQueue(): Promise<QueuedMutation[]> {
  return tx(QUEUE_STORE, "readonly", (s) => s.getAll());
}

export function addQueue(mutation: Omit<QueuedMutation, "id">): Promise<number> {
  return tx(QUEUE_STORE, "readwrite", (s) => s.add(mutation)).then((id) => Number(id));
}

export function updateQueue(id: number, patch: Partial<QueuedMutation>): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const t = db.transaction(QUEUE_STORE, "readwrite");
        const store = t.objectStore(QUEUE_STORE);
        const get = store.get(id);
        get.onsuccess = () => {
          const rec = get.result as QueuedMutation;
          if (!rec) {
            resolve();
            return;
          }
          Object.assign(rec, patch);
          const put = store.put(rec);
          put.onsuccess = () => resolve();
          put.onerror = () => reject(put.error);
        };
        get.onerror = () => reject(get.error);
      }),
  );
}

export function deleteQueue(id: number): Promise<void> {
  return tx(QUEUE_STORE, "readwrite", (s) => s.delete(id)).then(() => undefined);
}

export function clearQueue(): Promise<void> {
  return tx(QUEUE_STORE, "readwrite", (s) => s.clear()).then(() => undefined);
}

export function getMeta<T>(key: string): Promise<T | undefined> {
  return tx(META_STORE, "readonly", (s) => s.get(key)).then((v) => (v ? (v as { key: string; value: T }).value : undefined));
}

export function setMeta<T>(key: string, value: T): Promise<void> {
  return tx(META_STORE, "readwrite", (s) => s.put({ key, value })).then(() => undefined);
}