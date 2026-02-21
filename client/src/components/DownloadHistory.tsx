import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import type { HistoryEntry } from 'shared';
import { useT } from '../i18n';
import { useLocalMergeHistory } from '../hooks/useLocalMergeHistory';

// Drag-Daten-Format für History → FileList
export const HISTORY_DRAG_TYPE = 'application/x-eXmerg-history';

const STORAGE_KEY  = 'mergeHistory_v1';
const HISTORY_MAX  = 10;
const HISTORY_TTL  = 30 * 60 * 1000; // 30 Min – wie Server-TTL

// ── localStorage-Helfer ───────────────────────────────────────────────────────

export function getLocalHistory(): HistoryEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as HistoryEntry[];
    // Nur Einträge innerhalb der TTL zurückgeben
    return raw.filter((e) => Date.now() - e.timestamp < HISTORY_TTL).slice(-HISTORY_MAX).reverse();
  } catch { return []; }
}

export function addToLocalHistory(entry: HistoryEntry): void {
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as HistoryEntry[];
    const fresh = existing.filter((e) => Date.now() - e.timestamp < HISTORY_TTL);
    fresh.push(entry);
    if (fresh.length > HISTORY_MAX) fresh.splice(0, fresh.length - HISTORY_MAX);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  } catch { /* localStorage nicht verfügbar */ }
}

/** Verlaufsliste im localStorage leeren (Einträge + Metadaten). */
export function clearLocalHistory(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '[]');
  } catch { /* ignore */ }
}

/** Einzelnen Verlaufseintrag aktualisieren (z. B. size nach Blob-Download). */
export function updateLocalHistoryEntry(id: string, patch: Partial<HistoryEntry>): void {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as HistoryEntry[];
    const entry = raw.find((e) => e.id === id);
    if (entry) {
      Object.assign(entry, patch);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
    }
  } catch { /* ignore */ }
}

// ── Komponente ────────────────────────────────────────────────────────────────

function timeAgo(t: (key: string, vars?: Record<string, number>) => string, ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 5)  return t('history.justNow');
  if (sec < 60) return t('history.secAgo', { n: sec });
  if (sec < 3600) return t('history.minAgo', { n: Math.floor(sec / 60) });
  return t('history.hourAgo', { n: Math.floor(sec / 3600) });
}

function formatStorageSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DownloadHistory() {
  const t = useT();
  const historyVersion = useStore((s) => s.historyVersion);
  const bumpHistory = useStore((s) => s.bumpHistory);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const {
    totalSize,
    loading: idbLoading,
    actionLoading,
    hasLocalBlob,
    downloadMerge,
    deleteMerge,
    clearAll,
  } = useLocalMergeHistory();

  // Verlauf aus localStorage laden – bei jedem Merge-Bump aktualisieren
  useEffect(() => {
    setEntries(getLocalHistory());
  }, [historyVersion]);

  const handleDelete = async (id: string) => {
    await deleteMerge(id);
  };
  /** Gesamten Verlauf löschen: IndexedDB + Verlaufsliste (localStorage). */
  const handleClearEntireHistory = async () => {
    await clearAll();
    clearLocalHistory();
    setEntries([]);
    bumpHistory();
  };

  if (entries.length === 0) return null;

  return (
    <div className="space-y-2 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-xs font-medium text-zinc-600 uppercase tracking-wide">{t('history.title')}</span>
        <div className="h-px flex-1 bg-zinc-300 dark:bg-surface-700" />
        <span className="text-xs text-zinc-500 dark:text-zinc-700">{entries.length} {entries.length === 1 ? t('history.entry') : t('history.entries')}</span>
      </div>

      <p className="text-[11px] text-zinc-500 dark:text-zinc-600 leading-snug">
        {t('history.privacy')}
      </p>

      {/* Speicheranzeige + Clear */}
      {!idbLoading && totalSize >= 0 && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[11px] text-zinc-500 dark:text-zinc-600">
            {t('history.storageUsed', { size: formatStorageSize(totalSize) })}
          </span>
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearEntireHistory}
              disabled={actionLoading}
              className="text-[11px] text-zinc-500 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-50"
            >
              {t('history.clearEntire')}
            </button>
          </span>
        </div>
      )}

      {/* Liste */}
      <ul className="space-y-1.5">
        {entries.map((entry) => {
          const serverDownloadUrl =
            `/api/download?id=${encodeURIComponent(entry.fileId)}` +
            `&name=${encodeURIComponent(entry.filename)}` +
            (entry.isOds ? '&fmt=ods' : '');
          const hasLocal = hasLocalBlob(entry.id);

          const ext = entry.filename.split('.').pop()?.toLowerCase() ?? 'xlsx';
          const extColor = ext === 'ods'
            ? 'bg-sky-500/15 text-sky-400 border-sky-500/20'
            : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';

          return (
            <li
              key={entry.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(HISTORY_DRAG_TYPE, JSON.stringify(entry));
                e.dataTransfer.effectAllowed = 'copy';
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-zinc-100 dark:bg-surface-800 border border-zinc-300 dark:border-surface-600 group hover:border-zinc-400 dark:hover:border-surface-500 transition-colors cursor-grab active:cursor-grabbing"
            >
              {/* Format-Badge */}
              <span className={`badge border shrink-0 ${extColor}`}>{ext}</span>

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-zinc-700 dark:text-zinc-300 truncate">{entry.filename}</div>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="text-xs text-zinc-500 dark:text-zinc-600">{timeAgo(t, entry.timestamp)}</span>
                  <span className="text-zinc-500 dark:text-zinc-700">·</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-600">
                    {entry.fileCount} {entry.fileCount === 1 ? t('history.file') : t('history.files')}
                  </span>
                  {entry.size != null && entry.size >= 0 && (
                    <>
                      <span className="text-zinc-500 dark:text-zinc-700">·</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-600">{formatStorageSize(entry.size)}</span>
                    </>
                  )}
                  <span className="text-zinc-500 dark:text-zinc-700">·</span>
                  <span className="badge bg-zinc-200 dark:bg-surface-700 text-zinc-600 dark:text-zinc-500 border-zinc-300 dark:border-surface-600 text-[10px]">
                    {t(`mode.${entry.mode}` as 'mode.one_file_per_sheet') || entry.mode}
                  </span>
                </div>
              </div>

              {/* Erneut herunterladen: lokal (IndexedDB) oder Server-Link */}
              {hasLocal ? (
                <button
                  type="button"
                  onClick={() => downloadMerge(entry.id)}
                  disabled={actionLoading}
                  className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium
                    bg-zinc-200 dark:bg-surface-700 text-zinc-600 dark:text-zinc-400 border border-zinc-400 dark:border-surface-500
                    hover:bg-zinc-300 dark:hover:bg-surface-600 hover:text-zinc-800 dark:hover:text-zinc-200 hover:border-zinc-500
                    transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  title={t('history.downloadTitle')}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span className="hidden sm:inline">{t('history.downloadTitle')}</span>
                </button>
              ) : (
                <a
                  href={serverDownloadUrl}
                  download={entry.filename}
                  className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium
                    bg-zinc-200 dark:bg-surface-700 text-zinc-600 dark:text-zinc-400 border border-zinc-400 dark:border-surface-500
                    hover:bg-zinc-300 dark:hover:bg-surface-600 hover:text-zinc-800 dark:hover:text-zinc-200 hover:border-zinc-500
                    transition-colors opacity-0 group-hover:opacity-100"
                  title={t('history.downloadTitle')}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span className="hidden sm:inline">{t('history.download')}</span>
                </a>
              )}

              {/* Löschen (nur wenn lokal vorhanden) */}
              {hasLocal && (
                <button
                  type="button"
                  onClick={() => handleDelete(entry.id)}
                  disabled={actionLoading}
                  className="shrink-0 flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium
                    bg-zinc-200 dark:bg-surface-700 text-zinc-500 dark:text-zinc-500 border border-zinc-400 dark:border-surface-500
                    hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 hover:border-red-500/30
                    transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  title={t('history.delete')}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4m1 4h6M4 7h16" />
                  </svg>
                  <span className="hidden sm:inline">{t('history.delete')}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
