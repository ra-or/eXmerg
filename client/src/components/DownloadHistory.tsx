import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import type { HistoryEntry } from 'shared';
import { useT } from '../i18n';

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

// ── Komponente ────────────────────────────────────────────────────────────────

function timeAgo(t: (key: string, vars?: Record<string, number>) => string, ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 5)  return t('history.justNow');
  if (sec < 60) return t('history.secAgo', { n: sec });
  if (sec < 3600) return t('history.minAgo', { n: Math.floor(sec / 60) });
  return t('history.hourAgo', { n: Math.floor(sec / 3600) });
}

export function DownloadHistory() {
  const t = useT();
  const historyVersion = useStore((s) => s.historyVersion);
  const addHistoryFile = useStore((s) => s.addHistoryFile);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  // Verlauf aus localStorage laden – bei jedem Merge-Bump aktualisieren
  useEffect(() => {
    setEntries(getLocalHistory());
  }, [historyVersion]);

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

      {/* Liste */}
      <ul className="space-y-1.5">
        {entries.map((entry) => {
          const downloadUrl =
            `/api/download?id=${encodeURIComponent(entry.fileId)}` +
            `&name=${encodeURIComponent(entry.filename)}` +
            (entry.isOds ? '&fmt=ods' : '');

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
                  <span className="text-zinc-500 dark:text-zinc-700">·</span>
                  <span className="badge bg-zinc-200 dark:bg-surface-700 text-zinc-600 dark:text-zinc-500 border-zinc-300 dark:border-surface-600 text-[10px]">
                    {t(`mode.${entry.mode}` as 'mode.one_file_per_sheet') || entry.mode}
                  </span>
                </div>
              </div>

              {/* Als Quelle hinzufügen */}
              <button
                type="button"
                onClick={() => addHistoryFile(entry)}
                className="shrink-0 flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium
                  bg-zinc-200 dark:bg-surface-700 text-zinc-600 dark:text-zinc-500 border border-zinc-400 dark:border-surface-500
                  hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/30
                  transition-colors opacity-0 group-hover:opacity-100"
                title={t('history.addSourceTitle')}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">{t('history.addAsSource')}</span>
              </button>

              {/* Download-Button */}
              <a
                href={downloadUrl}
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
