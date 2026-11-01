import type { LibraryDocument } from "./types";
import {
  createLibraryDocument,
  importLibraryDocument,
  sortLibraries,
} from "./tree";

/**
 * One IndexedDB record per library JSON document.
 *
 * Library documents are user data. They must survive app updates and
 * service-worker updates. This module never calls `clear` or
 * `indexedDB.deleteDatabase`. Renames and edits `put` the same id.
 * Import always inserts a new id beside the libraries already stored.
 * A record is removed only when the user confirms Delete on that library.
 */
const DB_NAME = "antiprism-gui";
const DB_VERSION = 1;
const STORE = "libraries";

let dbPromise: Promise<IDBDatabase> | null = null;
let loadPromise: Promise<LibraryDocument[]> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      // Add stores if a future version needs them. Never delete or
      // recreate `libraries`: that would destroy user JSON.
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error("Could not open library storage"));
    };
  });
  return dbPromise;
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        let request: IDBRequest<T> | void;
        try {
          request = run(store);
        } catch (error) {
          reject(error);
          return;
        }
        tx.oncomplete = () => resolve(request?.result as T | undefined);
        tx.onerror = () => reject(tx.error ?? new Error("Library storage failed"));
        tx.onabort = () => reject(tx.error ?? new Error("Library storage aborted"));
      }),
  );
}

async function readAll(): Promise<LibraryDocument[]> {
  const rows = await withStore<LibraryDocument[]>("readonly", (store) => store.getAll());
  return sortLibraries(rows ?? []);
}

/** Insert or replace one library document in place. */
export async function saveLibrary(doc: LibraryDocument): Promise<void> {
  if (!doc?.id || doc.format !== "antiprism-library") {
    throw new Error("Refusing to write an invalid library");
  }
  await withStore("readwrite", (store) => {
    store.put(doc);
  });
}

/** Remove one library the user confirmed deleting. Other libraries stay. */
export async function removeLibraryRecord(id: string): Promise<void> {
  if (!id) throw new Error("Library not found");
  await withStore("readwrite", (store) => {
    store.delete(id);
  });
}

async function ensureLibraries(): Promise<LibraryDocument[]> {
  const existing = await readAll();
  if (existing.length > 0) return existing;
  const doc = createLibraryDocument("MyLibrary", [], { pinned: true });
  await saveLibrary(doc);
  return [doc];
}

/** Load every library, creating MyLibrary the first time the store is empty. */
export function loadLibraries(): Promise<LibraryDocument[]> {
  if (!loadPromise) {
    loadPromise = ensureLibraries().finally(() => {
      loadPromise = null;
    });
  }
  return loadPromise;
}

export async function readLibraryFile(file: File, existingNames: string[]): Promise<LibraryDocument> {
  const text = await file.text();
  return importLibraryDocument(text, existingNames);
}
