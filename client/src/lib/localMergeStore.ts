/**
 * IndexedDB-Persistenz für Merge-Ergebnisse (Blobs).
 * Ermöglicht erneuten Download aus dem Verlauf ohne Server.
 * Bei Fehlern (z. B. privates Fenster): Fallback, App läuft weiter.
 */

import type { MergeOptions } from 'shared';

const DB_NAME = 'exmerg-local-files';
const STORE_NAME = 'merges';
const DB_VERSION = 1;

export interface LocalMergeMeta {
  id: string;
  filename: string;
  mergeOptions: MergeOptions;
  createdAt?: number;
}

export interface LocalMergeRecord extends LocalMergeMeta {
  blob: Blob;
  size: number;
  createdAt: number;
}

/** Für Listen ohne Blob (spart Speicher beim Iterieren). */
export interface LocalMergeSummary {
  id: string;
  filename: string;
  size: number;
  createdAt: number;
  mergeOptions: MergeOptions;
}

let dbInstance: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbOpenPromise) return dbOpenPromise;
  dbOpenPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        dbInstance = req.result;
        resolve(dbInstance);
      };
      req.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    } catch {
      resolve(null);
    }
  });
  return dbOpenPromise;
}

function getStore(mode: IDBTransactionMode): Promise<IDBObjectStore | null> {
  return openDB().then((db) => {
    if (!db) return null;
    return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
  });
}

/**
 * Speichert ein Merge-Ergebnis (Blob + Metadaten).
 */
export async function saveMerge(file: Blob, meta: LocalMergeMeta): Promise<void> {
  const store = await getStore('readwrite');
  if (!store) return;
  try {
    const record: LocalMergeRecord = {
      id: meta.id,
      filename: meta.filename,
      blob: file,
      size: file.size,
      createdAt: meta.createdAt ?? Date.now(),
      mergeOptions: meta.mergeOptions,
    };
    await new Promise<void>((resolve, reject) => {
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // still work without IndexedDB
  }
}

/**
 * Alle gespeicherten Merges (ohne Blob für Listen).
 */
export async function getAllMerges(): Promise<LocalMergeSummary[]> {
  const store = await getStore('readonly');
  if (!store) return [];
  try {
    const list = await new Promise<LocalMergeRecord[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    });
    return list.map(({ blob: _b, ...rest }) => rest);
  } catch {
    return [];
  }
}

/**
 * Ein Merge inkl. Blob (für Download).
 */
export async function getMerge(id: string): Promise<LocalMergeRecord | null> {
  const store = await getStore('readonly');
  if (!store) return null;
  try {
    return await new Promise<LocalMergeRecord | null>((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * Ein Merge löschen.
 */
export async function deleteMerge(id: string): Promise<void> {
  const store = await getStore('readwrite');
  if (!store) return;
  try {
    await new Promise<void>((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore
  }
}

/**
 * Gesamtgröße aller gespeicherten Blobs in Bytes.
 */
export async function getTotalSize(): Promise<number> {
  const list = await getAllMerges();
  return list.reduce((sum, m) => sum + m.size, 0);
}

/**
 * Alle lokalen Merge-Dateien löschen.
 */
export async function clearAllMerges(): Promise<void> {
  const store = await getStore('readwrite');
  if (!store) return;
  try {
    await new Promise<void>((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore
  }
}
