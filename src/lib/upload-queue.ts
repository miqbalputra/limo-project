export type QueuedUpload = { questionId: string; file: File };

type QueueRecord = {
  id: string;
  key: string;
  questionId: string;
  name: string;
  type: string;
  lastModified: number;
  blob: Blob;
};

const DB_NAME = "limo-upload-queue";
const DB_VERSION = 1;
const STORE = "uploads";

function recordId(key: string, questionId: string) {
  return `${key}::${questionId}`;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("key", "key", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

export async function loadQueuedUploads(key: string): Promise<QueuedUpload[]> {
  const db = await openDb();
  if (!db) return [];

  try {
    return await new Promise<QueuedUpload[]>((resolve) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).index("key").getAll(key);
      request.onsuccess = () => {
        const records = (request.result as QueueRecord[]) ?? [];
        resolve(records.map((record) => ({
          questionId: record.questionId,
          file: new File([record.blob], record.name, { type: record.type, lastModified: record.lastModified }),
        })));
      };
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  } finally {
    db.close();
  }
}

export async function saveQueuedUpload(key: string, questionId: string, file: File): Promise<void> {
  const db = await openDb();
  if (!db) return;

  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ id: recordId(key, questionId), key, questionId, name: file.name, type: file.type, lastModified: file.lastModified, blob: file } satisfies QueueRecord);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    // IndexedDB tidak tersedia (mode privat/CSP) — antrean tetap berjalan di memori.
  } finally {
    db.close();
  }
}

export async function removeQueuedUpload(key: string, questionId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;

  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(recordId(key, questionId));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    // abaikan
  } finally {
    db.close();
  }
}

export async function clearQueuedUploads(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;

  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const request = store.index("key").getAllKeys(key);
      request.onsuccess = () => {
        for (const id of request.result as IDBValidKey[]) store.delete(id);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    // abaikan
  } finally {
    db.close();
  }
}
