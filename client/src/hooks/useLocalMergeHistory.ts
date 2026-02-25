import { useState, useCallback, useEffect } from 'react';
import { useStore } from '../store/useStore';
import {
  getAllMerges,
  getMerge,
  saveMerge as saveMergeStorage,
  deleteMerge as deleteMergeStorage,
  getTotalSize,
  clearAllMerges,
  type LocalMergeSummary,
  type LocalMergeMeta,
} from '../lib/localMergeStore';

/**
 * Hook für lokale Merge-Dateien (IndexedDB).
 * - merges/totalSize laden
 * - saveMerge, downloadMerge, deleteMerge, clearAll
 * - Aktualisiert sich, wenn localMergeVersion sich ändert (neuer Merge im Browser gespeichert)
 */
export function useLocalMergeHistory() {
  const localMergeVersion = useStore((s) => s.localMergeVersion);
  const [merges, setMerges] = useState<LocalMergeSummary[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [list, size] = await Promise.all([getAllMerges(), getTotalSize()]);
      setMerges(list);
      setTotalSize(size);
    } catch {
      setMerges([]);
      setTotalSize(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Wenn woanders eine Datei in IndexedDB gespeichert wurde (z. B. nach Merge), Liste neu laden
  useEffect(() => {
    if (localMergeVersion > 0) void refresh();
  }, [localMergeVersion, refresh]);

  const saveMerge = useCallback(
    async (file: Blob, meta: LocalMergeMeta) => {
      setActionLoading(true);
      try {
        await saveMergeStorage(file, meta);
        await refresh();
      } catch {
        // Fallback: app continues
      } finally {
        setActionLoading(false);
      }
    },
    [refresh],
  );

  const downloadMerge = useCallback(async (id: string) => {
    setActionLoading(true);
    try {
      const record = await getMerge(id);
      if (!record) return;
      const url = URL.createObjectURL(record.blob);
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = record.filename;
        a.click();
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      // e.g. IDB not available
    } finally {
      setActionLoading(false);
    }
  }, []);

  const deleteMerge = useCallback(
    async (id: string) => {
      setActionLoading(true);
      try {
        await deleteMergeStorage(id);
        await refresh();
      } catch {
        // ignore
      } finally {
        setActionLoading(false);
      }
    },
    [refresh],
  );

  const clearAll = useCallback(async () => {
    setActionLoading(true);
    try {
      await clearAllMerges();
      await refresh();
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  }, [refresh]);

  const hasLocalBlob = useCallback((id: string) => merges.some((m) => m.id === id), [merges]);

  return {
    merges,
    totalSize,
    loading,
    actionLoading,
    saveMerge,
    downloadMerge,
    deleteMerge,
    clearAll,
    hasLocalBlob,
    refresh,
  };
}
